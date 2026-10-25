// The gimbal camera's video: headless Chromium renders the demo server's /camera-world page, its screencast frames go
// through ffmpeg as H.264, and ffmpeg publishes them to the RTSP server. If any part stops, the process exits and Docker
// restarts the whole pipeline, which is simpler and more reliable than repairing one piece in place.
import { spawn } from 'node:child_process'

// 720p rendered at full size, at 15 fps, keeps Chromium near 1.75 of the VPS's 4 cores. Antialiasing on the CPU
// renderer took about 3, at any frame rate, so the scene goes without it.
const PAGE_URL = process.env.PAGE_URL ?? 'http://apdc-demos:8765/camera-world?fps=15&scale=1'
const RTSP_URL = process.env.RTSP_URL
const WIDTH = Number(process.env.WIDTH) || 1280
const HEIGHT = Number(process.env.HEIGHT) || 720
const FPS = 15
const DEBUG_PORT = 9222
if (!RTSP_URL) throw new Error('RTSP_URL is required')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fail = (why) => {
  console.error(`[camera] ${why}`)
  process.exit(1)
}

const chromium = spawn(
  'chromium',
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-debugging-address=127.0.0.1',
    // No GPU on the VPS: WebGL runs on the CPU through SwiftShader.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] }
)

// Frames arrive at whatever rate the page renders; the fps filter turns that into a steady stream for the decoder.
const ffmpeg = spawn(
  'ffmpeg',
  [
    // Warnings would repeat for every frame (Chromium's JPEGs use the full-range pixel format), so only errors log.
    '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-use_wallclock_as_timestamps', '1', '-c:v', 'mjpeg', '-i', '-',
    '-vf', `fps=${FPS},scale=${WIDTH}:${HEIGHT}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
    '-g', String(FPS), '-b:v', '3500k', '-maxrate', '3500k', '-bufsize', '1400k',
    '-f', 'rtsp', '-rtsp_transport', 'tcp', RTSP_URL,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] }
)
chromium.on('exit', (code) => fail(`chromium exited (${code})`))
ffmpeg.on('exit', (code) => fail(`ffmpeg exited (${code})`))
ffmpeg.stdin.on('error', (error) => fail(`ffmpeg input closed: ${error.message}`))

// The DevTools endpoint takes a moment to come up after Chromium starts.
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500)
  target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)
    .then((r) => r.json())
    .then((list) => list.find((t) => t.type === 'page'))
    .catch(() => undefined)
}
if (!target) fail('chromium never offered a page to drive')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.onopen = resolve
  socket.onerror = () => reject(new Error('could not reach chromium'))
})
socket.onclose = () => fail('lost the connection to chromium')
let nextId = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })

let frames = 0
let everHadFrames = false
let lastFrameAt = Date.now()
let onLoad = () => {}
let ffmpegBusy = false
ffmpeg.stdin.on('drain', () => (ffmpegBusy = false))
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    pending.get(message.id)?.(message.result)
    pending.delete(message.id)
    return
  }
  if (message.method === 'Page.loadEventFired') onLoad()
  if (message.method !== 'Page.screencastFrame') return
  everHadFrames = true
  const { data, sessionId } = message.params
  send('Page.screencastFrameAck', { sessionId })
  lastFrameAt = Date.now()
  frames++
  // A frame dropped while ffmpeg catches up costs nothing; queueing them would add delay that never goes away.
  if (!ffmpegBusy) ffmpegBusy = !ffmpeg.stdin.write(Buffer.from(data, 'base64'))
}

await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
await send('Page.enable')
await send('Runtime.enable')
// A screencast started before the page has loaded sends nothing, so it starts once the load event has fired.
const loaded = new Promise((resolve) => (onLoad = resolve))
await send('Page.navigate', { url: PAGE_URL })
await Promise.race([loaded, sleep(30000)])
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 })
console.log(`[camera] rendering ${PAGE_URL} at ${WIDTH}x${HEIGHT}, publishing to the RTSP server`)

// The page is reloaded if it failed to load (the demo server restarting, say), and the whole pipeline restarts if
// frames stop coming. The first frame can take a while, since compiling shaders on the CPU is slow.
setInterval(async () => {
  if (Date.now() - lastFrameAt > (everHadFrames ? 15000 : 60000)) fail('no frames from the page')
  const result = await send('Runtime.evaluate', { expression: "Boolean(document.querySelector('canvas'))", returnByValue: true })
  if (result?.result?.value !== true) {
    console.log('[camera] the page has no scene, reloading it')
    await send('Page.navigate', { url: PAGE_URL })
  }
}, 10000)
setInterval(() => {
  console.log(`[camera] ${(frames / 60).toFixed(1)} frames/s from the page`)
  frames = 0
}, 60000)
