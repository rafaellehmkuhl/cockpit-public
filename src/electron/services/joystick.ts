import { JoystickState } from '@/types/joystick'
import { SDLJoystickDevice, SDLJoystickInstance, SDLModule } from '@/types/sdl'

const openedJoysticks = new Map<string, SDLJoystickInstance>()
const previousStates = new Map<string, JoystickState>()

/**
 * The interval at which to check the state of a joystick
 */
const joystickStateCheckInterval = 50 // ms

/**
 * Load the SDL module
 * @returns {SDLModule} The loaded SDL module
 * @throws {Error} If the SDL module does not load or does not have the expected joystick property
 */
export function loadSDL(): SDLModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('@kmamal/sdl')
    if (!module || !module.joystick) {
      throw new Error('SDL module does not have expected joystick property')
    }
    return module
  } catch (sdlLoadError) {
    throw new Error(`Failed to load SDL module: ${(sdlLoadError as Error).message}`)
  }
}

/**
 * The state of a joystick when it is first opened, based on number of buttons and axes
 * @param {SDLJoystickInstance} joystickInstance - The joystick instance
 * @returns {JoystickState} The zeroed joystick state
 */
const zeroedJoystickState = (joystickInstance: SDLJoystickInstance): JoystickState => ({
  buttons: Array(joystickInstance.buttons.length).fill(0),
  axes: Array(joystickInstance.axes.length).fill(0),
})

// Function to handle a joystick device
export const openJoystick = (sdl: SDLModule, device: SDLJoystickDevice): void => {
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
    previousStates.set(device.id, zeroedJoystickState(joystickInstance))

    // Log joystick details
    console.log(`Successfully opened joystick:`)
    console.log(`  ID: ${device.id}`)
    console.log(`  Name: ${device.name}`)
    console.log(`  Vendor: ${device.vendor ? device.vendor.toString(16).padStart(4, '0') : 'Unknown'}`)
    console.log(`  Product: ${device.product ? device.product.toString(16).padStart(4, '0') : 'Unknown'}`)
    console.log(`  Number of axes: ${joystickInstance.axes.length}`)
    console.log(`  Number of buttons: ${joystickInstance.buttons.length}`)

    // Create polling function to check joystick state

    // Set up polling interval for joystick state
    const pollInterval = setInterval(() => {
      if (joystickInstance.closed) {
        console.log(`Joystick closed: ${device.name}`)
        openedJoysticks.delete(device.id)
        previousStates.delete(device.id)
        clearInterval(pollInterval)
        return
      }

      const zeroedState = zeroedJoystickState(joystickInstance)
      checkJoystickState(device.name, joystickInstance, previousStates.get(device.id) ?? zeroedState)
    }, joystickStateCheckInterval)
  } catch (error) {
    console.error(`Error opening joystick ${device.name}:`, error)
  }
}

export const checkJoystickState = (
  deviceName: string,
  joystickInstance: SDLJoystickInstance,
  previousState: JoystickState
): void => {
  // Only process if the joystick is still connected
  if (joystickInstance.closed) return

  // Check buttons for changes
  for (let i = 0; i < joystickInstance.buttons.length; i++) {
    const isPressed = joystickInstance.buttons[i] ? 1 : 0
    if (isPressed !== previousState.buttons[i]) {
      console.log(`Joystick [${deviceName}] Button ${i}: ${isPressed ? 'PRESSED' : 'RELEASED'}`)
      previousState.buttons[i] = isPressed
    }
  }

  // Check axes for changes
  for (let i = 0; i < joystickInstance.axes.length; i++) {
    const value = joystickInstance.axes[i]
    // Only report axis values if they exceed a threshold and have changed significantly
    if (Math.abs(value - (previousState.axes[i] ?? 0)) >= 0.005) {
      if (Math.abs(value) >= 0.005) {
        console.log(`Joystick [${deviceName}] Axis ${i}: ${value.toFixed(2)}`)
      }
      previousState.axes[i] = value
    }
  }
}

export const checkDeviceChanges = (sdl: SDLModule): void => {
  try {
    const currentJoystickDevices = sdl.joystick.devices
    console.debug(`Found ${currentJoystickDevices.length} joystick(s) connected`)

    // Open all currently connected joysticks
    currentJoystickDevices.forEach((device) => {
      if (!openedJoysticks.has(device.id)) {
        console.debug(`Opening joystick: ${device.name}`)
        openJoystick(sdl, device)
      }
    })

    // Close any joysticks that are no longer connected
    openedJoysticks.forEach((joystickInstance, deviceId) => {
      if (joystickInstance.closed || !currentJoystickDevices.some((device) => device.id === deviceId)) {
        console.debug(`Joystick closed: ${deviceId}`)
        openedJoysticks.delete(deviceId)
        previousStates.delete(deviceId)
      }
    })
  } catch (sdlError) {
    console.error('Error accessing SDL joystick devices:', sdlError)
  }
}

/**
 * Initialize joystick detection and monitoring
 */
export const setupJoystickMonitoring = (): void => {
  let sdl: SDLModule | null = null

  try {
    sdl = loadSDL()
  } catch (error) {
    console.error('Cannot setup joystick monitoring. Failed to load SDL module:', error)
    return
  }

  console.debug('Initializing SDL joystick monitoring...')
  setInterval(() => checkDeviceChanges(sdl), 1000)
}
