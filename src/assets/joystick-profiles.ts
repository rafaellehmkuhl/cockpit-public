import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { JoystickModel } from '@/libs/joystick/manager'
import { availableCockpitActions } from '@/libs/joystick/protocols/cockpit-actions'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
} from '@/libs/joystick/protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from '@/libs/joystick/protocols/other'
import {
  type GamepadToCockpitStdMapping,
  type JoystickProtocolActionsMapping,
  CockpitModifierKeyOption,
  JoystickAxis,
  JoystickButton,
} from '@/types/joystick'

export const defaultRovMappingHash = '10b0075a-27a7-4800-ba95-f35fd722d1df'
export const defaultBoatMappingHash = 'd3427f20-ba28-4cf7-ae24-ec740dd6dce0'
export const defaultMavMappingHash = 'dd654387-18fc-4674-89a6-4dc4d0bc8240'

export const defaultProtocolMappingVehicleCorrespondency = {
  [MavType.MAV_TYPE_SUBMARINE]: defaultRovMappingHash,
  [MavType.MAV_TYPE_SURFACE_BOAT]: defaultBoatMappingHash,
  [MavType.MAV_TYPE_QUADROTOR]: defaultMavMappingHash,
}

// TODO: Adjust mapping for PS5 controller
export const cockpitStandardToProtocols: JoystickProtocolActionsMapping[] = [
  {
    name: 'ROV functions mapping',
    hash: defaultRovMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: 0 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: modifierKeyActions.shift },
        [JoystickButton.B1]: { action: availableMavlinkManualControlButtonFunctions['Mode manual'] },
        [JoystickButton.B2]: { action: availableMavlinkManualControlButtonFunctions['Mode depth hold'] },
        [JoystickButton.B3]: { action: availableMavlinkManualControlButtonFunctions['Mode stabilize'] },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: availableMavlinkManualControlButtonFunctions['Mount tilt down'] },
        [JoystickButton.B7]: { action: availableMavlinkManualControlButtonFunctions['Mount tilt up'] },
        [JoystickButton.B8]: { action: availableMavlinkManualControlButtonFunctions['Disarm'] },
        [JoystickButton.B9]: { action: availableMavlinkManualControlButtonFunctions['Arm'] },
        [JoystickButton.B10]: { action: availableMavlinkManualControlButtonFunctions['Mount center'] },
        [JoystickButton.B11]: { action: availableMavlinkManualControlButtonFunctions['Input hold set'] },
        [JoystickButton.B12]: { action: availableMavlinkManualControlButtonFunctions['Gain inc'] },
        [JoystickButton.B13]: { action: availableMavlinkManualControlButtonFunctions['Gain dec'] },
        [JoystickButton.B14]: { action: availableMavlinkManualControlButtonFunctions['Lights1 dimmer'] },
        [JoystickButton.B15]: { action: availableMavlinkManualControlButtonFunctions['Lights1 brighter'] },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: availableMavlinkManualControlButtonFunctions['Roll pitch toggle'] },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: availableMavlinkManualControlButtonFunctions['Mode poshold'] },
        [JoystickButton.B3]: { action: availableMavlinkManualControlButtonFunctions['Mode acro'] },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: availableMavlinkManualControlButtonFunctions['Servo 1 min'] },
        [JoystickButton.B7]: { action: availableMavlinkManualControlButtonFunctions['Servo 1 max'] },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: availableMavlinkManualControlButtonFunctions['Relay 1 toggle'] },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: availableMavlinkManualControlButtonFunctions['Trim pitch inc'] },
        [JoystickButton.B13]: { action: availableMavlinkManualControlButtonFunctions['Trim pitch dec'] },
        [JoystickButton.B14]: { action: availableMavlinkManualControlButtonFunctions['Trim roll dec'] },
        [JoystickButton.B15]: { action: availableMavlinkManualControlButtonFunctions['Trim roll inc'] },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
  {
    name: 'Boat functions mapping',
    hash: defaultBoatMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: -1000 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: modifierKeyActions.shift },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: availableCockpitActions.mavlink_disarm },
        [JoystickButton.B9]: { action: availableCockpitActions.mavlink_arm },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: otherAvailableActions.no_function },
        [JoystickButton.B16]: { action: otherAvailableActions.no_function },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
  {
    name: 'MAV functions mapping',
    hash: defaultMavMappingHash,
    axesCorrespondencies: {
      [JoystickAxis.A0]: { action: mavlinkManualControlAxes.axis_r, min: -1000, max: +1000 },
      [JoystickAxis.A1]: { action: mavlinkManualControlAxes.axis_z, min: +1000, max: 0 },
      [JoystickAxis.A2]: { action: mavlinkManualControlAxes.axis_y, min: -1000, max: +1000 },
      [JoystickAxis.A3]: { action: mavlinkManualControlAxes.axis_x, min: +1000, max: -1000 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {
        [JoystickButton.B0]: { action: availableCockpitActions.mavlink_disarm },
        [JoystickButton.B1]: { action: availableCockpitActions.mavlink_arm },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: availableCockpitActions.go_to_previous_view },
        [JoystickButton.B5]: { action: availableCockpitActions.go_to_next_view },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: modifierKeyActions.shift },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: availableCockpitActions.toggle_top_bar },
        [JoystickButton.B16]: { action: availableCockpitActions.toggle_bottom_bar },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B0]: { action: otherAvailableActions.no_function },
        [JoystickButton.B1]: { action: otherAvailableActions.no_function },
        [JoystickButton.B2]: { action: otherAvailableActions.no_function },
        [JoystickButton.B3]: { action: otherAvailableActions.no_function },
        [JoystickButton.B4]: { action: otherAvailableActions.no_function },
        [JoystickButton.B5]: { action: otherAvailableActions.no_function },
        [JoystickButton.B6]: { action: otherAvailableActions.no_function },
        [JoystickButton.B7]: { action: otherAvailableActions.no_function },
        [JoystickButton.B8]: { action: otherAvailableActions.no_function },
        [JoystickButton.B9]: { action: otherAvailableActions.no_function },
        [JoystickButton.B10]: { action: otherAvailableActions.no_function },
        [JoystickButton.B11]: { action: otherAvailableActions.no_function },
        [JoystickButton.B12]: { action: otherAvailableActions.no_function },
        [JoystickButton.B13]: { action: otherAvailableActions.no_function },
        [JoystickButton.B14]: { action: otherAvailableActions.no_function },
        [JoystickButton.B15]: { action: otherAvailableActions.no_function },
        [JoystickButton.B16]: { action: otherAvailableActions.no_function },
        [JoystickButton.B17]: { action: otherAvailableActions.no_function },
      },
    },
  },
]

