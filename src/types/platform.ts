/**
 * Platform types supported by the application
 */
export enum Platform {
  MACOS = 'darwin',
  WINDOWS = 'win32',
  LINUX = 'linux',
}

/**
 * Architecture types supported by the application
 */
export enum Architecture {
  X64 = 'x64',
  IA32 = 'ia32',
  ARM64 = 'arm64',
  ARM = 'arm',
  RISCV64 = 'riscv64',
}

/**
 * Display information
 */
export interface DisplayInfo {
  /**
   * The width of the display in pixels
   */
  width: number
  /**
   * The height of the display in pixels
   */
  height: number
  /**
   * The scale factor of the display (DPI scaling)
   */
  scaleFactor: number
}

/**
 * Basic system information from electron
 */
export interface BasicSystemInfo {
  /**
   * The platform of the system. Possibilities can be found in the Platform enum.
   */
  platform: string
  /**
   * The architecture of the system. Possibilities can be found in the Architecture enum.
   */
  arch: string
  /**
   * The architecture of the process. Possibilities can be found in the Architecture enum.
   */
  processArch: string
  /**
   * Information about all connected displays
   */
  displays: DisplayInfo[]
}

/**
 * Status of a single Chromium graphics feature, as reported by `app.getGPUFeatureStatus()`.
 *
 * Common values seen on healthy systems:
 *   - 'enabled' / 'enabled_force' / 'enabled_on'
 *   - 'enabled_force_on'
 *   - 'unavailable_software' / 'unavailable_off' / 'unavailable_off_ok'
 *   - 'disabled_software' / 'disabled_off' / 'disabled_off_ok'
 *   - 'software_only' / 'gpu_disabled'
 *
 * The exact set of keys depends on the Chromium version Electron ships with.
 */
export type GpuFeatureStatus = Record<string, string>

/**
 * Subset of `Electron.GPUFeatureStatus`-style info we surface for diagnostics. We collect the
 * primary GPU description plus the top-level feature flags so users can see at a glance whether
 * hardware video decoding/encoding is enabled.
 */
export interface DiagnosticGpuInfo {
  /**
   * Friendly name of the active GPU as reported by Chromium / OS, e.g. 'AMD Radeon RX 540'
   */
  primaryGpuName: string | null
  /**
   * GPU vendor string, e.g. 'AMD', 'Intel', 'NVIDIA'
   */
  primaryGpuVendor: string | null
  /**
   * Driver version string when the OS exposes it
   */
  primaryGpuDriverVersion: string | null
  /**
   * All GPUs discovered by Chromium (helpful on switchable-graphics laptops)
   */
  allGpus: Array<{
    /**
     * Friendly name (vendor + model) when available
     */
    name: string | null
    /**
     * Vendor string
     */
    vendor: string | null
    /**
     * Driver version
     */
    driverVersion: string | null
    /**
     * Whether Chromium considers this GPU active
     */
    active: boolean
  }>
  /**
   * Feature status map from Chromium: `webgl`, `video_decode`, `video_encode`, `rasterization`, …
   */
  featureStatus: GpuFeatureStatus
}

/**
 * Free / total bytes for a filesystem path. Used to surface "disk almost full" warnings
 * for the directory where Cockpit writes its videos.
 */
export interface DiskSpaceInfo {
  /**
   * Absolute filesystem path the space report is for
   */
  path: string
  /**
   * Total filesystem capacity in bytes
   */
  totalBytes: number
  /**
   * Free capacity in bytes
   */
  freeBytes: number
}

/**
 * Aggregated diagnostic snapshot exposed via `electronAPI.getDiagnosticInfo`. Combines static
 * hardware identification with live numbers (memory, disk free) so the renderer can render a
 * single "System info" panel in the Development settings without coordinating multiple IPCs.
 */
