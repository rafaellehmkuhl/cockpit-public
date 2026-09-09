import { defineConfig, mergeConfig } from 'vite'

import base from '../vite.config'

// The worktree links `node_modules` from the main clone, so Vite's default fs allow-list rejects the icon webfont and
// every glyph renders as tofu. Capture-only config: never used by the app itself.
export default defineConfig(async (env) => {
  const resolved = await (base as (e: typeof env) => Promise<unknown>)(env)
  return mergeConfig(resolved as Record<string, unknown>, {
    server: { fs: { strict: false } },
  })
})
