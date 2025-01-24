import { availableGamepadToCockpitMaps } from '@/assets/joystick-profiles'
import { JoystickModel } from '@/libs/joystick/manager'
import { GamepadToCockpitStdMapping, JoystickAxis, JoystickButton, JoystickState } from '@/types/joystick'

/**
 * Joystick abstraction for widget
 */
export class Joystick {
  gamepad: Gamepad
  model: JoystickModel = JoystickModel.Unknown

  /**
   * Create joystick component
   * @param {Gamepad} gamepad Axis to be set
   * @param {JoystickModel} model Joystick model
   */
  constructor(gamepad: Gamepad, model: JoystickModel = JoystickModel.Unknown) {
    this.gamepad = gamepad
    this.model = model
  }

  /**
   * Returns the gamepad to cockpit mapping for the current joystick model
   * @returns {GamepadToCockpitStdMapping}
   */
  get gamepadToCockpitMapping(): GamepadToCockpitStdMapping {
    return availableGamepadToCockpitMaps[this.model]
  }

  /**
   * Returns current raw state of axes and buttons, without mapping to the Cockpit standard
   * @returns {JoystickState}
   */
  get rawState(): JoystickState {
    return {
      buttons: this.gamepad.buttons.map((button) => button.value),
      axes: this.gamepad.axes.map((axis) => axis),
    }
  }

  /**
   * Returns the Cockpit standard button id for a given gamepad button index
   * @param {number} gamepadButtonIndex - The index of the gamepad button
   * @returns {JoystickButton | undefined} The Cockpit standard button id or undefined if not found
   */
  gamepadButtonToCockpitButton(gamepadButtonIndex: number): JoystickButton | undefined {
    return this.gamepadToCockpitMapping.buttons.find((corr) => {
      return corr.indexInGamepadAPI === gamepadButtonIndex
    })?.idInCockpitStd
  }

  /**
   * Returns the Cockpit standard axis id for a given gamepad axis index
   * @param {number} gamepadAxisIndex - The index of the gamepad axis
   * @returns {JoystickAxis | undefined} The Cockpit standard axis id or undefined if not found
   */
  gamepadAxisToCockpitAxis(gamepadAxisIndex: number): JoystickAxis | undefined {
    return this.gamepadToCockpitMapping.axes.find((corr) => corr.indexInGamepadAPI === gamepadAxisIndex)?.idInCockpitStd
  }

  /**
   * Returns current state of axes and buttons.
   * The state is mapped to the Cockpit standard if the joystick has a mapping.
   * If the joystick has no mapping, it returns the raw state.
   * @returns {JoystickState}
   */
  get state(): JoystickState {
    const buttons = this.gamepadToCockpitMapping.buttons.map((corr) => {
      return corr.indexInGamepadAPI === null ? undefined : this.gamepad.buttons[corr.indexInGamepadAPI]?.value
    })

    const axes = this.gamepadToCockpitMapping.axes.map((corr) => {
      return corr.indexInGamepadAPI === null ? undefined : this.gamepad.axes[corr.indexInGamepadAPI]
    })

    return { buttons, axes }
  }
}
