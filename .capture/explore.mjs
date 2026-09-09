import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/'
const OUT = new URL('./out/', import.meta.url).pathname

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

page.on('console', (m) => {
  if (m.type() === 'error') console.log('PAGE ERROR:', m.text().slice(0, 200))
})

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(12000)

await page.screenshot({ path: OUT + 'explore-boot.png' })

const info = await page.evaluate(() => {
  const keys = Object.keys(localStorage)
  const dialogs = [...document.querySelectorAll('.v-overlay--active, .v-dialog, [role="dialog"]')].map((d) =>
    (d.textContent || '').trim().slice(0, 300)
  )
  return { keys, dialogs, title: document.title, hash: location.hash }
})

console.log(JSON.stringify(info, null, 2))
await browser.close()
