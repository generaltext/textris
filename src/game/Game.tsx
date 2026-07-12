import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { GameRunner, type GameOverInfo } from './loop'
import { attachKeyboard } from './input'
import { BOARD_H, BOARD_W, CELL, drawBoard, drawPreview } from './render'
import { palette } from './palette'
import type { Action } from '~/engine/types'

const NEXT_COUNT = 1 // classic Tetris shows a single next piece
const PREVIEW_BOX = 4 // cells; preview canvas is PREVIEW_BOX*CELL, scaled down by CSS

function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  return ctx
}

export default function Game({
  seed,
  dark,
  onFinish,
  onExit,
}: {
  seed: number
  dark: boolean
  onFinish: (info: GameOverInfo) => void
  onExit: () => void
}) {
  const boardRef = useRef<HTMLCanvasElement>(null)
  const holdRef = useRef<HTMLCanvasElement>(null)
  const nextRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const scoreRef = useRef<HTMLSpanElement>(null)
  const linesRef = useRef<HTMLSpanElement>(null)
  const levelRef = useRef<HTMLSpanElement>(null)
  const runnerRef = useRef<GameRunner | null>(null)
  const palRef = useRef(palette(dark))
  const scaleWrapRef = useRef<HTMLDivElement>(null)
  const scaleInnerRef = useRef<HTMLDivElement>(null)

  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  // Auto-scale the fixed-size play area down to fit the viewport (never up, so
  // the canvas stays crisp). Essential on mobile, where the board + rails are
  // wider than the screen.
  const [box, setBox] = useState({ scale: 1, h: 0 })

  // Keep the canvas palette current when the shell theme flips.
  useEffect(() => {
    palRef.current = palette(dark)
  }, [dark])

  // Fit-to-width: measure the natural size of the play area and scale it down if
  // it's wider than the available space. Reserves the scaled height so the touch
  // controls below never overlap.
  useLayoutEffect(() => {
    const wrap = scaleWrapRef.current
    const inner = scaleInnerRef.current
    if (!wrap || !inner) return
    const measure = () => {
      const avail = wrap.clientWidth
      const natural = inner.offsetWidth
      if (!avail || !natural) return
      const scale = natural > avail ? avail / natural : 1
      const h = inner.offsetHeight * scale
      setBox((prev) => (prev.scale === scale && prev.h === h ? prev : { scale, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const board = boardRef.current
    const hold = holdRef.current
    if (!board || !hold) return

    const boardCtx = setupCanvas(board, BOARD_W, BOARD_H)
    const holdCtx = setupCanvas(hold, PREVIEW_BOX * CELL, PREVIEW_BOX * CELL)
    const nextCtxs = nextRefs.current.map((c) =>
      c ? setupCanvas(c, PREVIEW_BOX * CELL, PREVIEW_BOX * CELL) : null,
    )

    const runner = new GameRunner(seed)
    runnerRef.current = runner

    runner.onFrame = (r) => {
      const pal = palRef.current
      drawBoard(boardCtx, r.engine, pal)
      drawPreview(holdCtx, r.engine.state.hold, pal)
      for (let i = 0; i < NEXT_COUNT; i++) {
        const ctx = nextCtxs[i]
        if (ctx) drawPreview(ctx, r.engine.state.queue[i] ?? null, pal)
      }
      if (scoreRef.current) scoreRef.current.textContent = r.engine.state.score.toLocaleString()
      if (linesRef.current) linesRef.current.textContent = String(r.engine.state.lines)
      if (levelRef.current) levelRef.current.textContent = String(r.engine.state.level)
    }
    runner.onGameOver = (info) => {
      setOver(true)
      onFinish(info)
    }

    const detach = attachKeyboard(runner, {
      onPauseToggle: () => {
        if (runner.engine.state.gameOver) return
        setPaused((p) => {
          const next = !p
          runner.setPaused(next)
          return next
        })
      },
    })

    runner.start()
    return () => {
      detach()
      runner.stop()
    }
    // Restart cleanly whenever the seed changes (new game).
  }, [seed, onFinish])

  const togglePause = () => {
    const runner = runnerRef.current
    if (!runner || runner.engine.state.gameOver) return
    setPaused((p) => {
      const next = !p
      runner.setPaused(next)
      return next
    })
  }

  // Touch controls: press-and-hold for movement, tap for edge actions.
  const hold = (a: Action) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      runnerRef.current?.input(a, true)
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault()
      runnerRef.current?.input(a, false)
    },
    onPointerLeave: () => runnerRef.current?.input(a, false),
  })
  const tap = (a: Action) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      runnerRef.current?.input(a, true)
    },
  })

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        ref={scaleWrapRef}
        className="flex w-full items-start justify-center overflow-hidden"
        style={{ height: box.h || undefined }}
      >
        <div
          ref={scaleInnerRef}
          className="flex shrink-0 items-start gap-3"
          style={
            box.scale !== 1
              ? { transform: `scale(${box.scale})`, transformOrigin: 'top center' }
              : undefined
          }
        >
          {/* Hold: the box, with a Hold button below it in the same column (mobile). */}
        <Side label="Hold">
          <canvas
            ref={holdRef}
            className="rounded-md border"
            style={{ width: 64, height: 64, borderColor: 'var(--gt-border, #444)' }}
          />
          <button
            {...tap('hold')}
            className="w-16 rounded-md border py-1 text-xs font-medium active:opacity-70 sm:hidden"
            style={{ borderColor: 'var(--gt-border, #444)', touchAction: 'none' }}
          >
            Hold
          </button>
        </Side>

        {/* Board */}
        <div className="relative">
          <canvas
            ref={boardRef}
            className="rounded-lg border shadow-sm"
            style={{
              width: BOARD_W,
              height: BOARD_H,
              borderColor: 'var(--gt-border, #444)',
              touchAction: 'none',
            }}
          />
          {(paused || over) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/60 text-white backdrop-blur-sm">
              <p className="text-lg font-semibold">{over ? 'Game over' : 'Paused'}</p>
              {over ? (
                <button
                  onClick={onExit}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={togglePause}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  <Play size={15} /> Resume
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right rail: next, stats, pause */}
        <div className="flex w-24 flex-col gap-3">
          <Side label="Next">
            <canvas
              ref={(el) => {
                nextRefs.current[0] = el
              }}
              className="rounded-md border"
              style={{ width: 64, height: 64, borderColor: 'var(--gt-border, #444)' }}
            />
          </Side>
          <Stat label="Score" refEl={scoreRef} />
          <Stat label="Lines" refEl={linesRef} />
          <Stat label="Level" refEl={levelRef} />
          <button
            onClick={togglePause}
            disabled={over}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm disabled:opacity-40"
            style={{ borderColor: 'var(--gt-border, #444)' }}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
        </div>
      </div>

      {/* Touch controls (hidden on desktop; Hold lives on the Hold box above). */}
      <div className="flex justify-center gap-2 sm:hidden">
        <TouchBtn {...hold('left')} aria-label="Move left">
          <ArrowLeft size={18} />
        </TouchBtn>
        <TouchBtn {...tap('rotCCW')} aria-label="Rotate counter-clockwise">
          <RotateCcw size={18} />
        </TouchBtn>
        <TouchBtn {...tap('rotCW')} aria-label="Rotate clockwise">
          <RotateCw size={18} />
        </TouchBtn>
        <TouchBtn {...hold('right')} aria-label="Move right">
          <ArrowRight size={18} />
        </TouchBtn>
        <TouchBtn {...hold('softDrop')} aria-label="Soft drop">
          <ArrowDown size={18} />
        </TouchBtn>
        <TouchBtn {...tap('hardDrop')} aria-label="Hard drop">
          <ChevronsDown size={18} />
        </TouchBtn>
      </div>

      <p className="hidden text-center text-xs text-[var(--gt-fg-3,#888)] sm:block">
        ← → move · ↓ soft drop · Space hard drop · ↑/X rotate · Z rotate ccw · C hold · Esc pause
      </p>
    </div>
  )
}

function Side({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gt-fg-3,#888)]">
        {label}
      </span>
      {children}
    </div>
  )
}

function Stat({ label, refEl }: { label: string; refEl: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="rounded-md border px-3 py-2" style={{ borderColor: 'var(--gt-border, #444)' }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gt-fg-3,#888)]">
        {label}
      </div>
      <span ref={refEl} className="text-lg font-bold tabular-nums">
        0
      </span>
    </div>
  )
}

function TouchBtn({ children, ...rest }: React.ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      className="flex h-12 w-12 select-none items-center justify-center rounded-lg border text-lg font-semibold active:bg-[var(--gt-accent-soft,#3336)]"
      style={{ borderColor: 'var(--gt-border, #444)', touchAction: 'none' }}
    >
      {children}
    </button>
  )
}
