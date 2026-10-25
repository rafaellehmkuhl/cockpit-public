// Backend for the talk's live demos. One port does it all: it is the WebSocket feed Cockpit reads (demos 1 and 3),
// it receives the HTTP requests Cockpit's actions send (demo 2), it collects the audience's phones (demo 4), and it
// serves the page that shows what this side sees. Plain Node, no dependencies: `node presentation/demos/server.mjs`.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 8765)
const PAGE = new URL('./index.html', import.meta.url)
const JOIN = new URL('./join.html', import.meta.url)
const VENDOR = fileURLToPath(new URL('./vendor/', import.meta.url))
const JS = 'text/javascript; charset=utf-8'
const TEXT = 'text/plain; charset=utf-8'
// Files served as they are. The DIY widget in Cockpit imports the gimbal from here, so these allow any origin.
const FILES = {
  '/obstacle-map.js': [new URL('./obstacle-map.js', import.meta.url), JS],
  '/gimbal-view.js': [new URL('./gimbal-view.js', import.meta.url), JS],
  '/diy-widget/widget.html': [new URL('./diy-widget/widget.html', import.meta.url), TEXT],
  '/diy-widget/widget.css': [new URL('./diy-widget/widget.css', import.meta.url), TEXT],
  '/diy-widget/widget.js': [new URL('./diy-widget/widget.js', import.meta.url), TEXT],
}
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' }
const MAX_BODY = 64 * 1024
// On a public host the feed controls need this key (sent by the page as `x-control-key`); locally there is none.
const CONTROL_KEY = process.env.CONTROL_KEY ?? ''

// What the feed sends; the page edits it through POST /control/feed.
const feed = {
  running: true,
  format: 'json',
  rateHz: 10,
  sensors: {
    temperature: { value: 18.4, drift: true },
    salinity: { value: 35, drift: true },
    luminosity: { value: 420, drift: true },
  },
}
// The variable each virtual sensor sends, the range the console can set, and how far and how slowly it drifts.
const SENSORS = {
  temperature: { name: 'WaterTemp', min: -5, max: 45, amplitude: 1.2, periodS: 20, decimals: 2 },
  salinity: { name: 'Salinity', min: 0, max: 42, amplitude: 0.4, periodS: 27, decimals: 2 },
  luminosity: { name: 'Luminosity', min: 0, max: 2000, amplitude: 40, periodS: 13, decimals: 0 },
}
const RATES = [1, 2, 5, 10, 20]

const lanUrls = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((i) => i?.family === 'IPv4' && !i.internal)
    .map((i) => i.address)

// --- events to the page (Server-Sent Events) ---------------------------------------------
const pages = new Set()
const broadcast = (event, data) => {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of pages) res.write(chunk)
}
const state = () => ({
  feed,
  camera: cameraNow(),
  crowd: { on: crowd.on },
  obstacles: obstacleList(),
  vehicle: vehicleNow(),
  clients: [...sockets.values()].map(({ remote, since }) => ({ remote, since })),
  locked: Boolean(CONTROL_KEY),
  sitl: Boolean(process.env.SITL_M2R),
})

// Behind Traefik and Cloudflare the socket peer is the proxy, so the client is read from their headers.
const clientIp = (req) =>
  (req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? '?')
    .trim()
    .replace('::ffff:', '')

// --- the WebSocket feed --------------------------------------------------------------------
const sockets = new Map()

const frame = (opcode, payload = Buffer.alloc(0)) => {
  const n = payload.length
  const header =
    n < 126
      ? Buffer.from([0x80 | opcode, n])
      : n < 65536
      ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 0xff])
      : Buffer.concat([Buffer.from([0x80 | opcode, 127]), Buffer.from(new BigUint64Array([BigInt(n)]).buffer).reverse()])
  return Buffer.concat([header, payload])
}

