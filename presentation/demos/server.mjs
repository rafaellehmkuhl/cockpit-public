// Backend for the talk's live demos. One port does it all: it is the WebSocket feed Cockpit reads (demos 1 and 3),
// it receives the HTTP requests Cockpit's actions send (demo 2), it collects the audience's phones (demo 4), and it
// serves the page that shows what this side sees. Plain Node, no dependencies: `node presentation/demos/server.mjs`.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

const PORT = Number(process.env.PORT ?? 8765)
const PAGE = new URL('./index.html', import.meta.url)
const JOIN = new URL('./join.html', import.meta.url)
const QR = new URL('./vendor/qrcode.js', import.meta.url)
const MAX_BODY = 64 * 1024
// On a public host the feed controls need this key (sent by the page as `x-control-key`); locally there is none.
const CONTROL_KEY = process.env.CONTROL_KEY ?? ''

// What the feed sends; the page edits it through POST /control/feed.
const feed = {
  running: true,
  format: 'json',
  rateHz: 10,
  waterTemp: 18.4,
  wave: true,
  winchLocked: false,
  status: 'Logging',
}
const STATUSES = ['Logging', 'Idle', 'Recovering']
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
  crowd: { on: crowd.on },
  obstacles: obstacleList(),
  vehicle: vehicleNow(),
  clients: [...sockets.values()].map(({ remote, since }) => ({ remote, since })),
  locked: Boolean(CONTROL_KEY),
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
const MAX_OBSTACLES = 150
const OBSTACLES_PER_PHONE = 5
const OBSTACLE_COOLDOWN_MS = 2000
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
const placeObstacle = (phone, lat, lon) => {
  if (![lat, lon].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return 'That spot is off the map.'
  if (vehicle.lat === null) return 'Waiting for the boat to report where it is.'
  const distance = distanceM(vehicle, { lat, lon })
  if (distance < MIN_DISTANCE_M) return `Too close to the boat: keep at least ${MIN_DISTANCE_M} m away.`
  if (distance > MAX_DISTANCE_M) return 'Too far from the boat to matter.'
  if (obstacles.size >= MAX_OBSTACLES) return 'The map is full.'
  if (phone.placed >= OBSTACLES_PER_PHONE) return `You have placed all ${OBSTACLES_PER_PHONE} of yours.`
  if (Date.now() - phone.lastPlaced < OBSTACLE_COOLDOWN_MS) return 'One every two seconds.'
  phone.placed++
  phone.lastPlaced = Date.now()
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
  for (const phone of phones.values()) phone.placed = 0
  obstaclesChanged()
  toPhones({ type: 'placed', left: OBSTACLES_PER_PHONE })
}

const onPhoneMessage = (socket, phone, text) => {
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    return
  }
  if (typeof msg?.poi !== 'object' || msg.poi === null) return
  const reason = placeObstacle(phone, Number(msg.poi.lat), Number(msg.poi.lon))
  sendJson(socket, reason ? { type: 'rejected', reason } : { type: 'placed', left: OBSTACLES_PER_PHONE - phone.placed })
}

const acceptPhone = (req, socket) => {
  if (phones.size >= MAX_PHONES) return socket.destroy()
  if (!handshake(req, socket)) return
  const phone = { placed: 0, lastPlaced: 0, pending: Buffer.alloc(0) }
  phones.set(socket, phone)
  // The first phone puts the crowd in the feed, unless the console already chose.
  if (!crowd.chosen) crowd.on = true
  broadcast('state', state())
  sendJson(socket, {
    type: 'hello',
    count: phones.size,
    obstacles: obstacleList(),
    vehicle: vehicleNow(),
    left: OBSTACLES_PER_PHONE,
    minDistance: MIN_DISTANCE_M,
  })
  socket.on('data', (chunk) => readFrames(socket, phone, chunk, (text) => onPhoneMessage(socket, phone, text)))
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

// The temperature drifts on a slow wave so the data lake sees a change every tick: Cockpit only notifies listeners
// (plots, action links, DIY widgets) when a value changes.
const started = Date.now()
let sonar = 12.3
const reading = () => {
  const t = (Date.now() - started) / 1000
  const wave = feed.wave ? 1.2 * Math.sin((2 * Math.PI * t) / 20) + 0.15 * Math.sin(t * 1.7) : 0
  sonar = Math.min(40, Math.max(2, sonar + (Math.random() - 0.5) * 0.6))
  return {
    WaterTemp: Math.round((feed.waterTemp + wave) * 100) / 100,
    Sonar: { Ping: { Distance: Math.round(sonar * 100) / 100 } },
    Winch: { Locked: feed.winchLocked },
    PayloadStatus: feed.status,
    ...(crowd.on ? { Crowd: crowdNow() } : {}),
  }
}

// Plain text is one variable per message; a `/` in a name would become `-`, so the names stay flat.
const messagesFor = (r) =>
  feed.format === 'json'
    ? [JSON.stringify(r)]
    : [
        `WaterTemp=${r.WaterTemp}`,
        `SonarDistance=${r.Sonar.Ping.Distance}`,
        `WinchLocked=${r.Winch.Locked}`,
        `PayloadStatus="${r.PayloadStatus}"`,
        ...(r.Crowd ? Object.entries(r.Crowd).map(([k, v]) => `Crowd${k}=${v}`) : []),
      ]

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

// --- control from the page ---------------------------------------------------------------------
const applyControl = (patch) => {
  if (typeof patch.running === 'boolean') feed.running = patch.running
  if (['json', 'text'].includes(patch.format)) feed.format = patch.format
  if (RATES.includes(patch.rateHz) && patch.rateHz !== feed.rateHz) {
    feed.rateHz = patch.rateHz
    schedule()
  }
  if (Number.isFinite(patch.waterTemp)) feed.waterTemp = Math.min(60, Math.max(-10, patch.waterTemp))
  if (typeof patch.wave === 'boolean') feed.wave = patch.wave
  if (typeof patch.winchLocked === 'boolean') feed.winchLocked = patch.winchLocked
  if (STATUSES.includes(patch.status)) feed.status = patch.status
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

  if (req.method === 'GET' && url.pathname === '/') {
    return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(PAGE))
  }
  if (url.pathname === '/favicon.ico') return res.writeHead(204).end()
  if (req.method === 'GET' && url.pathname === '/join') {
    return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(readFileSync(JOIN))
  }
  if (req.method === 'GET' && url.pathname === '/vendor/qrcode.js') {
    return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(readFileSync(QR))
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
    query: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(
      ['content-type', 'authorization', 'user-agent'].filter((h) => req.headers[h]).map((h) => [h, req.headers[h]])
    ),
    body,
    json,
    from: clientIp(req),
  }
  broadcast('request', entry)
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
  console.log(`Action target:  http://localhost:${PORT}/axis?v={{ inputs/mavlink/axis-x }}`)
  console.log(`Audience joins: http://localhost:${PORT}/join`)
  for (const ip of lanUrls()) console.log(`On the network: http://${ip}:${PORT}/`)
})
