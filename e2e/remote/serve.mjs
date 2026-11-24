// Serves a Cockpit web build's dist folder on this machine, so a plain Chrome can open it as Cockpit Lite.
//   node serve.mjs <dist folder> <port>
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const [root, port = '5050'] = process.argv.slice(2)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' }
createServer((req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
  let file = join(root, path)
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html') } catch { file = join(root, 'index.html') }
  try { statSync(file) } catch { res.writeHead(404).end(); return }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  createReadStream(file).pipe(res)
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on ${port}`))
