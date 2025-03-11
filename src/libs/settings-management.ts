import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from './blueos'

const localCockpitSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'

const nullValue = 'null'

export type OldCockpitSetting = any

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

const localSettings: LocalSettings = {}
let lastConnectedVehicle: string = nullValue
let lastConnectedUser: string = nullValue
let currentUser: string = nullValue
let currentVehicle: string = nullValue

const validateIndividualSetting = (setting: CockpitSetting): void => {
  if (setting.epochLastChangedLocally === undefined) {
    throw new Error('No epoch information for setting.')
  }
}

const validateVehicleSettings = (vehicleSettings: VehicleSettings): void => {
  Object.entries(vehicleSettings).forEach(([key, setting]) => {
    try {
      validateIndividualSetting(setting)
    } catch (error) {
      console.error(`Could not validate setting for key '${key}'.`, error)
    }
  })
}

const validateUserSettings = (userSettings: UserSettings): void => {
  Object.entries(userSettings).forEach(([vehicleId, vehicleSettings]) => {
    try {
      validateVehicleSettings(vehicleSettings)
    } catch (error) {
      console.error(`Could not validate settings for vehicle '${vehicleId}'.`, error)
    }
  })
}

const validateLocalSettings = (settingsToValidate: LocalSettings): void => {
  Object.entries(settingsToValidate).forEach(([userId, userSettings]) => {
    try {
      validateUserSettings(userSettings)
    } catch (error) {
      console.error(`Could not validate settings for user '${userId}'.`, error)
    }
  })
}

export const getUserSettings = (userId: string): UserSettings => {
  return localSettings[userId]
}

export const setUserSettings = (userId: string, settings: UserSettings): void => {
  console.log(`Setting user settings for user '${userId}'.`)
  localSettings[userId] = settings
  saveLocalSettings()
}

export const getVehicleSettings = (userId: string, vehicleId: string): VehicleSettings => {
  return localSettings[userId][vehicleId]
}

export const setVehicleSettings = (userId: string, vehicleId: string, settings: VehicleSettings): void => {
  console.log(`Setting vehicle settings for user '${userId}' and vehicle '${vehicleId}'.`)
  if (!localSettings[userId]) {
    localSettings[userId] = {}
  }
  localSettings[userId][vehicleId] = settings
  saveLocalSettings()
}

export const setCurrentUser = (userId: string): void => {
  console.log('Setting current user to:', userId)
  currentUser = userId
  setLastConnectedUser(userId)
}

export const setCurrentVehicle = (vehicleId: string): void => {
  console.log('Setting current vehicle to:', vehicleId)
  currentVehicle = vehicleId
  setLastConnectedVehicle(vehicleId)
}

export const setLastConnectedUser = (userId: string): void => {
  console.log('Setting last connected user to:', userId)
  lastConnectedUser = userId
  saveLastConnectedUser(userId)
}

export const setLastConnectedVehicle = (vehicleId: string): void => {
  console.log('Setting last connected vehicle to:', vehicleId)
  lastConnectedVehicle = vehicleId
  saveLastConnectedVehicle(vehicleId)
}

export const getCurrentUser = (): string => {
  return currentUser
}

export const getCurrentVehicle = (): string => {
  return currentVehicle
}

export const getLastConnectedUser = (): string => {
  return lastConnectedUser
}

export const getLastConnectedVehicle = (): string => {
  return lastConnectedVehicle
}

export const getLocalSettings = (): LocalSettings => {
  return localSettings
}

