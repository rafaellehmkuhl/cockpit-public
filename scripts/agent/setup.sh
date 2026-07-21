#!/usr/bin/env bash
# Install Cockpit's dependencies inside a sandboxed agent environment (e.g.
# Claude Code on the web), where outbound network access is restricted:
#
#   - GitHub-hosted dependencies (mavlink2rest-wasm, @kmamal/sdl) cannot be
#     fetched, so they are swapped for local stubs from scripts/agent/stubs/.
#     Both are only used by the Electron main process / standalone connection
#     path, which browser dev mode never exercises.
#   - Lifecycle scripts are skipped (--ignore-scripts) to avoid the postinstall
#     binary downloads (ffmpeg, go2rtc, electron) that are Electron-only.
#
# package.json and yarn.lock are restored to their original content afterwards,
# so this script leaves the working tree untouched.
set -euo pipefail

cd "$(dirname "$0")/../.."

# The app imports from these submodules (mavlink message/enum definitions,
# ArduPilot parameter metadata) — dev server 500s without them.
git submodule update --init --recursive

if [ -d node_modules/vite ] && [ -d node_modules/mavlink2rest-wasm ]; then
  echo "Dependencies already installed — skipping. (rm -rf node_modules to force)"
  exit 0
fi

backup_dir=$(mktemp -d)
cp package.json yarn.lock "$backup_dir"/
restore() {
  cp "$backup_dir"/package.json "$backup_dir"/yarn.lock .
  rm -rf "$backup_dir"
}
trap restore EXIT

node -e "
  const fs = require('fs')
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  pkg.dependencies['mavlink2rest-wasm'] = 'file:./scripts/agent/stubs/mavlink2rest-wasm'
  pkg.dependencies['@kmamal/sdl'] = 'file:./scripts/agent/stubs/kmamal-sdl'
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
"

yarn install --ignore-scripts

echo "Done. Start the dev server with: yarn dev (serves on http://localhost:5173)"
