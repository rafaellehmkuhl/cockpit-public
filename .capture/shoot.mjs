import { chromium } from 'playwright'
import { WebSocketServer } from 'ws'
import { mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs'

const BASE = 'http://localhost:5173/'
const SHOTS = new URL('../presentation/media/shots/', import.meta.url).pathname
const CLIPS = new URL('../presentation/media/clips/', import.meta.url).pathname
const TMPVID = new URL('./vid/', import.meta.url).pathname

mkdirSync(SHOTS, { recursive: true })
mkdirSync(CLIPS, { recursive: true })
rmSync(TMPVID, { recursive: true, force: true })
mkdirSync(TMPVID, { recursive: true })

const WS_PORT = 8765

// Live payload feed, in the exact `name=value` wire format Cockpit's generic WebSocket door expects.
const startFeed = () => {
  const wss = new WebSocketServer({ port: WS_PORT })
  wss.on('connection', (ws) => {
    let t = 0
    const tick = setInterval(() => {
      t += 1
      const send = (s) => ws.readyState === 1 && ws.send(s)
      send(`WaterTemp=${(18.4 + Math.sin(t / 9) * 1.7).toFixed(2)}`)
      send(`Salinity=${(34.7 + Math.cos(t / 13) * 0.4).toFixed(2)}`)
      send(`SonarAltitude=${(12.3 + Math.sin(t / 5) * 3.1).toFixed(2)}`)
      send(`WinchPayout=${(45 + t * 0.35).toFixed(1)}`)
      send(`PayloadStatus="Logging"`)
    }, 250)
    ws.on('close', () => clearInterval(tick))
  })
  return wss
}

const settle = async (page, ms = 1400) => {
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForTimeout(ms)
}

// The tutorial is persistent and comes back on navigation, so opt out of it first and only then close it.
const dismissTutorial = async (page) => {
  await page.locator('button:has-text("Don\'t show again")').first().click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const holders = [...document.querySelectorAll('div')].filter(
      (el) => el.textContent?.includes('Welcome to Cockpit!') && el.querySelector('.mdi-close')
    )
    // Innermost match is the modal itself rather than a page-level wrapper.
    const modal = holders.sort((a, b) => a.textContent.length - b.textContent.length)[0]
    modal?.querySelector('.mdi-close')?.closest('button')?.click()
  })
  // Any leftover snackbars would sit on top of the shots.
  await page.evaluate(() => {
    document.querySelectorAll('.v-snackbar .mdi-close').forEach((i) => i.closest('button')?.click())
  })
  await page.waitForTimeout(500)
}

const boot = async (ctx) => {
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.dismiss().catch(() => {}))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await dismissTutorial(page)
  return page
}

const go = async (page, hash, wait = 2200) => {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  await settle(page, wait)
}

const shot = async (page, name) => {
  await dismissTutorial(page)
  await page.screenshot({ path: SHOTS + name + '.png' })
  console.log('  shot:', name)
}

// Adds the running feed as a generic WebSocket connection, through the real settings UI.
const wireUpWebSocket = async (page) => {
  await go(page, '#/settings/general', 2600)
  const panel = page.locator('text=Generic WebSocket connections').first()
  await panel.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(800)
  const field = page.locator('input[type="input"]').last()
  await field.click()
  await field.fill(`ws://localhost:${WS_PORT}`)
  await page.waitForTimeout(500)
  await shot(page, '02-websocket-typed')
  await page.locator('button:has-text("Add connection")').first().click()
  await page.waitForTimeout(3000)
}

const wss = startFeed()
const browser = await chromium.launch()

// ---------------------------------------------------------------- stills
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
  const page = await boot(ctx)

  await shot(page, '01-main-interface')

  try {
    await wireUpWebSocket(page)
    await shot(page, '03-websocket-connected')
  } catch (e) { console.log('  !! websocket flow:', e.message.slice(0, 120)) }

  // The data lake carries 500+ variables; filtering to the ones that just arrived is the point being made.
  try {
    await go(page, '#/tools/data-lake', 3000)
    await shot(page, '04-data-lake')
    const search = page.getByPlaceholder('Search variables').first()
    await search.click()
    await search.type('external', { delay: 80 })
    await page.waitForTimeout(2500)
    await shot(page, '04b-data-lake-external')
  } catch (e) { console.log('  !! data-lake:', e.message.slice(0, 120)) }

  try {
    await go(page, '#/settings/actions', 2600)
    await shot(page, '05-actions')
    await page.locator('button:has-text("New action")').first().click()
    await page.waitForTimeout(1600)
    await shot(page, '05b-action-types')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
  } catch (e) { console.log('  !! actions:', e.message.slice(0, 120)) }

  const pages = [
    ['#/tools/logs', '06-data-logs', 2400],
    ['#/settings/joystick', '07-joystick', 3000],
    ['#/settings/video', '08-video', 2400],
    ['#/tools/mavlink', '09-mavlink-inspector', 2400],
    ['#/mission-planning', '10-mission-planning', 4000],
    ['#/edit', '11-edit-mode', 2600],
    ['#/about', '12-about', 2000],
  ]
  for (const [hash, name, wait] of pages) {
    try {
      await go(page, hash, wait)
      await shot(page, name)
    } catch (e) { console.log('  !!', name, e.message.slice(0, 100)) }
  }

  await ctx.close()
}

// ---------------------------------------------------------------- clip: the websocket door
{
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: TMPVID, size: { width: 1600, height: 900 } },
  })
  const page = await boot(ctx)
  try {
    await wireUpWebSocket(page)
    await page.waitForTimeout(2500)
    await go(page, '#/tools/data-lake', 3000)
    // Filter down to the variables that just arrived from outside.
    const search = page.getByPlaceholder('Search variables').first()
    await search.click().catch(() => {})
    await search.type('external', { delay: 120 }).catch(() => {})
    await page.waitForTimeout(8000)
  } catch (e) { console.log('  !! clip:', e.message.slice(0, 120)) }
  await ctx.close()
  const f = readdirSync(TMPVID).find((n) => n.endsWith('.webm'))
  if (f) { renameSync(TMPVID + f, CLIPS + 'websocket-door.webm'); console.log('  clip: websocket-door.webm') }
}

await browser.close()
wss.close()
console.log('capture done')
