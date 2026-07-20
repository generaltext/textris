import { useMemo, useState } from 'react'
import { AlertTriangle, CircleHelp, Play, ShieldCheck, ShieldX } from 'lucide-react'
import ReplayViewer from '~/game/ReplayViewer'
import { decodeReplay } from '~/engine/replay'
import type { InputEvent } from '~/engine/types'
import { useLeaderboard, type Entry } from './use-leaderboard'
import { dailyChallenge, replayFilePath } from './records'

type Tab = 'daily' | 'free' | 'all'

function statusRank(e: Entry): number {
  const s = e.verdict?.status
  if (s === 'verified') return 0
  if (!e.verdict) return 1 // still checking
  if (s === 'error') return 2
  return 3 // failed
}

export default function Leaderboard({
  me,
  dark,
}: {
  me: { pubkeyId: string | null; gtUserId: string | undefined }
  dark: boolean
}) {
  const { entries } = useLeaderboard()
  const [tab, setTab] = useState<Tab>('daily')
  const [watching, setWatching] = useState<{
    seed: number
    events: InputEvent[]
    label: string
  } | null>(null)

  const todayMode = dailyChallenge().mode

  const shown = useMemo(() => {
    const filtered = entries.filter((e) => {
      if (tab === 'daily') return e.rec.mode === todayMode
      if (tab === 'free') return e.rec.mode === 'free'
      return true
    })
    return filtered.sort((a, b) => {
      const r = statusRank(a) - statusRank(b)
      if (r !== 0) return r
      return b.rec.score - a.rec.score
    })
  }, [entries, tab, todayMode])

  const openReplay = async (e: Entry) => {
    try {
      const text = await window.gt.readFile(replayFilePath(e.rec.runId))
      const { seed, events } = decodeReplay(text)
      setWatching({ seed, events, label: `${e.rec.player.name} · ${e.rec.score.toLocaleString()}` })
    } catch {
      // replay gone — nothing to watch
    }
  }

  let rank = 0

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-1.5">
        <TabBtn active={tab === 'daily'} onClick={() => setTab('daily')}>
          Today's Daily
        </TabBtn>
        <TabBtn active={tab === 'free'} onClick={() => setTab('free')}>
          Free play
        </TabBtn>
        <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
          All
        </TabBtn>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-[var(--gt-fg-3,#888)]"
           style={{ borderColor: 'var(--gt-border,#444)' }}>
          No games here yet. Play a round to get on the board.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--gt-border,#444)' }}>
          {shown.map((e, idx) => {
            const verified = e.verdict?.status === 'verified'
            if (verified) rank++
            // "(you)" tracks the account (so all your devices count), falling
            // back to this device's signing key when there's no account id.
            const mine =
              (!!me.gtUserId && e.rec.player.gtUser === me.gtUserId) ||
              (!!me.pubkeyId && e.rec.player.id === me.pubkeyId)
            const rowStyle: React.CSSProperties = {}
            if (mine) rowStyle.background = 'var(--gt-accent-soft,#3b82f622)'
            if (idx > 0) rowStyle.borderTop = '1px solid var(--gt-divider)'
            return (
              <li
                key={e.rec.runId}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                  verified ? '' : 'opacity-60'
                }`}
                style={rowStyle}
              >
                <span className="w-6 shrink-0 text-right font-bold tabular-nums text-[var(--gt-fg-3,#888)]">
                  {verified ? rank : '·'}
                </span>
                <StatusIcon e={e} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {e.rec.player.name}
                    {mine && <span className="ml-1.5 text-xs text-[var(--gt-fg-3,#888)]">(you)</span>}
                  </div>
                  <div className="text-xs text-[var(--gt-fg-3,#888)]">
                    {e.rec.lines} lines · level {e.rec.level}
                    {e.rec.mode.startsWith('daily-') && tab === 'all' && ' · daily'}
                    {e.verdict?.status === 'failed' && (
                      <span className="text-red-500"> · rejected: {e.verdict.reason}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-right font-bold tabular-nums">
                  {e.rec.score.toLocaleString()}
                </span>
                <button
                  onClick={() => openReplay(e)}
                  title="Watch this run"
                  className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-[var(--gt-bg-elev,#2226)]"
                  style={{ borderColor: 'var(--gt-border,#444)' }}
                >
                  <Play size={13} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {watching && (
        <ReplayViewer
          seed={watching.seed}
          events={watching.events}
          label={watching.label}
          dark={dark}
          onClose={() => setWatching(null)}
        />
      )}
    </div>
  )
}

function StatusIcon({ e }: { e: Entry }) {
  if (!e.verdict) return <CircleHelp size={16} className="shrink-0 text-[var(--gt-fg-3,#888)]" />
  if (e.verdict.status === 'verified') {
    return e.verdict.suspicious ? (
      <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-label="Verified but flagged as unusual" />
    ) : (
      <ShieldCheck size={16} className="shrink-0 text-green-500" aria-label="Verified" />
    )
  }
  if (e.verdict.status === 'error') {
    return <CircleHelp size={16} className="shrink-0 text-[var(--gt-fg-3,#888)]" aria-label="Replay unavailable" />
  }
  return <ShieldX size={16} className="shrink-0 text-red-500" aria-label="Failed verification" />
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-[var(--gt-accent,#3b82f6)] text-white' : 'text-[var(--gt-fg-2,#aaa)] hover:bg-[var(--gt-bg-elev,#2226)]'
      }`}
    >
      {children}
    </button>
  )
}
