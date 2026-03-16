/**
 * Generates realistic synthetic MAVLink message payloads for benchmarking.
 * Uses MessageChannel for high-frequency delivery and wall-clock time for
 * smooth, continuous value changes that simulate a real submarine.
 */

import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'

let sequenceCounter = 0
let startTime = 0
const timeScale = 2

/**
 * Get scaled elapsed seconds since the generator started
 * @returns {number} Scaled seconds elapsed with sub-millisecond precision
 */
function elapsed(): number {
  return ((performance.now() - startTime) / 1000) * timeScale
}

/**
 * Create the standard mavlink2rest header
 * @param {number} systemId
 * @returns {Package['header']} A valid MAVLink header
 */
function makeHeader(systemId = 1): Package['header'] {
  return {
    system_id: systemId,
    component_id: 1,
    sequence: sequenceCounter++ % 256,
  }
}

/**
 * Generate a synthetic ATTITUDE message.
 * Simulates gentle submarine roll/pitch oscillation and slow yaw rotation.
 * @returns {Package} A complete MAVLink package
 */
function makeAttitude(): Package {
  const t = elapsed()
  return {
    header: makeHeader(),
    message: {
      type: 'ATTITUDE' as any,
      time_boot_ms: Math.round(t * 1000),
      roll: Math.sin(t * 0.4) * 0.12 + Math.sin(t * 1.1) * 0.03,
      pitch: Math.sin(t * 0.3) * 0.08 + Math.cos(t * 0.9) * 0.02,
      yaw: ((t * 0.15) % (2 * Math.PI)) + Math.sin(t * 0.2) * 0.1,
      rollspeed: Math.cos(t * 0.4) * 0.4 * 0.12,
      pitchspeed: Math.cos(t * 0.3) * 0.3 * 0.08,
      yawspeed: 0.15 + Math.cos(t * 0.2) * 0.2 * 0.1,
    } as any,
  }
}

/**
 * Generate a synthetic HEARTBEAT message
 * @returns {Package} A complete MAVLink package
 */
function makeHeartbeat(): Package {
  return {
    header: makeHeader(),
    message: {
      type: 'HEARTBEAT' as any,
      custom_mode: 0,
      mavtype: { type: 'MAV_TYPE_SUBMARINE' },
      autopilot: { type: 'MAV_AUTOPILOT_ARDUPILOTMEGA' },
      base_mode: { bits: 209 },
      system_status: { type: 'MAV_STATE_ACTIVE' },
      mavlink_version: 3,
    } as any,
  }
}

/**
 * Generate a synthetic GLOBAL_POSITION_INT message.
 * Simulates a submarine moving in a slow circular path at ~1 m/s.
 * @returns {Package} A complete MAVLink package
 */
function makeGlobalPositionInt(): Package {
  const t = elapsed()
  const baseLatDeg = -27.5
  const baseLonDeg = -48.4
  const circleRadiusDeg = 0.0003
  return {
    header: makeHeader(),
    message: {
      type: 'GLOBAL_POSITION_INT' as any,
      time_boot_ms: Math.round(t * 1000),
      lat: Math.round((baseLatDeg + Math.sin(t * 0.08) * circleRadiusDeg) * 1e7),
      lon: Math.round((baseLonDeg + Math.cos(t * 0.08) * circleRadiusDeg) * 1e7),
      alt: Math.round((-5 + Math.sin(t * 0.15) * 2) * 1000),
      relative_alt: Math.round((-5 + Math.sin(t * 0.15) * 2) * 1000),
      vx: Math.round(Math.cos(t * 0.08) * 80),
      vy: Math.round(-Math.sin(t * 0.08) * 80),
      vz: Math.round(Math.cos(t * 0.15) * 30),
      hdg: Math.round(((t * 0.08 * 180) / Math.PI) * 100) % 36000,
    } as any,
  }
}

/**
 * Generate a synthetic SYS_STATUS message.
 * Simulates slowly draining battery with realistic voltage sag under load.
 * @returns {Package} A complete MAVLink package
 */
function makeSysStatus(): Package {
  const t = elapsed()
  const baseBatteryV = 14.8 - t * 0.01
  return {
    header: makeHeader(),
    message: {
      type: 'SYS_STATUS' as any,
      onboard_control_sensors_present: { bits: 325188863 },
      onboard_control_sensors_enabled: { bits: 309461503 },
      onboard_control_sensors_health: { bits: 325188863 },
      load: Math.round(150 + Math.sin(t * 0.5) * 30),
      voltage_battery: Math.round(baseBatteryV * 1000 + Math.sin(t * 0.3) * 50),
      current_battery: Math.round(500 + Math.sin(t * 0.4) * 150),
      battery_remaining: Math.max(0, Math.round(85 - t * 0.3)),
      drop_rate_comm: 0,
      errors_comm: 0,
      _errors_count1: 0,
      _errors_count2: 0,
      _errors_count3: 0,
      _errors_count4: 0,
    } as any,
  }
}

