import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { mavlinkManualControlAxes, mavlinkManualControlButtonFunctions } from './protocols/mavlink-manual-control'

/**
 * Current state of the controller in the MavLink protocol
 */

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

export const allAvailableAxes: ProtocolAction[] = [
  ...Object.values(mavlinkManualControlAxes),
  ...Object.values(OtherProtocol).map((fn) => ({ protocol: JoystickProtocol.Other, id: fn, name: fn })),
]

export const allAvailableButtons: ProtocolAction[] = [
  ...Object.values(availableCockpitActions),
  ...Object.values(mavlinkManualControlButtonFunctions),
  ...Object.values(OtherProtocol).map((fn) => ({ protocol: JoystickProtocol.Other, id: fn, name: fn })),
]