// Cockpit never sends data on its connection; phones send small JSON text frames, each in one frame.
const readFrames = (socket, info, chunk, onText) => {
  info.pending = Buffer.concat([info.pending, chunk])
  while (info.pending.length >= 2) {
    const opcode = info.pending[0] & 0x0f
    let length = info.pending[1] & 0x7f
    let offset = 2
    if (length === 126) [length, offset] = [info.pending.readUInt16BE(2), 4]
    else if (length === 127) [length, offset] = [Number(info.pending.readBigUInt64BE(2)), 10]
    const masked = info.pending[1] & 0x80
    const total = offset + (masked ? 4 : 0) + length
    if (info.pending.length < total) return
    const mask = masked ? info.pending.subarray(offset, offset + 4) : null
    const payload = Buffer.from(info.pending.subarray(total - length, total))
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
    info.pending = info.pending.subarray(total)
    if (opcode === 0x8) {
      socket.end(frame(0x8, payload.subarray(0, 2)))
      return
    }
    if (opcode === 0x9) socket.write(frame(0xa, payload))
    if (opcode === 0x1 && onText) onText(payload.toString('utf8'))
  }
}

const handshake = (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key) return socket.destroy() && false
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
  )
  return true
}

const acceptSocket = (req, socket) => {
  if (!handshake(req, socket)) return
  const info = { remote: clientIp(req), since: Date.now(), pending: Buffer.alloc(0) }
  sockets.set(socket, info)
  broadcast('state', state())
  // A Cockpit that connects after the audience started gets every obstacle already placed. Cockpit drops external
  // points of interest until it has synced with the vehicle, up to 30 s without BlueOS, so the list is sent again for
  // a while; a repeat of one it already has is only a warning on its side.
  const replay = () => {
    if (!sockets.has(socket)) return
    for (const obstacle of obstacles.values()) sendJson(socket, addPoiCommand(obstacle))
  }
  replay()
  const replays = setInterval(replay, 10000)
  setTimeout(() => clearInterval(replays), 90000)
  socket.on('close', () => clearInterval(replays))
  socket.on('data', (chunk) => readFrames(socket, info, chunk))
  const drop = () => {
    if (sockets.delete(socket)) broadcast('state', state())
  }
  socket.on('close', drop)
  socket.on('error', drop)
}

// --- the audience: phones on /crowd drop obstacles on the map, which reach Cockpit as points of interest -----------
const phones = new Map()
const crowd = { on: false, chosen: false }
const obstacles = new Map()
// Where the presenter's boat is, as Cockpit reports it through an HTTP action (GET /vehicle).
const vehicle = { lat: null, lon: null, hdg: null, at: 0 }
let obstacleCount = 0
const MAX_PHONES = 2000
// No limit per person; this only stops a script from burying Cockpit's map in points of interest.
const MAX_OBSTACLES = 1000
const MIN_DISTANCE_M = 10
const MAX_DISTANCE_M = 1500

