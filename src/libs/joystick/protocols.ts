import { type ProtocolAction } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { mavlinkManualControlAxes, mavlinkManualControlButtonFunctions } from './protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from './protocols/other'

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
