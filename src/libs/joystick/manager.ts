import { defaultJoystickCalibration } from '@/assets/defaults'
import { getJoystickModelFromVidPid, JoystickModel } from '@/assets/joystick-profiles'
import {
  type ElectronSDLControllerStateEventData,
  type JoystickCalibration,
  type JoystickState,
  Joystick,
  sdlControllerStateToJoystickState,
} from '@/types/joystick'

import { isElectron } from '../utils'
import { applyCalibration } from './calibration'
import { type GamepadStateEvent, gamepadManager, getVidPidFromGamepad } from './gamepad'

export const joystickCalibrationOptionsKey = 'cockpit-joystick-calibration-options'

export type JoysticksMap = Map<number, Joystick>

export type JoystickStateEvent = {
  /**
   * Joystick index
   */
  index: number
  /**
   * Joystick state
   */
  state: JoystickState
}

type CallbackJoystickStateEventType = (event: JoystickStateEvent) => void
type CallbackJoystickConnectionEventType = (event: JoysticksMap) => void

/**
 * Joystick Manager
 * Abstraction over different joystick APIs (Gamepad API, SDL, and others in the future)
 */
class JoystickManager {
  private static instance = new JoystickManager()

  private callbacksJoystickConnection: Array<CallbackJoystickConnectionEventType> = []
  private callbacksJoystickState: Array<CallbackJoystickStateEventType> = []
  private joysticks: JoysticksMap = new Map()
  private calibrationOptions: Map<JoystickModel, JoystickCalibration> = new Map()

  /**
   * Singleton constructor
   */
  private constructor() {
    console.log('Starting JoystickManager...')

    if (isElectron()) {
      // Also check SDL status directly after a short delay
      setTimeout(async () => {
        try {
          if (!window.electronAPI) {
            console.error('Electron API not available.')
            this.startGamepadApiMonitoringRoutine()
            return
          }
          const status = await window.electronAPI.checkSDLStatus()

          if (!status.loaded) {
            console.error('SDL not loaded according to status check, falling back to Gamepad API.')
            this.startGamepadApiMonitoringRoutine()
          } else {
            console.log('SDL loaded successfully, using SDL for controllers.')
            this.startElectronSdlJoystickMonitoringRoutine()
          }
        } catch (error) {
          console.error('Error checking SDL status, falling back to Gamepad API:', error)
          this.startGamepadApiMonitoringRoutine()
        }
      }, 3000)
    } else {
      // In browser or if electronAPI is not available, use the Gamepad API
      console.log('Not in Electron or Electron API not available, using Gamepad API.')
      this.startGamepadApiMonitoringRoutine()
    }
  }

  /**
   * Singleton access
   * @returns {JoystickManager}
   */
  static self(): JoystickManager {
    return JoystickManager.instance
  }

  /**
   * Callback to be used and receive joystick connection updates
   * @param {CallbackJoystickConnectionEventType} callback
   */
  onJoystickConnectionUpdate(callback: CallbackJoystickConnectionEventType): void {
    this.callbacksJoystickConnection.push(callback)
  }

  /**
   * Register joystick event callback
   * @param {CallbackJoystickStateEventType} callback
   */
  onJoystickStateUpdate(callback: CallbackJoystickStateEventType): void {
    this.callbacksJoystickState.push(callback)
  }

  /**
   * Check SDL status
   * @returns {Promise<void>}
   */
  private async startSDLStatusCheckRoutine(): Promise<void> {
    if (!window.electronAPI) {
      return
    }
    const status = await window.electronAPI.checkSDLStatus()

    if (!status.loaded) {
      console.error('SDL connection dropped. Falling back to Gamepad API.')
      this.startGamepadApiMonitoringRoutine()
    }

    // Remove any joysticks that are not in the status.connectedControllers map
    let joystickConnectionsChanged = false
    for (const [index, _] of this.joysticks) {
      if (!status.connectedControllers.has(index)) {
        this.joysticks.delete(index)
        joystickConnectionsChanged = true
      }
    }

    if (joystickConnectionsChanged) {
      this.emitJoystickConnectionUpdate()
    }

    setTimeout(() => this.startSDLStatusCheckRoutine(), 1000)
  }

