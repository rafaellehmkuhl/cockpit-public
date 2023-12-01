/* eslint-disable prettier/prettier */
/* eslint-disable vue/max-len */
/* eslint-disable max-len */
/* eslint-disable jsdoc/require-jsdoc */
import { round, scale } from '@/libs/utils'
import { type JoystickProtocolActionsMapping, type JoystickState, type ProtocolAction, JoystickAxis, JoystickButton, JoystickProtocol, ProtocolControllerState } from '@/types/joystick'

/**
 * Possible axes in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum MAVLinkAxisFunction {
  X = 'axis_x',
  Y = 'axis_y',
  Z = 'axis_z',
  R = 'axis_r',
}

/**
 * Possible functions in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum MAVLinkButtonFunction {
    disabled = 'Disabled', // 0
    shift = 'Shift', // 1
    arm_toggle = 'Arm toggle', // 2
    arm = 'Arm', // 3
    disarm = 'Disarm', // 4
    mode_manual = 'Mode manual', // 5
    mode_stabilize = 'Mode stabilize', // 6
    mode_depth_hold = 'Mode depth hold', // 7
    mode_poshold = 'Mode poshold', // 8
    mode_auto = 'Mode auto', // 9
    mode_circle = 'Mode circle', // 10
    mode_guided = 'Mode guided', // 11
    mode_acro = 'Mode acro', // 12
    mount_center = 'Mount center', // 21
    mount_tilt_up = 'Mount tilt up', // 22
    mount_tilt_down = 'Mount tilt down', // 23
    camera_trigger = 'Camera trigger', // 24
    camera_source_toggle = 'Camera source toggle', // 25
    mount_pan_right = 'Mount pan right', // 26
    mount_pan_left = 'Mount pan left', // 27
    lights1_cycle = 'Lights1 cycle', // 31
    lights1_brighter = 'Lights1 brighter', // 32
    lights1_dimmer = 'Lights1 dimmer', // 33
    lights2_cycle = 'Lights2 cycle', // 34
    lights2_brighter = 'Lights2 brighter', // 35
    lights2_dimmer = 'Lights2 dimmer', // 36
    gain_toggle = 'Gain toggle', // 41
    gain_inc = 'Gain inc', // 42
    gain_dec = 'Gain dec', // 43
    trim_roll_inc = 'Trim roll inc', // 44
    trim_roll_dec = 'Trim roll dec', // 45
    trim_pitch_inc = 'Trim pitch inc', // 46
    trim_pitch_dec = 'Trim pitch dec', // 47
    input_hold_set = 'Input hold set', // 48
    roll_pitch_toggle = 'Roll pitch toggle', // 49
    relay1_on = 'Relay 1 on', // 51
    relay1_off = 'Relay 1 off', // 52
    relay1_toggle = 'Relay 1 toggle', // 53
    relay2_on = 'Relay 2 on', // 54
    relay2_off = 'Relay 2 off', // 55
    relay2_toggle = 'Relay 2 toggle', // 56
    relay3_on = 'Relay 3 on', // 57
    relay3_off = 'Relay 3 off', // 58
    relay3_toggle = 'Relay 3 toggle', // 59
    servo1_inc = 'Servo 1 inc', // 61
    servo1_dec = 'Servo 1 dec', // 62
    servo1_min = 'Servo 1 min', // 63
    servo1_max = 'Servo 1 max', // 64
    servo1_center = 'Servo 1 center', // 65
    servo2_inc = 'Servo 2 inc', // 66
    servo2_dec = 'Servo 2 dec', // 67
    servo2_min = 'Servo 2 min', // 68
    servo2_max = 'Servo 2 max', // 69
    servo2_center = 'Servo 2 center', // 70
    servo3_inc = 'Servo 3 inc', // 71
    servo3_dec = 'Servo 3 dec', // 72
    servo3_min = 'Servo 3 min', // 73
    servo3_max = 'Servo 3 max', // 74
    servo3_center = 'Servo 3 center', // 75
    servo1_min_momentary = 'Servo 1 min momentary', // 76
    servo1_max_momentary = 'Servo 1 max momentary', // 77
    servo1_min_toggle = 'Servo 1 min toggle', // 78
    servo1_max_toggle = 'Servo 1 max toggle', // 79
    servo2_min_momentary = 'Servo 2 min momentary', // 80
    servo2_max_momentary = 'Servo 2 max momentary', // 81
    servo2_min_toggle = 'Servo 2 min toggle', // 82
    servo2_max_toggle = 'Servo 2 max toggle', // 83
    servo3_min_momentary = 'Servo 3 min momentary', // 84
    servo3_max_momentary = 'Servo 3 max momentary', // 85
    servo3_min_toggle = 'Servo 3 min toggle', // 86
    servo3_max_toggle = 'Servo 3 max toggle', // 87
    custom1 = 'Custom 1', // 91
    custom2 = 'Custom 2', // 92
    custom3 = 'Custom 3', // 93
    custom4 = 'Custom 4', // 94
    custom5 = 'Custom 5', // 95
    custom6 = 'Custom 6', // 96
    relay4_on = 'Relay 4 on', // 101
    relay4_off = 'Relay 4 off', // 102
    relay4_toggle = 'Relay 4 toggle', // 103
    relay1_momentary = 'Relay 1 momentary', // 104
    relay2_momentary = 'Relay 2 momentary', // 105
    relay3_momentary = 'Relay 3 momentary', // 106
    relay4_momentary = 'Relay 4 momentary', // 107
}

export enum MAVLinkManualControlButton {
  R0 = 'BTN0_FUNCTION',
  S0 = 'BTN0_SFUNCTION',
  R1 = 'BTN1_FUNCTION',
  S1 = 'BTN1_SFUNCTION',
  R2 = 'BTN2_FUNCTION',
  S2 = 'BTN2_SFUNCTION',
  R3 = 'BTN3_FUNCTION',
  S3 = 'BTN3_SFUNCTION',
  R4 = 'BTN4_FUNCTION',
  S4 = 'BTN4_SFUNCTION',
  R5 = 'BTN5_FUNCTION',
  S5 = 'BTN5_SFUNCTION',
  R6 = 'BTN6_FUNCTION',
  S6 = 'BTN6_SFUNCTION',
  R7 = 'BTN7_FUNCTION',
  S7 = 'BTN7_SFUNCTION',
  R8 = 'BTN8_FUNCTION',
  S8 = 'BTN8_SFUNCTION',
  R9 = 'BTN9_FUNCTION',
  S9 = 'BTN9_SFUNCTION',
  R10 = 'BTN10_FUNCTION',
  S10 = 'BTN10_SFUNCTION',
  R11 = 'BTN11_FUNCTION',
  S11 = 'BTN11_SFUNCTION',
  R12 = 'BTN12_FUNCTION',
  S12 = 'BTN12_SFUNCTION',
  R13 = 'BTN13_FUNCTION',
  S13 = 'BTN13_SFUNCTION',
  R14 = 'BTN14_FUNCTION',
  S14 = 'BTN14_SFUNCTION',
  R15 = 'BTN15_FUNCTION',
  S15 = 'BTN15_SFUNCTION',
}

const shiftActivatedButtons = (): MAVLinkManualControlButton[] => {
  return Object.entries(MAVLinkManualControlButton).filter((btn) => btn[1].includes('SFUNCTION')).map((btn) => btn[0] as MAVLinkManualControlButton)
}

const manualControlButtonFromParameterName = (name: string): MAVLinkManualControlButton | undefined => {
  const button = Object.entries(MAVLinkManualControlButton).find((entry) => entry[1] === name)?.[0]
  return button === undefined ? button : button as MAVLinkManualControlButton
}

/**
 * An axis action meant to be used with MAVLink's `MANUAL_CONTROL` message
 */
