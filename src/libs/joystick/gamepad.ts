import { availableGamepadToCockpitMaps, getJoystickModelFromVidPid, JoystickModel } from '@/assets/joystick-profiles'
import { type JoystickState, gamepadStateToJoystickState, Joystick, VidPid } from '@/types/joystick'

export type GamepadStateEvent = {
  /**
   * Gamepad index
   */
  index: number
  /**
   * Gamepad object
   */
  gamepad: Gamepad
  /**
   * Joystick state
   */
  state: JoystickState
}

/**
 * Callback type for gamepad state events
 */
type CallbackGamepadStateEventType = (event: GamepadStateEvent) => void

/**
 * Callback type for gamepad connection events
 */
type CallbackGamepadConnectionEventType = (gamepads: Map<number, Gamepad>) => void

/**
 * Previous gamepad state tracking
 */
interface PreviousGamepadState {
  /**
   * Timestamp of the state
   */
  timestamp: number
  /**
   * The joystick state
   */
  state: JoystickState
}

/**
 * Get Vendor ID and Product ID from joystick
 * @param {Gamepad} gamepad Object
 * @returns {VidPid} VID and PID
 */
export const getVidPidFromGamepad = (gamepad: Gamepad): VidPid => {
  const joystick_information = gamepad.id
  const vendor_regex = new RegExp('Vendor: (?<vendor_id>[0-9a-f]{4})')
  const product_regex = new RegExp('Product: (?<product_id>[0-9a-f]{4})')
  const vendor_id = vendor_regex.exec(joystick_information)?.groups?.vendor_id
  const product_id = product_regex.exec(joystick_information)?.groups?.product_id
  return { vendor_id, product_id }
}

/**
 * GamepadManager handles browser Gamepad API functionality
 */
export class GamepadManager {
  private static instance = new GamepadManager()

  private callbacksGamepadConnection: Array<CallbackGamepadConnectionEventType> = []
  private callbacksGamepadState: Array<CallbackGamepadStateEventType> = []
  private gamepads: Map<number, Gamepad> = new Map()
  private enabledGamepads: Array<number> = []
  private animationFrameId: number | null = null
  private previousGamepadState: Map<number, PreviousGamepadState> = new Map()
  private lastTimeGamepadConnectionsPolled = 0

  /**
   * Singleton constructor
   */
  private constructor() {
    console.log('Starting GamepadManager...')
  }

  /**
   * Singleton access
   * @returns {GamepadManager}
   */
  static self(): GamepadManager {
    return GamepadManager.instance
  }

  /**
   * Start monitoring gamepad connections and states
   */
  start(): void {
    this.updateGamepadsConnections()
    this.pollGamepadsStates()
  }

  /**
   * Stop monitoring gamepad events
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Callback to be used and receive gamepad connection updates
   * @param {CallbackGamepadConnectionEventType} callback
   */
  onGamepadConnectionUpdate(callback: CallbackGamepadConnectionEventType): void {
    this.callbacksGamepadConnection.push(callback)
  }

  /**
   * Register gamepad event callback
   * @param {CallbackGamepadStateEventType} callback
   */
  onGamepadStateUpdate(callback: CallbackGamepadStateEventType): void {
    this.callbacksGamepadState.push(callback)
  }

  /**
   * Get connected gamepads as Joystick objects
   * @returns {Map<number, Joystick>} Map of gamepad index to Joystick
   */
  getJoysticks(): Map<number, Joystick> {
    const joysticks = new Map<number, Joystick>()

    for (const [index, gamepad] of this.gamepads) {
      const { vendor_id, product_id } = getVidPidFromGamepad(gamepad)
      const model = getJoystickModelFromVidPid(vendor_id || '', product_id || '')

      const joystick = new Joystick(
        model,
        vendor_id || '',
        product_id || '',
        gamepad.buttons.length,
        gamepad.axes.length
      )

      joysticks.set(index, joystick)
    }

    return joysticks
  }

