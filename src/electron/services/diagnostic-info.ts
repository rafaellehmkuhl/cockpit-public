import { app, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as os from 'os'
import { join } from 'path'

import type { DiagnosticGpuInfo, DiagnosticInfo, DiskSpaceInfo, GpuFeatureStatus } from '@/types/platform'

import { getCockpitFolderPath } from './storage'

/**
 * Shape of a single GPU device entry as returned by `app.getGPUInfo('complete')`. Electron's
 * type is `unknown`, so we describe the fields we use defensively.
 */
interface GpuDeviceLike {
  /**
   * Vendor identifier (numeric in some Electron builds, string in others)
   */
  vendorId?: number | string
  /**
   * Device identifier (numeric or string depending on the platform)
   */
  deviceId?: number | string
  /**
   * Whether Chromium considers this device active
   */
  active?: boolean
  /**
   * Driver vendor string when available (e.g. 'AMD', 'Intel Corporation')
   */
  driverVendor?: string
  /**
   * Driver version string when available
   */
  driverVersion?: string
  /**
   * Vendor name string (Linux primarily)
   */
  vendorString?: string
  /**
   * Device name string (Linux primarily)
   */
  deviceString?: string
}

/**
 * Loose type alias for the value returned by `app.getGPUInfo('complete')`. The Electron typings
 * declare it as `unknown`, but the structure is stable enough across recent versions for us to
 * extract the fields we need.
 */
interface GpuInfoLike {
  /**
   * Auxiliary attributes block (varies per platform; we read GL renderer / vendor strings here).
   */
  auxAttributes?: {
    /**
     * GL renderer string used as a friendly GPU name fallback
     */
    glRenderer?: string
    /**
     * GL vendor string
     */
    glVendor?: string
  }
  /**
   * List of detected GPU devices
   */
  gpuDevice?: GpuDeviceLike[]
}

/**
 * Convert an arbitrary GPU-info value to a string when possible. Handles numeric ids by formatting
 * them as 4-digit hex (the convention Chromium follows for vendor/device identifiers).
 * @param {number | string | undefined} value Raw vendor or device identifier
 * @returns {string | null} Formatted string or null when not provided
 */
const formatVendorOrDeviceId = (value: number | string | undefined): string | null => {
  if (value === undefined) return null
  if (typeof value === 'number') return `0x${value.toString(16).padStart(4, '0')}`
  return value.length > 0 ? value : null
}

/**
 * Pick a friendly name for a GPU device, preferring strings explicitly provided by the OS over
 * numeric identifiers.
 * @param {GpuDeviceLike} device A single entry from `gpuDevice`
 * @param {GpuInfoLike} info The full GPU info object (used for GL fallback strings)
 * @returns {string | null} Display name for the device
 */
const pickGpuDisplayName = (device: GpuDeviceLike, info: GpuInfoLike): string | null => {
  if (device.deviceString && device.deviceString.length > 0) return device.deviceString
  if (device.driverVendor && device.driverVendor.length > 0) {
    const id = formatVendorOrDeviceId(device.deviceId)
    return id ? `${device.driverVendor} (${id})` : device.driverVendor
  }
  if (info.auxAttributes?.glRenderer) return info.auxAttributes.glRenderer
  return formatVendorOrDeviceId(device.deviceId)
}

/**
 * Collect a `DiagnosticGpuInfo` snapshot from Chromium's GPU APIs. Errors are caught so the rest
 * of the diagnostic report still succeeds even on systems where GPU info is unavailable.
 * @returns {Promise<DiagnosticGpuInfo>} GPU diagnostic snapshot
 */
const collectGpuInfo = async (): Promise<DiagnosticGpuInfo> => {
  let info: GpuInfoLike = {}
  let featureStatus: GpuFeatureStatus = {}

  try {
    info = ((await app.getGPUInfo('complete')) as GpuInfoLike) ?? {}
  } catch (error) {
    console.warn('Failed to get complete GPU info from Electron:', error)
  }

  try {
    featureStatus = (app.getGPUFeatureStatus() as GpuFeatureStatus) ?? {}
  } catch (error) {
    console.warn('Failed to get GPU feature status from Electron:', error)
  }

  const devices = info.gpuDevice ?? []
  const allGpus = devices.map((device) => ({
    name: pickGpuDisplayName(device, info),
    vendor: device.vendorString ?? device.driverVendor ?? formatVendorOrDeviceId(device.vendorId),
    driverVersion: device.driverVersion ?? null,
    active: Boolean(device.active),
  }))

  // Prefer the explicitly active device, fall back to the first one reported.
  const primaryDevice = devices.find((d) => d.active) ?? devices[0]
  const primary = primaryDevice
    ? {
        primaryGpuName: pickGpuDisplayName(primaryDevice, info),
        primaryGpuVendor:
          primaryDevice.vendorString ?? primaryDevice.driverVendor ?? formatVendorOrDeviceId(primaryDevice.vendorId),
        primaryGpuDriverVersion: primaryDevice.driverVersion ?? null,
      }
    : { primaryGpuName: null, primaryGpuVendor: null, primaryGpuDriverVersion: null }

  return {
    ...primary,
    allGpus,
    featureStatus,
  }
}

/**
 * Best-effort filesystem space report for the Cockpit videos folder.
 * @returns {Promise<DiskSpaceInfo | null>} Disk usage info, or null when the path can't be inspected
 */
const collectVideosFolderDisk = async (): Promise<DiskSpaceInfo | null> => {
  const videosPath = join(getCockpitFolderPath(), 'videos')
  try {
    await fs.mkdir(videosPath, { recursive: true })
    // `fs.statfs` is available in Node 18.15+ (Electron 26+) and reports the filesystem hosting the path.
    const stats = await fs.statfs(videosPath)
    const totalBytes = Number(stats.blocks) * Number(stats.bsize)
    const freeBytes = Number(stats.bavail) * Number(stats.bsize)
    return { path: videosPath, totalBytes, freeBytes }
  } catch (error) {
    console.warn('Failed to collect disk space info for videos folder:', error)
    return null
  }
}

/**
 * Build a serializable diagnostic snapshot for the renderer's "System info" panel. Combines
 * static identification (versions, CPU, GPU) with live numbers (free RAM, free disk).
 * @returns {Promise<DiagnosticInfo>} Aggregated diagnostic information
 */
export const collectDiagnosticInfo = async (): Promise<DiagnosticInfo> => {
  const [gpu, videosFolderDisk] = await Promise.all([collectGpuInfo(), collectVideosFolderDisk()])
  const cpus = os.cpus()
  return {
    cockpitVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    chromeVersion: process.versions.chrome ?? '',
    nodeVersion: process.versions.node ?? '',
    platform: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? null,
    cpuLogicalCores: cpus.length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    gpu,
    videosFolderDisk,
  }
}

/**
 * Setup the diagnostic info IPC handler.
 * Exposes `get-diagnostic-info` for the renderer to request a live snapshot of system + GPU + disk
 * information for the System info panel in Configuration → Development.
 */
export const setupDiagnosticInfoService = (): void => {
  ipcMain.handle('get-diagnostic-info', async (): Promise<DiagnosticInfo> => {
    return collectDiagnosticInfo()
  })
}
