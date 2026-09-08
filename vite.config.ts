import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: {
    // shadcn/ui generates components that import via `@/...` (e.g.
    // `@/lib/utils`); this mirrors the same alias declared in
    // tsconfig.json's `paths` so Vite resolves it identically at build time.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // nitro() compiles the server routes into deployable Vercel Functions.
  // TanStack Start no longer bundles this itself (see "Why TanStack Start
  // is Ditching Adapters"), so without it the client build still succeeds
  // but every route 404s on Vercel (x-vercel-error: NOT_FOUND) since there's
  // nothing for the platform to route requests to.
  //
  // preset is pinned rather than left to autodetection: nitro's Vercel
  // autodetect keys off a *local* .vercel/project.json (from `vercel link`),
  // which is gitignored — so a clean checkout (CI, a fresh clone) silently
  // falls back to the node-server preset and produces the same broken,
  // no-server-function output that caused this bug in the first place.
  plugins: [tailwindcss(), tanstackStart(), nitro({ preset: 'vercel' }), viteReact()],
})
