import { app, BrowserWindow, powerSaveBlocker, protocol, screen, session } from 'electron'
import { join } from 'path'

import { setupAutoUpdater } from './services/auto-update'
import store from './services/config-store'
import { setupElectronLogService } from './services/electron-log'
import { setupGo2RTCService } from './services/go2rtc'
import { setupHardwareTelemetryService } from './services/hardware-telemetry'
import { setupJoystickMonitoring } from './services/joystick'
import { linkService } from './services/link'
import { setupNetworkService } from './services/network'
import { setupResourceMonitoringService } from './services/resource-monitoring'
import { setupFilesystemStorage } from './services/storage'
import { setupSystemInfoService } from './services/system-info'
import { setupUserAgentService } from './services/user-agent'
import { setupVideoRecordingService } from './services/video-recording'
import { setupWorkspaceService } from './services/workspace'

// Setup the logger service as soon as possible to avoid different behaviors across runtime
setupElectronLogService()

export const ROOT_PATH = {
  dist: join(__dirname, '..'),
}

let mainWindow: BrowserWindow | null

let appSuspensionPowerSaveBlockerId: number | undefined
let displaySleepPowerSaveBlockerId: number | undefined

/**
 * Create electron window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: join(ROOT_PATH.dist, 'pwa-512x512.png'),
    backgroundColor: '#333333',
    webPreferences: {
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      webSecurity: !process.env.VITE_DEV_SERVER_URL, // Disable CORS in dev mode so we don't have to deal with per-system workarounds
    },
    autoHideMenuBar: true,
    width: store.get('windowBounds')?.width ?? screen.getPrimaryDisplay().workAreaSize.width,
    height: store.get('windowBounds')?.height ?? screen.getPrimaryDisplay().workAreaSize.height,
    x: store.get('windowBounds')?.x ?? screen.getPrimaryDisplay().bounds.x,
    y: store.get('windowBounds')?.y ?? screen.getPrimaryDisplay().bounds.y,
    title: `Cockpit (${app.getVersion()})`,
  })

  linkService.setMainWindow(mainWindow)

  mainWindow.on('move', () => {
    const windowBounds = mainWindow!.getBounds()
    const { x, y, width, height } = windowBounds
    store.set('windowBounds', { x, y, width, height })
  })

  // Don't use the browser page title
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(ROOT_PATH.dist, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  console.log('Closing application.')
  mainWindow = null
  app.quit()
})

app.on('ready', () => {
  protocol.registerFileProtocol('file', (i, o) => {
    o({ path: i.url.substring('file://'.length) })
  })
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'file',
    privileges: {
      secure: true,
      standard: true,
    },
  },
])

setupFilesystemStorage()
setupNetworkService()
setupResourceMonitoringService()
setupSystemInfoService()
setupHardwareTelemetryService()
setupUserAgentService()
setupWorkspaceService()
setupJoystickMonitoring()
setupVideoRecordingService()
setupGo2RTCService()

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  const cspPolicy = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "connect-src 'self' https://us.i.posthog.com https://*.ingest.us.sentry.io https://*.github.com ws: wss: http: https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' blob: mediastream:",
    "worker-src 'self' blob:",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy],
      },
    })
  })

  console.log('Creating window...')
  createWindow()

  appSuspensionPowerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
  displaySleepPowerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')

  setTimeout(() => {
    setupAutoUpdater(mainWindow as BrowserWindow)
  }, 5000)
})

app.on('before-quit', () => {
  if (appSuspensionPowerSaveBlockerId !== undefined && powerSaveBlocker.isStarted(appSuspensionPowerSaveBlockerId)) {
    powerSaveBlocker.stop(appSuspensionPowerSaveBlockerId)
    appSuspensionPowerSaveBlockerId = undefined
  }
  if (displaySleepPowerSaveBlockerId !== undefined && powerSaveBlocker.isStarted(displaySleepPowerSaveBlockerId)) {
    powerSaveBlocker.stop(displaySleepPowerSaveBlockerId)
    displaySleepPowerSaveBlockerId = undefined
  }

  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
