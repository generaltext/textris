// Shared engine types. The engine is pure and headless: no DOM, no clock, no
// Math.random — everything flows from the seed and the input log. That is what
// makes a game bit-for-bit reproducible, which is what makes the leaderboard
// verifiable (see ../board/verify.ts).

/** 0..6 → I, J, L, O, S, T, Z. colorId = type + 1 (0 = empty cell). */
export type PieceType = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Rotation state: 0 = spawn, 1 = CW, 2 = 180, 3 = CCW. */
export type Rotation = 0 | 1 | 2 | 3

export interface ActivePiece {
  type: PieceType
  rot: Rotation
  /** Top-left of the piece's bounding box, in grid coordinates (y grows down). */
  x: number
  y: number
}

/** Logical inputs. `left`/`right`/`softDrop` are held (down + up matter); the
 *  rest are edge-triggered (only the `down` is acted on). */
export type Action = 'left' | 'right' | 'softDrop' | 'rotCW' | 'rotCCW' | 'hardDrop' | 'hold'

export interface InputEvent {
  /** Logical frame the event occurred on. */
  f: number
  a: Action
  /** true = key down, false = key up. Edge actions only ever emit `down: true`. */
  down: boolean
}

export interface GameState {
  /** ROWS*COLS, row-major: grid[r*COLS + c]. 0 = empty, else colorId (type+1). */
  grid: Uint8Array
  cur: ActivePiece | null
  hold: PieceType | null
  holdUsed: boolean
  /** Upcoming pieces, refilled from the 7-bag; index 0 is next to spawn. */
  queue: PieceType[]

  frame: number
  gameOver: boolean

  // Scoring / progression.
  score: number
  lines: number
  level: number
  /** -1 when no active combo; increments on each consecutive line-clearing lock. */
  combo: number
  /** true when the last clear was "difficult" (a tetris), for the b2b bonus. */
  b2b: boolean

  // Held-key + auto-repeat (DAS/ARR) state.
  held: { left: boolean; right: boolean; softDrop: boolean }
  dasDir: -1 | 0 | 1
  dasTimer: number
  arrTimer: number

  // Gravity + lock delay.
  gravityAcc: number
  /** Frames the piece has been resting on the stack; -1 = airborne. */
  lockTimer: number
  lockResets: number

  // Anti-cheat / stats: raw input count over the game.
  inputCount: number
}

export interface GameResult {
  score: number
  lines: number
  level: number
  frames: number
  topOut: boolean
  inputCount: number
}
