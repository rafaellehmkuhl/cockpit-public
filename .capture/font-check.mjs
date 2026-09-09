import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } })

const failed = []
page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText || '')))
page.on('response', (r) => {
  if (r.url().includes('materialdesignicons') || r.url().includes('.woff')) {
    console.log('FONT RESP', r.status(), r.url().slice(-70))
  }
})

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)

const info = await page.evaluate(async () => {
  await document.fonts.ready
  const faces = [...document.fonts].map((f) => `${f.family} | ${f.status}`)
  const el = document.querySelector('.mdi, .v-icon, [class*="mdi-"]')
  const cs = el ? getComputedStyle(el) : null
  return {
    faces,
    check: document.fonts.check('24px "Material Design Icons"'),
    sample: el ? el.className.toString().slice(0, 80) : 'none',
    fontFamily: cs ? cs.fontFamily : 'n/a',
    content: cs ? getComputedStyle(el, '::before').content.slice(0, 20) : 'n/a',
  }
})
console.log(JSON.stringify(info, null, 2))
console.log('FAILED REQS:', failed.slice(0, 10))
await browser.close()
