import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from './blueos'
import { sleep } from './utils'

// TODO: Create default settings?
const defaultSettings: VehicleSettings = {}

const localCockpitSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'

const listeners: Record<string, SettingsListener> = {}

const keyValueUpdateTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}

const nullValue = 'null'

const keyValueUpdateDebounceTime = 2000

export type OldCockpitSetting = any

/**
 * A queue of key value updates for a vehicle
 * Only the most recent change is stored for each vehicle/user/key combination
 */
interface KeyValueVehicleUpdateQueue {
  [vehicleId: string]: {
    [userId: string]: {
      [key: string]: {
        /**
         * The new value of the setting
         */
        value: any
        /**
         * The epoch to be written to the setting
         */
        epochChange: number
      }
    }
  }
}

const pushKeyValueUpdateToVehicleUpdateQueue = (
  vehicleId: string,
  userId: string,
  key: string,
  value: any,
  epochChange: number
): void => {
  if (!keyValueVehicleUpdateQueue[vehicleId]) {
    keyValueVehicleUpdateQueue[vehicleId] = {}
  }
  if (!keyValueVehicleUpdateQueue[vehicleId][userId]) {
    keyValueVehicleUpdateQueue[vehicleId][userId] = {}
  }
  keyValueVehicleUpdateQueue[vehicleId][userId][key] = { value, epochChange }
}

