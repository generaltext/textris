// The live game loop. Owns the Engine and the frame clock, and — crucially —
// records every input event tagged with the exact logical frame it applied on.
// That recorded log is what gets signed and stored; feeding it back through
// simulate() reproduces this game bit-for-bit.
//
// Timing model: real elapsed time (performance.now) only decides HOW MANY fixed
// 60 Hz logical frames to advance. The simulation itself is purely frame-based,
// so a fast or slow display never changes the outcome.

import { Engine } from '~/engine/engine'
import type { Action, GameResult, InputEvent } from '~/engine/types'

const TICK_MS = 1000 / 60
const MAX_TICKS_PER_FRAME = 8 // clamp catch-up after a stall so it can't spiral

export interface GameOverInfo {
  seed: number
  events: InputEvent[]
  result: GameResult
}

export class GameRunner {
  readonly engine: Engine
  readonly seed: number
  readonly events: InputEvent[] = []
  paused = false

  onFrame?: (runner: GameRunner) => void
  onGameOver?: (info: GameOverInfo) => void

  private queue: { a: Action; down: boolean }[] = []
  private acc = 0
  private last = 0
  private raf = 0
  private running = false

  constructor(seed: number) {
    this.seed = seed >>> 0
    this.engine = new Engine(this.seed)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.last = performance.now() // don't accumulate the paused interval
  }

  /** Enqueue an input; it applies on the next logical tick. Ignored once over. */
  input(a: Action, down: boolean): void {
    if (this.engine.state.gameOver) return
    this.queue.push({ a, down })
  }

  private step(): void {
    const f = this.engine.state.frame
    if (this.queue.length) {
      for (const ev of this.queue) {
        this.engine.applyEvent(ev.a, ev.down)
        this.events.push({ f, a: ev.a, down: ev.down })
      }
      this.queue.length = 0
    }
    this.engine.tick()
  }

  private loop = (): void => {
    if (!this.running) return
    const now = performance.now()
    const elapsed = now - this.last
    this.last = now

    if (!this.paused && !this.engine.state.gameOver) {
      this.acc += elapsed
      let ticks = 0
      while (this.acc >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        this.step()
        this.acc -= TICK_MS
        ticks++
        if (this.engine.state.gameOver) break
      }
      if (ticks >= MAX_TICKS_PER_FRAME) this.acc = 0 // drop backlog after a stall
    }

    this.onFrame?.(this)

    if (this.engine.state.gameOver) {
      this.running = false
      this.onGameOver?.({ seed: this.seed, events: this.events, result: this.engine.result() })
      return
    }
    this.raf = requestAnimationFrame(this.loop)
  }
}