export class MAVLinkManualControlAxisAction implements ProtocolAction {
  readonly protocol = JoystickProtocol.MAVLinkManualControl
  /**
   * Create an axis input
   * @param {MAVLinkAxisFunction} id Axis identification
   * @param {string} name Axis human-readable name
   */
  constructor(public id: MAVLinkAxisFunction, public name: string) {}
}

/**
 * A button action meant to be used with MAVLink's `MANUAL_CONTROL` message
 */
export class MAVLinkManualControlButtonAction implements ProtocolAction {
  readonly protocol = JoystickProtocol.MAVLinkManualControl
  /**
   * Create a button input
   * @param {MAVLinkButtonFunction} id Button identification
   * @param {string} name Button human-readable name
   */
  constructor(public id: MAVLinkButtonFunction, public name: string) {}
}

// Available axis actions
export const mavlinkManualControlAxes: { [key in MAVLinkAxisFunction]: MAVLinkManualControlAxisAction } = {
  [MAVLinkAxisFunction.X]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.X, 'Axis X'),
  [MAVLinkAxisFunction.Y]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.Y, 'Axis Y'),
  [MAVLinkAxisFunction.Z]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.Z, 'Axis Z'),
  [MAVLinkAxisFunction.R]: new MAVLinkManualControlAxisAction(MAVLinkAxisFunction.R, 'Axis R'),
}

