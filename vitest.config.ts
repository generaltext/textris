import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Standalone test config (kept separate from vite.config.ts so the app's vite 6
// plugin types don't clash with the vite version vitest bundles). The engine
// tests are pure Node — no DOM, no plugins.
export default defineConfig({
  esbuild: { target: 'es2022' },
  resolve: {
    alias: { '~': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
