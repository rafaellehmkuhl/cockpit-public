/* eslint-disable */
// Temporary experiment: the map workout (idle, wheel zoom, drag pan) in four conditions on PERF-04's scene, the boat
// moving or holding, the map following it or not. PERF_EXP picks runtime patches from PERF-90, joined with '+'.
import { CENTER, isTracking, openCenterDial } from '../lib/centering.mjs'
import { mapExpr, setMapView } from '../lib/cockpit.mjs'
import { mapWorkout } from '../lib/perf.mjs'
import { ensureTrail, PATCH } from './PERF-90.mjs'
import { beforeLaunch, meta as m, setup as baseSetup } from './PERF-04.mjs'
export { beforeLaunch }
const EXP = process.env.PERF_EXP || 'control'
export const meta = { ...m, title: `map matrix: ${EXP}` }
const HOLD = 4

export async function setup(ctx) {
  await baseSetup(ctx)
  await ensureTrail(ctx)
  if (EXP === 'control') return
  const n = await ctx.page.eval(`(() => { const map = ${mapExpr('widget')}; const wps = [];
    map.eachLayer((l) => { if (l.options?.icon?.options?.className === 'waypoint-marker-icon') wps.push(l) });
    ${EXP.split('+').map((k) => { if (!(k in PATCH)) throw new Error(`unknown PERF_EXP ${k}`); return PATCH[k] }).join(';\n')}; return wps.length })()`)
  console.log(`   EXP ${EXP}: ${n} waypoint markers`)
}

async function follow(page, vehicle) {
  await setMapView(page, 'widget', await vehicle.position(), 16)
  await openCenterDial(page)
  await page.dblClick(CENTER.vehicle, { settle: 1500 })
  await page.check('Vehicle button shows it is tracking', () => isTracking(page, CENTER.vehicle))
  await page.key('Escape', { show: false })
}

async function free(page, vehicle) {
  await openCenterDial(page)
  const tracking = await isTracking(page, CENTER.vehicle)
  await page.key('Escape', { show: false })
  await page.check('The map is not tracking the boat', () => ({ ok: !tracking }))
  await setMapView(page, 'widget', await vehicle.position(), 16)
  await page.wait(2000)
}

async function speed(vehicle) {
  return (await vehicle.waitFor('VFR_HUD', () => true, 5000))?.groundspeed ?? NaN
}

async function block(page, vehicle, name, moving) {
  const gs = await speed(vehicle)
  console.log(`   ${name}: groundspeed ${gs.toFixed(2)} m/s`)
  await page.check(`${name}: the boat is ${moving ? 'moving' : 'holding'}`, () => ({
    ok: moving ? gs > 1 : gs < 0.2,
    detail: `${gs.toFixed(2)} m/s`,
  }))
  await mapWorkout(page, { prefix: `${name} · ` })
}

export default async function run({ page, vehicle }) {
  await follow(page, vehicle)
  await block(page, vehicle, 'moving, following', true)
  // The drags of the last block stopped the following.
  await free(page, vehicle)
  await block(page, vehicle, 'moving, free', true)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, HOLD])
  await vehicle.waitFor('VFR_HUD', (v) => v.groundspeed < 0.1, 60000)
  await free(page, vehicle)
  await block(page, vehicle, 'holding, free', false)
  await follow(page, vehicle)
  await block(page, vehicle, 'holding, following', false)
}
