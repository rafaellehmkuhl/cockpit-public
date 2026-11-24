// ssh and scp to the measured machine. Its link drops handshakes now and then (ZeroTier resets a connection in the
// middle of authenticating, for minutes at a time), so every call shares one authenticated connection, and a call
// that could not connect at all (exit 255) is retried instead of failing the case.
import { spawnSync } from 'node:child_process'

// ssh uses the first value it is given for an option, so SHARED goes first where it applies. Long-lived connections (tunnels, the gesture player) get their own: a shared one that dies takes them all with it.
export const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=10', '-o', 'ControlMaster=no']
const SHARED = ['-o', 'ControlMaster=auto', '-o', 'ControlPath=/tmp/e2e-ssh-%C', '-o', 'ControlPersist=10m']

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/**
 * Run ssh or scp, retrying while the connection itself fails, for up to about ten minutes.
 * @param {'ssh'|'scp'} tool - Which one
 * @param {string[]} args - Its arguments, after the shared options
 * @param {object} [options] - spawnSync options
 * @returns {object} spawnSync's result of the last attempt
 */
export function sshSync(tool, args, options = {}) {
  let r
  for (let attempt = 0, waited = 0; ; attempt++) {
    r = spawnSync(tool, [...SHARED, ...SSH_OPTS, ...args], { encoding: 'utf8', timeout: 60000, ...options })
    if (r.status !== 255 || waited > 600000) return r
    const wait = Math.min(60000, 5000 * 2 ** attempt)
    console.log(`   ${tool} could not reach the box (${(r.stderr ?? '').trim().split('\n').at(-1)}); retrying in ${wait / 1000} s`)
    pause(wait)
    waited += wait
  }
}
