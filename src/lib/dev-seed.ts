// Seed the "Try it live" demo with a few real, verifiable leaderboard entries so
// the board isn't empty. These aren't faked numbers — we generate throwaway
// keypairs, run scripted games through the actual engine, and submit them the
// same way a real player would. They pass verification because they're genuine
// (if unimpressive) games; the visitor can watch their replays and then beat them.

import { exportJwk, generateKeyPair, pubkeyId } from '~/board/sign'
import { dailyChallenge, submitRun } from '~/board/records'
import { simulate } from '~/engine/simulate'
import { Prng } from '~/engine/prng'
import type { Identity } from '~/board/identity'
import type { Action, InputEvent } from '~/engine/types'

async function throwawayIdentity(): Promise<Identity> {
  const pair = await generateKeyPair()
  const publicJwk = await exportJwk(pair.publicKey)
  return { pubkeyId: await pubkeyId(publicJwk), publicJwk, privateKey: pair.privateKey, name: '' }
}

// A deterministic bot: mostly shuffle-and-drop, so it survives a bit and racks up
// some hard-drop points. Not good Tetris — just a real game to fill the board.
function botPlan(seed: number, frames: number): InputEvent[] {
  const r = new Prng(seed)
  const moves: Action[] = ['left', 'right', 'rotCW', 'rotCCW']
  const events: InputEvent[] = []
  for (let f = 0; f < frames; f += 6 + r.int(10)) {
    // A short flurry of moves, then a hard drop.
    const shuffles = r.int(3)
    for (let i = 0; i < shuffles; i++) {
      const a = moves[r.int(moves.length)]!
      events.push({ f, a, down: true })
      if (a === 'left' || a === 'right') events.push({ f: f + 1, a, down: false })
    }
    events.push({ f: f + 2, a: 'hardDrop', down: true })
  }
  events.sort((p, q) => p.f - q.f)
  return events
}

export async function seedDemo(): Promise<void> {
  const gt = window.gt
  if (gt.mode !== 'demo') return
  const files = await gt.listFiles()
  if (files.length > 0) return

  const { mode, seed } = dailyChallenge()
  const bots = [
    { name: 'Tetra', s: 101 },
    { name: 'Blockwave', s: 202 },
    { name: 'Dropbot', s: 303 },
  ]
  for (const bot of bots) {
    const events = botPlan(bot.s, 6000)
    const result = simulate(seed, events)
    const id = await throwawayIdentity()
    await submitRun(id, { seed, events, result, mode, playerName: bot.name })
  }
}