/**
 * Generate a synthetic GPS_RAW_INT message
 * @returns {Package} A complete MAVLink package
 */
function makeGpsRawInt(): Package {
  const t = elapsed()
  const baseLatDeg = -27.5
  const baseLonDeg = -48.4
  const circleRadiusDeg = 0.0003
  return {
    header: makeHeader(),
    message: {
      type: 'GPS_RAW_INT' as any,
      time_usec: Math.round(t * 1e6),
      fix_type: { type: 'GPS_FIX_TYPE_3D_FIX' },
      lat: Math.round((baseLatDeg + Math.sin(t * 0.08) * circleRadiusDeg) * 1e7),
      lon: Math.round((baseLonDeg + Math.cos(t * 0.08) * circleRadiusDeg) * 1e7),
      alt: 100000,
      eph: 121,
      epv: 165,
      vel: 80,
      cog: 0,
      satellites_visible: 12,
    } as any,
  }
}

/**
 * Generate a synthetic AHRS2 message.
 * Simulates depth oscillation between 3-7 meters.
 * @returns {Package} A complete MAVLink package
 */
function makeAhrs2(): Package {
  const t = elapsed()
  return {
    header: makeHeader(),
    message: {
      type: 'AHRS2' as any,
      roll: Math.sin(t * 0.4) * 0.12,
      pitch: Math.sin(t * 0.3) * 0.08,
      yaw: (t * 0.15) % (2 * Math.PI),
      altitude: -5 + Math.sin(t * 0.2) * 2,
      lat: -275000000,
      lng: -484000000,
    } as any,
  }
}

/**
 * Generator entry with its proportional rate
 */
interface MessageGeneratorEntry {
  /** Function to generate a message */
  generate: () => Package
  /** Default rate in Hz for this message type */
  defaultHz: number
  /** Message type name */
  name: string
}

const messageGenerators: MessageGeneratorEntry[] = [
  { generate: makeAttitude, defaultHz: 10, name: 'ATTITUDE' },
  { generate: makeHeartbeat, defaultHz: 1, name: 'HEARTBEAT' },
  { generate: makeGlobalPositionInt, defaultHz: 5, name: 'GLOBAL_POSITION_INT' },
  { generate: makeSysStatus, defaultHz: 2, name: 'SYS_STATUS' },
  { generate: makeGpsRawInt, defaultHz: 5, name: 'GPS_RAW_INT' },
  { generate: makeAhrs2, defaultHz: 2, name: 'AHRS2' },
]

const defaultTotalHz = messageGenerators.reduce((sum, g) => sum + g.defaultHz, 0)

/**
 * Manages a synthetic MAVLink message stream at a configurable rate.
 * Uses MessageChannel for sub-millisecond scheduling that bypasses the browser's
 * 4ms setInterval clamp, allowing accurate high-frequency message delivery.
 */
export class SyntheticMavlinkGenerator {
  private channel: MessageChannel | null = null
  private running = false
  private tickCount = 0
  /** Total messages sent since last reset */
  messagesGenerated = 0

  /**
   * Start generating messages at the specified total rate.
   * Uses a MessageChannel tick loop with timing control to achieve the target rate.
   * @param {number} targetHz - Target total message rate in Hz
   * @param {(pkg: Package) => void} onMessage - Callback for each generated message
   */
  start(targetHz: number, onMessage: (pkg: Package) => void): void {
    this.stop()
    this.tickCount = 0
    this.messagesGenerated = 0
    this.running = true
    startTime = performance.now()

    const intervalUs = 1_000_000 / targetHz
    let lastSendTime = performance.now() * 1000

    this.channel = new MessageChannel()
    const port = this.channel.port2

    this.channel.port1.onmessage = (): void => {
      if (!this.running) return

      try {
        const nowUs = performance.now() * 1000
        while (nowUs - lastSendTime >= intervalUs) {
          lastSendTime += intervalUs
          this.tickCount++

          const weightedPick = this.tickCount % defaultTotalHz
          let cumulative = 0
          for (const gen of messageGenerators) {
            cumulative += gen.defaultHz
            if (weightedPick < cumulative) {
              onMessage(gen.generate())
              this.messagesGenerated++
              break
            }
          }
        }
      } catch (error) {
        console.error('[Benchmark] Generator error:', error)
      }

      port.postMessage(null)
    }

    port.postMessage(null)
  }

  /**
   * Stop the message generator
   */
  stop(): void {
    this.running = false
    if (this.channel) {
      this.channel.port1.close()
      this.channel.port2.close()
      this.channel = null
    }
  }
}
