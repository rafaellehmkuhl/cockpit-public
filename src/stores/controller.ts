import { defineStore } from 'pinia'
import { ref } from 'vue'

import { availableGamepadToCockpitMaps } from '@/assets/joystick-profiles'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import { humanizeString } from '@/libs/utils'
import { GamepadToCockpitStdMapping, Joystick } from '@/types/joystick'

const cockpitStdMappingsKey = 'cockpit-standard-mappings-v3'

export const joystickInputDataLakeId = (joystickIndex: number, inputType: 'button' | 'axis', inputId: number | string): string => {
  return `joystick-${joystickIndex}-${inputType}-${inputId}`
}

type GamepadToCockpitStdMappingV2 = {
  /**
   * The indices of the buttons in the gamepad API.
   */
  buttons: number[]
  /**
   * The indices of the axes in the gamepad API.
   */
  axes: number[]
}

// Get the default mappings (if the user has old V2 mappings, migrate them from to V3)
const defaultGamepadToCockpitMaps = (): Record<JoystickModel, GamepadToCockpitStdMapping> => {
  return availableGamepadToCockpitMaps // TODO: Remove this before merging. Make sure this migration is working.

  const oldMappings = localStorage.getItem('cockpit-standard-mappings-v2')
  if (!oldMappings) return availableGamepadToCockpitMaps

  const parsedOldMappings = JSON.parse(oldMappings as string)
  if (Object.keys(parsedOldMappings).length === 0) return availableGamepadToCockpitMaps

  const newMappings = availableGamepadToCockpitMaps

  // Migrate old mappings to new format if they exist in the user storage
  Object.entries(parsedOldMappings).forEach(([joystickModel, oldMapping]) => {
    const buttons = (oldMapping as GamepadToCockpitStdMappingV2).buttons.map((btn: number, index: number) => ({
      indexInGamepadAPI: btn,
      idInCockpitStd: index,
    }))
    const axes = (oldMapping as GamepadToCockpitStdMappingV2).axes.map((axis: number, index: number) => ({
      indexInGamepadAPI: axis,
      idInCockpitStd: index,
    }))
    newMappings[joystickModel as JoystickModel] = { buttons, axes }
  })
  return newMappings
}

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const cockpitStdMappings = useBlueOsStorage(cockpitStdMappingsKey, defaultGamepadToCockpitMaps())
  const enableForwarding = ref(false)

  joystickManager.onJoystickUpdate((event) => processJoystickEvent(event))
  joystickManager.onJoystickStateUpdate((event) => processJoystickStateEvent(event))

  const processJoystickEvent = (event: Map<number, Gamepad>): void => {
    const newMap = new Map(Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)]))

    // Add new joysticks
    for (const [index, joystick] of newMap) {
      if (joysticks.value.has(index)) continue
      joystick.model = joystickManager.getModel(joystick.gamepad)
      joysticks.value.set(index, joystick)
      console.info(`Joystick ${index} connected. // ID: ${joystick.gamepad.id} // Model: ${joystick.model}`)
      console.info('Enabling joystick forwarding.')
      enableForwarding.value = true

      // Create a data-lake variable for each joystick input
      joystick.state.buttons.forEach((_, inputIndex) => {
        const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'button', inputIndex)
        const variable: DataLakeVariable = { id: variableId, name: humanizeString(variableId), type: 'number' }
        createDataLakeVariable(variable)
      })

      joystick.state.axes.forEach((_, inputIndex) => {
        const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'axis', inputIndex)
        const variable: DataLakeVariable = { id: variableId, name: humanizeString(variableId), type: 'number' }
        createDataLakeVariable(variable)
      })
    }

    // Remove joysticks that do not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue

      const joystick = joysticks.value.get(key)
      if (joystick === undefined) continue

      // Delete the data-lake variables for each joystick input
      joystick.gamepad.buttons.forEach((_, index) => {
        const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'button', index)
        deleteDataLakeVariable(variableId)
      })

      joystick.gamepad.axes.forEach((_, index) => {
        const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'axis', index)
        deleteDataLakeVariable(variableId)
      })

      const model = joystick.model
      joysticks.value.delete(key)
      console.info(`Joystick ${key} (${model ?? 'Unknown model'}) disconnected.`)
      if (joysticks.value.size === 0) {
        console.warn('Disabling joystick forwarding.')
        enableForwarding.value = false
      }
    }
  }

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    const joystick = joysticks.value.get(event.detail.index)
    if (joystick === undefined || (event.type !== EventType.Axis && event.type !== EventType.Button)) return
    joystick.gamepad = event.detail.gamepad

    // Update the data-lake variables for each joystick input
    joystick.state.buttons.forEach((buttonValue, inputIndex) => {
      const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'button', inputIndex)
      setDataLakeVariableData(variableId, buttonValue ?? null)
    })

    joystick.state.axes.forEach((axisValue, inputIndex) => {
      const variableId = joystickInputDataLakeId(joystick.gamepad.index, 'axis', inputIndex)
      setDataLakeVariableData(variableId, axisValue ?? null)
    })
  }

  // If there's a mapping in our database that is not on the user storage, add it to the user
  // This will happen whenever a new joystick profile is added to Cockpit's database
  Object.entries(availableGamepadToCockpitMaps).forEach(([k, v]) => {
    if (Object.keys(cockpitStdMappings.value).includes(k)) return
    cockpitStdMappings.value[k as JoystickModel] = v
  })

  return {
    enableForwarding,
    joysticks,
    cockpitStdMappings,
  }
})
