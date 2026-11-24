/* eslint-disable */
// Temporary diagnostic: PERF-90 with every step timed and the probe running, to see why runs vary.
import { isTracking } from '../lib/centering.mjs'
import { mapWorkout, missionOnMap, prepareMap, steadyMapWorkout } from '../lib/perf.mjs'
import { armVehicle } from '../lib/mission.mjs'
import { probeFile, startProbe, stopProbe } from '../lib/probe.mjs'
import { beforeLaunch, meta as m } from './PERF-04.mjs'
import { ensureTrail, PATCH } from './PERF-90.mjs'
import { mapExpr } from '../lib/cockpit.mjs'
export { beforeLaunch }
const EXP = process.env.PERF_EXP || 'control'
// Tile servers mapped to the box's own (remote/tiles.mjs), so every run sees the same map with no internet in the way.
// A window that ends up behind another is otherwise throttled to no frames, which reads as a frozen app.
const LOCAL_TILES = ['--host-resolver-rules="MAP server.arcgisonline.com 127.0.0.1:8443,MAP tiles.openseamap.org 127.0.0.1:8443,MAP tile.openstreetmap.org 127.0.0.1:8443"', '--ignore-certificate-errors',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-position=0,0', '--window-size=1600,1080', '--no-first-run', '--no-default-browser-check']
export const meta = { ...m, title: `diagnostic: ${EXP}${process.env.PERF_TILES ? ' · local tiles' : ''}`, browserArgs: process.env.PERF_TILES ? LOCAL_TILES : undefined }
const steps = []
let t0
const step = (what) => { const s = ((Date.now() - t0) / 1000).toFixed(1); steps.push([what, +s]); console.log(`   step: ${what} at ${s} s`) }
let file
export async function setup(ctx) {
  const { page, vehicle } = ctx
  t0 = Date.now(); steps.length = 0
  await page.waitFor(() => missionOnMap(page).then(({ markers }) => markers >= 200), { label: 'the survey to be drawn', timeout: 240000 })
  step('survey drawn')
  const seen = await startProbe(page)
  console.log(`   probe: map z${seen.zoom}, ${seen.markers} markers, tile layers ${seen.tiles.map((u) => u.slice(8, 40)).join(' | ')}`)
  const restored = await page.store('mission', 's.vehiclePositionHistory.length')
  step(`trail ${restored} points restored`)
  await ensureTrail(ctx)
  await prepareMap(page, vehicle)
  step('map prepared')
  await armVehicle(vehicle)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, 10])
  await vehicle.command('MAV_CMD_DO_SET_MISSION_CURRENT', [92, 0])
  await vehicle.command('MAV_CMD_MISSION_START', [92, 0])
  await vehicle.command('MAV_CMD_DO_CHANGE_SPEED', [1, 3, -1])
  step('boat started')
  await page.wait(1000)
  if (EXP !== 'control') await page.eval(`(() => { const map = ${mapExpr('widget')}; const wps = [];
    map.eachLayer((l) => { if (l.options?.icon?.options?.className === 'waypoint-marker-icon') wps.push(l) });
    ${EXP.split('+').map((k) => PATCH[k]).join(';\n')}; return wps.length })()`)
  file = probeFile(ctx.outDir, EXP)
  outDir = ctx.outDir
}
let outDir
// PERF_TRACE=1 records a Chrome trace of the drag window alone, into the run's folder.
async function traced(page, fn) {
  const events = []
  page.on('Tracing.dataCollected', ({ value }) => events.push(...value))
  const done = new Promise((resolve) => page.on('Tracing.tracingComplete', resolve))
  await page.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing', 'cc', 'viz', 'gpu'] } })
  try { return await fn() } finally {
    await page.send('Tracing.end')
    await done
    const { writeFileSync } = await import('node:fs')
    writeFileSync(`${outDir}/trace-drag-${EXP}.json`, JSON.stringify({ traceEvents: events }))
    console.log(`   trace: ${events.length} events`)
  }
}
export default async function run({ page }) {
  const mark = (l) => page.eval(`window.__probe.ev.push([Math.round(performance.now()), 'harness', ${JSON.stringify(l)}])`)
  try {
    await mark('workout start'); step('workout start')
    const quiet = process.env.PERF_WORKOUT === 'steady' ? await steadyMapWorkout(page, process.env.PERF_TRACE ? { aroundDrag: (fn) => traced(page, fn) } : {}) : await mapWorkout(page)
    if (quiet) console.log(`   quiet waits: ${JSON.stringify(quiet)}`)
    await mark('workout end'); step('workout end')
  } finally {
    if (EXP.split('+').includes('numbers')) await page.store('mission', 's.alwaysShowWaypointNumbers = false').catch(() => {})
    await stopProbe(page, file, { exp: EXP, steps })
  }
}
