// The Tetris engine: a deterministic state machine driven only by input events
// and a fixed-frame clock. Two consumers use it identically — the live game loop
// (game/loop.ts) and the headless verifier (board/verify.ts) — so a game plays
// and re-simulates to exactly the same score.
//
// Contract: feed all events for frame N via applyEvent(), then call tick() once
// to advance through frame N. Never read the wall clock or Math.random here.

import { cellsOf, COLS, kicksFor, spawnX } from './pieces'
import { clearLines, fits, makeGrid, newBag, stamp } from './board'
import { Prng } from './prng'
import type { Action, ActivePiece, GameResult, GameState, PieceType, Rotation } from './types'

// Tuning (all in logical frames at 60 fps).
const DAS = 10 // frames before auto-repeat kicks in
const ARR = 2 // frames between auto-repeat moves
const LOCK_DELAY = 30 // frames a resting piece waits before locking
const MAX_LOCK_RESETS = 15 // move/rotate resets allowed before forced lock
const SOFT_DROP_GRAVITY = 0.5 // cells/frame floor while soft-dropping (2 frames/cell)
const QUEUE_MIN = 7 // keep at least this many upcoming pieces buffered
const LINE_BASE = [0, 100, 300, 500, 800] // score per cleared-line count, ×level

/** Gravity in cells/frame for a level, via the guideline time-per-row curve. */
function gravity(level: number): number {
  const L = Math.min(level, 20)
  const secPerRow = Math.pow(0.8 - (L - 1) * 0.007, L - 1)
  return 1 / (secPerRow * 60)
}

export class Engine {
  readonly state: GameState
  private rng: Prng

  constructor(seed: number) {
    this.rng = new Prng(seed)
    this.state = {
      grid: makeGrid(),
      cur: null,
      hold: null,
      holdUsed: false,
      queue: [],
      frame: 0,
      gameOver: false,
      score: 0,
      lines: 0,
      level: 1,
      combo: -1,
      b2b: false,
      held: { left: false, right: false, softDrop: false },
      dasDir: 0,
      dasTimer: 0,
      arrTimer: 0,
      gravityAcc: 0,
      lockTimer: -1,
      lockResets: 0,
      inputCount: 0,
    }
    this.refillQueue()
    this.spawn()
  }

  private refillQueue(): void {
    while (this.state.queue.length <= QUEUE_MIN) {
      this.state.queue.push(...newBag(this.rng))
    }
  }

  private place(type: PieceType): void {
    const s = this.state
    const piece: ActivePiece = { type, rot: 0, x: spawnX(type), y: 0 }
    s.cur = piece
    s.gravityAcc = 0
    s.lockTimer = -1
    s.lockResets = 0
    if (!fits(s.grid, piece)) s.gameOver = true // block out
  }

  private spawn(): void {
    const type = this.state.queue.shift()
    this.refillQueue()
    if (type === undefined) {
      this.state.gameOver = true
      return
    }
    this.state.holdUsed = false
    this.place(type)
  }

  private canMoveDown(): boolean {
    const p = this.state.cur
    if (!p) return false
    return fits(this.state.grid, { ...p, y: p.y + 1 })
  }

  /** Reset the lock delay after a successful move/rotate, up to the reset cap. */
  private touchLock(): void {
    const s = this.state
    if (s.lockTimer >= 0 && s.lockResets < MAX_LOCK_RESETS) {
      s.lockTimer = 0
      s.lockResets++
    }
  }

  private tryMove(dir: -1 | 1): boolean {
    const s = this.state
    if (!s.cur) return false
    const cand = { ...s.cur, x: s.cur.x + dir }
    if (!fits(s.grid, cand)) return false
    s.cur = cand
    this.touchLock()
    return true
  }

  private rotate(dir: -1 | 1): void {
    const s = this.state
    if (!s.cur) return
    const from = s.cur.rot
    const to = ((((from + dir) % 4) + 4) % 4) as Rotation
    for (const [dx, dy] of kicksFor(s.cur.type, from, to)) {
      const cand: ActivePiece = { type: s.cur.type, rot: to, x: s.cur.x + dx, y: s.cur.y + dy }
      if (fits(s.grid, cand)) {
        s.cur = cand
        this.touchLock()
        return
      }
    }
  }

  private hardDrop(): void {
    const s = this.state
    if (!s.cur) return
    let dropped = 0
    while (this.canMoveDown()) {
      s.cur = { ...s.cur, y: s.cur.y + 1 }
      dropped++
    }
    s.score += 2 * dropped
    this.lockPiece()
  }

