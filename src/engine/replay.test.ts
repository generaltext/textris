import { describe, expect, it } from 'vitest'
import { decodeReplay, encodeReplay } from './replay'
import { simulate } from './simulate'
import { Prng } from './prng'
import type { Action, InputEvent } from './types'

function plan(seed: number, frames: number): InputEvent[] {
  const r = new Prng(seed)
  const actions: Action[] = ['left', 'right', 'softDrop', 'rotCW', 'rotCCW', 'hardDrop', 'hold']
  const events: InputEvent[] = []
  for (let f = 0; f < frames; f++) {
    if (r.next() < 0.2) {
      const a = actions[r.int(actions.length)]!
      events.push({ f, a, down: true })
      if (a === 'left' || a === 'right' || a === 'softDrop') {
        events.push({ f: f + 1 + r.int(5), a, down: false })
      }
    }
  }
  events.sort((p, q) => p.f - q.f)
  return events
}

describe('replay encode/decode', () => {
  it('round-trips the seed and every event', () => {
    const events = plan(31, 3000)
    const { seed, events: back } = decodeReplay(encodeReplay(555, events))
    expect(seed).toBe(555)
    expect(back).toEqual(events)
  })

  it('a decoded replay simulates to the same result as the original log', () => {
    const seed = 909090
    const events = plan(77, 5000)
    const original = simulate(seed, events)
    const decoded = decodeReplay(encodeReplay(seed, events))
    const roundTripped = simulate(decoded.seed, decoded.events)
    expect(roundTripped).toEqual(original)
  })

  it('rejects a malformed header', () => {
    expect(() => decodeReplay('not a replay\n0:h')).toThrow()
  })

  it('skips unparseable event lines but keeps valid ones', () => {
    const { events } = decodeReplay('textris-replay v1 seed=1\n10:h\ngarbage\n20:x\n')
    expect(events).toEqual([
      { f: 10, a: 'hardDrop', down: true },
      { f: 20, a: 'rotCW', down: true },
    ])
  })
})