  /**
   * Poll for gamepad connections and disconnection every 500ms, and activates polling the gamepad states.
   * The polling for connections and disconnections is a workaround to get around the fact that the gamepad API events do not work the same way in all browsers.
   * In Chrome, for example, the gamepadconnected event is sometimes not fired when a gamepad is connected after a long time since the page was loaded.
   * This is a workaround to get around this issue.
   */
  private updateGamepadsConnections(): void {
    // Poll for gamepad connections and disconnections every 500ms
    if (Date.now() - this.lastTimeGamepadConnectionsPolled > 500) {
      const gamepadConnectionsState = navigator.getGamepads()

      let gamepadConnectionsChanged = false

      // Add new gamepads to the list
      for (const gamepad of gamepadConnectionsState) {
        if (gamepad && !this.gamepads.has(gamepad.index)) {
          this.enabledGamepads.push(gamepad.index)
          this.gamepads.set(gamepad.index, gamepad)
          console.log(`Gamepad ${gamepad.index} connected`)
          console.log(gamepad)
          gamepadConnectionsChanged = true
        }
      }

      // Remove gamepads that are not connected anymore
      for (const [index, gamepad] of this.gamepads) {
        if (!gamepadConnectionsState.map((g) => g?.index).includes(gamepad.index)) {
          this.enabledGamepads = this.enabledGamepads.filter((idx) => idx !== gamepad.index)
          this.gamepads.delete(gamepad.index)
          gamepadConnectionsChanged = true
        }
      }

      // Emit the updated list of gamepads for all listeners if there were any changes
      if (gamepadConnectionsChanged) {
        this.emitGamepadConnectionUpdate()
      }

      this.lastTimeGamepadConnectionsPolled = Date.now()
    }
    this.animationFrameId = requestAnimationFrame(() => this.updateGamepadsConnections())
  }

  /**
   * Get joystick model from gamepad
   * @param {Gamepad} gamepad The gamepad object
   * @returns {JoystickModel} The joystick model
   */
  private getJoystickModelFromGamepad(gamepad: Gamepad): JoystickModel {
    const { vendor_id, product_id } = getVidPidFromGamepad(gamepad)
    return getJoystickModelFromVidPid(vendor_id || '', product_id || '')
  }

  /**
   * Poll for gamepad state changes
   */
  private pollGamepadsStates(): void {
    const gamepads = navigator.getGamepads()

    for (const gamepad of gamepads) {
      if (!gamepad) continue

      const previousState = this.previousGamepadState.get(gamepad.index)

      // Get the gamepad to cockpit mapping
      const model = this.getJoystickModelFromGamepad(gamepad)
      const gamepadToCockpitMap = availableGamepadToCockpitMaps[model]

      const timestamp = Date.now()
      let shouldEmitStateEvent = false

      // Create initial state
      const newState: JoystickState = gamepadStateToJoystickState(
        [...gamepad.buttons],
        [...gamepad.axes],
        timestamp,
        gamepadToCockpitMap
      )

      // Check if state has changed
      if (previousState) {
        // Check for axis changes
        gamepad.axes.forEach((_, index) => {
          if (previousState.state.axes[index] !== newState.axes[index]) {
            shouldEmitStateEvent = true
          }
        })

        // Check for button changes
        gamepad.buttons.forEach((_, index) => {
          if (previousState.state.buttons[index] !== newState.buttons[index]) {
            shouldEmitStateEvent = true
          }
        })
      } else {
        // First state, always emit
        shouldEmitStateEvent = true
      }

      // Update previous state
      this.previousGamepadState.set(gamepad.index, {
        timestamp,
        state: newState,
      })

      if (shouldEmitStateEvent) {
        const gamepadEvent: GamepadStateEvent = {
          index: gamepad.index,
          gamepad: gamepad,
          state: newState,
        }
        this.emitGamepadStateUpdate(gamepadEvent)
      }
    }

    // Continue polling
    this.animationFrameId = requestAnimationFrame(() => this.pollGamepadsStates())
  }

  /**
   * Emit gamepad state updates to registered callbacks
   * @param {GamepadStateEvent} state - The state event to emit
   */
  private emitGamepadStateUpdate(state: GamepadStateEvent): void {
    if (!this.enabledGamepads.includes(state.index)) return

    // Get the joystick model to check if it's disabled
    const model = this.getJoystickModelFromGamepad(state.gamepad)
    const disabledJoystickModels = JSON.parse(localStorage.getItem('cockpit-disabled-joystick-models') || '[]')
    if (disabledJoystickModels.includes(model)) return

    for (const callback of this.callbacksGamepadState) {
      callback(state)
    }
  }

  /**
   * Emit gamepad connection updates to registered callbacks
   */
  private emitGamepadConnectionUpdate(): void {
    for (const callback of this.callbacksGamepadConnection) {
      callback(this.gamepads)
    }
  }
}

export const gamepadManager = GamepadManager.self()
