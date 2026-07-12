// Canvas drawing for the playfield and the hold/next previews. Pure drawing — it
// reads engine state and paints; it never mutates game state.

import { cellsOf, COLS, HIDDEN_ROWS, PIECE_COLORS, ROWS, VISIBLE_ROWS } from '~/engine/pieces'
import type { Engine } from '~/engine/engine'
import type { PieceType } from '~/engine/types'
import type { Palette } from './palette'

export const CELL = 30 // logical px per cell (canvas is scaled by CSS/devicePixelRatio)
export const BOARD_W = COLS * CELL
export const BOARD_H = VISIBLE_ROWS * CELL

function roundedCell(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
  const pad = 1
  const r = 3
  const x = px + pad
  const y = py + pad
  const s = CELL - pad * 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + s, y, x + s, y + s, r)
  ctx.arcTo(x + s, y + s, x, y + s, r)
  ctx.arcTo(x, y + s, x, y, r)
  ctx.arcTo(x, y, x + s, y, r)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

export function drawBoard(ctx: CanvasRenderingContext2D, engine: Engine, pal: Palette): void {
  const s = engine.state
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  // Grid lines.
  ctx.strokeStyle = pal.grid
  ctx.lineWidth = 1
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * CELL + 0.5, 0)
    ctx.lineTo(c * CELL + 0.5, BOARD_H)
    ctx.stroke()
  }
  for (let r = 0; r <= VISIBLE_ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * CELL + 0.5)
    ctx.lineTo(BOARD_W, r * CELL + 0.5)
    ctx.stroke()
  }

  // Locked cells (only the visible portion).
  for (let r = HIDDEN_ROWS; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = s.grid[r * COLS + c]!
      if (v !== 0) roundedCell(ctx, c * CELL, (r - HIDDEN_ROWS) * CELL, PIECE_COLORS[v]!)
    }
  }

  if (!s.cur) return

  // Ghost (landing preview).
  const gy = engine.ghostY()
  for (const [dx, dy] of cellsOf(s.cur.type, s.cur.rot)) {
    const x = s.cur.x + dx
    const y = gy + dy
    if (y >= HIDDEN_ROWS) roundedCell(ctx, x * CELL, (y - HIDDEN_ROWS) * CELL, pal.ghost)
  }

  // Active piece.
  const color = PIECE_COLORS[s.cur.type + 1]!
  for (const [dx, dy] of cellsOf(s.cur.type, s.cur.rot)) {
    const x = s.cur.x + dx
    const y = s.cur.y + dy
    if (y >= HIDDEN_ROWS) roundedCell(ctx, x * CELL, (y - HIDDEN_ROWS) * CELL, color)
  }
}

/** Draw a single tetromino centered in a small preview canvas (hold / next). */
export function drawPreview(
  ctx: CanvasRenderingContext2D,
  type: PieceType | null,
  pal: Palette,
  boxCells = 4,
): void {
  const size = boxCells * CELL
  ctx.clearRect(0, 0, size, size)
  if (type === null) return
  const cells = cellsOf(type, 0)
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = (maxX - minX + 1) * CELL
  const h = (maxY - minY + 1) * CELL
  const offX = (size - w) / 2 - minX * CELL
  const offY = (size - h) / 2 - minY * CELL
  const color = PIECE_COLORS[type + 1]!
  for (const [dx, dy] of cells) roundedCell(ctx, offX + dx * CELL, offY + dy * CELL, color)
}
