/* eslint-disable */
// Temporary experiment: PERF-05 with one suspect removed at runtime, chosen by PERF_EXP.
import { mapExpr } from '../lib/cockpit.mjs'
import { mapWorkout } from '../lib/perf.mjs'
import { beforeLaunch, meta as m, setup as baseSetup } from './PERF-04.mjs'
export { beforeLaunch }
const EXP = process.env.PERF_EXP || 'control'
export const meta = { ...m, title: `zoom/drag experiment: ${EXP}` }
export const PATCH = {
  control: '',
  nosseticon: 'wps.forEach((w) => { w.setIcon = function () { return this } })',
  notooltip: 'wps.forEach((w) => w.unbindTooltip())',
  both: 'wps.forEach((w) => { w.unbindTooltip(); w.setIcon = function () { return this } })',
  nomarkers: 'wps.forEach((w) => map.removeLayer(w))',
  notilenoise: `let tl = 0; map.eachLayer((l) => { if (l._tiles && l.listens?.('tileerror')) { l.off('tileerror'); l.off('tileload'); tl++ } })
    if (!tl) throw new Error('no tile layer with a fallback found')`,
  noreplay: `const client = Object.values(window.__SENTRY__ ?? {}).map((v) => v?.defaultCurrentScope?.getClient?.()).find(Boolean)
    const replay = client?.getIntegrationByName('Replay'); console.log('replay found', !!replay, replay?.isEnabled?.()); replay?.stop()
    if (!replay) throw new Error('no Sentry replay found')`,
  numbers: `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('mission').alwaysShowWaypointNumbers = true`,
  notrail: `const tr = []; map.eachLayer((l) => { if (l.options?.renderer?.options?.pane === 'vehiclePathPane' || l.getLayers?.()[0]?.options?.renderer?.options?.pane === 'vehiclePathPane') tr.push(l) }); tr.forEach((l) => map.removeLayer(l)); console.log('notrail removed', tr.length)`,
  nodraghide: `const sd = document.createElement('style'); sd.textContent = 'html .leaflet-container.cockpit-drag-active .waypoint-marker-icon, html .leaflet-container.cockpit-drag-active .waypoint-tooltip { display: block !important }'; document.head.appendChild(sd)`,
  noflex: `const sf = document.createElement('style'); sf.textContent = '.waypoint-number { display: block !important; text-align: center; line-height: 26px }'; document.head.appendChild(sf)`,
  nonumtext: `const sn = document.createElement('style'); sn.textContent = '.waypoint-number { visibility: hidden !important }'; document.head.appendChild(sn)`,
  wcicon: `const sw = document.createElement('style'); sw.textContent = '.waypoint-marker-icon { will-change: transform }'; document.head.appendChild(sw)`,
  wcnum: `const sv = document.createElement('style'); sv.textContent = '.waypoint-number { will-change: transform }'; document.head.appendChild(sv)`,
  smooth: `const so = document.createElement('style'); so.textContent = '.waypoint-number { -webkit-font-smoothing: antialiased; text-rendering: optimizeSpeed }'; document.head.appendChild(so)`,
  noz: `const st = document.createElement('style'); st.textContent = '.waypoint-number { z-index: auto !important }'; document.head.appendChild(st)`,
  inplace: `wps.forEach((w) => { w.setIcon = function (icon) {
    const el = this.getElement(); this.options.icon = icon; if (!el) return this
    const o = icon.options; el.innerHTML = o.html
    el.style.width = o.iconSize[0] + 'px'; el.style.height = o.iconSize[1] + 'px'
    el.style.marginLeft = -o.iconAnchor[0] + 'px'; el.style.marginTop = -o.iconAnchor[1] + 'px'
    return this } })`,
}
// Electron runs Cockpit once before the driver attaches, and a run of that which passes the 10 s flush stores the few
// positions it saw in IndexedDB, which outranks the seeded key. Put the seeded trail in by hand then, so every run has it.
export async function ensureTrail({ page, meta: runMeta }) {
  const STORE = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('mission')`
  if ((await page.eval(`${STORE}.vehiclePositionHistory.length`)) >= 100000) return
  const n = await page.eval(`(() => { const s = ${STORE}
    s.vehiclePositionHistory = [...JSON.parse(${JSON.stringify(runMeta.seed['cockpit-vehicle-position-history'])}), ...s.vehiclePositionHistory]
    s.vehiclePositionHistoryRevision++; return s.vehiclePositionHistory.length })()`)
  console.log(`   trail not restored by the app; injected, now ${n} points`)
  await page.check('The trail is on the map', () => ({ ok: n >= 100000, detail: `${n} points, injected` }))
}
export async function setup(ctx) {
  await baseSetup(ctx)
  await ensureTrail(ctx)
  const n = await ctx.page.eval(`(() => { const map = ${mapExpr('widget')}; const wps = [];
    map.eachLayer((l) => { if (l.options?.icon?.options?.className === 'waypoint-marker-icon') wps.push(l) });
    ${EXP.split("+").map((k) => PATCH[k]).join(";\n")}; return wps.length })()`)
  console.log(`   EXP ${EXP}: ${n} waypoint markers`)
}
// Visible waypoint numbers, from either renderer: a permanent tooltip at opacity 1, or a number inside the icon.
const NUMBERS = `[...document.querySelectorAll('.waypoint-tooltip:not(.waypoint-tooltip--icon)')].filter((e) => e.style.opacity === '1').length + document.querySelectorAll('.waypoint-number').length`
const STORE = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('mission')`
export default async function run({ page }) {
  console.log(`   numbers visible before: ${await page.eval(NUMBERS)}`)
  try {
    await workout(page)
  } finally {
    console.log(`   numbers visible after: ${await page.eval(NUMBERS)}`)
    // The setting syncs to the vehicle's BlueOS, so leave it as found.
    if (EXP.split('+').includes('numbers')) await page.eval(`${STORE}.alwaysShowWaypointNumbers = false`)
  }
}
async function workout(page) {
  if (!process.env.PERF_TRACE) return mapWorkout(page)
  const events = []
  page.on('Tracing.dataCollected', ({ value }) => events.push(...value))
  const done = new Promise((resolve) => page.on('Tracing.tracingComplete', resolve))
  await page.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing', 'latencyInfo', 'gpu', 'viz', 'cc', 'disabled-by-default-devtools.timeline.frame'] },
  })
  await page.eval(`performance.mark('workout-start')`)
  await mapWorkout(page)
  await page.send('Tracing.end')
  await done
  const { writeFileSync } = await import('node:fs')
  const out = `${process.env.PERF_TRACE}/trace-${EXP}-${Date.now()}.json`
  writeFileSync(out, JSON.stringify({ traceEvents: events }))
  console.log(`   trace: ${out} (${events.length} events)`)
}
