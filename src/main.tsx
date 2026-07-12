import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '~/App'
import MissingRuntime from '~/components/MissingRuntime'
import { installDemoRuntime } from '~/lib/demo-runtime'
import '~/global.css'

// The platform injects `window.gt` (a classic script) before this deferred module
// runs, so a real runtime is present iff window.gt exists right now, before we'd
// ever install the demo. Captured once at load.
const HAS_REAL_RUNTIME = typeof window !== 'undefined' && !!window.gt

// The demo lives at its own route (`/demo`) so it's linkable and refreshable. The
// host serves index.html for it via SPA fallback (Workers `not_found_handling`).
const onDemoRoute = () =>
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').endsWith('/demo')

if (!HAS_REAL_RUNTIME && onDemoRoute()) installDemoRuntime()

function Root() {
  const [demo, setDemo] = useState(onDemoRoute)

  useEffect(() => {
    const onPop = () => {
      const isDemo = onDemoRoute()
      if (isDemo) installDemoRuntime()
      setDemo(isDemo)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (HAS_REAL_RUNTIME || demo) return <App />

  return (
    <MissingRuntime
      onTryDemo={() => {
        installDemoRuntime()
        window.history.pushState(null, '', '/demo')
        setDemo(true)
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
