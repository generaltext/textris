import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { simulate } from './simulate'
import { Prng } from './prng'
import { clearLines, makeGrid } from './board'
import { cellsOf } from './pieces'
import { COLS, ROWS } from './pieces'
import type { Action, InputEvent, PieceType, Rotation } from './types'

// A deterministic pseudo-random input plan, so tests exercise real gameplay
// (moves, rotates, drops) rather than an empty board. Not the engine's PRNG —
// this only generates the *events* we then feed identically two ways.
function makePlan(seed: number, frames: number): InputEvent[] {
  const r = new Prng(seed)
  const actions: Action[] = ['left', 'right', 'softDrop', 'rotCW', 'rotCCW', 'hardDrop', 'hold']
  const events: InputEvent[] = []
  for (let f = 0; f < frames; f++) {
    if (r.next() < 0.15) {
      const a = actions[r.int(actions.length)]!
      // Held actions get a matching up a few frames later; edge actions are down-only.
      const held = a === 'left' || a === 'right' || a === 'softDrop'
      events.push({ f, a, down: true })
      if (held) events.push({ f: f + 1 + r.int(6), a, down: false })
    }
  }
  events.sort((p, q) => p.f - q.f)
  return events
}

describe('shapes', () => {
  it('every piece/rotation has exactly 4 in-box cells', () => {
    for (let t = 0 as PieceType; t <= 6; t = (t + 1) as PieceType) {
      for (let rot = 0 as Rotation; rot <= 3; rot = (rot + 1) as Rotation) {
        const cells = cellsOf(t, rot)
        expect(cells).toHaveLength(4)
        for (const [x, y] of cells) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(4)
          expect(y).toBeLessThan(4)
        }
      }
    }
  })
})

describe('clearLines', () => {
  it('clears full rows and shifts the stack down', () => {
    const grid = makeGrid()
    const bottom = ROWS - 1
    // Fill the bottom row completely, and put one block just above it.
    for (let x = 0; x < COLS; x++) grid[bottom * COLS + x] = 1
    grid[(bottom - 1) * COLS + 0] = 2
    const cleared = clearLines(grid)
    expect(cleared).toBe(1)
    // The lone block should have fallen to the bottom row, col 0.
    expect(grid[bottom * COLS + 0]).toBe(2)
    for (let x = 1; x < COLS; x++) expect(grid[bottom * COLS + x]).toBe(0)
  })

  it('clears multiple rows at once (a tetris)', () => {
    const grid = makeGrid()
    for (let y = ROWS - 4; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) grid[y * COLS + x] = 1
    }
    expect(clearLines(grid)).toBe(4)
    expect(grid.every((c) => c === 0)).toBe(true)
  })
})

describe('determinism', () => {
  it('an empty game (no input) tops out with score 0 in finite frames', () => {
    const res = simulate(1234, [])
    expect(res.topOut).toBe(true)
    expect(res.score).toBe(0)
    expect(res.frames).toBeGreaterThan(0)
    expect(res.frames).toBeLessThan(1_000_000)
  })

  it('same seed + same input log → identical result, every time', () => {
    for (const seed of [1, 2, 42, 7777]) {
      const plan = makePlan(seed, 6000)
      const a = simulate(seed, plan)
      const b = simulate(seed, plan)
      expect(a).toEqual(b)
    }
  })

  it('different seeds diverge', () => {
    const plan = makePlan(5, 4000)
    const a = simulate(100, plan)
    const b = simulate(200, plan)
    // Overwhelmingly likely to differ (different piece order). Guard the invariant.
    expect(a).not.toEqual(b)
  })
})

describe('live play reproduces under replay', () => {
  it('driving the engine frame-by-frame matches simulate() of the recorded log', () => {
    const seed = 24680
    const plan = makePlan(seed, 8000)

    // "Live" style: advance one frame at a time, applying that frame's events
    // before ticking — exactly what game/loop.ts does — recording as we go.
    const live = new Engine(seed)
    const recorded: InputEvent[] = []
    let i = 0
    while (!live.state.gameOver && live.state.frame < 1_000_000) {
      const f = live.state.frame
      while (i < plan.length && plan[i]!.f === f) {
        const ev = plan[i]!
        live.applyEvent(ev.a, ev.down)
        recorded.push({ f, a: ev.a, down: ev.down })
        i++
      }
      live.tick()
    }
    const liveResult = live.result()

    // Feeding the recorded log to the headless verifier must reproduce it exactly.
    const replayed = simulate(seed, recorded)
    expect(replayed).toEqual(liveResult)
  })
})
