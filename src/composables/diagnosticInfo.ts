import { ref } from 'vue'

import { isElectron } from '@/libs/utils'
import type { DiagnosticInfo } from '@/types/platform'

/**
 * Live resource-usage snapshot returned by `electronAPI.getResourceUsage()`. Mirrored here so
 * consumers don't have to import the inline type from cosmos.ts.
 */
interface ResourceUsage {
  /**
   * Total Cockpit memory across all processes, in MB
   */
  totalMemoryMB: number
  /**
   * Memory used by the main (Browser) process, in MB
   */
  mainMemoryMB: number
  /**
   * Memory used by all renderer / utility processes, in MB
   */
  renderersMemoryMB: number
  /**
   * Memory used by the GPU process, in MB
   */
  gpuMemoryMB: number
  /**
   * Aggregate Cockpit CPU usage across all processes, in percent
   */
  cpuUsagePercent: number
}

const diagnosticInfo = ref<DiagnosticInfo | null>(null)
const resourceUsage = ref<ResourceUsage | null>(null)
const lastRefreshTimestamp = ref<number | null>(null)
const isRefreshing = ref(false)
let pollIntervalId: ReturnType<typeof setInterval> | null = null

/**
 * Format a byte count using GiB / MiB / KiB / B units. Returns '...' for null/undefined.
 * @param {number | null | undefined} bytes Value in bytes
 * @returns {string} Human readable size, e.g. '7.86 GiB' or '435 MiB'
 */
export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '...'
  const gib = 1024 ** 3
  const mib = 1024 ** 2
  const kib = 1024
  if (bytes >= gib) return `${(bytes / gib).toFixed(2)} GiB`
  if (bytes >= mib) return `${(bytes / mib).toFixed(0)} MiB`
  if (bytes >= kib) return `${(bytes / kib).toFixed(0)} KiB`
  return `${bytes} B`
}

/**
 * Refresh the diagnostic and resource-usage snapshots from the Electron main process.
 * No-op (and clears state) when running in the browser build.
 * @returns {Promise<void>} Promise that resolves once the snapshots have been updated
 */
const refresh = async (): Promise<void> => {
  if (!isElectron() || !window.electronAPI) {
    diagnosticInfo.value = null
    resourceUsage.value = null
    lastRefreshTimestamp.value = Date.now()
    return
  }
  isRefreshing.value = true
  try {
    const [diag, usage] = await Promise.all([
      window.electronAPI.getDiagnosticInfo(),
      window.electronAPI.getResourceUsage(),
    ])
    diagnosticInfo.value = diag
    resourceUsage.value = usage
    lastRefreshTimestamp.value = Date.now()
  } catch (error) {
    console.error('Failed to refresh diagnostic info:', error)
  } finally {
    isRefreshing.value = false
  }
}

/**
 * Start polling diagnostic info on a fixed interval. Calling this multiple times replaces the
 * existing timer with the new interval (so the most recent caller wins).
 * @param {number} intervalMs Polling interval in milliseconds (default 5000ms)
 * @returns {void}
 */
const startPolling = (intervalMs = 5000): void => {
  stopPolling()
  refresh()
  pollIntervalId = setInterval(refresh, intervalMs)
}

/**
 * Stop the polling timer started with `startPolling`. Safe to call when polling is not active.
 * @returns {void}
 */
const stopPolling = (): void => {
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
}

/**
 * Build a markdown-formatted diagnostic report suitable for pasting into a forum/issue post.
 * Includes Cockpit / OS / CPU / RAM / GPU / disk and live process resource usage.
 * @returns {string} Markdown-formatted report (or a short message when running in the browser)
 */