const regularGamepadToCockpitMap: GamepadToCockpitStdMapping = {
  axes: [
    { indexInGamepadAPI: 0, idInCockpitStd: JoystickAxis.A0 },
    { indexInGamepadAPI: 1, idInCockpitStd: JoystickAxis.A1 },
    { indexInGamepadAPI: 2, idInCockpitStd: JoystickAxis.A2 },
    { indexInGamepadAPI: 3, idInCockpitStd: JoystickAxis.A3 },
    { indexInGamepadAPI: 4, idInCockpitStd: JoystickAxis.A4 },
    { indexInGamepadAPI: 5, idInCockpitStd: JoystickAxis.A5 },
    { indexInGamepadAPI: 6, idInCockpitStd: JoystickAxis.A6 },
    { indexInGamepadAPI: 7, idInCockpitStd: JoystickAxis.A7 },
    { indexInGamepadAPI: 8, idInCockpitStd: JoystickAxis.A8 },
    { indexInGamepadAPI: 9, idInCockpitStd: JoystickAxis.A9 },
    { indexInGamepadAPI: 10, idInCockpitStd: JoystickAxis.A10 },
    { indexInGamepadAPI: 11, idInCockpitStd: JoystickAxis.A11 },
    { indexInGamepadAPI: 12, idInCockpitStd: JoystickAxis.A12 },
    { indexInGamepadAPI: 13, idInCockpitStd: JoystickAxis.A13 },
    { indexInGamepadAPI: 14, idInCockpitStd: JoystickAxis.A14 },
    { indexInGamepadAPI: 15, idInCockpitStd: JoystickAxis.A15 },

  ],
  buttons: [
    { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
    { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
    { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
    { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
    { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
    { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B5 },
    { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
    { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
    { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
    { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
    { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
    { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
    { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
    { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
    { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
    { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
    { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B16 },
    { indexInGamepadAPI: 17, idInCockpitStd: JoystickButton.B17 },
  ],
}

/**
 * Follows the standard controller in the Gamepad API: https://www.w3.org/TR/gamepad/#dfn-standard-gamepad
 * buttons[0] Bottom button in right cluster
 * buttons[1] Right button in right cluster
 * buttons[2] Left button in right cluster
 * buttons[3] Top button in right cluster
 * buttons[4] Top left front button
 * buttons[5] Top right front button
 * buttons[6] Bottom left front button
 * buttons[7] Bottom right front button
 * buttons[8] Left button in center cluster
 * buttons[9] Right button in center cluster
 * buttons[10] Left stick pressed button
 * buttons[11] Right stick pressed button
 * buttons[12] Top button in left cluster
 * buttons[13] Bottom button in left cluster
 * buttons[14] Left button in left cluster
 * buttons[15] Right button in left cluster
 * buttons[16] Center button in center cluster
 * buttons[17-31]	Extra non-standard buttons
 * axes[0] Horizontal axis for left stick (negative left/positive right)
 * axes[1] Vertical axis for left stick (negative up/positive down)
 * axes[2] Horizontal axis for right stick (negative left/positive right)
 * axes[3] Vertical axis for right stick (negative up/positive down)
 * axes[4-7] Extra non-standard axes
 */
export const availableGamepadToCockpitMaps: { [key in JoystickModel]: GamepadToCockpitStdMapping } = {
  [JoystickModel.DualSense]: regularGamepadToCockpitMap,
  [JoystickModel.DualShock4]: regularGamepadToCockpitMap,
  [JoystickModel.IpegaPG9023]: regularGamepadToCockpitMap,
  [JoystickModel.XboxOne_Wireless]: {
    axes: regularGamepadToCockpitMap.axes,
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
      { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
      { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
      { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
      { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
      { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B16 },
      { indexInGamepadAPI: 17, idInCockpitStd: JoystickButton.B17 },
    ],
  },
  [JoystickModel.XboxOneS_Bluetooth]: {
    axes: regularGamepadToCockpitMap.axes,
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
      { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
      { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
      { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
      { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
      { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B16 },
      { indexInGamepadAPI: 17, idInCockpitStd: JoystickButton.B17 },
    ],
  },
  [JoystickModel.XboxController_Bluetooth]: {
    axes: regularGamepadToCockpitMap.axes,
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
      { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
      { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
      { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
      { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
      { indexInGamepadAPI: 17, idInCockpitStd: JoystickButton.B16 },
      { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B17 },
    ],
  },
  [JoystickModel.XboxController_Wired]: {
    axes: regularGamepadToCockpitMap.axes,
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
      { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
      { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
      { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
      { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
      { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B16 },
    ],
  },
  [JoystickModel.XboxController_360]: {
    axes: regularGamepadToCockpitMap.axes,
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
      { indexInGamepadAPI: 12, idInCockpitStd: JoystickButton.B12 },
      { indexInGamepadAPI: 13, idInCockpitStd: JoystickButton.B13 },
      { indexInGamepadAPI: 14, idInCockpitStd: JoystickButton.B14 },
      { indexInGamepadAPI: 15, idInCockpitStd: JoystickButton.B15 },
      { indexInGamepadAPI: 16, idInCockpitStd: JoystickButton.B16 },
    ],
  },
  [JoystickModel.LogitechExtreme3DPro]: {
    axes: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickAxis.A0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickAxis.A1 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickAxis.A2 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickAxis.A3 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickAxis.A4 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickAxis.A5 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickAxis.A6 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickAxis.A7 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickAxis.A8 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickAxis.A9 },
    ],
    buttons: [
      { indexInGamepadAPI: 0, idInCockpitStd: JoystickButton.B0 },
      { indexInGamepadAPI: 1, idInCockpitStd: JoystickButton.B1 },
      { indexInGamepadAPI: 2, idInCockpitStd: JoystickButton.B2 },
      { indexInGamepadAPI: 3, idInCockpitStd: JoystickButton.B3 },
      { indexInGamepadAPI: 4, idInCockpitStd: JoystickButton.B4 },
      { indexInGamepadAPI: 5, idInCockpitStd: JoystickButton.B5 },
      { indexInGamepadAPI: 6, idInCockpitStd: JoystickButton.B6 },
      { indexInGamepadAPI: 7, idInCockpitStd: JoystickButton.B7 },
      { indexInGamepadAPI: 8, idInCockpitStd: JoystickButton.B8 },
      { indexInGamepadAPI: 9, idInCockpitStd: JoystickButton.B9 },
      { indexInGamepadAPI: 10, idInCockpitStd: JoystickButton.B10 },
      { indexInGamepadAPI: 11, idInCockpitStd: JoystickButton.B11 },
    ],
  },
  [JoystickModel.Unknown]: regularGamepadToCockpitMap,
}