export interface DiagnosticInfo {
  /**
   * Cockpit application version (matches `app.getVersion()`)
   */
  cockpitVersion: string
  /**
   * Electron runtime version
   */
  electronVersion: string
  /**
   * Chromium runtime version
   */
  chromeVersion: string
  /**
   * Node.js runtime version embedded in Electron
   */
  nodeVersion: string
  /**
   * `os.platform()` value (e.g. 'win32', 'darwin', 'linux')
   */
  platform: string
  /**
   * `os.release()` value (kernel / OS release identifier)
   */
  osRelease: string
  /**
   * `os.arch()` value
   */
  arch: string
  /**
   * CPU model string from `os.cpus()[0].model`
   */
  cpuModel: string | null
  /**
   * Number of logical CPUs reported by `os.cpus().length`
   */
  cpuLogicalCores: number
  /**
   * Total physical memory in bytes from `os.totalmem()`
   */
  totalMemoryBytes: number
  /**
   * Free physical memory in bytes from `os.freemem()`
   */
  freeMemoryBytes: number
  /**
   * GPU diagnostic information from Chromium APIs
   */
  gpu: DiagnosticGpuInfo
  /**
   * Disk space report for the Cockpit videos folder
   */
  videosFolderDisk: DiskSpaceInfo | null
}

/**
 * Hardware-oriented fields collected in the Electron main process for usage telemetry (browser build omits this).
 */
export interface TelemetrySystemHardwareInfo {
  /**
   * Device / system manufacturer when reported by the OS
   */
  deviceManufacturer: string | null
  /**
   * Device / system model when reported by the OS
   */
  deviceModel: string | null
  /**
   * CPU vendor / manufacturer string
   */
  cpuManufacturer: string | null
  /**
   * CPU marketing model name (e.g. Core i7, Apple M1)
   */
  cpuModel: string | null
  /**
   * Number of physical CPU packages (sockets) when available
   */
  cpuPackageCount: number | null
  /**
   * Count of physical CPU cores
   */
  cpuPhysicalCoreCount: number | null
  /**
   * Count of logical CPUs (threads)
   */
  cpuLogicalCoreCount: number | null
  /**
   * Maximum advertised CPU clock speed in GHz when available
   */
  cpuSpeedMaxGHz: number | null
  /**
   * Installed RAM in bytes
   */
  totalPhysicalMemoryBytes: number | null
  /**
   * Sum of physical disk capacities reported by disk layout (bytes)
   */
  totalPhysicalStorageBytes: number | null
  /**
   * Primary GPU vendor string when available
   */
  gpuManufacturer: string | null
  /**
   * Primary GPU model name when available
   */
  gpuModel: string | null
}

/**
 * Utility functions for platform detection
 */
export class PlatformUtils {
  /**
   * Check if the platform is macOS
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the platform is macOS, false otherwise.
   */
  static isMac(platform: string): boolean {
    return platform === Platform.MACOS
  }

  /**
   * Check if the system is ARM64 Mac
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the system is ARM64 Mac, false otherwise.
   */
  static isArm64Mac(platform: string, arch: string): boolean {
    return PlatformUtils.isMac(platform) && arch === Architecture.ARM64
  }

  /**
   * Check if x64 version is running on ARM64 Mac (via Rosetta)
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @param {string} arch - The architecture of the system. Possibilities can be found in the Architecture enum.
   * @param {string} processArch - The architecture of the process. Possibilities can be found in the Architecture enum.
   * @returns {boolean} True if the x64 version is running on ARM64 Mac (via Rosetta), false otherwise.
   */
  static isX64OnArm64Mac(platform: string, arch: string, processArch: string): boolean {
    return PlatformUtils.isArm64Mac(platform, arch) && processArch === Architecture.X64
  }

  /**
   * Check if the system is Windows
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the system is Windows, false otherwise.
   */
  static isWindows(platform: string): boolean {
    return platform === Platform.MACOS
  }

  /**
   * Check if the system is Linux
   * @param {string} platform - The platform of the system. Possibilities can be found in the Platform enum.
   * @returns {boolean} True if the system is Linux, false otherwise.
   */
  static isLinux(platform: string): boolean {
    return platform === Platform.LINUX
  }
}
