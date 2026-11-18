/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { CENTER, isTracking, openCenterDial } from '../lib/centering.mjs'
import { mapExpr, mapView } from '../lib/cockpit.mjs'
import { armVehicle } from '../lib/mission.mjs'
import { MAP_PROFILE, measure, missionOnMap, prepareMap } from '../lib/perf.mjs'
import { distance } from '../lib/vehicle.mjs'

export const meta = {
  title: 'Following the boat for a minute, mid-way through a 200-waypoint survey with its long trail behind it',
  route: '/',
  needs: ['vehicle'],
  perf: true,
  synced: { ...MAP_PROFILE, 'cockpit-vehicle-mission': [] },
  // The seeded settings already match the vehicle's, and a build frozen by the long trail never gets its first sync done.
  waitForSync: false,
}

const LEGS = 10
const PER_LEG = 20
// At zoom 16 on the 1600x1000 map this spans most of the screen, with waypoints ~70 px apart.
const ALONG_M = 150
const ACROSS_M = 180
// The boat starts here, mid-survey, so the survey surrounds it on screen while the map follows it.
const START = 4 * PER_LEG + 10
const TRAIL_POINTS = 100000
const AUTO = 10

/**
 * The survey's waypoints, laid out so waypoint `START` sits on the boat.
 * @param {{lat: number, lon: number}} boat - Where the boat is
 * @returns {{lat: number, lon: number}[]} Waypoints in mission order
 */
const survey = (boat) => {
  const mPerLon = 111320 * Math.cos((boat.lat * Math.PI) / 180)
  const grid = (i) => {
    const leg = Math.floor(i / PER_LEG)
    const along = leg % 2 ? PER_LEG - 1 - (i % PER_LEG) : i % PER_LEG
    return { x: along * ALONG_M, y: leg * ACROSS_M }
  }
  const origin = grid(START)
  return Array.from({ length: LEGS * PER_LEG }, (_, i) => {
    const { x, y } = grid(i)
    return { lat: boat.lat + (y - origin.y) / 111320, lon: boat.lon + (x - origin.x) / mPerLon }
  })
}

/**
 * Where the boat has already been: one whole run of the survey, then this run up to `START`, with a couple of metres of
 * GPS wander. Deterministic, so every run and every build gets the same trail.
 * @param {{lat: number, lon: number}[]} waypoints - The survey
 * @returns {number[][]} Oldest to newest [lat, lon] pairs, the shape Cockpit keeps its position history in
 */
const pastTrail = (waypoints) => {
  const route = [...waypoints, ...waypoints.slice(0, START + 1)]
  const legs = route.slice(1).map((b, i) => ({ a: route[i], b, m: distance(route[i], b) }))
  const total = legs.reduce((sum, l) => sum + l.m, 0)
  const mPerLon = 111320 * Math.cos((waypoints[0].lat * Math.PI) / 180)
  const trail = []
  let leg = 0
  let legStart = 0
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const at = (i / (TRAIL_POINTS - 1)) * total
    while (leg < legs.length - 1 && legStart + legs[leg].m < at) legStart += legs[leg++].m
    const { a, b, m } = legs[leg]
    const f = Math.min(1, (at - legStart) / m)
    const wander = 1.5 * Math.sin(i / 400) + 0.7 * Math.sin(i / 37)
    const lat = a.lat + (b.lat - a.lat) * f + (wander * 0.6) / 111320
    const lon = a.lon + (b.lon - a.lon) * f + (wander * 0.8) / mPerLon
    // 7 decimals is ~1 cm, and keeps the JSON well inside the localStorage quota.
    trail.push([Number(lat.toFixed(7)), Number(lon.toFixed(7))])
  }
  return trail
}

/**
 * Load the survey on the vehicle and the trail into the profile before Cockpit starts. The trail goes under the key
 * 1.19 keeps it in, which later versions import on their first start.
 * @param {object} ctx - Runner context
 * @param {object} ctx.vehicle - Vehicle helpers
 * @param {object} ctx.meta - This run's case metadata; its `seed` is written to localStorage before Cockpit starts
 */
export async function beforeLaunch({ vehicle, meta: runMeta }) {
  const waypoints = survey(await vehicle.position())
  // ArduPilot replaces item 0 with home, so the survey goes after a placeholder.
  await vehicle.writeMission([waypoints[0], ...waypoints])
  runMeta.seed = {
    'cockpit-vehicle-position-history': JSON.stringify(pastTrail(waypoints)),
    // 1.19 copies every localStorage key into this backup on a profile that has none, which would double the trail.
    'cockpit-settings-v1-backup': JSON.stringify({ 'seeded-by-e2e': true }),
  }
}

/**
 * Check the survey and the trail are on the map, then start the boat at waypoint `START`, all off camera.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 * @param {object} ctx.vehicle - Vehicle helpers
 */
export async function setup({ page, vehicle }) {
  await page.waitFor(() => missionOnMap(page).then(({ markers }) => markers >= LEGS * PER_LEG), {
    label: 'the survey to be drawn',
    // A build frozen by the long trail takes minutes to draw it; that time is setup, not measured.
    timeout: 240000,
  })
  const restored = await page.store('mission', 's.vehiclePositionHistory.length')
  await page.check('The app restored the long trail', () => ({
    ok: restored >= TRAIL_POINTS,
    detail: `${restored} points`,
  }))
  await prepareMap(page, vehicle)
  await armVehicle(vehicle)
  await vehicle.command('MAV_CMD_DO_SET_MODE', [1, AUTO])
  await vehicle.command('MAV_CMD_DO_SET_MISSION_CURRENT', [START + 2, 0])
  await vehicle.command('MAV_CMD_MISSION_START', [START + 2, 0])
  await vehicle.command('MAV_CMD_DO_CHANGE_SPEED', [1, 3, -1])
  await page.wait(3000)
}

/**
 * Follow the boat for 60 s without touching anything.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 * @param {object} ctx.vehicle - Vehicle helpers
 */
export default async function run({ page, vehicle }) {
  await page.caption('The boat is mid-survey. Double-click the vehicle button to follow it')
  await openCenterDial(page)
  await page.dblClick(CENTER.vehicle, { settle: 1500 })
  await page.check('Vehicle button shows it is tracking', () => isTracking(page, CENTER.vehicle))
  await page.key('Escape', { show: false })

  const start = await vehicle.position()
  await page.caption('Following the boat for one minute, hands off')
  await measure(page, 'mission', () => page.wait(60000), { map: mapExpr('widget') })
  const end = await vehicle.position()
  const travelled = distance(start, end)
  await page.check('The boat moved', () => ({ ok: travelled > 60, detail: `${travelled.toFixed(0)} m` }))
  const gap = distance(await mapView(page, 'widget'), end)
  await page.check('The map kept the boat centred', () => ({
    ok: gap < 15,
    detail: `${gap.toFixed(1)} m from the centre`,
  }))
}
