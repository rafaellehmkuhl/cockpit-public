import { type RemovableRef, useStorage } from '@vueuse/core'
import { diff } from 'jest-diff'
import { format as prettyFormat } from 'pretty-format'
import { type MaybeRef, ref, unref, watch } from 'vue'

import { getKeyDataFromCockpitVehicleStorage } from '@/libs/blueos'
import { settingsManager } from '@/libs/settings-management'
import { isEqual } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

export const resetJustMadeKey = 'cockpit-reset-just-made'
const resetJustMade = useStorage(resetJustMadeKey, false)
setTimeout(() => {
  resetJustMade.value = false
}, 10000)

const getVehicleAddress = async (): Promise<string> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    console.debug('Waiting for vehicle global address on BlueOS sync routine.')
    await new Promise((r) => setTimeout(r, 1000))
  }

  return vehicleStore.globalAddress
}

/**
 * This composable will keep a setting in sync between the browser's local storage and BlueOS.
 *
 * When initialized, it will try to get the value from BlueOS. While BlueOS does not connect, it will use the local
 * stored value and keep trying to communicate with BlueOS to get it's value.
 *
 * Once the connection is stablished, if BlueOS doesn't have a value, it will use the local stored one and update
 * BlueOS with it. On the other hand, if BlueOS has a value, it will ask the user if they want to use the value from
 *  BlueOS or the local one. Depending on the user's choice, it will update the local value or BlueOS.
 *
 * Once everything is in sync, if the local value changes, it will update the value on BlueOS.
 * In resume, the initial source of truth is decided by the user, and once everything is in sync, the source of truth
 *  is the local value.
 * @param { string } key
 * @param { T } defaultValue
 * @returns { RemovableRef<T> }
 */
export function useBlueOsStorage<T>(key: string, defaultValue: MaybeRef<T>): RemovableRef<T> {
  const unrefedDefaultValue = unref(defaultValue)
  const valueOnLocalStorage = settingsManager.getKeyValue(key)
  let watchUpdaterTimeout: ReturnType<typeof setTimeout> | undefined = undefined
  let valueToBeUsedOnStart: T | undefined = undefined

  if (valueOnLocalStorage === undefined) {
    console.log(`settingsSyncer: Key ${key} not found on settings manager. Checking for old style value.`)
    const oldStyleValue = localStorage.getItem(key)
    if (oldStyleValue) {
      console.log(`settingsSyncer: Key ${key} found on old style. Migrating to new style.`)
      // If the value is not yet defined here, set to the default value
      // Set the epoch to 0 so it's considered old till changed by the user
      settingsManager.setKeyValue(key, JSON.parse(JSON.stringify(oldStyleValue)), 0)
    } else {
      console.log(`settingsSyncer: Key ${key} not found on old style. Setting to default value.`)
      settingsManager.setKeyValue(key, unrefedDefaultValue, 0)
    }
    valueToBeUsedOnStart = unrefedDefaultValue as T
  } else {
    valueToBeUsedOnStart = valueOnLocalStorage as T
  }

  let oldRefedValue: T | undefined =
    valueToBeUsedOnStart !== undefined ? JSON.parse(JSON.stringify(valueToBeUsedOnStart)) : undefined
  const refedValue = ref<T | undefined>(valueToBeUsedOnStart)

  watch(
    refedValue,
    () => {
      const isTheSameObject = Object.is(refedValue.value, oldRefedValue)
      const hasTheSameSerialization = prettyFormat(refedValue.value) === prettyFormat(oldRefedValue)

      if (isTheSameObject || hasTheSameSerialization) {
        console.log(`settingsSyncer: Watch for key ${key} activated, but no changes in the value were detected.`)
        return
      }

      if (watchUpdaterTimeout) {
        clearTimeout(watchUpdaterTimeout)
      }

      watchUpdaterTimeout = setTimeout(() => {
        const diffInValue = diff(oldRefedValue, refedValue.value, {
          expand: false,
          contextLines: 3,
          includeChangeCounts: true,
        })
        if (diffInValue && diffInValue.split('\n').length > 15) {
          const diffLines = diffInValue.split('\n')
          const truncatedDiff = diffLines.slice(0, 14).join('\n') + '\n...'
          console.log(`settingsSyncer: Key ${key} changed on watch:\n${truncatedDiff}.`)
        } else {
          console.log(`settingsSyncer: Key ${key} changed on watch:\n${diffInValue}.`)
        }
        settingsManager.setKeyValue(key, refedValue.value)
        oldRefedValue = JSON.parse(JSON.stringify(refedValue.value)) as T
      }, 2000)
    },
    { deep: true }
  )

  settingsManager.registerListener(key, () => {
    const newValue = settingsManager.getKeyValue(key)
    if (isEqual(newValue, refedValue.value)) {
      console.log(`settingsSyncer: Listener for key ${key} activated, but no changes in the value were detected.`)
      return
    }

    settingsManager.setKeyValue(key, newValue)
    refedValue.value = newValue as T
    oldRefedValue = JSON.parse(JSON.stringify(refedValue.value)) as T
  })

  return refedValue as RemovableRef<T>
}

export const getSettingsUsernamesFromBlueOS = async (): Promise<string[]> => {
  const vehicleAddress = await getVehicleAddress()
  const maybeUsernames = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
  if (!maybeUsernames) {
    return []
  }
  return Object.entries(maybeUsernames)
    .filter(([, value]) => typeof value === 'object' && Object.keys(value).some((key) => key.includes('cockpit-')))
    .map(([key]) => key)
}
