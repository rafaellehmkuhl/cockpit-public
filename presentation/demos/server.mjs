// Backend for the talk's live demos. One port does it all: it is the WebSocket feed Cockpit reads (demos 1 and 3),
// it receives the HTTP requests Cockpit's actions send (demo 2), and it serves the page that shows the audience what
// this side sees. Plain Node, no dependencies: `node presentation/demos/server.mjs`.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

const PORT = Number(process.env.PORT ?? 8765)
const PAGE = new URL('./index.html', import.meta.url)
const MAX_BODY = 64 * 1024

// What the feed sends; the page edits it through POST /control/feed.
const feed = {
  running: true,
  format: 'json',
  rateHz: 1,
  waterTemp: 18.4,
  wave: true,
  winchLocked: false,
  status: 'Logging',
}
const STATUSES = ['Logging', 'Idle', 'Recovering']
const RATES = [1, 2, 5]

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
const state = () => ({ feed, clients: [...sockets.values()].map(({ remote, since }) => ({ remote, since })), port: PORT, lan: lanUrls() })

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

// Cockpit never sends data on this connection; only close and ping frames need an answer.
const readFrames = (socket, info, chunk) => {
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
  }
}

const acceptSocket = (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key) return socket.destroy()
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
  )
  const info = { remote: req.socket.remoteAddress?.replace('::ffff:', '') ?? '?', since: Date.now(), pending: Buffer.alloc(0) }
  sockets.set(socket, info)
  broadcast('state', state())
  socket.on('data', (chunk) => readFrames(socket, info, chunk))
  const drop = () => {
    if (sockets.delete(socket)) broadcast('state', state())
  }
  socket.on('close', drop)
  socket.on('error', drop)
}

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
      ]

let timer
const tick = () => {
  const r = reading()
  const messages = messagesFor(r)
  const sent = feed.running ? sockets.size : 0
  if (feed.running) for (const socket of sockets.keys()) for (const m of messages) socket.write(frame(0x1, Buffer.from(m)))
  broadcast('feed', { at: Date.now(), reading: r, messages, sent })
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

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write(`event: state\ndata: ${JSON.stringify(state())}\n\n`)
    pages.add(res)
    req.on('close', () => pages.delete(res))
    return
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
    from: req.socket.remoteAddress?.replace('::ffff:', '') ?? '?',
  }
  broadcast('request', entry)
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, id: entry.id }))
})

server.on('upgrade', acceptSocket)
server.listen(PORT, () => {
  schedule()
  console.log(`Demo page:      http://localhost:${PORT}/`)
  console.log(`Cockpit feed:   ws://localhost:${PORT}`)
  console.log(`Action target:  http://localhost:${PORT}/axis?v={{ inputs/mavlink/axis-x }}`)
  for (const ip of lanUrls()) console.log(`On the network: http://${ip}:${PORT}/`)
})
