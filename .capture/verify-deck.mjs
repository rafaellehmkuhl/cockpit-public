import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const DECK = 'file://' + new URL('../presentation/index.html', import.meta.url).pathname
const OUT = new URL('./deck/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 })

const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)) })

await page.goto(DECK, { waitUntil: 'load' })
await page.waitForTimeout(1200)

const total = await page.evaluate(() => document.querySelectorAll('.slide').length)
console.log('slides:', total)

// Overflow is the failure mode that matters: a slide taller than the 720px stage silently clips.
const overflow = await page.evaluate(() => {
  const bad = []
  document.querySelectorAll('.slide').forEach((s, i) => {
    const prev = s.className
    s.classList.add('on')
    if (s.scrollHeight > 722 || s.scrollWidth > 1282) {
      bad.push({ i: i + 1, h: s.scrollHeight, w: s.scrollWidth, t: (s.querySelector('h1,h2') || {}).textContent })
    }
    s.className = prev
  })
  return bad
})

const want = process.argv.slice(2).map(Number).filter((n) => !isNaN(n))
const list = want.length ? want : [1, 3, 7, 12, 15, 16, 20, 23, 33, 34, 36, 38, 39, 43]
for (const n of list) {
  await page.evaluate((i) => { window.location.hash = '#' + i }, n)
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}slide-${String(n).padStart(2, '0')}.png` })
}

console.log('OVERFLOW:', JSON.stringify(overflow, null, 1))
console.log('ERRORS:', errors.length ? errors : 'none')
await browser.close()
