/* eslint-disable vue/max-len */
/* eslint-disable prettier/prettier */
/* eslint-disable max-len */
import { v4 as uuid4 } from 'uuid'

import { type JoystickProtocolActionsMapping,type JoystickState, type ProtocolAction, JoystickButton,JoystickProtocol } from '@/types/joystick'

/**
 * Possible functions in the MAVLink `MANUAL_CONTROL` message protocol
 */
export enum CockpitActionsFunction {
  go_to_next_view = 'go_to_next_view',
  go_to_previous_view = 'go_to_previous_view',
  toggle_full_screen = 'toggle_full_screen',
  mavlink_arm = 'mavlink_arm',
  mavlink_disarm = 'mavlink_disarm',
  toggle_bottom_bar = 'toggle_bottom_bar',
}

/**
 * An action to be performed by Cockpit itself
 */
export class CockpitAction implements ProtocolAction {
  id: CockpitActionsFunction
  name: string
  readonly protocol = JoystickProtocol.CockpitAction

  // eslint-disable-next-line jsdoc/require-jsdoc
  constructor(id: CockpitActionsFunction, name: string) {
    this.id = id
    this.name = name
  }
}

// Available actions
export const availableCockpitActions: { [key in CockpitActionsFunction]: CockpitAction } = {
  [CockpitActionsFunction.go_to_next_view]: new CockpitAction(CockpitActionsFunction.go_to_next_view, 'Go to next view'),
  [CockpitActionsFunction.go_to_previous_view]: new CockpitAction(CockpitActionsFunction.go_to_previous_view, 'Go to previous view'),
  [CockpitActionsFunction.toggle_full_screen]: new CockpitAction(CockpitActionsFunction.toggle_full_screen, 'Toggle full screen'),
  [CockpitActionsFunction.mavlink_arm]: new CockpitAction(CockpitActionsFunction.mavlink_arm, 'Mavlink arm'),
  [CockpitActionsFunction.mavlink_disarm]: new CockpitAction(CockpitActionsFunction.mavlink_disarm, 'Mavlink disarm'),
  [CockpitActionsFunction.toggle_bottom_bar]: new CockpitAction(CockpitActionsFunction.toggle_bottom_bar, 'Toggle bottom bar'),
}

export type CockpitActionCallback = () => void

/**
 * Callback entry
 */
interface CallbackEntry {
  /**
   * Unique ID for that callback register
   */
  action: CockpitAction
  /**
   * Callback to be called
   */
  callback: CockpitActionCallback
}

// @ts-ignore: Typescript does not get that we are initializing the object dinamically
const actionsCallbacks: { [id in string]: CallbackEntry } = {}

export const registerActionCallback = (action: CockpitAction, callback: CockpitActionCallback): string => {
  const id = uuid4()
  actionsCallbacks[id] = { action, callback }
  return id
}
export const unregisterActionCallback = (id: string): void => {
  delete actionsCallbacks[id]
}

export const sendCockpitActions = (joystickState: JoystickState, mapping: JoystickProtocolActionsMapping): void => {
  const actionsToCallback: CockpitAction[] = []
  joystickState.buttons.forEach((state) => {
    const mappedButton = mapping.buttonsCorrespondencies[state as JoystickButton]
    if (state && mappedButton?.action.protocol === JoystickProtocol.CockpitAction) {
      actionsToCallback.push(mappedButton.action as CockpitAction)
    }
  })
  Object.values(actionsCallbacks).forEach((entry) => {
    if (actionsToCallback.includes(entry.action)) {
      entry.callback()
    }
  })
}