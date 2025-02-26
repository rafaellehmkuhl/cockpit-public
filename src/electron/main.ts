import { app, BrowserWindow, protocol, screen } from 'electron'
import logger from 'electron-log'
import { join } from 'path'

// Define SDL module type
interface SDLJoystickInstance {
  buttons: number[];
  axes: number[];
  closed: boolean;
  on: (eventType: string, callback: (event: string) => void) => void;
  close: () => void;
}

interface SDLJoystickDevice {
  id: string;
  name: string;
  vendor?: string;
  product?: string;
}

interface SDLJoystickModule {
  devices: SDLJoystickDevice[];
  openDevice: (device: SDLJoystickDevice) => SDLJoystickInstance;
  on?: (eventType: string, callback: (device: SDLJoystickDevice) => void) => void;
}

interface SDLModule {
  joystick: SDLJoystickModule;
}

// Import SDL properly for Electron environment
function loadSDL(): SDLModule | null {
  console.log('Attempting to load SDL module...')

  // Try multiple paths to find the SDL module
  const possiblePaths = [
    '@kmamal/sdl',                                     // Direct require
    join(app.getAppPath(), 'node_modules/@kmamal/sdl'), // From app path
    join(__dirname, '../../node_modules/@kmamal/sdl'),  // Relative to current directory
    join(process.cwd(), 'node_modules/@kmamal/sdl')     // From current working directory
  ]

  // Version information for debugging
  console.log(`Node.js version: ${process.version}`)
  console.log(`Electron version: ${process.versions.electron}`)
  console.log(`App path: ${app.getAppPath()}`)
  console.log(`Current directory: ${__dirname}`)
  console.log(`Working directory: ${process.cwd()}`)

  let sdlModule: SDLModule | null = null
  let loadError: Error | null = null

  // Try each path in order
  for (const modulePath of possiblePaths) {
    try {
      console.log(`Trying to load SDL from: ${modulePath}`)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require(modulePath)
      if (module && module.joystick) {
        console.log(`Successfully loaded SDL from: ${modulePath}`)
        sdlModule = module
        break
      } else {
        console.log(`Module loaded from ${modulePath} but doesn't have expected joystick property`)
      }
    } catch (error) {
      loadError = error as Error
      console.log(`Failed to load from ${modulePath}: ${(error as Error).message}`)
    }
  }

  if (!sdlModule) {
    console.error('All SDL loading attempts failed. Last error:', loadError)
    return null
  }

  // Test the joystick functionality
  try {
    console.log(`Joystick devices available: ${sdlModule.joystick.devices.length}`)
    sdlModule.joystick.devices.forEach((device, index) => {
      console.log(`Device ${index + 1}:`)
      console.log(`  ID: ${device.id}`)
      console.log(`  Name: ${device.name}`)
      console.log(`  Vendor: ${device.vendor || 'Unknown'}`)
      console.log(`  Product: ${device.product || 'Unknown'}`)
    })
    return sdlModule
  } catch (error) {
    console.error('Error accessing SDL joystick devices:', error)
    return null
  }
}

const sdl = loadSDL()

import { setupAutoUpdater } from './services/auto-update'
import store from './services/config-store'
import { setupNetworkService } from './services/network'
import { setupFilesystemStorage } from './services/storage'

// If the app is packaged, push logs to the system instead of the console
if (app.isPackaged) {
  Object.assign(console, logger.functions)
}

export const ROOT_PATH = {
  dist: join(__dirname, '..'),
}

let mainWindow: BrowserWindow | null

/**
 * Create electron window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: join(ROOT_PATH.dist, 'pwa-512x512.png'),
    webPreferences: {
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    width: store.get('windowBounds')?.width ?? screen.getPrimaryDisplay().workAreaSize.width,
    height: store.get('windowBounds')?.height ?? screen.getPrimaryDisplay().workAreaSize.height,
    x: store.get('windowBounds')?.x ?? screen.getPrimaryDisplay().bounds.x,
    y: store.get('windowBounds')?.y ?? screen.getPrimaryDisplay().bounds.y,
  })

  mainWindow.on('move', () => {
    const windowBounds = mainWindow!.getBounds()
    const { x, y, width, height } = windowBounds
    store.set('windowBounds', { x, y, width, height })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(ROOT_PATH.dist, 'index.html'))
  }
}

/**
 * Initialize joystick detection and monitoring
 */
