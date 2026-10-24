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
  socket.on('data', (chunk) => readFrames(socket, info, chunk))
  const drop = () => {
    if (sockets.delete(socket)) broadcast('state', state())
  }
  socket.on('close', drop)
  socket.on('error', drop)
}

// --- the audience: phones on /crowd send their tilt and taps, and can be flashed ----------------------
const phones = new Map()
const crowd = { on: false, chosen: false, taps: 0 }
const MAX_PHONES = 2000
const TAPS_PER_PHONE_PER_S = 15
const clampDeg = (v) => Math.max(-90, Math.min(90, Math.round(v * 10) / 10))
const average = (list) => (list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : 0)

const crowdNow = () => {
  const now = Date.now()
  const tilted = [...phones.values()].filter((p) => p.roll !== null)
  let recent = 0
  for (const p of phones.values()) {
    p.taps = p.taps.filter((t) => now - t < 2000)
    recent += p.taps.length
  }
  return {
    Count: phones.size,
    Roll: average(tilted.map((p) => p.roll)),
    Pitch: average(tilted.map((p) => p.pitch)),
    TapsPerSecond: recent / 2,
    Taps: crowd.taps,
  }
}

const sendJson = (socket, data) => socket.write(frame(0x1, Buffer.from(JSON.stringify(data))))

// Phones are untrusted input from a public QR code: only known message shapes, finite numbers and a tap rate cap.
const onPhoneMessage = (phone, text) => {
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    return
  }
  if (Array.isArray(msg?.tilt) && msg.tilt.length === 2 && msg.tilt.every(Number.isFinite)) {
    phone.roll = clampDeg(msg.tilt[0])
    phone.pitch = clampDeg(msg.tilt[1])
  }
  if (msg?.tap === true) {
    const now = Date.now()
    if (phone.taps.filter((t) => now - t < 1000).length < TAPS_PER_PHONE_PER_S) {
      phone.taps.push(now)
      crowd.taps++
    }
  }
}

const acceptPhone = (req, socket) => {
  if (phones.size >= MAX_PHONES) return socket.destroy()
  if (!handshake(req, socket)) return
  const phone = { roll: null, pitch: null, taps: [], pending: Buffer.alloc(0) }
  phones.set(socket, phone)
  // The first phone puts the crowd in the feed, unless the console already chose.
  if (!crowd.chosen) crowd.on = true
  broadcast('state', state())
  sendJson(socket, { type: 'hello', count: phones.size })
  socket.on('data', (chunk) => readFrames(socket, phone, chunk, (text) => onPhoneMessage(phone, text)))
  const drop = () => {
    if (phones.delete(socket)) broadcast('state', state())
  }
  socket.on('close', drop)
  socket.on('error', drop)
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
setInterval(() => {
  for (const socket of phones.keys()) sendJson(socket, { type: 'count', count: phones.size })
}, 1000)

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
