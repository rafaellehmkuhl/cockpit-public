/* eslint-disable */
// Take a screenshot of the running Cockpit dev server with headless Chromium.
// Designed for sandboxed agent environments where Playwright is installed
// globally (npm root -g) rather than as a project dependency.
//
// Usage:
//   node scripts/agent/screenshot.mjs [url] [options]
//
// Options:
//   --out <file>        Output path (default: screenshot.png)
//   --wait-for <sel>    CSS selector to wait for before shooting
//   --delay <ms>        Extra settle time after load/wait (default: 2000)
//   --viewport <WxH>    Viewport size (default: 1920x1080)
//   --full-page         Capture the full scrollable page
//   --click <sel>       Click a selector before the settle delay (repeatable)
//
// Examples:
//   node scripts/agent/screenshot.mjs
//   node scripts/agent/screenshot.mjs http://localhost:5173/#/tools/mission-planning --out mission.png
//   node scripts/agent/screenshot.mjs --click 'button:has-text("Menu")' --out menu.png

import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Resolve playwright from the project if present, else from the global npm root. */
function loadPlaywright() {
  try {
    return require('playwright')
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    return require(`${globalRoot}/playwright`)
  }
}

const args = process.argv.slice(2)
let url = 'http://localhost:5173'
let out = 'screenshot.png'
let waitFor = null
let delay = 2000
let viewport = { width: 1920, height: 1080 }
let fullPage = false
const clicks = []

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--out') out = args[++i]
  else if (arg === '--wait-for') waitFor = args[++i]
  else if (arg === '--delay') delay = Number(args[++i])
  else if (arg === '--full-page') fullPage = true
  else if (arg === '--click') clicks.push(args[++i])
  else if (arg === '--viewport') {
    const [width, height] = args[++i].split('x').map(Number)
    viewport = { width, height }
  } else if (!arg.startsWith('--')) url = arg
  else {
    console.error(`Unknown option: ${arg}`)
    process.exit(1)
  }
}

const { chromium } = loadPlaywright()

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport })

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (error) => consoleErrors.push(String(error)))

try {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 })
  for (const selector of clicks) {
    await page.click(selector, { timeout: 15000 })
  }
  if (delay > 0) await page.waitForTimeout(delay)
  await page.screenshot({ path: out, fullPage })
  console.log(`Screenshot saved to ${out}`)
} finally {
  await browser.close()
}

if (consoleErrors.length > 0) {
  console.log(`\n${consoleErrors.length} console error(s):`)
  for (const error of consoleErrors.slice(0, 20)) console.log(`  - ${error}`)
}
