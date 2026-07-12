// Ambient types for the platform-injected `window.gt` runtime. General Text
// injects the runtime at serve time (and a dev vite plugin injects it locally),
// so this app bundles NO sync client and no yjs — these are types only.
//
// This is the minimal surface Textris uses. The full contract is documented at
// generaltext.org/docs/building-apps.

/** The live CRDT text for a file — methods ride on the object the runtime hands
 *  back; we never construct one, so no yjs import is needed. */
interface GtText {
  toString(): string
  readonly length: number
  insert(index: number, content: string): void
  delete(index: number, length: number): void
  observe(fn: () => void): void
  unobserve(fn: () => void): void
}

interface GtUser {
  id: string
  name: string
  email: string
}

interface GtApi {
  /** Resolves once connected to the workspace. */
  readonly ready: Promise<void>
  readonly version: string
  readonly connected: boolean
  readonly workspaceId?: string
  /** 'demo' in the gallery "Try it live" demo (and the App Builder preview),
   *  'live' in a normal workspace. */
  readonly mode?: 'demo' | 'live'

  /** The shell's current light/dark theme and palette (runtime 1.8+). */
  readonly theme?: { mode: 'light' | 'dark'; vars: Record<string, string> }

  user(): Promise<GtUser | null>

  // Live editing (used to keep the leaderboard live as peers append).
  subscribeFile(path: string): GtText
  unsubscribeFile(path: string): void
  applyDiff(text: GtText, oldVal: string, newVal: string): void

  // Whole-file ops.
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<{ path: string; sizeBytes: number }[]>

  // File list + connection.
  files(): string[]
  watchFiles(cb: (paths: string[]) => void): () => void
  on(
    event: 'connected' | 'disconnected' | 'mode-changed' | 'error' | 'theme-changed',
    cb: (...args: unknown[]) => void,
  ): () => void

  /** Escape hatch to the underlying client (dev-only `isLocal`). */
  readonly sync: {
    readonly isLocal: boolean
  }
}

interface Window {
  gt: GtApi
}
