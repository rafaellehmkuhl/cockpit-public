// Diagnostic probe for performance cases: what the map, its tiles, the console and the vehicle did during a run, on
// the same performance.now() clock as the frame sampler, so every slow frame can be lined up with what caused it.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { mapExpr } from './cockpit.mjs'

const PINIA = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`

/**
 * Start recording. Call once the map is drawn.
 * @param {object} page - Driver page
 * @returns {Promise<object>} What the map is showing when the probe starts
 */
export const startProbe = (page) =>
  page.eval(`(() => {
    const map = ${mapExpr('widget')}; const now = () => Math.round(performance.now())
    const P = window.__probe = { ev: [] }; const log = (k, d) => P.ev.push([now(), k, d])
    for (const n of ['zoomstart', 'zoomend', 'movestart', 'moveend', 'dragstart', 'dragend']) map.on(n, () => log(n, n === 'zoomend' ? map.getZoom() : undefined))
    const tiles = []
    map.eachLayer((l) => { if (!l._tiles) return; tiles.push(l._url)
      l.on('tileloadstart', () => log('tileStart', l._url.slice(8, 30)))
      l.on('tileload', () => log('tileLoad', l._url.slice(8, 30)))
      l.on('tileerror', () => log('tileError', l._url.slice(8, 30))) })
    let setIcons = 0; map.eachLayer((l) => { if (l.options?.icon?.options?.className === 'waypoint-marker-icon') {
      const orig = l.setIcon; l.setIcon = function (...a) { setIcons++; return orig.apply(this, a) } } })
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) { const orig = console[level]
      console[level] = (...a) => { try { log('console.' + level, a.map(String).join(' ').slice(0, 200)) } catch {} return orig.apply(console, a) } }
    const v = ${PINIA}.get('main-vehicle'), m = ${PINIA}.get('mission')
    P.timer = setInterval(() => { const c = map.getCenter()
      log('s', { lat: +c.lat.toFixed(6), lon: +c.lng.toFixed(6), z: map.getZoom(), vlat: v.coordinates?.latitude, vlon: v.coordinates?.longitude,
        gs: v.velocity?.ground ?? null, mode: v.mode, icons: document.querySelectorAll('.waypoint-marker-icon').length,
        numbers: document.querySelectorAll('.waypoint-number').length, tilesLoading: document.querySelectorAll('.leaflet-tile:not(.leaflet-tile-loaded)').length,
        setIcons, trail: m.vehiclePositionHistory.length, heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6) }) }, 250)
    return { tiles, zoom: map.getZoom(), markers: document.querySelectorAll('.waypoint-marker-icon').length }
  })()`)

/**
 * Stop recording and save what was seen next to the run's other files.
 * @param {object} page - Driver page
 * @param {string} file - Where to write it
 * @param {object} extra - More to keep with it, such as the harness's own step timings
 */
export async function stopProbe(page, file, extra = {}) {
  const ev = await page.eval(`(() => { clearInterval(window.__probe.timer); return window.__probe.ev })()`)
  writeFileSync(file, JSON.stringify({ ...extra, ev }))
  const count = (k) => ev.filter((e) => e[1] === k).length
  console.log(`   probe: ${ev.length} events, tiles ${count('tileStart')} started / ${count('tileLoad')} loaded / ${count('tileError')} failed, ${count('zoomend')} zooms`)
}
export const probeFile = (outDir, tag) => join(outDir, `probe-${tag}-${Date.now()}.json`)
