// Live leaderboard state. Subscribes to every player's score file in the
// workspace (so a friend's new game shows up in real time via the CRDT), parses
// them, and verifies each run in the background. Verification is cached by runId
// and never blocks the UI — an entry shows as "checking…" until its verdict lands.

import { useEffect, useRef, useState } from 'react'
import { idFromScorePath, parseScoreFile, SCORES_DIR, type ScoreRecord } from './records'
import { verifyRun, type Verdict } from './verify'

export interface Entry {
  rec: ScoreRecord
  verdict: Verdict | null
  fileId: string
}

interface Sub {
  text: GtText
  handler: () => void
}

export function useLeaderboard(): { entries: Entry[] } {
  const [, force] = useState(0)
  const rerender = () => force((n) => n + 1)

  const recordsRef = useRef(new Map<string, ScoreRecord[]>()) // path -> records
  const verdictsRef = useRef(new Map<string, Verdict>()) // runId -> verdict
  const subsRef = useRef(new Map<string, Sub>()) // path -> subscription
  const inflightRef = useRef(new Set<string>()) // runIds being verified

  useEffect(() => {
    const gt = window.gt
    // Capture the stable ref containers so the cleanup closes over the same
    // objects (they're created once via useRef; their identity never changes).
    const records = recordsRef.current
    const verdicts = verdictsRef.current
    const subs = subsRef.current
    const inflight = inflightRef.current

    const runVerifications = () => {
      for (const [path, recs] of records) {
        const fileId = idFromScorePath(path)
        if (!fileId) continue
        for (const rec of recs) {
          if (verdicts.has(rec.runId) || inflight.has(rec.runId)) continue
          inflight.add(rec.runId)
          verifyRun(rec, fileId)
            .then((v) => verdicts.set(rec.runId, v))
            .catch(() =>
              verdicts.set(rec.runId, { status: 'error', suspicious: false, reason: 'verify-threw' }),
            )
            .finally(() => {
              inflight.delete(rec.runId)
              rerender()
            })
        }
      }
    }

    const reparse = (path: string) => {
      const sub = subs.get(path)
      if (!sub) return
      records.set(path, parseScoreFile(sub.text.toString()))
      runVerifications()
      rerender()
    }

    const subscribe = (path: string) => {
      if (subs.has(path)) return
      const text = gt.subscribeFile(path)
      const handler = () => reparse(path)
      text.observe(handler)
      subs.set(path, { text, handler })
      records.set(path, parseScoreFile(text.toString()))
    }

    const unsubscribe = (path: string) => {
      const sub = subs.get(path)
      if (!sub) return
      sub.text.unobserve(sub.handler)
      gt.unsubscribeFile(path)
      subs.delete(path)
      records.delete(path)
    }

    const stop = gt.watchFiles((paths) => {
      const wanted = new Set(paths.filter((p) => p.startsWith(SCORES_DIR) && p.endsWith('.jsonl')))
      for (const p of wanted) subscribe(p)
      for (const p of [...subs.keys()]) if (!wanted.has(p)) unsubscribe(p)
      runVerifications()
      rerender()
    })

    return () => {
      stop()
      for (const p of [...subs.keys()]) unsubscribe(p)
    }
  }, [])

  // Flatten current records into entries (deduped by runId across files).
  const entries: Entry[] = []
  const seen = new Set<string>()
  for (const [path, recs] of recordsRef.current) {
    const fileId = idFromScorePath(path) ?? ''
    for (const rec of recs) {
      if (seen.has(rec.runId)) continue
      seen.add(rec.runId)
      entries.push({ rec, fileId, verdict: verdictsRef.current.get(rec.runId) ?? null })
    }
  }
  return { entries }
}