const distanceM = (a, b) => {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

const obstacleList = () => [...obstacles.values()].map(({ id, lat, lon }) => ({ id, lat, lon }))
const crowdNow = () => ({ Count: phones.size, Obstacles: obstacles.size })
const vehicleNow = () => (vehicle.lat === null ? null : { lat: vehicle.lat, lon: vehicle.lon, hdg: vehicle.hdg, at: vehicle.at })

const sendJson = (socket, data) => socket.write(frame(0x1, Buffer.from(JSON.stringify(data))))
const toPhones = (data) => {
  for (const socket of phones.keys()) sendJson(socket, data)
}
const toCockpit = (data) => {
  for (const socket of sockets.keys()) sendJson(socket, data)
}
const addPoiCommand = (obstacle) => ({
  type: 'cockpit:addPointOfInterest',
  poi: {
    id: obstacle.id,
    name: obstacle.name,
    description: 'Dropped by the audience',
    latitude: obstacle.lat,
    longitude: obstacle.lon,
    icon: 'mdi-alert-octagon',
    color: '#D2686A',
  },
})

const obstaclesChanged = () => {
  toPhones({ type: 'obstacles', list: obstacleList() })
  broadcast('obstacles', { list: obstacleList() })
}

// Phones are untrusted input from a public QR code, so every rule the page shows is enforced again here.
const placeObstacle = (lat, lon) => {
  if (![lat, lon].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return 'That spot is off the map.'
  if (vehicle.lat === null) return 'Waiting for the boat to report where it is.'
  const distance = distanceM(vehicle, { lat, lon })
  if (distance < MIN_DISTANCE_M) return `Too close to the boat: keep at least ${MIN_DISTANCE_M} m away.`
  if (distance > MAX_DISTANCE_M) return 'Too far from the boat to matter.'
  if (obstacles.size >= MAX_OBSTACLES) return 'The map is full.'
  const n = ++obstacleCount
  const round = (v) => Math.round(v * 1e6) / 1e6
  const obstacle = { id: `audience-obstacle-${n}`, name: `Obstacle ${n}`, lat: round(lat), lon: round(lon) }
  obstacles.set(obstacle.id, obstacle)
  toCockpit(addPoiCommand(obstacle))
  obstaclesChanged()
  return null
}

const clearObstacles = () => {
  for (const id of obstacles.keys()) toCockpit({ type: 'cockpit:removePointOfInterest', id })
  obstacles.clear()
  obstaclesChanged()
}

const onPhoneMessage = (socket, text) => {
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    return
  }
  if (typeof msg?.poi !== 'object' || msg.poi === null) return
  const reason = placeObstacle(Number(msg.poi.lat), Number(msg.poi.lon))
  sendJson(socket, reason ? { type: 'rejected', reason } : { type: 'placed' })
}

const acceptPhone = (req, socket) => {
  if (phones.size >= MAX_PHONES) return socket.destroy()
  if (!handshake(req, socket)) return
  const phone = { pending: Buffer.alloc(0) }
  phones.set(socket, phone)
  // The first phone puts the crowd in the feed, unless the console already chose.
  if (!crowd.chosen) crowd.on = true
  broadcast('state', state())
  sendJson(socket, {
    type: 'hello',
    count: phones.size,
    obstacles: obstacleList(),
    vehicle: vehicleNow(),
    minDistance: MIN_DISTANCE_M,
  })
  socket.on('data', (chunk) => readFrames(socket, phone, chunk, (text) => onPhoneMessage(socket, text)))
  const drop = () => {
    if (phones.delete(socket)) broadcast('state', state())
  }
  socket.on('close', drop)
  socket.on('error', drop)
}

// MAVLink sends GLOBAL_POSITION_INT in 1e7 degrees and centidegrees; plain degrees work too.
let lastVehicleSent = 0
const setVehicle = (lat, lon, hdg) => {
  if (![lat, lon].every(Number.isFinite)) return false
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) [lat, lon] = [lat / 1e7, lon / 1e7]
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false
  Object.assign(vehicle, {
    lat,
    lon,
    hdg: Number.isFinite(hdg) && hdg !== 65535 ? (hdg > 360 ? hdg / 100 : hdg) : vehicle.hdg,
    at: Date.now(),
  })
  // Cockpit can report many times a second; phones on a conference network only need a few.
  if (Date.now() - lastVehicleSent > 250) {
    lastVehicleSent = Date.now()
    toPhones({ type: 'vehicle', vehicle: vehicleNow() })
  }
  broadcast('vehicle', vehicleNow())
  return true
}