  /**
   * Set up joystick monitoring in Electron environment
   * This method sets up listeners for joystick events from the main process
   * and converts them to the same format as the Gamepad API events
   */
  private startElectronSdlJoystickMonitoringRoutine(): void {
    if (!window.electronAPI) {
      console.error('Electron API not available.')
      return
    }

    // Start checking SDL status
    this.startSDLStatusCheckRoutine()

    /**
     * Listen for joystick state updates from the main process
     * Converts SDL joystick state to Gamepad API format
     * @param data The joystick state data from the main process
     */
    window.electronAPI.onElectronSDLControllerStateChange((data: ElectronSDLControllerStateEventData) => {
      // Convert SDL joystick state to our event format

      // Add joystick to the list of joysticks if it is not already there
      if (!this.joysticks.has(data.deviceId)) {
        try {
          const model = getJoystickModelFromVidPid(data.vendorId, data.productId)
          const numberOfButtons = Object.keys(data.state.buttons).length
          const numberOfAxes = Object.keys(data.state.axes).length
          const newJoystick = new Joystick(model, data.vendorId, data.productId, numberOfButtons, numberOfAxes)
          this.joysticks.set(data.deviceId, newJoystick)
        } catch (error) {
          console.error('Failed to create joystick:', error)
          return
        }
      }

      const joystickState = sdlControllerStateToJoystickState(data.state)

      // Apply calibration to the SDL joystick state
      const model = getJoystickModelFromVidPid(data.vendorId, data.productId)
      const calibratedState: JoystickState = {
        timestamp: joystickState.timestamp,
        axes: joystickState.axes.map((value, index) =>
          value !== undefined ? this.applyCalibrationToValue('axis', index, value, model) : value
        ),
        buttons: joystickState.buttons.map((value, index) =>
          value !== undefined ? this.applyCalibrationToValue('button', index, value, model) : value
        ),
      }

      const joystickEvent: JoystickStateEvent = {
        index: data.deviceId,
        state: calibratedState,
      }

      // Emit joystick connection update
      this.emitJoystickConnectionUpdate()

      // Emit joystick state update
      this.emitJoystickStateUpdate(joystickEvent)
    })
  }

  /**
   * Start gamepad API monitoring routine
   */
  private startGamepadApiMonitoringRoutine(): void {
    // Start gamepad manager
    gamepadManager.start()

    // Listen for gamepad connections
    gamepadManager.onGamepadConnectionUpdate((gamepads) => {
      // Convert gamepads to joysticks and update our joysticks map
      this.joysticks = gamepadManager.getJoysticks()
      this.emitJoystickConnectionUpdate()
    })

    // Listen for gamepad state updates
    gamepadManager.onGamepadStateUpdate((event: GamepadStateEvent) => {
      // Apply calibration to gamepad state
      const { vendor_id, product_id } = getVidPidFromGamepad(event.gamepad)
      const model = getJoystickModelFromVidPid(vendor_id || '', product_id || '')

      const calibratedState: JoystickState = {
        timestamp: event.state.timestamp,
        axes: event.state.axes.map((value, index) =>
          value !== undefined ? this.applyCalibrationToValue('axis', index, value, model) : value
        ),
        buttons: event.state.buttons.map((value, index) =>
          value !== undefined ? this.applyCalibrationToValue('button', index, value, model) : value
        ),
      }

      const joystickEvent: JoystickStateEvent = {
        index: event.index,
        state: calibratedState,
      }

      this.emitJoystickStateUpdate(joystickEvent)
    })

    // Check calibration settings every second
    this.updateCalibrationSettings()
  }

  /**
   * Update calibration settings
   */
  private updateCalibrationSettings(): void {
    this.loadCalibrationSettings()
    setTimeout(() => {
      this.updateCalibrationSettings()
    }, 1000)
  }

  /**
   * Load calibration settings from localStorage
   */
  private loadCalibrationSettings(): void {
    try {
      const stored = localStorage.getItem(joystickCalibrationOptionsKey)
      if (stored) {
        const options = JSON.parse(stored) as Record<JoystickModel, JoystickCalibration>
        this.calibrationOptions = new Map(Object.entries(options).map(([key, value]) => [key as JoystickModel, value]))
      }
    } catch (error) {
      console.error('Failed to load joystick calibration settings:', error)
    }
  }

  /**
   * Get calibration settings for a joystick model
   * @param {JoystickModel} model The joystick model
   * @returns {JoystickCalibration} The calibration settings
   */
  private getCalibrationSettings(model: JoystickModel): JoystickCalibration {
    return this.calibrationOptions.get(model) ?? defaultJoystickCalibration
  }

  /**
   * Apply calibration to a joystick value
   * @param {string} inputType The type of input ('button' or 'axis')
   * @param {number} inputIndex The index of the input
   * @param {number} originalValue The original value of the input
   * @param {JoystickModel} model The joystick model
   * @returns {number} The calibrated value
   */
  private applyCalibrationToValue(
    inputType: 'button' | 'axis',
    inputIndex: number,
    originalValue: number,
    model: JoystickModel
  ): number {
    const calibration = this.getCalibrationSettings(model)
    return applyCalibration(inputType, inputIndex, originalValue, calibration)
  }
  /**
   * Emit joystick state updates to registered callbacks
   * @param {JoystickStateEvent} state - The state event to emit
   */
  private emitJoystickStateUpdate(state: JoystickStateEvent): void {
    for (const callback of this.callbacksJoystickState) {
      callback(state)
    }
  }

  /**
   * Emit joystick connection updates to registered callbacks
   */
  private emitJoystickConnectionUpdate(): void {
    for (const callback of this.callbacksJoystickConnection) {
      callback(this.joysticks)
    }
  }

  /**
   * Stop polling for gamepad events
   */
  stop(): void {
    gamepadManager.stop()
  }
}

export const joystickManager = JoystickManager.self()
