// Headless replay: run a whole game from its seed + input log and return the
// final result. This is the trust anchor of the leaderboard — a claimed score is
// only believed if simulate() reproduces it exactly.

import { Engine } from './engine'
import type { GameResult, InputEvent } from './types'

// Safety cap so a malformed log can never spin forever. A real human game is far
// under this (millions of frames = tens of thousands of seconds).
const FRAME_CAP = 20_000_000

/** Replay to the end (top-out) and return the derived result. Events must be
 *  sorted by frame ascending. */
export function simulate(seed: number, events: readonly InputEvent[]): GameResult {
  const e = new Engine(seed)
  let i = 0
  while (!e.state.gameOver && e.state.frame < FRAME_CAP) {
    const f = e.state.frame
    while (i < events.length && events[i]!.f === f) {
      const ev = events[i]!
      e.applyEvent(ev.a, ev.down)
      i++
    }
    // Skip any stale (out-of-order / past) events defensively.
    while (i < events.length && events[i]!.f < f) i++
    e.tick()
  }
  return e.result()
}

/** Step a game forward to a target frame, for watching a replay unfold. Returns
 *  the engine so the caller can render `engine.state` frame by frame. */
export function makeReplayEngine(seed: number): Engine {
  return new Engine(seed)
}

/** Advance an engine to `targetFrame`, applying any events due along the way.
 *  `cursor` is the index of the next unapplied event; returns the new cursor. */
export function advanceTo(
  e: Engine,
  events: readonly InputEvent[],
  cursor: number,
  targetFrame: number,
): number {
  let i = cursor
  while (!e.state.gameOver && e.state.frame < targetFrame) {
    const f = e.state.frame
    while (i < events.length && events[i]!.f === f) {
      const ev = events[i]!
      e.applyEvent(ev.a, ev.down)
      i++
    }
    while (i < events.length && events[i]!.f < f) i++
    e.tick()
  }
  return i
}

export type { GameResult }
