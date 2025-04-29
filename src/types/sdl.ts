/**
 * SDL joystick instance type
 */
export interface SDLJoystickInstance {
  /**
   * State of the joystick buttons
   */
  buttons: number[]
  /**
   * State of the joystick axes
   */
  axes: number[]
  /**
   * Whether the joystick is disabled or not
   */
  closed: boolean
  /**
   * Add an event listener to the joystick
   */
  on: (eventType: string, callback: (event: string) => void) => void
  /**
   * Disable the joystick
   */
  close: () => void
}

/**
 * SDL joystick device type
 */
export interface SDLJoystickDevice {
  /**
   * Device identification
   */
  id: string
  /**
   * Device name
   */
  name: string
  /**
   * Device vendor
   */
  vendor?: string
  /**
   * Device product
   */
  product?: string
}

/**
 * SDL joystick module type
 */
export interface SDLJoystickModule {
  /**
   * List of available joysticks
   */
  devices: SDLJoystickDevice[]
  /**
   * Enable a joystick device by its device identification
   */
  openDevice: (device: SDLJoystickDevice) => SDLJoystickInstance
  /**
   * Add an event listener to the joystick
   */
  on?: (eventType: string, callback: (device: SDLJoystickDevice) => void) => void
}

/**
 * SDL module type
 */
export interface SDLModule {
  /**
   * Joystick module
   */
  joystick: SDLJoystickModule
}