// Available button actions
export const mavlinkManualControlButtonFunctions: { [key in MAVLinkButtonFunction]: MAVLinkManualControlButtonAction } = {
  [MAVLinkButtonFunction.disabled]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.disabled, 'Disabled'),
  [MAVLinkButtonFunction.shift]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.shift, 'Shift'),
  [MAVLinkButtonFunction.arm_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.arm_toggle, 'Arm toggle'),
  [MAVLinkButtonFunction.arm]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.arm, 'Arm'),
  [MAVLinkButtonFunction.disarm]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.disarm, 'Disarm'),
  [MAVLinkButtonFunction.mode_manual]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_manual, 'Mode manual'),
  [MAVLinkButtonFunction.mode_stabilize]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_stabilize, 'Mode stabilize'),
  [MAVLinkButtonFunction.mode_depth_hold]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_depth_hold, 'Mode depth hold'),
  [MAVLinkButtonFunction.mode_poshold]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_poshold, 'Mode poshold'),
  [MAVLinkButtonFunction.mode_auto]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_auto, 'Mode auto'),
  [MAVLinkButtonFunction.mode_circle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_circle, 'Mode circle'),
  [MAVLinkButtonFunction.mode_guided]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_guided, 'Mode guided'),
  [MAVLinkButtonFunction.mode_acro]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mode_acro, 'Mode acro'),
  [MAVLinkButtonFunction.mount_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_center, 'Mount center'),
  [MAVLinkButtonFunction.mount_tilt_up]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_tilt_up, 'Mount tilt up'),
  [MAVLinkButtonFunction.mount_tilt_down]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_tilt_down, 'Mount tilt down'),
  [MAVLinkButtonFunction.camera_trigger]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.camera_trigger, 'Camera trigger'),
  [MAVLinkButtonFunction.camera_source_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.camera_source_toggle, 'Camera source toggle'),
  [MAVLinkButtonFunction.mount_pan_right]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_pan_right, 'Mount pan right'),
  [MAVLinkButtonFunction.mount_pan_left]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.mount_pan_left, 'Mount pan left'),
  [MAVLinkButtonFunction.lights1_cycle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_cycle, 'Lights1 cycle'),
  [MAVLinkButtonFunction.lights1_brighter]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_brighter, 'Lights1 brighter'),
  [MAVLinkButtonFunction.lights1_dimmer]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights1_dimmer, 'Lights1 dimmer'),
  [MAVLinkButtonFunction.lights2_cycle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_cycle, 'Lights2 cycle'),
  [MAVLinkButtonFunction.lights2_brighter]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_brighter, 'Lights2 brighter'),
  [MAVLinkButtonFunction.lights2_dimmer]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.lights2_dimmer, 'Lights2 dimmer'),
  [MAVLinkButtonFunction.gain_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_toggle, 'Gain toggle'),
  [MAVLinkButtonFunction.gain_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_inc, 'Gain inc'),
  [MAVLinkButtonFunction.gain_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.gain_dec, 'Gain dec'),
  [MAVLinkButtonFunction.trim_roll_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_roll_inc, 'Trim roll inc'),
  [MAVLinkButtonFunction.trim_roll_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_roll_dec, 'Trim roll dec'),
  [MAVLinkButtonFunction.trim_pitch_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_pitch_inc, 'Trim pitch inc'),
  [MAVLinkButtonFunction.trim_pitch_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.trim_pitch_dec, 'Trim pitch dec'),
  [MAVLinkButtonFunction.input_hold_set]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.input_hold_set, 'Input hold set'),
  [MAVLinkButtonFunction.roll_pitch_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.roll_pitch_toggle, 'Roll pitch toggle'),
  [MAVLinkButtonFunction.relay1_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_on, 'Relay 1 on'),
  [MAVLinkButtonFunction.relay1_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_off, 'Relay 1 off'),
  [MAVLinkButtonFunction.relay1_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_toggle, 'Relay 1 toggle'),
  [MAVLinkButtonFunction.relay2_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_on, 'Relay 2 on'),
  [MAVLinkButtonFunction.relay2_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_off, 'Relay 2 off'),
  [MAVLinkButtonFunction.relay2_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_toggle, 'Relay 2 toggle'),
  [MAVLinkButtonFunction.relay3_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_on, 'Relay 3 on'),
  [MAVLinkButtonFunction.relay3_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_off, 'Relay 3 off'),
  [MAVLinkButtonFunction.relay3_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_toggle, 'Relay 3 toggle'),
  [MAVLinkButtonFunction.servo1_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_inc, 'Servo 1 inc'),
  [MAVLinkButtonFunction.servo1_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_dec, 'Servo 1 dec'),
  [MAVLinkButtonFunction.servo1_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min, 'Servo 1 min'),
  [MAVLinkButtonFunction.servo1_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max, 'Servo 1 max'),
  [MAVLinkButtonFunction.servo1_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_center, 'Servo 1 center'),
  [MAVLinkButtonFunction.servo2_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_inc, 'Servo 2 inc'),
  [MAVLinkButtonFunction.servo2_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_dec, 'Servo 2 dec'),
  [MAVLinkButtonFunction.servo2_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min, 'Servo 2 min'),
  [MAVLinkButtonFunction.servo2_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max, 'Servo 2 max'),
  [MAVLinkButtonFunction.servo2_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_center, 'Servo 2 center'),
  [MAVLinkButtonFunction.servo3_inc]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_inc, 'Servo 3 inc'),
  [MAVLinkButtonFunction.servo3_dec]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_dec, 'Servo 3 dec'),
  [MAVLinkButtonFunction.servo3_min]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min, 'Servo 3 min'),
  [MAVLinkButtonFunction.servo3_max]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max, 'Servo 3 max'),
  [MAVLinkButtonFunction.servo3_center]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_center, 'Servo 3 center'),
  [MAVLinkButtonFunction.servo1_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min_momentary, 'Servo 1 min momentary'),
  [MAVLinkButtonFunction.servo1_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max_momentary, 'Servo 1 max momentary'),
  [MAVLinkButtonFunction.servo1_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_min_toggle, 'Servo 1 min toggle'),
  [MAVLinkButtonFunction.servo1_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo1_max_toggle, 'Servo 1 max toggle'),
  [MAVLinkButtonFunction.servo2_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min_momentary, 'Servo 2 min momentary'),
  [MAVLinkButtonFunction.servo2_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max_momentary, 'Servo 2 max momentary'),
  [MAVLinkButtonFunction.servo2_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_min_toggle, 'Servo 2 min toggle'),
  [MAVLinkButtonFunction.servo2_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo2_max_toggle, 'Servo 2 max toggle'),
  [MAVLinkButtonFunction.servo3_min_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min_momentary, 'Servo 3 min momentary'),
  [MAVLinkButtonFunction.servo3_max_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max_momentary, 'Servo 3 max momentary'),
  [MAVLinkButtonFunction.servo3_min_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_min_toggle, 'Servo 3 min toggle'),
  [MAVLinkButtonFunction.servo3_max_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.servo3_max_toggle, 'Servo 3 max toggle'),
  [MAVLinkButtonFunction.custom1]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom1, 'Custom 1'),
  [MAVLinkButtonFunction.custom2]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom2, 'Custom 2'),
  [MAVLinkButtonFunction.custom3]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom3, 'Custom 3'),
  [MAVLinkButtonFunction.custom4]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom4, 'Custom 4'),
  [MAVLinkButtonFunction.custom5]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom5, 'Custom 5'),
  [MAVLinkButtonFunction.custom6]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.custom6, 'Custom 6'),
  [MAVLinkButtonFunction.relay4_on]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_on, 'Relay 4 on'),
  [MAVLinkButtonFunction.relay4_off]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_off, 'Relay 4 off'),
  [MAVLinkButtonFunction.relay4_toggle]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_toggle, 'Relay 4 toggle'),
  [MAVLinkButtonFunction.relay1_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay1_momentary, 'Relay 1 momentary'),
  [MAVLinkButtonFunction.relay2_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay2_momentary, 'Relay 2 momentary'),
  [MAVLinkButtonFunction.relay3_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay3_momentary, 'Relay 3 momentary'),
  [MAVLinkButtonFunction.relay4_momentary]: new MAVLinkManualControlButtonAction(MAVLinkButtonFunction.relay4_momentary, 'Relay 4 momentary'),
}