const sendKeyValueUpdatesToVehicle = async (vehicleAddress: string, vehicleId: string): Promise<void> => {
  if (!keyValueVehicleUpdateQueue[vehicleId] || Object.keys(keyValueVehicleUpdateQueue[vehicleId]).length === 0) {
    return
  }

  const updatesForVehicle = Object.entries(keyValueVehicleUpdateQueue[vehicleId])
  for (const [userId, updatesForUser] of updatesForVehicle) {
    for (const [key, update] of Object.entries(updatesForUser)) {
      console.log(`Sending new value of key '${key}' for user '${userId}' to vehicle '${vehicleId}'.`)
      await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${userId}/${key}`, update.value)
      delete keyValueVehicleUpdateQueue[vehicleId][userId][key]
    }
  }
}

/**
 * A queue of key value updates for a vehicle
 * The keys are the IDs of the vehicles those updates are intended for
 */
const keyValueVehicleUpdateQueue: KeyValueVehicleUpdateQueue = {}

/**
 * An individual setting for a vehicle/user pair
 * Stores the value as well as the epoch time of the last change. The epoch is used to compare with remote values and determine which one is newer.
 */
export type CockpitSetting = {
  /**
   * The epoch time of the setting
   */
  epochLastChangedLocally: number
  /**
   * The value of the setting
   */
  value: any
}

export type VehicleSettings = Record<string, CockpitSetting>

/**
 * UserSettings is a map with the settings of different vehicles for a single user.
 * The keys are the vehicle ids and the values are the settings for that vehicle.
 */
export interface UserSettings {
  [key: string]: VehicleSettings
}

/**
 * LocalSettings is a map with the settings for different users.
 * The keys are the user ids and the values are the user settings.
 */
export interface LocalSettings {
  /**
   * The settings for different users
   */
  [key: string]: UserSettings
}

export type SettingsListener = (newSettings: LocalSettings) => void

const localSettings: LocalSettings = {}
let currentUser: string = nullValue
let currentVehicle: string = nullValue

export const getCurrentUser = (): string => {
  return currentUser
}

export const getCurrentVehicle = (): string => {
  return currentVehicle
}

export const getCurrentLocalSettings = (): LocalSettings => {
  return localSettings
}

export const setLocalSettings = (settings: LocalSettings): void => {
  Object.assign(localSettings, settings)
}

export const clearLocalSettings = (): void => {
  console.log('Clearing local settings.')
  Object.assign(localSettings, {})
  saveLocalSettings()
}

export const clearUserSettings = (userId: string): void => {
  console.log('Clearing user settings for:', userId)
  delete localSettings[userId]
  saveLocalSettings()
}

export const clearVehicleSettings = (userId: string, vehicleId: string): void => {
  console.log('Clearing vehicle settings for:', userId, vehicleId)
  delete localSettings[userId][vehicleId]
  saveLocalSettings()
}

export const setKeyValue = async (
  key: string,
  value: any,
  epochChange?: number,
  userId?: string,
  vehicleId?: string
): Promise<void> => {
  if (userId === undefined || userId === null || userId === '') {
    userId = currentUser || nullValue
  }
  if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
    vehicleId = currentVehicle || nullValue
  }
  if (keyValueUpdateTimeouts[key]) {
    clearTimeout(keyValueUpdateTimeouts[key])
  }
  keyValueUpdateTimeouts[key] = setTimeout(async () => {
    const newEpoch = epochChange !== undefined ? epochChange : Date.now()
    console.log(`Updating value of key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`)
    const newSetting = {
      epochLastChangedLocally: newEpoch,
      value: value,
    }
    localSettings[userId][vehicleId][key] = newSetting
    saveLocalSettings()

    pushKeyValueUpdateToVehicleUpdateQueue(vehicleId, userId, key, value, newEpoch)
  }, keyValueUpdateDebounceTime)
}

export const getKeyValue = (key: string, userId?: string, vehicleId?: string): any => {
  if (userId === undefined) {
    userId = currentUser
  }

  if (vehicleId === undefined) {
    vehicleId = currentVehicle
  }

  if (localSettings[userId][vehicleId][key] === undefined) {
    return undefined
  }

  return localSettings[userId][vehicleId][key].value
}

export const deleteKeyValue = (key: string, userId?: string, vehicleId?: string): void => {
  if (userId === undefined) {
    userId = currentUser
  }
  if (vehicleId === undefined) {
    vehicleId = currentVehicle
  }
  console.log(`Deleting key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`)
  delete localSettings[userId][vehicleId][key]
  saveLocalSettings()
}

const retrieveLocalSettings = (): LocalSettings => {
  const storedLocalSettings = localStorage.getItem(localCockpitSettingsKey)
  if (storedLocalSettings) {
    return JSON.parse(storedLocalSettings)
  }
  return {}
}

const saveLocalSettings = (): void => {
  console.log('Saving local settings.')
  localStorage.setItem(localCockpitSettingsKey, JSON.stringify(localSettings))
}

const retrieveLastConnectedUser = (): string => {
  return localStorage.getItem(cockpitLastConnectedUserKey) || nullValue
}

const retrieveLastConnectedVehicle = (): string => {
  return localStorage.getItem(cockpitLastConnectedVehicleKey) || nullValue
}

const saveLastConnectedUser = (userId: string): void => {
  console.log('Saving last connected user:', userId)
  localStorage.setItem(cockpitLastConnectedUserKey, userId)
}

const saveLastConnectedVehicle = (vehicleId: string): void => {
  console.log('Saving last connected vehicle:', vehicleId)
  localStorage.setItem(cockpitLastConnectedVehicleKey, vehicleId)
}

const loadLocalSettings = (): void => {
  console.log('Loading local settings.')
  const storedLocalSettings = retrieveLocalSettings()
  console.log('Setting local settings to:', storedLocalSettings)
  setLocalSettings(storedLocalSettings)
}

window.addEventListener('storage', () => {
  const newSettings = retrieveLocalSettings()
  if (newSettings === localSettings) {
    return
  }

  console.log('Local settings changed externally!')
  setLocalSettings(newSettings)
  notifyListeners(newSettings)
})

export const registerListener = (key: string, callback: SettingsListener): void => {
  listeners[key] = callback
}

export const unregisterListener = (key: string): void => {
  delete listeners[key]
}

const notifyListeners = (newSettings: LocalSettings): void => {
  Object.entries(listeners).forEach(([, callback]) => {
    callback(newSettings)
  })
}

type VehicleOnlineEvent = CustomEvent<{
  /**
   * The address of the vehicle that came online
   */
  vehicleAddress: string
}>

type UserChangedEvent = CustomEvent<{
  /**
   * The username of the user that changed
   */
  username: string
}>

/**
 * Define the custom event types for TypeScript
 */
declare global {
  /**
   * Custom event types for the window object
   */
  interface WindowEventMap {
    /**
     * Event triggered when a vehicle comes online
     */
    // eslint-disable-next-line jsdoc/require-jsdoc
    'vehicle-online': VehicleOnlineEvent
    /**
     * Event triggered when the user changes
     */
    // eslint-disable-next-line jsdoc/require-jsdoc
    'user-changed': UserChangedEvent
  }
}

/**
 * Checks if settings 2.0 format exists
 * @returns {boolean} True if settings 2.0 format exists, false otherwise
 */
const hasSettings2Locally = (): boolean => {
  return Object.keys(localSettings).length > 0
}

/**
 * Checks if settings exist for the specified user and vehicle
 * @param {string} userId - The user ID to check
 * @param {string} vehicleId - The vehicle ID to check
 * @returns {boolean} True if settings exist for the user/vehicle pair, false otherwise
 */
const hasSettingsForUserAndVehicle = (userId: string, vehicleId: string): boolean => {
  return Boolean(localSettings[userId] && localSettings[userId][vehicleId])
}

/**
 * Copies settings from one user/vehicle to another
 * @param {string} fromUserId - Source user ID
 * @param {string} fromVehicleId - Source vehicle ID
 * @param {string} toUserId - Destination user ID
 * @param {string} toVehicleId - Destination vehicle ID
 */
const copySettings = (fromUserId: string, fromVehicleId: string, toUserId: string, toVehicleId: string): void => {
  console.log(
    `Copying settings from user=${fromUserId}/vehicle=${fromVehicleId} to user=${toUserId}/vehicle=${toVehicleId}`
  )
  if (localSettings[fromUserId] && localSettings[fromUserId][fromVehicleId]) {
    if (!localSettings[toUserId]) {
      localSettings[toUserId] = {}
    }
    localSettings[toUserId][toVehicleId] = JSON.parse(JSON.stringify(localSettings[fromUserId][fromVehicleId]))
    saveLocalSettings()
  }
}

/**
 * Copies default settings to a user/vehicle
 * @param {string} userId - The user ID to copy settings to
 * @param {string} vehicleId - The vehicle ID to copy settings to
 */
const copyDefaultSettings = (userId: string, vehicleId: string): void => {
  console.log(`Copying default settings to user=${userId}/vehicle=${vehicleId}`)
  if (!localSettings[userId]) {
    localSettings[userId] = {}
  }
  localSettings[userId][vehicleId] = defaultSettings
  saveLocalSettings()
}

/**
 * Migrates settings from 1.0 format to 2.0 format
 * @param {string} userId - The user ID to migrate settings for
 * @param {string} vehicleId - The vehicle ID to migrate settings for
 */
const migrateSettings1To2 = (userId: string, vehicleId: string): void => {
  console.log(`Migrating settings 1.0 to 2.0 for user=${userId}/vehicle=${vehicleId}`)
  // Get all keys from localStorage that start with "cockpit-"
  const cockpitKeys = Object.keys(localStorage).filter((key) => key.startsWith('cockpit'))

  // Skip the keys we already use for settings 2.0
  const ignoredKeys = [localCockpitSettingsKey, cockpitLastConnectedVehicleKey, cockpitLastConnectedUserKey]
  const oldSettingsKeys = cockpitKeys.filter((key) => !ignoredKeys.includes(key))

  // Create empty settings if they don't exist
  if (!localSettings[userId]) {
    localSettings[userId] = {}
  }
  if (!localSettings[userId][vehicleId]) {
    localSettings[userId][vehicleId] = {}
  }

  // For each settings key, migrate it to the new format
  for (const key of oldSettingsKeys) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '')
      if (value) {
        // Create a new setting with current epoch time
        const newSetting: CockpitSetting = {
          epochLastChangedLocally: Date.now(),
          value: value,
        }

        // Add to the user/vehicle settings
        localSettings[userId][vehicleId][key] = newSetting
      }
    } catch (error) {
      console.error(`Failed to migrate setting ${key}:`, error)
    }
  }

  saveLocalSettings()
}

/**
 * Syncs local settings with vehicle settings, keeping the most recent based on epoch time
 * @param {string} userId - The user ID to sync settings for
 * @param {string} vehicleId - The vehicle ID to sync settings for
 * @param {string} vehicleAddress - The address of the vehicle to sync with
 * @returns {Promise<void>} A promise that resolves when sync is complete
 */
const syncSettingsWithVehicle = async (userId: string, vehicleId: string, vehicleAddress: string): Promise<void> => {
  console.log(`Syncing settings for user=${userId}/vehicle=${vehicleId}`)

  if (userId === undefined || userId === null || userId === '') {
    userId = currentUser || nullValue
  }

  if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
    vehicleId = currentVehicle || nullValue
  }

  // Get settings from vehicle
  let vehicleSettings = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')

  if (!vehicleSettings) {
    console.error(`No settings found on vehicle '${vehicleId}'.`)
    vehicleSettings = {}
  }

  if (!vehicleSettings[userId]) {
    console.error(`No settings found for user '${userId}' on vehicle '${vehicleId}'.`)
    vehicleSettings[userId] = {}
  }

  // Local settings for this user/vehicle
  if (!localSettings[userId]) {
    localSettings[userId] = {}
  }
  if (!localSettings[userId][vehicleId]) {
    localSettings[userId][vehicleId] = {}
  }

  const localUserVehicleSettings = localSettings[userId][vehicleId]

  // Cast vehicleUserSettings to the right type since we don't know its exact structure
  const vehicleUserSettings = vehicleSettings[userId] as Record<string, CockpitSetting | OldCockpitSetting>

  // Merge settings, keeping the most recent based on epoch time
  const mergedSettings: VehicleSettings = {}

  if (vehicleUserSettings === undefined || Object.keys(vehicleUserSettings).length === 0) {
    console.log('User settings on vehicle are undefined or empty. Using local settings.')
    Object.assign(mergedSettings, localUserVehicleSettings)
  } else {
    Object.entries({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach(([key, localSetting]) => {
      console.log(`Comparing key '${key}'.`)
      const vehicleSetting = vehicleUserSettings[key]

      /* eslint-disable vue/max-len, prettier/prettier, max-len */
      const hasVehicleSettings = vehicleSetting !== undefined
      const hasNewVehicleSettings = hasVehicleSettings && vehicleSetting.value !== undefined && vehicleSetting.epochLastChangedLocally !== undefined
      const hasOldVehicleSettings = hasVehicleSettings && (vehicleSetting.value === undefined || vehicleSetting.epochLastChangedLocally === undefined)
      const hasLocalSettings = localSetting !== undefined
      const hasNewLocalSettings = hasLocalSettings && localSetting.value !== undefined && localSetting.epochLastChangedLocally !== undefined
      const hasOldLocalSettings = hasLocalSettings && (localSetting.value === undefined || localSetting.epochLastChangedLocally === undefined)
      const bothSettingsAreNew = hasNewLocalSettings && hasNewVehicleSettings
      const localSettingsIsNewer = bothSettingsAreNew && localSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally
      const vehicleSettingsIsNewer = bothSettingsAreNew && vehicleSetting.epochLastChangedLocally > localSetting.epochLastChangedLocally
      const bothSettingsAreOld = hasOldLocalSettings && hasOldVehicleSettings
      /* eslint-enable vue/max-len, prettier/prettier, max-len */

      switch (true) {
        case !hasLocalSettings && !hasVehicleSettings:
          console.log('Both local and vehicle settings are undefined.')
          console.log(`Setting key '${key}' to undefined.`)
          mergedSettings[key] = {
            epochLastChangedLocally: Date.now(),
            value: undefined,
          }
          break
        case hasNewLocalSettings && !hasNewVehicleSettings:
          console.log('Local setting is defined and vehicle setting is undefined or old.')
          console.log(`Setting key '${key}' to local setting.`)
          mergedSettings[key] = localSetting
          break
        case !hasNewLocalSettings && hasNewVehicleSettings:
          console.log('Vehicle setting is defined and local setting is undefined or old.')
          console.log(`Setting key '${key}' to vehicle setting.`)
          mergedSettings[key] = vehicleSetting
          break
        case localSettingsIsNewer:
          console.log('Both settings are defined but local setting is newer than vehicle setting.')
          console.log(`Setting key '${key}' to local setting.`)
          mergedSettings[key] = localSetting
          break
        case vehicleSettingsIsNewer:
          console.log('Both settings are defined but vehicle setting is newer than local setting.')
          console.log(`Setting key '${key}' to vehicle setting.`)
          mergedSettings[key] = vehicleSetting
          break
        case bothSettingsAreOld:
          console.log('Both settings are defined but both are old.')
          console.log(`Setting key '${key}' to vehicle setting.`)
          mergedSettings[key] = vehicleSetting
          break
      }

      // If the epochLastChangedLocally is undefined, set it to the current time
      if (
        mergedSettings[key] !== undefined &&
        mergedSettings[key].value !== undefined &&
        mergedSettings[key].epochLastChangedLocally === undefined
      ) {
        mergedSettings[key].epochLastChangedLocally = Date.now()
      }
    })
  }

  // Update local settings with merged settings
  localSettings[userId][vehicleId] = mergedSettings
  saveLocalSettings()

  await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${userId}`, mergedSettings)
}

const handleChangingCurrentUserOrVehicle = (): void => {
  // Load local settings from storage
  if (localSettings === undefined || localSettings === null || Object.keys(localSettings).length === 0) {
    loadLocalSettings()
  }

  const storedLastConnectedUser = retrieveLastConnectedUser()
  const storedLastConnectedVehicle = retrieveLastConnectedVehicle()

  // Check if we have settings 2.0
  if (!hasSettings2Locally()) {
    // No settings 2.0, migrate from settings 1.0
    migrateSettings1To2(currentUser, currentVehicle)
  } else {
    // Have settings 2.0, check if we have settings for current user/vehicle
    if (hasSettingsForUserAndVehicle(currentUser, currentVehicle)) {
      // We are good to go
    } else {
      // No settings for current user/vehicle, copy from last connected
      if (hasSettingsForUserAndVehicle(storedLastConnectedUser, storedLastConnectedVehicle)) {
        copySettings(storedLastConnectedUser, storedLastConnectedVehicle, currentUser, currentVehicle)
      } else {
        // No settings for last connected user/vehicle, copy default settings
        copyDefaultSettings(currentUser, currentVehicle)
      }
    }
    // Update last connected to current
    saveLastConnectedUser(currentUser)
    saveLastConnectedVehicle(currentVehicle)
  }
}

/**
 * Initialize local settings and set up the state based on the flowchart
 */
export const initLocalSettings = (): void => {
  // Load last connected user from storage
  console.log('Retrieving last connected user.')
  const storedLastConnectedUser = retrieveLastConnectedUser()
  console.log('Setting current user to:', storedLastConnectedUser)
  currentUser = storedLastConnectedUser

  // Load last connected vehicle from storage
  console.log('Retrieving last connected vehicle.')
  const storedLastConnectedVehicle = retrieveLastConnectedVehicle()
  console.log('Setting current vehicle to:', storedLastConnectedVehicle)
  currentVehicle = storedLastConnectedVehicle

  console.log(`Current user: ${currentUser} / Current vehicle: ${currentVehicle}`)

  handleChangingCurrentUserOrVehicle()
}

const getVehicleIdFromVehicle = async (vehicleAddress: string): Promise<string> => {
  let vehicleId = undefined
  while (vehicleId === undefined) {
    sleep(1000)
    try {
      vehicleId = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'cockpit-vehicle-id')
      if (vehicleId && typeof vehicleId === 'string') {
        break
      }
    } catch (error) {
      console.error(`Failed to get vehicle ID from remote storage for vehicle '${vehicleAddress}'.`, error)
    }
  }
  return vehicleId
}

