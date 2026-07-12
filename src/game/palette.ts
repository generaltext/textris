// Canvas needs concrete colors (it can't read CSS custom properties), so we
// derive a small palette from the shell's light/dark mode. Piece colors stay
// iconic (they identify the tetromino); only the board chrome flips.

export interface Palette {
  bg: string
  grid: string
  border: string
  ghost: string
  emptyCell: string
}

export function palette(dark: boolean): Palette {
  return dark
    ? {
        bg: '#0a0a0a',
        grid: '#1c1c1c',
        border: '#2a2a2a',
        ghost: 'rgba(255,255,255,0.16)',
        emptyCell: '#141414',
      }
    : {
        bg: '#f5f5f5',
        grid: '#e2e2e2',
        border: '#cfcfcf',
        ghost: 'rgba(0,0,0,0.12)',
        emptyCell: '#ffffff',
      }
}
