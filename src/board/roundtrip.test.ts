// End-to-end test of the leaderboard's trust model, against an in-memory stand-in
// for window.gt. This is where the headline claim is proven: a genuine run
// verifies, and every way of faking a score is caught.

import { beforeEach, describe, expect, it } from 'vitest'
import { loadOrCreateIdentity } from './identity'
import { submitRun, type ScoreRecord } from './records'
import { verifyRun } from './verify'
import { sign } from './sign'
import { simulate } from '~/engine/simulate'
import { Prng } from '~/engine/prng'
import type { Action, InputEvent } from '~/engine/types'

// Minimal in-memory FileAPI: enough for submitRun (read/write) and verifyRun.
function installFakeGt() {
  const files = new Map<string, string>()
  const gt = {
    async readFile(p: string): Promise<string> {
      if (!files.has(p)) throw new Error(`no such file: ${p}`)
      return files.get(p)!
    },
    async writeFile(p: string, c: string): Promise<void> {
      files.set(p, c)
    },
    async user() {
      return { id: 'u1', name: 'Ada', email: 'ada@example.com' }
    },
  }
  ;(globalThis as unknown as { window: { gt: unknown } }).window = { gt }
  return files
}

function plan(seed: number, frames: number): InputEvent[] {
  const r = new Prng(seed)
  const actions: Action[] = ['left', 'right', 'rotCW', 'hardDrop', 'softDrop']
  const events: InputEvent[] = []
  for (let f = 0; f < frames; f++) {
    if (r.next() < 0.2) {
      const a = actions[r.int(actions.length)]!
      events.push({ f, a, down: true })
      if (a === 'left' || a === 'right' || a === 'softDrop') events.push({ f: f + 1, a, down: false })
    }
  }
  events.sort((p, q) => p.f - q.f)
  return events
}

async function playAndSubmit() {
  const identity = await loadOrCreateIdentity()
  const seed = 424242
  const events = plan(9, 6000)
  const result = simulate(seed, events)
  const rec = await submitRun(identity, { seed, events, result, mode: 'free', playerName: 'Ada' })
  return { identity, rec, result }
}

describe('leaderboard round-trip', () => {
  let files: Map<string, string>
  beforeEach(() => {
    files = installFakeGt()
  })

  it('a genuine run verifies', async () => {
    const { identity, rec } = await playAndSubmit()
    const verdict = await verifyRun(rec, identity.pubkeyId)
    expect(verdict.status).toBe('verified')
  })

  it('editing the score number breaks the signature', async () => {
    const { identity, rec } = await playAndSubmit()
    const tampered: ScoreRecord = { ...rec, score: rec.score + 100000 }
    const verdict = await verifyRun(tampered, identity.pubkeyId)
    expect(verdict.status).toBe('failed')
    expect(verdict.reason).toBe('bad-signature')
  })

  it('altering the stored replay is detected by the hash', async () => {
    const { identity, rec } = await playAndSubmit()
    const replayPath = `v0/replays/${rec.runId}.txt`
    files.set(replayPath, files.get(replayPath)! + '\n9999:h') // append a phantom input
    const verdict = await verifyRun(rec, identity.pubkeyId)
    expect(verdict.status).toBe('failed')
    expect(verdict.reason).toBe('replay-tampered')
  })

  it('a forged higher score, correctly re-signed, still fails re-simulation', async () => {
    const { identity, rec } = await playAndSubmit()
    // Cheater keeps their real key and real replay, but claims a bigger score and
    // re-signs so the signature is valid. The replay simply doesn't produce it.
    const forgedScore = rec.score + 50000
    const { sig: _old, ...rest } = rec
    const payload = { ...rest, score: forgedScore }
    const newSig = await sign(payload, identity.privateKey)
    const forged: ScoreRecord = { ...payload, sig: newSig }
    const verdict = await verifyRun(forged, identity.pubkeyId)
    expect(verdict.status).toBe('failed')
    expect(verdict.reason).toBe('score-not-reproducible')
  })

  it('a record placed in the wrong player file is rejected', async () => {
    const { rec } = await playAndSubmit()
    const verdict = await verifyRun(rec, 'someoneelsesid')
    expect(verdict.status).toBe('failed')
    expect(verdict.reason).toBe('id-does-not-match-file')
  })
})
