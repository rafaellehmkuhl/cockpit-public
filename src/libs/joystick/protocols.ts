import { type ProtocolAction, CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { mavlinkManualControlAxes, mavlinkManualControlButtonFunctions } from './protocols/mavlink-manual-control'

/**
 * Possible other protocol functions
 */
export enum OtherProtocol {
  no_function = 'no_function',
}

export const otherAvailableActions: { [key in OtherProtocol]: ProtocolAction } = {
  [OtherProtocol.no_function]: {
    protocol: JoystickProtocol.Other,
    id: OtherProtocol.no_function,
    name: 'No function',
  },
}

export const modifierKeyActions: { [key in CockpitModifierKeyOption]: ProtocolAction } = {
  [CockpitModifierKeyOption.regular]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.regular,
    name: 'Regular',
  },
  [CockpitModifierKeyOption.shift]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.shift,
    name: 'Shift',
  },
}

export const allAvailableAxes: ProtocolAction[] = [
  ...Object.values(mavlinkManualControlAxes),
  ...Object.values(otherAvailableActions),
]

export const allAvailableButtons: ProtocolAction[] = [
  ...Object.values(availableCockpitActions),
  ...Object.values(mavlinkManualControlButtonFunctions),
  ...Object.values(otherAvailableActions),
  ...Object.values(modifierKeyActions),
]
