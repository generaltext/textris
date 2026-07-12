// Verification: the reason the leaderboard is trustworthy. A record's score is
// never taken on faith. To accept it we (1) confirm the record is signed by the
// key its file claims, (2) confirm the replay hasn't been altered, and (3)
// re-simulate the replay from scratch and require it to reproduce the claimed
// score exactly. A fabricated number simply fails step 3.

import { decodeReplay } from '~/engine/replay'
import { simulate } from '~/engine/simulate'
import { pubkeyId, sha256Hex, verify as verifySig } from './sign'
import { replayFilePath, type ScoreRecord } from './records'

export type VerifyStatus = 'verified' | 'failed' | 'error'

export interface Verdict {
  status: VerifyStatus
  /** true when the run verifies but looks inhuman (bot-ish input rate). */
  suspicious: boolean
  reason?: string
}

/** Sustained inputs-per-second above this is flagged (not rejected) — a soft,
 *  advisory bot signal. Fast humans peak ~10-13/s; 20/s sustained is inhuman. */
const SUSPICIOUS_IPS = 20

function isSuspicious(rec: ScoreRecord): boolean {
  const seconds = rec.frames / 60
  if (seconds < 5) return false // too short to judge
  return rec.inputCount / seconds > SUSPICIOUS_IPS
}

async function readReplay(runId: string): Promise<string | null> {
  try {
    return await window.gt.readFile(replayFilePath(runId))
  } catch {
    return null
  }
}

/** Verify a single record against the file it came from (`expectedId`). */
export async function verifyRun(rec: ScoreRecord, expectedId: string): Promise<Verdict> {
  const fail = (reason: string): Verdict => ({ status: 'failed', suspicious: false, reason })

  // The record must belong to the file it's in, and its key must match its id.
  if (rec.player.id !== expectedId) return fail('id-does-not-match-file')
  if ((await pubkeyId(rec.pubkey)) !== rec.player.id) return fail('key-does-not-match-id')

  // The signature must cover the record (everything but `sig`).
  const { sig, ...payload } = rec
  if (!(await verifySig(payload, sig, rec.pubkey))) return fail('bad-signature')

  // The replay must exist and be untampered.
  const replayText = await readReplay(rec.runId)
  if (replayText === null) return { status: 'error', suspicious: false, reason: 'replay-missing' }
  if (`sha256:${await sha256Hex(replayText)}` !== rec.replayHash) return fail('replay-tampered')

  let decoded
  try {
    decoded = decodeReplay(replayText)
  } catch {
    return fail('replay-corrupt')
  }
  if (decoded.seed !== rec.seed) return fail('seed-mismatch')

  // The teeth: re-simulate and require an exact reproduction of the claim.
  const result = simulate(rec.seed, decoded.events)
  if (
    result.score !== rec.score ||
    result.lines !== rec.lines ||
    result.level !== rec.level ||
    result.frames !== rec.frames
  ) {
    return fail('score-not-reproducible')
  }

  return { status: 'verified', suspicious: isSuspicious(rec) }
}
