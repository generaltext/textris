// Pure grid operations: collision, stamping a locked piece, clearing lines, and
// the 7-bag piece source. No state beyond what's passed in.

import { cellsOf, COLS, ROWS } from './pieces'
import type { ActivePiece, PieceType } from './types'
import type { Prng } from './prng'

export function makeGrid(): Uint8Array {
  return new Uint8Array(ROWS * COLS)
}

export function cellAt(grid: Uint8Array, x: number, y: number): number {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return -1 // out of bounds = solid
  return grid[y * COLS + x]!
}

/** True if the piece's cells are all in-bounds and land on empty grid cells. */
export function fits(grid: Uint8Array, p: ActivePiece): boolean {
  for (const [dx, dy] of cellsOf(p.type, p.rot)) {
    const x = p.x + dx
    const y = p.y + dy
    if (x < 0 || x >= COLS || y >= ROWS) return false
    if (y < 0) continue // above the ceiling is allowed (spawn buffer)
    if (grid[y * COLS + x] !== 0) return false
  }
  return true
}

/** Write the piece's cells into the grid (mutates). */
export function stamp(grid: Uint8Array, p: ActivePiece): void {
  const colorId = p.type + 1
  for (const [dx, dy] of cellsOf(p.type, p.rot)) {
    const x = p.x + dx
    const y = p.y + dy
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) grid[y * COLS + x] = colorId
  }
}

/** Remove full rows, shifting everything above down. Returns rows cleared. */
export function clearLines(grid: Uint8Array): number {
  let cleared = 0
  for (let y = ROWS - 1; y >= 0; y--) {
    let full = true
    for (let x = 0; x < COLS; x++) {
      if (grid[y * COLS + x] === 0) {
        full = false
        break
      }
    }
    if (full) {
      // Shift rows [0..y) down by one, clear the top row.
      grid.copyWithin(COLS, 0, y * COLS)
      for (let x = 0; x < COLS; x++) grid[x] = 0
      cleared++
      y++ // re-check the same row index (now holding the shifted-down row)
    }
  }
  return cleared
}

/** One shuffled bag of all 7 pieces (Fisher-Yates, driven by the seeded PRNG). */
export function newBag(rng: Prng): PieceType[] {
  const bag: PieceType[] = [0, 1, 2, 3, 4, 5, 6]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = bag[i]!
    bag[i] = bag[j]!
    bag[j] = tmp
  }
  return bag
}
