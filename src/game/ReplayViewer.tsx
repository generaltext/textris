import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { advanceTo, makeReplayEngine, simulate } from '~/engine/simulate'
import type { Engine } from '~/engine/engine'
import { BOARD_H, BOARD_W, drawBoard } from './render'
import { palette } from './palette'
import type { InputEvent } from '~/engine/types'

const TICK_MS = 1000 / 60

/** Watches a recorded game replay to itself — the same deterministic engine used
 *  for verification, rendered frame by frame. Auto-plays, and the scrubber lets
 *  you grab and seek anywhere. (The engine only runs forward, so seeking back
 *  re-simulates from the start; a game is a few thousand frames, so it's cheap.) */
export default function ReplayViewer({
  seed,
  events,
  dark,
  label,
  onClose,
}: {
  seed: number
  events: InputEvent[]
  dark: boolean
  label: string
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const cursorRef = useRef(0)

  // Total length of the run (its top-out frame), for the scrubber's range.
  const total = useMemo(() => simulate(seed, events).frames, [seed, events])
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(2)

  const draw = useCallback(() => {
    const ctx = ctxRef.current
    const engine = engineRef.current
    if (ctx && engine) drawBoard(ctx, engine, palette(dark))
  }, [dark])

  const seek = useCallback(
    (target: number) => {
      const t = Math.max(0, Math.min(total, Math.round(target)))
      let engine = engineRef.current
      // Seeking backward (or first run) rebuilds from frame 0; forward advances.
      if (!engine || t < engine.state.frame) {
        engine = makeReplayEngine(seed)
        engineRef.current = engine
        cursorRef.current = 0
      }
      cursorRef.current = advanceTo(engine, events, cursorRef.current, t)
      setFrame(engine.state.frame)
      draw()
    },
    [seed, events, total, draw],
  )

  // Canvas setup + reset when the replay changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(BOARD_W * dpr)
    canvas.height = Math.round(BOARD_H * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctxRef.current = ctx
    engineRef.current = makeReplayEngine(seed)
    cursorRef.current = 0
    setFrame(0)
    setPlaying(true)
    draw()
  }, [seed, events, draw])

  // Redraw on theme flip without disturbing playback position.
  useEffect(() => {
    draw()
  }, [dark, draw])

  // Auto-advance loop (runs only while playing).
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = () => {
      const engine = engineRef.current
      if (!engine) return
      const now = performance.now()
      acc += (now - last) * speed
      last = now
      let target = engine.state.frame
      while (acc >= TICK_MS) {
        acc -= TICK_MS
        target++
      }
      if (target > engine.state.frame) {
        cursorRef.current = advanceTo(engine, events, cursorRef.current, target)
        setFrame(engine.state.frame)
        draw()
      }
      if (engine.state.gameOver || engine.state.frame >= total) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, events, total, draw])

  const done = frame >= total || (engineRef.current?.state.gameOver ?? false)

  const togglePlay = () => {
    if (done) {
      seek(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }

  const secs = (f: number) => (f / 60).toFixed(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border p-4"
        style={{ background: 'var(--gt-bg, #111)', borderColor: 'var(--gt-border, #444)' }}
      >
        <div className="flex w-full items-center justify-between gap-4">
          <span className="truncate text-sm font-semibold">Replay · {label}</span>
          <button onClick={onClose} className="shrink-0 text-[var(--gt-fg-3,#888)] hover:text-current">
            <X size={18} />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className="rounded-lg border"
          style={{
            width: '100%',
            maxWidth: BOARD_W,
            aspectRatio: `${BOARD_W} / ${BOARD_H}`,
            borderColor: 'var(--gt-border, #444)',
          }}
        />

        {/* Scrubber: follows autoplay, and you can grab it to seek anywhere. */}
        <div className="flex w-full items-center gap-2">
          <button
            onClick={togglePlay}
            className="shrink-0 rounded-md border p-1.5"
            style={{ borderColor: 'var(--gt-border, #444)' }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={15} /> : done ? <RotateCcw size={15} /> : <Play size={15} />}
          </button>
          <input
            type="range"
            min={0}
            max={total}
            value={Math.min(frame, total)}
            onChange={(e) => {
              setPlaying(false)
              seek(Number(e.target.value))
            }}
            className="min-w-0 flex-1"
            style={{ accentColor: 'var(--gt-accent, #3b82f6)' }}
            aria-label="Scrub replay"
          />
          <span className="shrink-0 text-xs tabular-nums text-[var(--gt-fg-3,#888)]">
            {secs(frame)}s / {secs(total)}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--gt-fg-3,#888)]">Speed</span>
          {[1, 2, 4, 8].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                speed === s ? 'bg-[var(--gt-accent,#3b82f6)] text-white' : ''
              }`}
              style={{ borderColor: 'var(--gt-border, #444)' }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
