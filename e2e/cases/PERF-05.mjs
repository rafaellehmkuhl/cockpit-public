/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { mapWorkout } from '../lib/perf.mjs'
import { beforeLaunch, meta as followMeta, setup } from './PERF-04.mjs'

export { beforeLaunch, setup }

export const meta = {
  ...followMeta,
  title: 'Wheel zoom and drag on the map, mid-way through a 200-waypoint survey with its long trail behind it',
}

/**
 * The standard map workout on PERF-04's scene, with the boat running the survey and the map not following it.
 * @param {object} ctx - Case context from the runner
 * @param {object} ctx.page - Driver page
 */
export default async function run({ page }) {
  await mapWorkout(page)
}