export const setLocalSettings = (settings: LocalSettings): void => {
  console.log('Updating local settings to:', settings)
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

export const setKeyValue = (userId: string, vehicleId: string, key: string, value: any): void => {
  console.log(`Setting key '${key}' for user '${userId}' and vehicle '${vehicleId}' to '${value}'.`)
  localSettings[userId][vehicleId][key] = value
  saveLocalSettings()
}

export const getKeyValue = (userId: string, vehicleId: string, key: string): any => {
  return localSettings[userId][vehicleId][key]
}

export const deleteKeyValue = (userId: string, vehicleId: string, key: string): void => {
  console.log(`Deleting key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`)
  delete localSettings[userId][vehicleId][key]
  saveLocalSettings()
}

export const getUsersIds = (): string[] => {
  return Object.keys(localSettings)
}

export const getVehiclesIds = (userId: string): string[] => {
  return Object.keys(localSettings[userId])
}

export const getKeysValues = (userId: string, vehicleId: string): [string, any][] => {
  return Object.entries(localSettings[userId][vehicleId])
}

const saveLocalSettings = (): void => {
  console.log('Saving local settings.')
  localStorage.setItem(localCockpitSettingsKey, JSON.stringify(localSettings))
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
  const storedLocalSettings = JSON.parse(localStorage.getItem(localCockpitSettingsKey) || '{}')
  console.log('Setting local settings to:', storedLocalSettings)
  setLocalSettings(storedLocalSettings)
}

const loadLastConnectedVehicle = (): void => {
  console.log('Loading last connected vehicle.')
  const storedLastConnectedVehicle = localStorage.getItem(cockpitLastConnectedVehicleKey) || nullValue
  console.log('Setting last connected vehicle to:', storedLastConnectedVehicle)
  setLastConnectedVehicle(storedLastConnectedVehicle)
}

const loadLastConnectedUser = (): void => {
  console.log('Loading last connected user.')
  const storedLastConnectedUser = localStorage.getItem(cockpitLastConnectedUserKey) || nullValue
  console.log('Setting last connected user to:', storedLastConnectedUser)
  setLastConnectedUser(storedLastConnectedUser)
}

window.addEventListener('storage', () => {
  const newSettings = JSON.parse(localStorage.getItem(localCockpitSettingsKey) || '{}')
  if (newSettings === localSettings) {
    return
  }

  console.log('Local settings changed externally!')
  setLocalSettings(newSettings)
})

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
const hasSettings2FormatLocally = (): boolean => {
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

  // Get settings from vehicle
  const vehicleSettings = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')

  if (!vehicleSettings) {
    console.error(`No settings found on vehicle '${vehicleId}'.`)
    return
  }

  if (!vehicleSettings[userId]) {
    console.error(`No settings found for user '${userId}' on vehicle '${vehicleId}'.`)
    return
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

  // Process all keys from local settings
  Object.entries({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach(([key, localSetting]) => {
    const vehicleSetting = vehicleUserSettings[key]
    // If one of the settings is undefined, we use the other one
    // Otherwise, if the local setting is in the new type and the vehicle setting is in the old type, we use the local setting
    // Otherwise, if the local setting is in the old type and the vehicle setting is in the new type, we use the vehicle setting
    // Otherwise, if both settings are defined and in the new type, we use the one with the most recent epoch time
    if (vehicleSetting === undefined) {
      mergedSettings[key] = localSetting
    } else if (localSetting === undefined) {
      mergedSettings[key] = vehicleSetting
    } else if (
      vehicleSetting !== undefined &&
      vehicleSetting.epochLastChangedLocally &&
      vehicleSetting.epochLastChangedLocally > localSetting.epochLastChangedLocally
    ) {
      mergedSettings[key] = vehicleSetting
    } else {
      mergedSettings[key] = localSetting
    }
  })

  // Update local settings with merged settings
  localSettings[userId][vehicleId] = mergedSettings
  saveLocalSettings()

  await setKeyDataOnCockpitVehicleStorage(vehicleAddress, 'settings', mergedSettings)
}

/**
 * Initialize local settings and set up the state based on the flowchart
 */
export const initLocalSettings = (): void => {
  // Load settings and last connected user/vehicle from storage
  loadLocalSettings()
  loadLastConnectedUser()
  loadLastConnectedVehicle()

  console.log(`Last connected user: ${lastConnectedUser}, Last connected vehicle: ${lastConnectedVehicle}`)

  // Check if we have settings 2.0
  if (!hasSettings2FormatLocally()) {
    // No settings 2.0, migrate from settings 1.0
    if (currentUser && currentVehicle) {
      migrateSettings1To2(currentUser, currentVehicle)
    }
  } else if (currentUser && currentVehicle) {
    // Have settings 2.0, check if we have settings for current user/vehicle
    if (!hasSettingsForUserAndVehicle(currentUser, currentVehicle)) {
      // No settings for current user/vehicle, copy from last connected
      if (
        lastConnectedUser &&
        lastConnectedVehicle &&
        hasSettingsForUserAndVehicle(lastConnectedUser, lastConnectedVehicle)
      ) {
        copySettings(lastConnectedUser, lastConnectedVehicle, currentUser, currentVehicle)
      }
    }
    // Update last connected to current
    setLastConnectedUser(currentUser)
    setLastConnectedVehicle(currentVehicle)
  }
}

/**
 * Event handler for when a vehicle comes online
 * @param event - The custom event containing vehicle address
 */
window.addEventListener('vehicle-online', async (event: VehicleOnlineEvent) => {
  console.log('Vehicle online!')

  // Get ID of the connected vehicle
  const vehicleId = await getKeyDataFromCockpitVehicleStorage(event.detail.vehicleAddress, 'cockpit-vehicle-id')
  console.log('Vehicle ID:', vehicleId)
  if (vehicleId && typeof vehicleId === 'string') {
    setCurrentVehicle(vehicleId)

    // Sync settings if we have a current user
    const userId = getCurrentUser()
    if (userId) {
      await syncSettingsWithVehicle(userId, vehicleId, event.detail.vehicleAddress)
    }
  }
})

/**
 * Event handler for when the user changes
 * @param event - The custom event containing username
 */
window.addEventListener('user-changed', (event: UserChangedEvent) => {
  console.log('User changed:', event.detail.username)
  setCurrentUser(event.detail.username)

  // Handle user change according to flowchart
  const vehicle = getCurrentVehicle()
  if (vehicle && hasSettings2FormatLocally()) {
    // Check if we have settings for the new user and current vehicle
    if (!hasSettingsForUserAndVehicle(event.detail.username, vehicle)) {
      const lastUser = getLastConnectedUser()
      if (lastUser && hasSettingsForUserAndVehicle(lastUser, vehicle)) {
        copySettings(lastUser, vehicle, event.detail.username, vehicle)
      }
    }
  }
})

initLocalSettings()
