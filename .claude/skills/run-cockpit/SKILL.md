---
name: run-cockpit
description: Run the Cockpit web app (Vite dev server) in a sandboxed agent environment and take screenshots of it with headless Chromium. Use when asked to run the app, test UI features visually, or verify UI changes/bugs with screenshots.
---

# Run Cockpit and take screenshots

Cockpit is a Vue 3 + Vuetify + Vite ground control station. In browser dev
mode it runs fully standalone — no vehicle needed. All the sandbox-specific
plumbing lives in `scripts/agent/`.

## 1. One-time setup (per container)

```bash
./scripts/agent/setup.sh
```

This initializes the git submodules (required — the dev server 500s without
them), swaps the two unfetchable GitHub-hosted deps (`mavlink2rest-wasm`,
`@kmamal/sdl`) for local stubs from `scripts/agent/stubs/`, and runs
`yarn install --ignore-scripts`. It restores `package.json`/`yarn.lock`
afterwards, so the working tree stays clean. Idempotent — skips the install
if `node_modules` is already populated.

Both stubbed packages are Electron-main-process-only, so browser dev mode
never touches them. Electron mode (`yarn dev:electron`) will NOT work in
the sandbox — don't try it.

## 2. Dev server

```bash
yarn dev > /tmp/vite-dev.log 2>&1 &
timeout 90 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Serves on http://localhost:5173. To stop/restart:
`lsof -ti:5173 -sTCP:LISTEN | xargs -r kill`. Check `/tmp/vite-dev.log` for
"Pre-transform error" if pages 500.

## 3. Screenshots

```bash
node scripts/agent/screenshot.mjs [url] [--out file] [--wait-for sel] \
  [--delay ms] [--viewport WxH] [--full-page] [--click sel]...
```

Uses the globally-installed Playwright (`npm root -g`) and the pre-installed
Chromium — the project itself has no Playwright dependency. Prints page
console errors after the shot — read them, but see "expected errors" below.

Routes are hash-based: `/` (main flight view), `#/mission-planning`,
`#/about`.

```bash
# Main view, dismissing the first-run welcome dialog
node scripts/agent/screenshot.mjs --click "text=DON'T SHOW AGAIN" --out home.png

# Mission planning view
node scripts/agent/screenshot.mjs "http://localhost:5173/#/mission-planning" \
  --click "text=DON'T SHOW AGAIN" --delay 8000 --out mission.png
```

For interactions beyond what the flags cover (menus, widget editing, drag),
write a throwaway Playwright script modeled on `scripts/agent/screenshot.mjs`
(reuse its `loadPlaywright()` helper and `--no-sandbox` launch args).

## Gotchas

- **Welcome dialog on every run.** Each screenshot run is a fresh browser
  profile, so the "Welcome to Cockpit!" tour dialog always appears.
  Dismiss with `--click "text=DON'T SHOW AGAIN"`.
- **Expected console errors with no vehicle.** `net::ERR_NAME_NOT_RESOLVED`
  and "Failed to fetch" from `blueos.local` / vehicle discovery are normal —
  there is no vehicle in the sandbox. Only treat errors as real if they come
  from app source files and are not network fetch failures.
- **Map tiles show "MAP DATA UNAVAILABLE".** External tile servers are
  blocked by the sandbox egress proxy; the app renders its noise fallback.
  Normal.
- **First page load is slow.** Vite compiles on demand; give the first
  screenshot a generous `--delay` (8–10s).