// Available actions (axes and buttons)
export const availableMAVLinkManualControlActions = {
  ...mavlinkManualControlAxes,
  ...mavlinkManualControlButtonFunctions,
}

export class MavlinkControllerState extends ProtocolControllerState {
  x: number
  y: number
  z: number
  r: number
  buttons: number
  target: number
  public static readonly BUTTONS_PER_BITFIELD = 16

  /**
   *
   * @param { JoystickState } joystickState - Cockpit standard mapped values for the joystick
   * @param { JoystickProtocolActionsMapping } mapping - Gamepad API to Protocols joystick mapping, where assignments and limits are got from.
   * @param { { title: string, value: number } } buttonParameterTable - Gamepad API to Protocols joystick mapping, where assignments and limits are got from.
   * @param { { [key in string]: number } } currentParameters - Gamepad API to Protocols joystick mapping, where assignments and limits are got from.
   * @param { ProtocolAction[] } activeButtonActions - Currently active button actions.
   * @param { number } target - Specify targeted vehicle ID.
   */
  constructor(
    joystickState: JoystickState,
    mapping: JoystickProtocolActionsMapping,
    buttonParameterTable: { title: string, value: number }[],
    currentParameters: { [key in string]: number },
    activeButtonActions: ProtocolAction[],
    target = 1
  ) {
    super()

    // const isMavlinkAction = (action: ProtocolAction): boolean => action.protocol === JoystickProtocol.MAVLinkManualControl

    let buttons_int = 0

    if (buttonParameterTable.length !== 0 && Object.entries(currentParameters).length !== 0) {
      const buttonParametersNamedObject: { [key in number]: string } = {}
      buttonParameterTable.forEach((entry) => buttonParametersNamedObject[entry.value] = entry.title)
      const currentButtonParameters = Object.entries(currentParameters).filter(([k,]) => k.includes('BTN'))
      const buttonActionIdTable = currentButtonParameters.map((btn) => ({ button: btn[0], actionId: buttonParametersNamedObject[btn[1]]}))
      const maybeShiftButton = buttonActionIdTable.find((entry) => entry.actionId as MAVLinkButtonFunction === mavlinkManualControlButtonFunctions['Shift'].id)
      let shiftButton = undefined
      if (maybeShiftButton !== undefined) {
        shiftButton = manualControlButtonFromParameterName(maybeShiftButton.button)
      }

      if (shiftButton === undefined) {
        // map shift to some button
      } else {
        // we are fine
      }

      const activeMavlinkManualControlActions = activeButtonActions.filter((a) => a.protocol === JoystickProtocol.MAVLinkManualControl)
      const vehicleButtonsToActivate = buttonActionIdTable.filter((entry) => activeMavlinkManualControlActions.map((action) => action.id).includes(entry.actionId as MAVLinkButtonFunction)).map((entry) => manualControlButtonFromParameterName(entry.button))
      const useShift = shiftActivatedButtons().filter((btn) => vehicleButtonsToActivate.includes(btn)).length > 0
      // console.log('use shift?', useShift)

      for (let i = 0; i < MavlinkControllerState.BUTTONS_PER_BITFIELD; i++) {
        let buttonState = 0
        if (shiftButton !== undefined && Number(shiftButton.replace('R', '').replace('S', '')) === i && useShift) {
          buttonState = 1
        }
        vehicleButtonsToActivate.forEach((btn) => {
          if (btn !== undefined && Number(btn.replace('R', '').replace('S', '')) === i) {
            buttonState = 1
          }
        })
        buttons_int += buttonState * 2 ** i
      }

      // Calculate axes

      const xCorrespondency = Object.entries(mapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_x.id)
      const yCorrespondency = Object.entries(mapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_y.id)
      const zCorrespondency = Object.entries(mapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_z.id)
      const rCorrespondency = Object.entries(mapping.axesCorrespondencies).find((entry) => entry[1].action.protocol === JoystickProtocol.MAVLinkManualControl && entry[1].action.id === mavlinkManualControlAxes.axis_r.id)

      this.x = xCorrespondency === undefined ? 0 : round(scale(joystickState.axes[xCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, xCorrespondency[1].min, xCorrespondency[1].max), 0)
      this.y = yCorrespondency === undefined ? 0 : round(scale(joystickState.axes[yCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, yCorrespondency[1].min, yCorrespondency[1].max), 0)
      this.z = zCorrespondency === undefined ? 0 : round(scale(joystickState.axes[zCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, zCorrespondency[1].min, zCorrespondency[1].max), 0)
      this.r = rCorrespondency === undefined ? 0 : round(scale(joystickState.axes[rCorrespondency[0] as unknown as JoystickAxis] ?? 0, -1, 1, rCorrespondency[1].min, rCorrespondency[1].max), 0)
    } else {
      console.log('not enough information to create a mavlink manual control package')
    }

    // console.log('buttons', buttons_int)
    // console.log('x', this.x)
    // console.log('y', this.y)
    // console.log('z', this.z)
    // console.log('r', this.r)

    this.buttons = buttons_int
    this.target = round(target, 0)
  }
}