const buildDiagnosticReport = (): string => {
  const diag = diagnosticInfo.value
  const usage = resourceUsage.value
  if (!diag) {
    return 'Diagnostic info is not available (running in browser build, or main process unreachable).'
  }

  const lines: string[] = []
  lines.push('### Cockpit diagnostic report')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('| --- | --- |')
  lines.push(`| Cockpit | ${diag.cockpitVersion} |`)
  lines.push(`| Electron | ${diag.electronVersion} (Chromium ${diag.chromeVersion}, Node ${diag.nodeVersion}) |`)
  lines.push(`| OS | ${diag.platform} ${diag.osRelease} (${diag.arch}) |`)
  lines.push(`| CPU | ${diag.cpuModel ?? 'unknown'}  (${diag.cpuLogicalCores} logical cores) |`)
  lines.push(`| RAM | total ${formatBytes(diag.totalMemoryBytes)} / free ${formatBytes(diag.freeMemoryBytes)} |`)
  if (diag.videosFolderDisk) {
    const usedRatio = 1 - diag.videosFolderDisk.freeBytes / Math.max(diag.videosFolderDisk.totalBytes, 1)
    lines.push(
      `| Videos disk | \`${diag.videosFolderDisk.path}\` — ${formatBytes(
        diag.videosFolderDisk.freeBytes
      )} free of ${formatBytes(diag.videosFolderDisk.totalBytes)} (${(usedRatio * 100).toFixed(0)}% used) |`
    )
  }

  if (usage) {
    lines.push('')
    lines.push('### Cockpit live resource usage')
    lines.push('')
    lines.push('| Process | Memory (MB) |')
    lines.push('| --- | --- |')
    lines.push(`| Main | ${usage.mainMemoryMB.toFixed(0)} |`)
    lines.push(`| Renderers + Utility | ${usage.renderersMemoryMB.toFixed(0)} |`)
    lines.push(`| GPU | ${usage.gpuMemoryMB.toFixed(0)} |`)
    lines.push(`| Total | ${usage.totalMemoryMB.toFixed(0)} |`)
    lines.push(`| Aggregate CPU | ${usage.cpuUsagePercent.toFixed(1)}% |`)
  }

  lines.push('')
  lines.push('### GPUs')
  lines.push('')
  if (diag.gpu.allGpus.length === 0) {
    lines.push('_No GPUs reported by Chromium._')
  } else {
    lines.push('| # | Name | Vendor | Driver | Active |')
    lines.push('| --- | --- | --- | --- | --- |')
    diag.gpu.allGpus.forEach((g, idx) => {
      lines.push(
        `| ${idx} | ${g.name ?? 'unknown'} | ${g.vendor ?? 'unknown'} | ${g.driverVersion ?? 'unknown'} | ${
          g.active ? 'yes' : 'no'
        } |`
      )
    })
  }

  const featureKeys = Object.keys(diag.gpu.featureStatus)
  if (featureKeys.length > 0) {
    lines.push('')
    lines.push('### GPU feature status')
    lines.push('')
    lines.push('| Feature | Status |')
    lines.push('| --- | --- |')
    featureKeys.sort().forEach((key) => {
      lines.push(`| ${key} | ${diag.gpu.featureStatus[key]} |`)
    })
  }

  return lines.join('\n')
}

/**
 * Reactive access to diagnostic info, live resource usage and helpers used by the System info
 * panel. Polling is opt-in via `startPolling()` so consumers that only need a one-shot snapshot
 * can call `refresh()` instead.
 * @returns {object} Reactive state, polling controls and the markdown report builder
 */
export const useDiagnosticInfo = (): {
  /**
   * Latest diagnostic snapshot, or null when not yet fetched / running in browser
   */
  diagnosticInfo: typeof diagnosticInfo
  /**
   * Latest live resource usage snapshot, or null when not yet fetched
   */
  resourceUsage: typeof resourceUsage
  /**
   * Epoch (ms) of the last successful refresh, or null when no refresh has succeeded yet
   */
  lastRefreshTimestamp: typeof lastRefreshTimestamp
  /**
   * True while a refresh is in flight
   */
  isRefreshing: typeof isRefreshing
  /**
   * Trigger an immediate refresh
   */
  refresh: typeof refresh
  /**
   * Start periodic polling (replaces any existing timer)
   */
  startPolling: typeof startPolling
  /**
   * Stop periodic polling
   */
  stopPolling: typeof stopPolling
  /**
   * Build a markdown-formatted diagnostic report from the current state
   */
  buildDiagnosticReport: typeof buildDiagnosticReport
} => ({
  diagnosticInfo,
  resourceUsage,
  lastRefreshTimestamp,
  isRefreshing,
  refresh,
  startPolling,
  stopPolling,
  buildDiagnosticReport,
})
