// Demo 4: how far the boat gets without passing within HIT_RADIUS_M of a point of interest. Every POI keeps its
// coordinates in the data lake as cockpit/pois/<id>/latitude and /longitude, so the obstacles the audience drops
// are read from there, and the boat from the autopilot's GLOBAL_POSITION_INT.
// The block keeps these names local, so the widget can run again without the script mode set to scoped.
{
  const HIT_RADIUS_M = 5
  const POSITION = 'mavlink/1/1/GLOBAL_POSITION_INT'
  const COUNTDOWN_S = 3
  const host = (typeof root === 'undefined' ? document : root).querySelector('.apdc-run')
  const $ = (selector) => host.querySelector(selector)
  const every = typeof root === 'undefined' ? window.setInterval : cockpit.setInterval

  const metersBetween = (a, b) => {
    const rad = Math.PI / 180
    const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
    return 2 * 6371000 * Math.asin(Math.sqrt(h))
  }
  // MAVLink sends degrees times 1e7.
  const degrees = (value) => (Math.abs(Number(value)) > 180 ? Number(value) / 1e7 : Number(value))
  const boat = () => {
    const lat = degrees(cockpit.getDataLakeVariableData(`${POSITION}/lat`))
    const lon = degrees(cockpit.getDataLakeVariableData(`${POSITION}/lon`))
    return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null
  }
  const obstacles = () =>
    Object.keys(cockpit.getAllDataLakeVariablesInfo())
      .map((id) => id.match(/^cockpit\/pois\/(.+)\/latitude$/)?.[1])
      .filter(Boolean)
      .map((poi) => ({
        lat: Number(cockpit.getDataLakeVariableData(`cockpit/pois/${poi}/latitude`)),
        lon: Number(cockpit.getDataLakeVariableData(`cockpit/pois/${poi}/longitude`)),
      }))
      .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon))

  let state = 'idle'
  let distance = 0
  let last = null
  let startedAt = 0
  let endedAt = 0

  const setState = (next, status) => {
    state = next
    host.dataset.state = next
    $('.status').textContent = status
    $('.start').disabled = next === 'countdown' || next === 'running'
  }
  const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

  const start = () => {
    if (state === 'countdown' || state === 'running') return
    distance = 0
    last = boat()
    startedAt = Date.now() + COUNTDOWN_S * 1000
    setState('countdown', `${COUNTDOWN_S}…`)
  }
  const reset = () => {
    distance = 0
    startedAt = endedAt = 0
    setState('idle', 'Ready')
  }
  $('.start').addEventListener('click', start)
  $('.reset').addEventListener('click', reset)

  // Also offered as Cockpit actions, so a joystick button starts the run without letting go of the sticks.
  for (const [id, name, run] of [['apdc-obstacle-run-start', 'Obstacle run: start', start], ['apdc-obstacle-run-reset', 'Obstacle run: reset', reset]]) {
    const action = { protocol: 'cockpit-action', id, name }
    cockpit.registerNewAction(action)
    const callbackId = cockpit.registerActionCallback(action, run)
    cockpit.onCleanup?.(() => cockpit.unregisterActionCallback(callbackId))
  }

  every(() => {
    const now = Date.now()
    const here = boat()
    const list = obstacles()
    const nearest = here && list.length ? Math.min(...list.map((o) => metersBetween(here, o))) : null
    $('.count').textContent = list.length
    $('.nearest').textContent = nearest === null ? '—' : `${nearest.toFixed(1)} m`

    if (state === 'countdown') {
      if (now < startedAt) $('.status').textContent = `${Math.ceil((startedAt - now) / 1000)}…`
      else {
        last = here
        setState('running', 'Go!')
      }
    }
    if (state === 'running' && here) {
      // A jump this large between two reads is a position glitch, not the boat moving.
      if (last && metersBetween(last, here) < 50) distance += metersBetween(last, here)
      last = here
      if (nearest !== null && nearest < HIT_RADIUS_M) {
        endedAt = now
        setState('hit', 'Hit!')
      }
    }
    $('.distance').textContent = distance.toFixed(distance < 100 ? 1 : 0)
    const elapsed = state === 'running' ? now - startedAt : state === 'hit' ? endedAt - startedAt : 0
    $('.time').textContent = clock(Math.max(0, elapsed))
  }, 200)
}
