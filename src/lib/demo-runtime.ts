// A self-contained, in-browser stand-in for the platform's `window.gt` runtime,
// so the landing page can offer a "try it" demo when the app is opened outside
// General Text (no real runtime injected). It implements just the GtApi surface
// Textris uses (see src/gt.d.ts), backed by plain strings in memory and mirrored
// to localStorage so a session survives a refresh. Single-user, local, throwaway.

const PREFIX = 'textris-demo:'

export function installDemoRuntime(): void {
  if (typeof window === 'undefined' || window.gt) return
  window.gt = createDemoRuntime()
}

function createDemoRuntime(): GtApi {
  const files = new Map<string, string>()
  const observers = new Map<string, Set<() => void>>()
  const texts = new Map<string, GtText>()
  const fileListeners = new Set<(paths: string[]) => void>()

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) files.set(key.slice(PREFIX.length), localStorage.getItem(key) ?? '')
    }
  } catch {
    /* localStorage unavailable — in-memory only */
  }

  const persist = (path: string) => {
    try {
      localStorage.setItem(PREFIX + path, files.get(path) ?? '')
    } catch {
      /* ignore */
    }
  }
  const obs = (path: string) => {
    let set = observers.get(path)
    if (!set) observers.set(path, (set = new Set()))
    return set
  }
  const notify = (path: string) => obs(path).forEach((fn) => fn())
  const notifyFiles = () => {
    const paths = [...files.keys()]
    fileListeners.forEach((fn) => fn(paths))
  }

  function makeText(path: string): GtText {
    const existing = texts.get(path)
    if (existing) return existing
    const text: GtText = {
      toString: () => files.get(path) ?? '',
      get length() {
        return (files.get(path) ?? '').length
      },
      insert(index, content) {
        const isNew = !files.has(path)
        const cur = files.get(path) ?? ''
        files.set(path, cur.slice(0, index) + content + cur.slice(index))
        persist(path)
        notify(path)
        if (isNew) notifyFiles()
      },
      delete(index, length) {
        const cur = files.get(path) ?? ''
        files.set(path, cur.slice(0, index) + cur.slice(index + length))
        persist(path)
        notify(path)
      },
      observe: (fn) => void obs(path).add(fn),
      unobserve: (fn) => void obs(path).delete(fn),
    }
    texts.set(path, text)
    return text
  }

  return {
    ready: Promise.resolve(),
    version: 'demo',
    mode: 'demo',
    connected: true,

    async user() {
      return { id: 'demo', name: 'You', email: '' }
    },

    subscribeFile: (path) => makeText(path),
    unsubscribeFile: () => {},
    applyDiff(text, oldVal, newVal) {
      if (oldVal === newVal) return
      let start = 0
      while (start < oldVal.length && start < newVal.length && oldVal[start] === newVal[start]) start++
      let oldEnd = oldVal.length
      let newEnd = newVal.length
      while (oldEnd > start && newEnd > start && oldVal[oldEnd - 1] === newVal[newEnd - 1]) {
        oldEnd--
        newEnd--
      }
      if (oldEnd - start > 0) text.delete(start, oldEnd - start)
      if (newEnd - start > 0) text.insert(start, newVal.slice(start, newEnd))
    },

    async readFile(path) {
      const v = files.get(path)
      if (v === undefined) throw new Error(`no such file: ${path}`)
      return v
    },
    async writeFile(path, content) {
      const isNew = !files.has(path)
      files.set(path, content)
      persist(path)
      notify(path)
      if (isNew) notifyFiles()
    },
    async deleteFile(path) {
      files.delete(path)
      try {
        localStorage.removeItem(PREFIX + path)
      } catch {
        /* ignore */
      }
      notify(path)
      notifyFiles()
    },
    async listFiles() {
      return [...files].map(([path, content]) => ({ path, sizeBytes: content.length }))
    },

    files: () => [...files.keys()],
    watchFiles(cb) {
      fileListeners.add(cb)
      cb([...files.keys()])
      return () => void fileListeners.delete(cb)
    },
    on: () => () => {},

    sync: { isLocal: true },
  }
}