  private hold(): void {
    const s = this.state
    if (!s.cur || s.holdUsed) return
    const cur = s.cur.type
    if (s.hold === null) {
      s.hold = cur
      this.spawn()
    } else {
      const swap = s.hold
      s.hold = cur
      this.place(swap)
    }
    s.holdUsed = true
  }

  private lockPiece(): void {
    const s = this.state
    if (!s.cur) return
    stamp(s.grid, s.cur)
    const cleared = clearLines(s.grid)
    if (cleared > 0) {
      const difficult = cleared === 4
      let lineScore = LINE_BASE[cleared]! * s.level
      if (difficult && s.b2b) lineScore = Math.floor(lineScore * 1.5)
      s.score += lineScore
      s.combo++
      if (s.combo > 0) s.score += 50 * s.combo * s.level
      s.b2b = difficult
      s.lines += cleared
      s.level = Math.min(20, 1 + Math.floor(s.lines / 10))
    } else {
      s.combo = -1 // combo breaks on a non-clearing lock; b2b is untouched
    }
    this.spawn()
  }

  /** Apply one input event. `down` is ignored for edge actions' key-up. */
  applyEvent(action: Action, down: boolean): void {
    const s = this.state
    if (s.gameOver) return
    if (down) s.inputCount++
    switch (action) {
      case 'left':
        if (down) {
          s.held.left = true
          s.dasDir = -1
          s.dasTimer = 0
          s.arrTimer = 0
          this.tryMove(-1)
        } else {
          s.held.left = false
          if (s.dasDir === -1) {
            s.dasDir = s.held.right ? 1 : 0
            s.dasTimer = 0
            s.arrTimer = 0
          }
        }
        break
      case 'right':
        if (down) {
          s.held.right = true
          s.dasDir = 1
          s.dasTimer = 0
          s.arrTimer = 0
          this.tryMove(1)
        } else {
          s.held.right = false
          if (s.dasDir === 1) {
            s.dasDir = s.held.left ? -1 : 0
            s.dasTimer = 0
            s.arrTimer = 0
          }
        }
        break
      case 'softDrop':
        s.held.softDrop = down
        break
      case 'rotCW':
        if (down) this.rotate(1)
        break
      case 'rotCCW':
        if (down) this.rotate(-1)
        break
      case 'hardDrop':
        if (down) this.hardDrop()
        break
      case 'hold':
        if (down) this.hold()
        break
    }
  }

  /** Advance one logical frame. */
  tick(): void {
    const s = this.state
    if (s.gameOver || !s.cur) {
      s.frame++
      return
    }

    // Horizontal auto-repeat (DAS → ARR).
    const dirHeld =
      (s.dasDir === -1 && s.held.left) || (s.dasDir === 1 && s.held.right) ? s.dasDir : 0
    if (dirHeld !== 0) {
      s.dasTimer++
      if (s.dasTimer >= DAS) {
        s.arrTimer++
        while (s.arrTimer >= ARR) {
          if (!this.tryMove(dirHeld)) break
          s.arrTimer -= ARR
        }
      }
    }

    // Gravity (with soft-drop floor). May traverse multiple cells at high level.
    const g = s.held.softDrop ? Math.max(gravity(s.level), SOFT_DROP_GRAVITY) : gravity(s.level)
    s.gravityAcc += g
    while (s.gravityAcc >= 1) {
      s.gravityAcc -= 1
      if (this.canMoveDown()) {
        s.cur = { ...s.cur, y: s.cur.y + 1 }
        if (s.held.softDrop) s.score++
      } else {
        s.gravityAcc = 0
        break
      }
    }

    // Lock delay.
    if (!this.canMoveDown()) {
      if (s.lockTimer < 0) s.lockTimer = 0
      else s.lockTimer++
      if (s.lockTimer >= LOCK_DELAY) this.lockPiece()
    } else {
      s.lockTimer = -1
    }

    s.frame++
  }

  /** The landing row (y) of the current piece, for the ghost preview. */
  ghostY(): number {
    const p = this.state.cur
    if (!p) return 0
    let y = p.y
    while (fits(this.state.grid, { ...p, y: y + 1 })) y++
    return y
  }

  result(): GameResult {
    const s = this.state
    return {
      score: s.score,
      lines: s.lines,
      level: s.level,
      frames: s.frame,
      topOut: s.gameOver,
      inputCount: s.inputCount,
    }
  }
}

// Re-export a couple of constants that the renderer needs.
export { cellsOf, COLS }
