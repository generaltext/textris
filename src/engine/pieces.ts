// Tetromino shapes and SRS wall-kick data. Shapes are hardcoded per rotation
// state (rather than computed via rotation matrices) so there's no chance of a
// subtle off-by-one in the rotation math — the cells are exactly the canonical
// SRS orientations.

import type { PieceType, Rotation } from './types'

export const COLS = 10
/** Visible playfield height. */
export const VISIBLE_ROWS = 20
/** Hidden spawn rows above the visible field. Total grid = HIDDEN + VISIBLE. */
export const HIDDEN_ROWS = 2
export const ROWS = HIDDEN_ROWS + VISIBLE_ROWS

/** Bounding-box width per piece; drives the centered spawn column. */
const BOX_W: Record<PieceType, number> = { 0: 4, 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 6: 3 }

/** Spawn column (top-left of the bounding box) so the piece enters centered. */
export function spawnX(type: PieceType): number {
  return Math.floor((COLS - BOX_W[type]) / 2)
}

type Cells = ReadonlyArray<readonly [number, number]>

// [type][rotation] → the four occupied cells, as [x, y] offsets within the
// piece's bounding box (y grows down). I=0, J=1, L=2, O=3, S=4, T=5, Z=6.
export const SHAPES: Record<PieceType, readonly [Cells, Cells, Cells, Cells]> = {
  // I
  0: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  // J
  1: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  // L
  2: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  // O
  3: [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
  ],
  // S
  4: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // T
  5: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // Z
  6: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
}

export function cellsOf(type: PieceType, rot: Rotation): Cells {
  return SHAPES[type][rot]
}

// SRS wall kicks. For a rotation from `fromRot` to `toRot` the engine tries each
// [dx, dy] offset in order and takes the first that fits. Coordinates use y-down
// (the standard tables, published y-up, are negated on the y axis here).
type Kick = readonly (readonly [number, number])[]

// JLSTZ share one table.
const JLSTZ_KICKS: Record<string, Kick> = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}

const I_KICKS: Record<string, Kick> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}

export function kicksFor(type: PieceType, from: Rotation, to: Rotation): Kick {
  if (type === 3) return [[0, 0]] // O never needs to kick.
  const table = type === 0 ? I_KICKS : JLSTZ_KICKS
  return table[`${from}>${to}`] ?? [[0, 0]]
}

/** Iconic tetromino colors (kept regardless of shell theme — they identify the
 *  pieces). Indexed by colorId (type + 1); index 0 is unused (empty). */
export const PIECE_COLORS: readonly string[] = [
  '#000000', // 0 unused
  '#22d3ee', // I cyan
  '#3b82f6', // J blue
  '#f97316', // L orange
  '#eab308', // O yellow
  '#22c55e', // S green
  '#a855f7', // T purple
  '#ef4444', // Z red
]