// On the VPS the SITL runs next door, so the boat is read straight from its mavlink2rest. A SITL without a GPS fix
// yet reports 0, 0, which is skipped rather than drawn off the coast of Africa.
const SITL_M2R = process.env.SITL_M2R
if (SITL_M2R) {
  setInterval(async () => {
    try {
      const url = `${SITL_M2R}/mavlink/vehicles/1/components/1/messages/GLOBAL_POSITION_INT`
      const { message } = await (await fetch(url, { signal: AbortSignal.timeout(1000) })).json()
      if (message.lat !== 0 || message.lon !== 0) setVehicle(message.lat, message.lon, message.hdg)
    } catch {
      // The SITL is still starting or restarting; the next poll tries again.
    }
  }, 250)
}

// At most one flash every few seconds, so a public URL can't strobe the room's phones.
let lastFlash = 0
const flashPhones = (text) => {
  if (Date.now() - lastFlash < 3000) return 0
  lastFlash = Date.now()
  const message = String(text || 'Cockpit says thanks!').slice(0, 80)
  for (const socket of phones.keys()) sendJson(socket, { type: 'flash', text: message })
  broadcast('flash', { at: Date.now(), text: message, phones: phones.size })
  return phones.size
}

// Each phone hears how many others are in, once a second.
setInterval(() => toPhones({ type: 'count', count: phones.size }), 1000)

// Drifting sensors move on a slow wave so the data lake sees a change every tick: Cockpit only notifies listeners
// (plots, action links, DIY widgets) when a value changes.
const started = Date.now()
const reading = () => {
  const t = (Date.now() - started) / 1000
  const values = Object.entries(SENSORS).map(([id, { name, min, max, amplitude, periodS, decimals }]) => {
    const { value, drift } = feed.sensors[id]
    const wave = drift ? amplitude * (Math.sin((2 * Math.PI * t) / periodS) + 0.12 * Math.sin(t * 1.7)) : 0
    return [name, Number(Math.min(max, Math.max(min, value + wave)).toFixed(decimals))]
  })
  return {
    ...Object.fromEntries(values),
    // Demo 3: the camera's state, which a DIY widget in Cockpit draws. Its attitude is the target the gimbal slews to.
    Camera: { Roll: camera.roll, Pitch: camera.pitch, Yaw: camera.yaw, Recording: camera.recording, Photos: camera.photos },
    ...(crowd.on ? { Crowd: crowdNow() } : {}),
  }
}

// Plain text is one variable per message and cannot nest, so the camera and the crowd still go as one JSON message:
// the widgets read them as external/camera/... in either format.
const messagesFor = (r) => {
  if (feed.format === 'json') return [JSON.stringify(r)]
  const flat = Object.entries(r).filter(([, v]) => typeof v !== 'object')
  const nested = Object.entries(r).filter(([, v]) => typeof v === 'object')
  return [...flat.map(([k, v]) => `${k}=${v}`), ...(nested.length ? [JSON.stringify(Object.fromEntries(nested))] : [])]
}

let timer
const tick = () => {
  const r = reading()
  const messages = messagesFor(r)
  const sent = feed.running ? sockets.size : 0
  if (feed.running) for (const socket of sockets.keys()) for (const m of messages) socket.write(frame(0x1, Buffer.from(m)))
  broadcast('feed', { at: Date.now(), reading: r, messages, sent })
  if (phones.size || crowd.on) broadcast('crowd', { at: Date.now(), ...(r.Crowd ?? crowdNow()) })
}
const schedule = () => {
  clearInterval(timer)
  timer = setInterval(tick, 1000 / feed.rateHz)
}

// --- demo 2: a virtual gimbal camera that Cockpit's HTTP actions drive ----------------------------------------------
const camera = { roll: 0, pitch: -10, yaw: 25, recording: false, recordingSince: 0, photos: 0 }
const CAMERA_LIMITS = { roll: [-45, 45], pitch: [-90, 30] }
const wrap180 = (angle) => ((((angle + 180) % 360) + 360) % 360) - 180
// The page's clock is not the server's, so a recording is sent as how long it has been running.
const cameraNow = () => {
  const { recordingSince, ...rest } = camera
  return { ...rest, recordingForMs: camera.recording ? Date.now() - recordingSince : 0 }
}

