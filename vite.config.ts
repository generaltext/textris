import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Dev-only: inject the platform `window.gt` runtime so the app runs standalone
// (`pnpm dev`) with a local in-browser workspace (IndexedDB + cross-tab sync) —
// no General Text server needed. In production General Text injects the runtime
// itself, so this never ships. Point GT_ORIGIN at a local worker if you're
// running General Text locally, otherwise it defaults to prod.
function gtRuntime(): Plugin {
  const origin = process.env.GT_ORIGIN || 'https://www.generaltext.org'
  return {
    name: 'gt-runtime',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace('</head>', `<script src="${origin}/__gt/runtime.js"></script></head>`),
  }
}

export default defineConfig({
  base: './',
  // tsconfig targets ES2024 for type-checking, but esbuild (transpile/bundle)
  // only knows up to es2022 by name — pin it so it doesn't warn on each file.
  esbuild: { target: 'es2022' },
  plugins: [react(), tailwindcss(), gtRuntime()],
  resolve: {
    alias: { '~': resolve(__dirname, 'src') },
    // Force a single React instance. Without this, Vite could optimize `react`
    // and `react-dom/client` in separate passes (mismatched `?v=` hashes),
    // loading two React copies → "invalid hook call" / null dispatcher.
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle all of React together in the first optimize pass so a late
  // discovery of `react-dom/client` can't trigger a second, mismatched pass.
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client'] },
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
})
