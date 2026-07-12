import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, Dices, Loader2, Moon, Shield, Sun } from 'lucide-react'
import Game from '~/game/Game'
import Leaderboard from '~/board/Leaderboard'
import { useTheme } from '~/lib/use-theme'
import { loadOrCreateIdentity, renameIdentity, type Identity } from '~/board/identity'
import { dailyChallenge, freeSeed, submitRun } from '~/board/records'
import { seedDemo } from '~/lib/dev-seed'
import type { GameOverInfo } from '~/game/loop'

type View = { kind: 'menu' } | { kind: 'play'; seed: number; mode: string }

export default function App() {
  const { dark, canToggle, toggle } = useTheme()
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>({ kind: 'menu' })
  const [playerName, setPlayerName] = useState('Player')
  const [myId, setMyId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const identityRef = useRef<Identity | null>(null)
  const nameRef = useRef('Player')
  const userIdRef = useRef<string | undefined>(undefined)
  const runModeRef = useRef('free')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await window.gt.ready
      await seedDemo()
      const identity = await loadOrCreateIdentity()
      if (cancelled) return
      identityRef.current = identity
      setMyId(identity.pubkeyId)

      // Name resolution: a previously saved name wins; otherwise seed from the
      // account if it's reachable (it often isn't inside the web sandbox, where
      // gt.user() returns null), and persist it; otherwise a generic default the
      // player can edit.
      let name = identity.name
      const user = await window.gt.user().catch(() => null)
      userIdRef.current = user?.id
      if (!name && user?.name) {
        name = user.name
        await renameIdentity(name).catch(() => {})
      }
      if (!name) name = 'Player'
      if (cancelled) return
      nameRef.current = name
      setPlayerName(name)
      setReady(true)
    })().catch((err) => {
      console.error('[textris] init failed', err)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFinish = useCallback(async (info: GameOverInfo) => {
    const identity = identityRef.current
    if (!identity) return
    try {
      await submitRun(identity, {
        seed: info.seed,
        events: info.events,
        result: info.result,
        mode: runModeRef.current,
        playerName: nameRef.current,
        ...(userIdRef.current ? { gtUserId: userIdRef.current } : {}),
      })
    } catch (e) {
      console.error('[textris] submit failed', e)
    }
  }, [])

  const exitToMenu = useCallback(() => setView({ kind: 'menu' }), [])

  const startDaily = () => {
    const { seed, mode } = dailyChallenge()
    runModeRef.current = mode
    setView({ kind: 'play', seed, mode })
  }
  const startFree = () => {
    const seed = freeSeed()
    runModeRef.current = 'free'
    setView({ kind: 'play', seed, mode: 'free' })
  }

  const startEditName = () => {
    setNameDraft(playerName === 'Player' ? '' : playerName)
    setEditingName(true)
  }
  const saveName = async () => {
    const n = nameDraft.trim().slice(0, 24) || 'Player'
    nameRef.current = n
    setPlayerName(n)
    setEditingName(false)
    try {
      await renameIdentity(n)
    } catch {
      /* best-effort; the name still applies this session */
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="animate-spin text-[var(--gt-fg-3)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-5">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Logo />
          <span className="text-lg font-bold leading-none">Textris</span>
        </div>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-[var(--gt-fg-2)]">
          {view.kind === 'play' ? (view.mode === 'free' ? 'Free play' : 'Daily') : playerName}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          {view.kind === 'play' ? (
            <button
              onClick={exitToMenu}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm text-[var(--gt-fg-2)] transition-colors hover:bg-[var(--gt-bg-elev)]"
              style={{ borderColor: 'var(--gt-border)' }}
            >
              <ChevronLeft size={15} /> Quit
            </button>
          ) : (
            canToggle && (
              <button
                onClick={toggle}
                className="rounded-md border p-2 text-[var(--gt-fg-2)]"
                style={{ borderColor: 'var(--gt-border)' }}
                aria-label="Toggle theme"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )
          )}
        </div>
      </header>

      {view.kind === 'play' ? (
        <div className="flex flex-col items-center gap-4">
          <Game
            key={view.seed}
            seed={view.seed}
            dark={dark}
            onFinish={handleFinish}
            onExit={exitToMenu}
          />
        </div>
      ) : (
        <main className="flex flex-col gap-7">
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--gt-fg-3)]">
            {editingName ? (
              <>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  autoFocus
                  maxLength={24}
                  placeholder="Your name"
                  className="rounded-md border bg-transparent px-2 py-1 text-sm text-[var(--gt-fg)]"
                  style={{ borderColor: 'var(--gt-border)' }}
                />
                <button
                  onClick={saveName}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--gt-border)' }}
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span>
                  Playing as <span className="font-medium text-[var(--gt-fg)]">{playerName}</span>
                </span>
                <button onClick={startEditName} className="text-xs text-[var(--gt-accent)] hover:underline">
                  Edit
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeButton
              icon={<CalendarDays size={20} />}
              title="Daily Challenge"
              subtitle="Same pieces for everyone today"
              onClick={startDaily}
            />
            <ModeButton
              icon={<Dices size={20} />}
              title="Free Play"
              subtitle="A fresh random game"
              onClick={startFree}
            />
          </div>

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--gt-fg-2)]">
                Leaderboard
              </h2>
              <span className="flex items-center gap-1.5 text-xs text-[var(--gt-fg-3)]">
                <Shield size={12} /> Verified by replay
              </span>
            </div>
            <Leaderboard myId={myId} dark={dark} />
          </section>
        </main>
      )}
    </div>
  )
}

function ModeButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-[var(--gt-bg-elev)]"
      style={{ borderColor: 'var(--gt-border)' }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--gt-accent)]"
        style={{ background: 'var(--gt-accent-soft)' }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-tight">{title}</span>
        <span className="block text-xs text-[var(--gt-fg-3)]">{subtitle}</span>
      </span>
    </button>
  )
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--gt-accent)" aria-hidden>
      <rect x="9" y="5.5" width="6" height="6" rx="1" />
      <rect x="2.5" y="12" width="6" height="6" rx="1" />
      <rect x="9" y="12" width="6" height="6" rx="1" />
      <rect x="15.5" y="12" width="6" height="6" rx="1" />
    </svg>
  )
}