// Each endpoint changes the camera and says how; an unknown one returns null. Angles are degrees, and any of roll,
// pitch and yaw can be left out to keep its current value.
const CAMERA_COMMANDS = {
  '/camera/attitude': (params) => {
    for (const axis of ['roll', 'pitch', 'yaw']) {
      const value = params[axis] === null || params[axis] === undefined || params[axis] === '' ? NaN : Number(params[axis])
      if (!Number.isFinite(value)) continue
      camera[axis] = axis === 'yaw' ? wrap180(value) : Math.min(CAMERA_LIMITS[axis][1], Math.max(CAMERA_LIMITS[axis][0], value))
    }
    return 'attitude'
  },
  '/camera/photo': () => (camera.photos++, 'photo'),
  '/camera/record/start': () => {
    if (!camera.recording) Object.assign(camera, { recording: true, recordingSince: Date.now() })
    return 'record-start'
  },
  '/camera/record/stop': () => (Object.assign(camera, { recording: false }), 'record-stop'),
}

// --- control from the page ---------------------------------------------------------------------
const applyControl = (patch) => {
  if (typeof patch.running === 'boolean') feed.running = patch.running
  if (['json', 'text'].includes(patch.format)) feed.format = patch.format
  if (RATES.includes(patch.rateHz) && patch.rateHz !== feed.rateHz) {
    feed.rateHz = patch.rateHz
    schedule()
  }
  for (const [id, change] of Object.entries(patch.sensors ?? {})) {
    const spec = SENSORS[id]
    if (!spec || typeof change !== 'object' || change === null) continue
    if (Number.isFinite(change.value)) feed.sensors[id].value = Math.min(spec.max, Math.max(spec.min, change.value))
    if (typeof change.drift === 'boolean') feed.sensors[id].drift = change.drift
  }
  if (typeof patch.crowd === 'boolean') [crowd.on, crowd.chosen] = [patch.crowd, true]
}

// --- HTTP ----------------------------------------------------------------------------------------
// Cockpit's HTTP actions run from a browser page in the Lite build, so every reply allows any origin.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const parts = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
      } else parts.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error', reject)
  })