function setupJoystickMonitoring(): void {
  if (!sdl) {
    console.error('Cannot set up joystick monitoring: SDL module is not available')
    return
  }

  try {
    console.log('Initializing SDL joystick monitoring...')

    // Map to track opened joysticks
    const openedJoysticks = new Map<string, SDLJoystickInstance>()

    // Map to track previous state of joysticks
    const previousStates = new Map<string, { buttons: number[]; axes: number[] }>()

    // Check for available joysticks
    try {
      const joystickDevices = sdl.joystick.devices
      console.log(`Found ${joystickDevices.length} joystick(s) connected`)

      // Function to handle a joystick device
      const openJoystick = (device: SDLJoystickDevice): void => {
        try {
          console.log(`Attempting to open joystick: ${device.name}`)
          const joystickInstance = sdl.joystick.openDevice(device)

          if (!joystickInstance) {
            console.log(`Failed to open joystick: ${device.name}`)
            return
          }

          // Store the joystick instance for later reference
          openedJoysticks.set(device.id, joystickInstance)

          // Initialize previous state for this joystick
          previousStates.set(device.id, {
            buttons: Array(joystickInstance.buttons.length).fill(0),
            axes: Array(joystickInstance.axes.length).fill(0)
          })

          // Log joystick details
          console.log(`Successfully opened joystick:`)
          console.log(`  ID: ${device.id}`)
          console.log(`  Name: ${device.name}`)
          console.log(`  Vendor: ${device.vendor || 'Unknown'}`)
          console.log(`  Product: ${device.product || 'Unknown'}`)
          console.log(`  Number of axes: ${joystickInstance.axes.length}`)
          console.log(`  Number of buttons: ${joystickInstance.buttons.length}`)

          // Create polling function to check joystick state
          const checkJoystickState = (): void => {
            // Only process if the joystick is still connected
            if (joystickInstance.closed) return

            const previousState = previousStates.get(device.id)
            if (!previousState) return // Safety check

            // Check buttons for changes
            for (let i = 0; i < joystickInstance.buttons.length; i++) {
              const isPressed = joystickInstance.buttons[i] ? 1 : 0
              if (isPressed !== previousState.buttons[i]) {
                console.log(`Joystick [${device.name}] Button ${i}: ${isPressed ? 'PRESSED' : 'RELEASED'}`)
                previousState.buttons[i] = isPressed
              }
            }

            // Check axes for changes
            for (let i = 0; i < joystickInstance.axes.length; i++) {
              const value = joystickInstance.axes[i]
              // Only report axis values if they exceed a threshold and have changed significantly
              if (Math.abs(value - previousState.axes[i]) > 0.05) {
                if (Math.abs(value) > 0.1) {
                  console.log(`Joystick [${device.name}] Axis ${i}: ${value.toFixed(2)}`)
                }
                previousState.axes[i] = value
              }
            }
          }

          // Set up polling interval for joystick state
          const pollInterval = setInterval(checkJoystickState, 50) // 50ms interval

          // Handle joystick close event
          joystickInstance.on('*', (event: string) => {
            if (event === 'close') {
              console.log(`Joystick closed: ${device.name}`)
              clearInterval(pollInterval)
              openedJoysticks.delete(device.id)
              previousStates.delete(device.id)
            }
          })

        } catch (error) {
          console.error(`Error opening joystick ${device.name}:`, error)
        }
      }

      // Open all currently connected joysticks
      joystickDevices.forEach(device => openJoystick(device))

      // Check if the 'on' method exists for device events
      if (typeof sdl.joystick.on === 'function') {
        // Monitor for device connections
        sdl.joystick.on('deviceAdd', (device: SDLJoystickDevice) => {
          console.log(`Joystick connected: ${device.name}`)
          openJoystick(device)
        })

        // Monitor for device disconnections
        sdl.joystick.on('deviceRemove', (device: SDLJoystickDevice) => {
          console.log(`Joystick disconnected: ${device.name}`)
          const instance = openedJoysticks.get(device.id)
          if (instance && !instance.closed) {
            instance.close()
          }
          openedJoysticks.delete(device.id)
          previousStates.delete(device.id)
        })
      } else {
        console.warn('SDL joystick module does not support device events (on method missing)')
        console.log('Will poll for device changes instead')

        // Set up periodic device checking if events aren't supported
        let previousDeviceIds = new Set(joystickDevices.map(device => device.id))

        const checkDeviceChanges = () => {
          const currentDevices = sdl?.joystick.devices || []
          const currentDeviceIds = new Set(currentDevices.map(device => device.id))

          // Check for new devices
          for (const device of currentDevices) {
            if (!previousDeviceIds.has(device.id) && !openedJoysticks.has(device.id)) {
              console.log(`Joystick connected (poll detected): ${device.name}`)
              openJoystick(device)
            }
          }

          // Check for removed devices
          for (const deviceId of previousDeviceIds) {
            if (!currentDeviceIds.has(deviceId)) {
              console.log(`Joystick disconnected (poll detected): ${deviceId}`)
              const instance = openedJoysticks.get(deviceId)
              if (instance && !instance.closed) {
                instance.close()
              }
              openedJoysticks.delete(deviceId)
              previousStates.delete(deviceId)
            }
          }

          previousDeviceIds = currentDeviceIds
        }

        // Check for device changes every second
        setInterval(checkDeviceChanges, 1000)
      }

      // Clean up when app quits
      app.on('will-quit', () => {
        console.log('Closing SDL joystick resources...')
        openedJoysticks.forEach((instance) => {
          if (instance && !instance.closed) {
            instance.close()
          }
        })
        openedJoysticks.clear()
        previousStates.clear()
      })

    } catch (sdlError) {
      console.error('Error accessing SDL joystick devices:', sdlError)
    }
  } catch (initError) {
    console.error('Failed to initialize SDL joystick monitoring:', initError)
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
      supportFetchAPI: true,
      allowServiceWorkers: true,
    },
  },
])

setupFilesystemStorage()
setupNetworkService()

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  // Set up joystick monitoring
  setupJoystickMonitoring()

  console.log('Creating window...')
  createWindow()

  setTimeout(() => {
    setupAutoUpdater(mainWindow as BrowserWindow)
  }, 5000)
})

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
