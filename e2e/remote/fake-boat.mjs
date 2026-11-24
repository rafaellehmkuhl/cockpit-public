// A stand-in for the BlueOS SITL boat, run on the measured machine itself, so a performance case needs no vehicle on
// the network and every run starts from the same place. It answers what Cockpit and the harness use of BlueOS:
// mavlink2rest (WebSocket and REST), the settings bag, and the beacon. Telemetry replays the SITL's own message mix
// at its own rates (fixtures/sitl-messages.json), with the position, attitude and mission fields driven by a simple
// boat that follows its mission at the commanded speed in AUTO.
//   node fake-boat.mjs <port> <sitl-messages.json>
// Harness-only routes, which a real BlueOS answers with 404: POST /e2e/reset puts the boat back at home, disarmed, in
// HOLD, with no mission; POST /e2e/mission [{lat, lon}] stores a mission at once instead of item by item.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const [port = '80', snapshotFile] = process.argv.slice(2)
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'))
const HOME = { lat: -27.572, lon: -48.2243 }
const HOLD = 4
const AUTO = 10
// Answers to someone's request in the snapshot, not periodic telemetry.
const NOT_STREAMED = new Set(['PARAM_VALUE', 'MISSION_ITEM_INT', 'MISSION_REQUEST', 'COMMAND_ACK', 'MISSION_ACK',
  'MISSION_COUNT', 'MISSION_ITEM_REACHED', 'STATUSTEXT', 'TIMESYNC'])
const started = Date.now()
const params = { SIM_SPEEDUP: 1, FENCE_ENABLE: 0 }

let boat
const reset = () => {
  boat = { ...HOME, hdg: 0, gs: 0, armed: false, mode: HOLD, speed: 2, mission: [], current: 0, upload: null }
}
reset()

// ---- the boat ----
const M_PER_DEG = 111320
const metres = (a, b) => {
  const dy = (b.lat - a.lat) * M_PER_DEG
  const dx = (b.lon - a.lon) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180)
  return { d: Math.hypot(dx, dy), dx, dy }
}
const DT = 0.05
setInterval(() => {
  boat.gs = 0
  if (!boat.armed || boat.mode !== AUTO || boat.current >= boat.mission.length) return
  const target = boat.mission[boat.current]
  const { d, dx, dy } = metres(boat, target)
  const step = boat.speed * DT
  boat.hdg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
  boat.gs = boat.speed
  if (d <= Math.max(step, 2)) {
    emit({ type: 'MISSION_ITEM_REACHED', seq: boat.current })
    boat.current++
    return
  }
  boat.lat += (dy / d) * (step / M_PER_DEG)
  boat.lon += (dx / d) * (step / (M_PER_DEG * Math.cos((boat.lat * Math.PI) / 180)))
}, DT * 1000)

// The snapshot's message with the boat's state written over it.
const telemetry = (type) => {
  const m = structuredClone(snapshot[type].message)
  const yaw = ((boat.hdg > 180 ? boat.hdg - 360 : boat.hdg) * Math.PI) / 180
  const lat = Math.round(boat.lat * 1e7)
  const lon = Math.round(boat.lon * 1e7)
  const vn = boat.gs * Math.cos(yaw)
  const ve = boat.gs * Math.sin(yaw)
  if ('time_boot_ms' in m) m.time_boot_ms = Date.now() - started
  switch (type) {
    case 'HEARTBEAT':
      m.base_mode = { bits: boat.armed ? m.base_mode.bits | 128 : m.base_mode.bits & ~128 }
      m.custom_mode = boat.mode
      break
    case 'GLOBAL_POSITION_INT':
      Object.assign(m, { lat, lon, hdg: Math.round(boat.hdg * 100), vx: Math.round(vn * 100), vy: Math.round(ve * 100) })
      break
    case 'GPS_RAW_INT':
      Object.assign(m, { lat, lon, vel: Math.round(boat.gs * 100), cog: Math.round(boat.hdg * 100) })
      break
    case 'VFR_HUD':
      Object.assign(m, { groundspeed: boat.gs, airspeed: boat.gs, heading: Math.round(boat.hdg) })
      break
    case 'ATTITUDE':
    case 'AHRS3':
      m.yaw = yaw
      break
    case 'AHRS2':
      Object.assign(m, { yaw, lat, lng: lon })
      break
    case 'MISSION_CURRENT':
      m.seq = boat.current
      break
    case 'SYSTEM_TIME':
      m.time_unix_usec = Date.now() * 1000
      break
  }
  return m
}

