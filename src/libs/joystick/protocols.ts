import { getAllCockpitActionVariablesInfo } from '@/libs/actions/data-lake'
import { type ProtocolAction } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { createDataLakeAction } from './protocols/data-lake'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
} from './protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from './protocols/other'

export const allAvailableAxes = (): ProtocolAction[] => {
  const dataLakeVariables = Object.values(getAllCockpitActionVariablesInfo())
    .filter((v) => v.type === 'number')
    .map((v) => createDataLakeAction(v.id, v.name, v.type))

  return [...Object.values(mavlinkManualControlAxes), ...dataLakeVariables, ...Object.values(otherAvailableActions)]
}

export const allAvailableButtons = (): ProtocolAction[] => {
  const dataLakeVariables = Object.values(getAllCockpitActionVariablesInfo())
    .filter((v) => v.type === 'number' || v.type === 'boolean')
    .map((v) => createDataLakeAction(v.id, v.name, v.type))

  return [
    ...Object.values(availableCockpitActions),
    ...Object.values(availableMavlinkManualControlButtonFunctions),
    ...dataLakeVariables,
    ...Object.values(otherAvailableActions),
    ...Object.values(modifierKeyActions),
  ]
}
