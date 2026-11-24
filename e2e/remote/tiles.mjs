// A stand-in for the internet tile servers, so every run sees the same map: Chrome is pointed here with
// --host-resolver-rules, and each satellite tile is one of a small pool of real tiles picked by its z/x/y, after a fixed
// delay like a fast network's. Sea marks answer 404, as they do over open water.
//   node tiles.mjs <folder with pool/, cert.pem, key.pem> <port>
import { readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:https'
import { join } from 'node:path'

const [root, port = '8443'] = process.argv.slice(2)
const pool = readdirSync(join(root, 'pool')).sort().map((f) => readFileSync(join(root, 'pool', f)))
let served = 0
createServer({ cert: readFileSync(join(root, 'cert.pem')), key: readFileSync(join(root, 'key.pem')) }, (req, res) => {
  const nums = (req.url.match(/\d+/g) ?? []).map(Number)
  const tile = req.headers.host?.startsWith('server.arcgisonline.com') && nums.length >= 3
  setTimeout(() => {
    if (!tile) return res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end()
    const [z, y, x] = nums.slice(-3)
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=86400' })
    res.end(pool[(x * 7919 + y * 104729 + z) % pool.length])
    if (++served % 500 === 0) console.log(`${served} tiles served`)
  }, 40)
}).listen(Number(port), '127.0.0.1', () => console.log(`tiles on ${port}, pool of ${pool.length}`))