// ---- mavlink2rest ----
const latest = new Map()
const clients = new Set()
let sequence = 0
const emit = (message) => {
  const packet = { header: { system_id: 1, component_id: 1, sequence: sequence++ % 256 }, message }
  latest.set(message.type, { message, at: new Date().toISOString() })
  const frame = textFrame(JSON.stringify(packet))
  for (const socket of clients) socket.write(frame)
}
for (const [type, { status }] of Object.entries(snapshot)) {
  const hz = status?.time?.frequency ?? 0
  if (NOT_STREAMED.has(type) || hz < 0.5) continue
  setInterval(() => emit(telemetry(type)), 1000 / hz)
}

const chars = (name) => [...name.padEnd(16, '\0')].slice(0, 16)
const paramName = (id) => (Array.isArray(id) ? id.join('') : id).replace(/\0/g, '')
const missionItem = (seq, { lat, lon }, type) => ({
  ...snapshot.MISSION_ITEM_INT.message,
  target_system: 255,
  target_component: 190,
  seq,
  current: seq === boat.current ? 1 : 0,
  x: Math.round(lat * 1e7),
  y: Math.round(lon * 1e7),
  z: 0,
  mission_type: type,
})
const isMission = (type) => (type?.type ?? 'MAV_MISSION_TYPE_MISSION') === 'MAV_MISSION_TYPE_MISSION'
const ack = (type) => ({ type: 'MISSION_ACK', target_system: 255, target_component: 190, mavtype: { type: 'MAV_MISSION_ACCEPTED' }, mission_type: type ?? { type: 'MAV_MISSION_TYPE_MISSION' }, opaque_id: 0 })

const handle = (msg) => {
  const p = (n) => msg[`param${n}`] ?? 0
  switch (msg.type) {
    case 'COMMAND_LONG':
    case 'COMMAND_INT': {
      const cmd = msg.command?.type
      if (cmd === 'MAV_CMD_COMPONENT_ARM_DISARM') boat.armed = p(1) === 1
      else if (cmd === 'MAV_CMD_DO_SET_MODE') boat.mode = p(2)
      else if (cmd === 'MAV_CMD_DO_SET_MISSION_CURRENT') boat.current = p(1)
      else if (cmd === 'MAV_CMD_MISSION_START') Object.assign(boat, { current: p(1) || 1, mode: AUTO })
      else if (cmd === 'MAV_CMD_DO_CHANGE_SPEED' && p(2) > 0) boat.speed = p(2)
      emit({ type: 'COMMAND_ACK', command: msg.command, result: { type: 'MAV_RESULT_ACCEPTED' }, progress: 0, result_param2: 0, target_system: 255, target_component: 190 })
      break
    }
    case 'PARAM_REQUEST_READ':
    case 'PARAM_SET': {
      const name = paramName(msg.param_id)
      if (msg.type === 'PARAM_SET') params[name] = msg.param_value
      emit({ type: 'PARAM_VALUE', param_id: chars(name), param_value: params[name] ?? 0, param_type: { type: 'MAV_PARAM_TYPE_REAL32' }, param_count: Object.keys(params).length, param_index: 0 })
      break
    }
    case 'MISSION_REQUEST_LIST':
      emit({ type: 'MISSION_COUNT', target_system: 255, target_component: 190, count: isMission(msg.mission_type) ? boat.mission.length : 0, mission_type: msg.mission_type, opaque_id: 0 })
      break
    case 'MISSION_REQUEST_INT':
    case 'MISSION_REQUEST':
      if (isMission(msg.mission_type) && boat.mission[msg.seq]) emit(missionItem(msg.seq, boat.mission[msg.seq], msg.mission_type))
      break
    case 'MISSION_COUNT':
      if (!isMission(msg.mission_type)) return emit(ack(msg.mission_type))
      boat.upload = { count: msg.count, items: [] }
      if (msg.count === 0) return emit(ack(msg.mission_type))
      emit({ type: 'MISSION_REQUEST_INT', target_system: 255, target_component: 190, seq: 0, mission_type: msg.mission_type })
      break
    case 'MISSION_ITEM_INT':
      if (!boat.upload || msg.seq !== boat.upload.items.length) return
      boat.upload.items.push({ lat: msg.x / 1e7, lon: msg.y / 1e7 })
      if (boat.upload.items.length < boat.upload.count) {
        emit({ type: 'MISSION_REQUEST_INT', target_system: 255, target_component: 190, seq: msg.seq + 1, mission_type: msg.mission_type })
      } else {
        setMission(boat.upload.items)
        boat.upload = null
        emit(ack(msg.mission_type))
      }
      break
    case 'MISSION_CLEAR_ALL':
      if (isMission(msg.mission_type)) setMission([])
      emit(ack(msg.mission_type))
      break
  }
}
// ArduPilot keeps item 0 as home, whatever was uploaded there.
const setMission = (points) => {
  boat.mission = points.length ? [{ lat: boat.lat, lon: boat.lon }, ...points.slice(1)] : []
  boat.current = 0
}

