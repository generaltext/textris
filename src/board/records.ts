// Score records and the files they live in. Layout (all relative to the app's
// data folder, versioned as v0/):
//   v0/scores/<pubkeyId>.jsonl   one signed record per game — single-writer per device
//   v0/replays/<runId>.txt       the full replayable input log for a run
// The signing key is device-local (localStorage), NOT a workspace file — see
// identity.ts for why. player.id is the device key's pubkeyId (names the file);
// player.gtUser is the account id (for the "you" highlight); player.name is the
// account name.

import { encodeReplay } from '~/engine/replay'
import type { GameResult, InputEvent } from '~/engine/types'
import { sha256Hex, sign } from './sign'
import type { Identity } from './identity'

export const SCORES_DIR = 'v0/scores/'
export const REPLAYS_DIR = 'v0/replays/'

export interface ScoreRecord {
  v: 1
  runId: string
  player: { id: string; name: string; gtUser?: string }
  /** 'daily-YYYY-MM-DD' (a shared, comparable seed) or 'free'. */
  mode: string
  seed: number
  score: number
  lines: number
  level: number
  frames: number
  inputCount: number
  /** ISO timestamp from the player's clock — a label, never trusted. */
  createdAt: string
  replayHash: string // 'sha256:<hex>'
  pubkey: JsonWebKey
  sig: string // base64, over the canonical record minus this field
}

export function scoreFilePath(pubkeyId: string): string {
  return `${SCORES_DIR}${pubkeyId}.jsonl`
}
export function replayFilePath(runId: string): string {
  return `${REPLAYS_DIR}${runId}.txt`
}

/** Extract the pubkeyId a score file claims to belong to, from its path. */
export function idFromScorePath(path: string): string | null {
  const m = path.match(/scores\/([a-f0-9]+)\.jsonl$/)
  return m ? m[1]! : null
}

/** A UTC day key + a stable seed derived from it, so every player worldwide gets
 *  the same daily piece sequence (directly comparable scores). */
export function dailyChallenge(date: Date = new Date()): { mode: string; seed: number } {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const key = `${y}-${m}-${d}`
  // Simple deterministic string hash → uint32 seed. Not security-sensitive.
  let h = 2166136261 >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return { mode: `daily-${key}`, seed: h >>> 0 }
}

/** A fresh random seed for a free-play game (a new game may use real randomness;
 *  only the *replay* must be deterministic, and it is — driven by this seed). */
export function freeSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! >>> 0
}

export function parseScoreFile(text: string): ScoreRecord[] {
  const out: ScoreRecord[] = []
  const seen = new Set<string>()
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const rec = JSON.parse(t) as ScoreRecord
      if (rec?.v === 1 && typeof rec.runId === 'string' && !seen.has(rec.runId)) {
        seen.add(rec.runId)
        out.push(rec)
      }
    } catch {
      // Skip a corrupt line; a merge can briefly split a JSON object across a
      // sync boundary, and we'd rather show the rest than throw the file away.
    }
  }
  return out
}

async function readFileOr(path: string, fallback: string): Promise<string> {
  try {
    return await window.gt.readFile(path)
  } catch {
    return fallback
  }
}

export interface SubmitInput {
  seed: number
  events: InputEvent[]
  result: GameResult
  mode: string
  playerName: string
  gtUserId?: string
}

/** Build, sign, and persist a run: writes the replay, then appends the signed
 *  summary to the player's own score file. Returns the stored record. */
export async function submitRun(identity: Identity, input: SubmitInput): Promise<ScoreRecord> {
  const replayText = encodeReplay(input.seed, input.events)
  const hashHex = await sha256Hex(replayText)
  const runId = hashHex.slice(0, 16)

  const player: ScoreRecord['player'] = { id: identity.pubkeyId, name: input.playerName }
  if (input.gtUserId) player.gtUser = input.gtUserId

  const payload = {
    v: 1 as const,
    runId,
    player,
    mode: input.mode,
    seed: input.seed >>> 0,
    score: input.result.score,
    lines: input.result.lines,
    level: input.result.level,
    frames: input.result.frames,
    inputCount: input.result.inputCount,
    createdAt: new Date().toISOString(),
    replayHash: `sha256:${hashHex}`,
    pubkey: identity.publicJwk,
  }
  const sig = await sign(payload, identity.privateKey)
  const record: ScoreRecord = { ...payload, sig }

  await window.gt.writeFile(replayFilePath(runId), replayText)
  const path = scoreFilePath(identity.pubkeyId)
  const current = await readFileOr(path, '')
  await window.gt.writeFile(path, current + JSON.stringify(record) + '\n')
  return record
}
