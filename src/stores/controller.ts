import { useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { ref } from 'vue'

import { availableGamepadToCockpitMaps, cockpitStandardToProtocols } from '@/assets/joystick-profiles'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import { allAvailableAxes, allAvailableButtons } from '@/libs/joystick/protocols'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import {
  type JoystickProtocolActionsMapping,
  type JoystickState,
  type ProtocolAction,
  Joystick,
} from '@/types/joystick'

export type controllerUpdateCallback = (
  state: JoystickState,
  protocolActionsMapping: JoystickProtocolActionsMapping,
  activeButtonActions: ProtocolAction[]
) => void

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const protocolMapping = useStorage('cockpit-protocol-mapping-v5.1', cockpitStandardToProtocols)
  const cockpitStdMappings = useStorage('cockpit-standard-mappings', availableGamepadToCockpitMaps)
  const availableAxesActions = allAvailableAxes
  const availableButtonActions = allAvailableButtons
  const enableForwarding = ref(true)

  const registerControllerUpdateCallback = (callback: controllerUpdateCallback): void => {
    updateCallbacks.value.push(callback)
  }

  joystickManager.onJoystickUpdate((event) => processJoystickEvent(event))
  joystickManager.onJoystickStateUpdate((event) => processJoystickStateEvent(event))

  const processJoystickEvent = (event: Map<number, Gamepad>): void => {
    const newMap = new Map(Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)]))

    // Add new joysticks
    for (const [index, joystick] of newMap) {
      if (joysticks.value.has(index)) continue
      joystick.model = joystickManager.getModel(joystick.gamepad)
      joysticks.value.set(index, joystick)
    }

    // Remove joysticks that doesn't not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue
      joysticks.value.delete(key)
    }
  }

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    const joystick = joysticks.value.get(event.detail.index)
    if (joystick === undefined || (event.type !== EventType.Axis && event.type !== EventType.Button)) return
    joystick.gamepad = event.detail.gamepad

    const joystickModel = joystick.model || JoystickModel.Unknown
    joystick.gamepadToCockpitMap = cockpitStdMappings.value[joystickModel]

    // const actv = activeButtonActions(joystick.state, protocolMapping.value)
    // console.log(actv.map((a) => a.name))

    for (const callback of updateCallbacks.value) {
      callback(joystick.state, protocolMapping.value, activeButtonActions(joystick.state, protocolMapping.value))
    }
  }

  const activeButtonActions = (joystickState: JoystickState, mapping: JoystickProtocolActionsMapping): ProtocolAction[] => {
    let modifierKeyId = modifierKeyActions.regular.id

    Object.entries(mapping.buttonsCorrespondencies.regular).forEach((e) => {
      const buttonActive = joystickState.buttons[Number(e[0])] ?? 0 > 0.5
      const isModifier = Object.values(modifierKeyActions)
        .map((a) => JSON.stringify(a))
        .includes(JSON.stringify(e[1].action))
      if (buttonActive && isModifier) {
        modifierKeyId = e[1].action.id
      }
    })
    return joystickState.buttons
      .map((btnState, idx) => ({ id: idx, value: btnState }))
      .filter((btn) => btn.value ?? 0 > 0.5)
      .map((btn) => mapping.buttonsCorrespondencies[modifierKeyId][btn.id as JoystickButton].action)
  }

  // If there's a mapping in our database that is not on the user storage, add it to the user
  // This will happen whenever a new joystick profile is added to Cockpit's database
  Object.entries(availableGamepadToCockpitMaps).forEach(([k, v]) => {
    if (Object.keys(cockpitStdMappings.value).includes(k)) return
    cockpitStdMappings.value[k as JoystickModel] = v
  })

  const downloadJoystickProfile = (joystick: Joystick): void => {
    const blob = new Blob([JSON.stringify(joystick.gamepadToCockpitMap)], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `cockpit-std-profile-joystick-${joystick.model}.json`)
  }

  const loadJoystickProfile = async (joystick: Joystick, e: Event): Promise<void> => {
    const reader = new FileReader()
    reader.onload = (event: Event) => {
      // @ts-ignore: We know the event type and need refactor of the event typing
      const contents = event.target.result
      const maybeProfile = JSON.parse(contents)
      if (!maybeProfile['name'] || !maybeProfile['axes'] || !maybeProfile['buttons']) {
        Swal.fire({ icon: 'error', text: 'Invalid profile file.', timer: 3000 })
        return
      }
      cockpitStdMappings.value[joystick.model] = maybeProfile
    }
    // @ts-ignore: We know the event type and need refactor of the event typing
    reader.readAsText(e.target.files[0])
  }

  return {
    registerControllerUpdateCallback,
    enableForwarding,
    joysticks,
    protocolMapping,
    cockpitStdMappings,
    availableAxesActions,
    availableButtonActions,
    downloadJoystickProfile,
    loadJoystickProfile,
  }
})