let requestCount = 0
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end()

  // The demo's own files change during rehearsals, so browsers and Cloudflare must not keep an old copy.
  const fresh = { 'Cache-Control': 'no-cache' }
  if (req.method === 'GET' && url.pathname === '/') {
    return res.writeHead(200, { ...fresh, 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(PAGE))
  }
  if (url.pathname === '/favicon.ico') return res.writeHead(204).end()
  if (req.method === 'GET' && url.pathname === '/join') {
    return res.writeHead(200, { ...fresh, 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(JOIN))
  }
  if (req.method === 'GET' && FILES[url.pathname]) {
    const [file, type] = FILES[url.pathname]
    return res.writeHead(200, { ...CORS, ...fresh, 'Content-Type': type }).end(readFileSync(file))
  }
  if (req.method === 'GET' && url.pathname.startsWith('/vendor/')) {
    const file = resolve(VENDOR, decodeURIComponent(url.pathname.slice('/vendor/'.length)))
    if (!file.startsWith(VENDOR.endsWith(sep) ? VENDOR : VENDOR + sep) || !existsSync(file) || !TYPES[extname(file)]) {
      return res.writeHead(404).end()
    }
    const headers = { ...CORS, 'Content-Type': `${TYPES[extname(file)]}; charset=utf-8`, 'Cache-Control': 'max-age=3600' }
    return res.writeHead(200, headers).end(readFileSync(file))
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.write(`event: state\ndata: ${JSON.stringify(state())}\n\n`)
    pages.add(res)
    req.on('close', () => pages.delete(res))
    return
  }

  if (req.method === 'POST' && url.pathname.startsWith('/control/')) {
    if (CONTROL_KEY && req.headers['x-control-key'] !== CONTROL_KEY) {
      return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'wrong or missing key' }))
    }
  }
  if (req.method === 'POST' && url.pathname === '/control/obstacles/clear') {
    clearObstacles()
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ obstacles: 0 }))
  }
  // The presenter's Cockpit reports the boat here from an HTTP action; on a public host it sends the key as a header.
  if (url.pathname === '/vehicle') {
    if (CONTROL_KEY && req.headers['x-control-key'] !== CONTROL_KEY) return res.writeHead(401, CORS).end()
    const q = url.searchParams
    const ok = setVehicle(Number(q.get('lat')), Number(q.get('lon')), Number(q.get('hdg')))
    return res.writeHead(ok ? 200 : 400, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok }))
  }
  if (req.method === 'POST' && url.pathname === '/control/flash') {
    const body = await readBody(req).catch(() => '')
    let text
    try {
      text = JSON.parse(body).text
    } catch {}
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ phones: flashPhones(text) }))
  }
  if (req.method === 'POST' && url.pathname === '/control/feed') {
    try {
      applyControl(JSON.parse(await readBody(req)))
      broadcast('state', state())
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(feed))
    } catch (error) {
      return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(error.message) }))
    }
  }

  // Anything else is a request from a Cockpit action: show it on the page and acknowledge it.
  let body = ''
  try {
    body = await readBody(req)
  } catch {
    return res.writeHead(413, CORS).end()
  }
  let json = null
  try {
    json = body ? JSON.parse(body) : null
  } catch {}
  const entry = {
    id: ++requestCount,
    at: Date.now(),
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'key')),
    headers: Object.fromEntries(
      ['content-type', 'authorization', 'user-agent'].filter((h) => req.headers[h]).map((h) => [h, req.headers[h]])
    ),
    body,
    json,
    from: clientIp(req),
  }
  broadcast('request', entry)
  if (url.pathname.startsWith('/camera')) {
    const command = CAMERA_COMMANDS[url.pathname.replace(/\/$/, '')]
    // On a public host only the presenter's Cockpit moves the camera; actions can send the key as a header or `key=`.
    const allowed = !CONTROL_KEY || [req.headers['x-control-key'], url.searchParams.get('key')].includes(CONTROL_KEY)
    if (!command || !allowed) {
      const error = command ? 'wrong or missing key' : `unknown endpoint; try ${Object.keys(CAMERA_COMMANDS).join(', ')}`
      return res.writeHead(command ? 401 : 404, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ error }))
    }
    const event = command({ ...Object.fromEntries(url.searchParams), ...(json && typeof json === 'object' ? json : {}) })
    broadcast('camera', { ...cameraNow(), event })
    return res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(cameraNow()))
  }
  // An action link fires on every change, true and false alike, so `when` lets the action pass its trigger along.
  let flashed
  if (url.pathname === '/crowd/flash') {
    const when = url.searchParams.get('when')
    // Only the key holder chooses the words on everyone's phone; the public URL always says thanks.
    const text = !CONTROL_KEY || req.headers['x-control-key'] === CONTROL_KEY ? url.searchParams.get('text') : null
    flashed = when === null || ['true', '1'].includes(when.trim().toLowerCase()) ? flashPhones(text) : 0
  }
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, id: entry.id, flashed }))
})

server.on('upgrade', (req, socket) => (new URL(req.url, 'http://localhost').pathname === '/crowd' ? acceptPhone : acceptSocket)(req, socket))
server.listen(PORT, () => {
  schedule()
  console.log(`Demo page:      http://localhost:${PORT}/`)
  console.log(`Cockpit feed:   ws://localhost:${PORT}`)
  console.log(`Gimbal camera:  http://localhost:${PORT}/camera/attitude?pitch=-45&yaw=90`)
  console.log(`Audience joins: http://localhost:${PORT}/join`)
  for (const ip of lanUrls()) console.log(`On the network: http://${ip}:${PORT}/`)
})
