import { ExternalLink, Play } from 'lucide-react'

// Shown when Textris is opened outside General Text — no injected `window.gt`
// runtime (someone visited the deployed site directly). A gt app has no backend,
// so on its own there's no workspace to read or write; point the visitor at how
// to actually use it, and offer a local sample demo right here.
export default function MissingRuntime({ onTryDemo }: { onTryDemo: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-neutral-950 px-6 py-12 text-neutral-100">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-neutral-800 bg-neutral-900 p-7">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#22d3ee" aria-hidden>
            <rect x="9" y="5.5" width="6" height="6" rx="1" />
            <rect x="2.5" y="12" width="6" height="6" rx="1" />
            <rect x="9" y="12" width="6" height="6" rx="1" />
            <rect x="15.5" y="12" width="6" height="6" rx="1" />
          </svg>
          <div>
            <h1 className="text-lg font-bold leading-tight">Textris</h1>
            <p className="text-xs text-neutral-500">A General Text app</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-neutral-300">
          Textris runs <span className="font-medium text-neutral-100">inside General Text</span>, a
          workspace for plain-text files that sync across your devices. That's where its leaderboard
          lives, as signed files you own. Opened on its own like this, there's no workspace to read
          or write.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.generaltext.org"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-200 px-3.5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            Open General Text
            <ExternalLink size={14} />
          </a>
          <a
            href="/demo"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              onTryDemo()
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-3.5 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800"
          >
            <Play size={14} />
            Play the demo
          </a>
        </div>
        <p className="-mt-2 text-xs text-neutral-600">
          The demo runs locally in your browser with sample scores. Nothing is saved to an account.
        </p>

        <p className="text-xs text-neutral-600">
          Building your own app?{' '}
          <a
            href="https://www.generaltext.org/docs/building-apps"
            className="text-neutral-100 underline decoration-neutral-600 underline-offset-2 hover:decoration-neutral-300"
          >
            Read the developer guide
          </a>
          .
        </p>
      </div>
    </div>
  )
}
