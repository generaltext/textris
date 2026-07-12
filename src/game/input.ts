// Keyboard → engine actions. Held keys (move/soft-drop) emit down + up so the
// engine can run its own DAS/ARR; the OS key-repeat is suppressed via a pressed
// set so a held key doesn't spam fresh "down" events.

import type { Action } from '~/engine/types'
import type { GameRunner } from './loop'

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'softDrop',
  ArrowUp: 'rotCW',
  KeyX: 'rotCW',
  KeyZ: 'rotCCW',
  Space: 'hardDrop',
  KeyC: 'hold',
}

const GAME_KEYS = new Set([...Object.keys(KEYMAP), 'Escape'])

export interface KeyboardHandlers {
  onPauseToggle: () => void
}

/** Attach keyboard control to a runner. Returns a detach function. */
export function attachKeyboard(runner: GameRunner, handlers: KeyboardHandlers): () => void {
  const pressed = new Set<string>()

  const onDown = (e: KeyboardEvent): void => {
    if (!GAME_KEYS.has(e.code)) return
    e.preventDefault()
    if (e.code === 'Escape') {
      if (!e.repeat) handlers.onPauseToggle()
      return
    }
    if (pressed.has(e.code)) return // ignore OS auto-repeat
    pressed.add(e.code)
    const action = KEYMAP[e.code]
    if (action) runner.input(action, true)
  }

  const onUp = (e: KeyboardEvent): void => {
    if (!GAME_KEYS.has(e.code)) return
    e.preventDefault()
    pressed.delete(e.code)
    const action = KEYMAP[e.code]
    if (action) runner.input(action, false)
  }

  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  return () => {
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
  }
}