/**
 * Event handler for when a vehicle comes online
 * @param event - The custom event containing vehicle address
 */
window.addEventListener('vehicle-online', async (event: VehicleOnlineEvent) => {
  console.log('Vehicle online!')

  const vehicleAddress = event.detail.vehicleAddress

  // Get ID of the connected vehicle
  const vehicleId = await getVehicleIdFromVehicle(vehicleAddress)
  console.log('Vehicle ID:', vehicleId)
  if (vehicleId && typeof vehicleId === 'string' && currentUser !== undefined && currentUser !== '') {
    await syncSettingsWithVehicle(currentUser, vehicleId, vehicleAddress)
  }

  handleChangingCurrentUserOrVehicle()

  // Start update loop
  setInterval(async () => {
    await sendKeyValueUpdatesToVehicle(vehicleAddress, currentVehicle)
  }, 1000)
})

/**
 * Event handler for when the user changes
 * @param event - The custom event containing username
 */
window.addEventListener('user-changed', (event: UserChangedEvent) => {
  console.log('User changed:', event.detail.username)
  currentUser = event.detail.username

  // Handle user change
  // Check if we have settings for the new user and current vehicle
  if (!hasSettingsForUserAndVehicle(currentUser, currentVehicle)) {
    const lastUser = retrieveLastConnectedUser()
    if (lastUser && hasSettingsForUserAndVehicle(lastUser, currentVehicle)) {
      copySettings(lastUser, currentVehicle, currentUser, currentVehicle)
    }
  }

  handleChangingCurrentUserOrVehicle()
})

initLocalSettings()