// ---- WebSocket, just enough of RFC 6455 for one text stream each way ----
function textFrame(text) {
  const payload = Buffer.from(text)
  const n = payload.length
  const header = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 0xff]) : Buffer.concat([Buffer.from([0x81, 127]), Buffer.from(new BigUint64Array([BigInt(n)]).buffer).reverse()])
  return Buffer.concat([header, payload])
}
const acceptSocket = (req, socket) => {
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  socket.setNoDelay(true)
  clients.add(socket)
  let buffer = Buffer.alloc(0)
  let pieces = []
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      if (buffer.length < 2) return
      const fin = buffer[0] & 0x80
      const opcode = buffer[0] & 0x0f
      let len = buffer[1] & 0x7f
      let offset = 2
      if (len === 126) [len, offset] = [buffer.length >= 4 ? buffer.readUInt16BE(2) : Infinity, 4]
      else if (len === 127) [len, offset] = [buffer.length >= 10 ? Number(buffer.readBigUInt64BE(2)) : Infinity, 10]
      const masked = buffer[1] & 0x80
      const total = offset + (masked ? 4 : 0) + len
      if (buffer.length < total) return
      const payload = Buffer.from(buffer.subarray(offset + (masked ? 4 : 0), total))
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[offset + (i % 4)]
      buffer = buffer.subarray(total)
      if (opcode === 8) return socket.end()
      if (opcode === 9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]))
      if (opcode === 1 || opcode === 0) {
        pieces.push(payload)
        if (!fin) continue
        const text = Buffer.concat(pieces).toString()
        pieces = []
        try {
          // Cockpit writes JSON5 (bare NaN), which plain JSON rejects.
          handle(JSON.parse(text.replace(/\bNaN\b/g, 'null')).message ?? {})
        } catch {}
      }
    }
  })
  const drop = () => clients.delete(socket)
  socket.on('close', drop)
  socket.on('error', drop)
}

// ---- HTTP ----
const bag = {}
const bagPath = (path) => path.split('/').filter(Boolean).map(decodeURIComponent)
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const path = url.pathname
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const data = body ? (() => { try { return JSON.parse(body.replace(/\bNaN\b/g, 'null')) } catch { return undefined } })() : undefined
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain')
    if (path === '/status') return send(res, 200, 'ok', 'text/plain')
    if (path === '/beacon/v1.0/services') return send(res, 200, [])
    if (path === '/e2e/reset') return reset(), send(res, 200, boat)
    if (path === '/e2e/mission') return setMission(data ?? []), send(res, 200, { count: boat.mission.length })
    if (path === '/e2e/state') return send(res, 200, boat)
    if (path.startsWith('/bag/v1.0/get/')) {
      let node = bag
      for (const k of bagPath(path.slice(14))) node = node?.[k]
      return node === undefined ? send(res, 404, { detail: 'Invalid path' }) : send(res, 200, node)
    }
    if (path.startsWith('/bag/v1.0/set/')) {
      const keys = bagPath(path.slice(14))
      let node = bag
      for (const k of keys.slice(0, -1)) node = node[k] = typeof node[k] === 'object' && node[k] ? node[k] : {}
      node[keys.at(-1)] = data
      return send(res, 200, 'Ok', 'text/plain')
    }
    const m = path.match(/^\/mavlink2rest\/mavlink\/vehicles\/1\/components\/1\/messages\/(\w+)$/)
    if (m) {
      const last = latest.get(m[1])
      return last ? send(res, 200, { message: last.message, status: { time: { last_update: last.at } } }) : send(res, 200, 'None', 'text/plain')
    }
    if (path === '/mavlink2rest/mavlink' && req.method === 'POST') return handle(data?.message ?? {}), send(res, 200, 'Ok', 'text/plain')
    send(res, 404, { detail: 'Not found' })
  })
})
server.on('upgrade', (req, socket) => {
  if (req.url.startsWith('/mavlink2rest/ws/mavlink')) acceptSocket(req, socket)
  else socket.destroy()
})
server.listen(Number(port), '127.0.0.1', () => console.log(`fake boat on ${port}, ${[...Object.keys(snapshot)].length} message types`))
