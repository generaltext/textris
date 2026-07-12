// Compact, human-legible plaintext encoding of an input log. This is the file
// that lives at v0/replays/<runId>.txt — the full record of a game, small enough
// (a few KB) to store as text and greppable enough to read by eye.
//
// Format:
//   textris-replay v1 seed=<n>
//   <frame>:<code>
//   ...
// One event per line. `code` is a single character (see CODES).

import type { Action, InputEvent } from './types'

export const REPLAY_VERSION = 1

// action + down → single char. Held actions use lower/upper for down/up; edge
// actions (rotate/hard-drop/hold) only ever emit `down`, so one char each.
const ENCODE: Record<string, string> = {
  'left:1': 'l',
  'left:0': 'L',
  'right:1': 'r',
  'right:0': 'R',
  'softDrop:1': 'd',
  'softDrop:0': 'D',
  'rotCW:1': 'x',
  'rotCCW:1': 'z',
  'hardDrop:1': 'h',
  'hold:1': 'c',
}

const DECODE: Record<string, { a: Action; down: boolean }> = {
  l: { a: 'left', down: true },
  L: { a: 'left', down: false },
  r: { a: 'right', down: true },
  R: { a: 'right', down: false },
  d: { a: 'softDrop', down: true },
  D: { a: 'softDrop', down: false },
  x: { a: 'rotCW', down: true },
  z: { a: 'rotCCW', down: true },
  h: { a: 'hardDrop', down: true },
  c: { a: 'hold', down: true },
}

export function encodeReplay(seed: number, events: readonly InputEvent[]): string {
  const lines = [`textris-replay v${REPLAY_VERSION} seed=${seed >>> 0}`]
  for (const ev of events) {
    const code = ENCODE[`${ev.a}:${ev.down ? 1 : 0}`]
    if (code) lines.push(`${ev.f}:${code}`)
  }
  return lines.join('\n') + '\n'
}

export interface DecodedReplay {
  seed: number
  events: InputEvent[]
}

/** Parse a replay file. Throws on a malformed header (a hard integrity failure);
 *  silently skips individual unparseable event lines. */
export function decodeReplay(text: string): DecodedReplay {
  const lines = text.split('\n')
  const header = lines[0]?.trim() ?? ''
  const m = header.match(/^textris-replay v(\d+) seed=(\d+)$/)
  if (!m) throw new Error('bad replay header')
  const seed = Number(m[2]) >>> 0
  const events: InputEvent[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const f = Number(line.slice(0, colon))
    const code = line.slice(colon + 1)
    const dec = DECODE[code]
    if (!Number.isFinite(f) || !dec) continue
    events.push({ f, a: dec.a, down: dec.down })
  }
  // Stable sort by frame so downstream simulation can assume ordering.
  events.sort((p, q) => p.f - q.f)
  return { seed, events }
}
