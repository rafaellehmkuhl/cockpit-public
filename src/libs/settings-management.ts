import { getKeyDataFromCockpitVehicleStorage } from './blueos'

const localCockpitSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle'
const cockpitLastLoggedUserKey = 'cockpit-last-logged-user'

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
let lastConnectedVehicle: string | undefined | null = undefined
let lastLoggedUser: string | undefined | null = undefined
let currentUser: string | undefined | null = undefined
let currentVehicle: string | undefined | null = undefined

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

export const setCurrentUser = (userId: string | null): void => {
  console.log('Setting current user to:', userId)
  currentUser = userId
  setLastLoggedUser(userId)
}

export const setCurrentVehicle = (vehicleId: string | null): void => {
  console.log('Setting current vehicle to:', vehicleId)
  currentVehicle = vehicleId
  setLastConnectedVehicle(vehicleId)
}

export const setLastLoggedUser = (userId: string | null): void => {
  console.log('Setting last user to:', userId)
  lastLoggedUser = userId
  saveLastLoggedUser(userId)
  saveLocalSettings()
}

export const setLastConnectedVehicle = (vehicleId: string | null): void => {
  console.log('Setting last connected vehicle to:', vehicleId)
  lastConnectedVehicle = vehicleId
  saveLastConnectedVehicle(vehicleId)
  saveLocalSettings()
}

export const getCurrentUser = (): string | undefined | null => {
  return currentUser
}

export const getCurrentVehicle = (): string | undefined | null => {
  return currentVehicle
}

export const getLastLoggedUser = (): string | undefined | null => {
  return lastLoggedUser
}

export const getLastConnectedVehicle = (): string | undefined | null => {
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

const saveLastLoggedUser = (userId: string | null): void => {
  console.log('Saving last logged user:', userId)
  localStorage.setItem(cockpitLastLoggedUserKey, userId || '')
}

const saveLastConnectedVehicle = (vehicleId: string | null): void => {
  console.log('Saving last connected vehicle:', vehicleId)
  localStorage.setItem(cockpitLastConnectedVehicleKey, vehicleId || '')
}

const loadLocalSettings = (): void => {
  const settings = JSON.parse(localStorage.getItem(localCockpitSettingsKey) || '{}')
  console.log('Loading local settings:', settings)
  setLocalSettings(settings)
  if (settings.lastConnectedVehicle) {
    console.log('Setting last connected vehicle to:', settings.lastConnectedVehicle)
    setLastConnectedVehicle(settings.lastConnectedVehicle)
  }
  if (settings.lastLoggedUser) {
    console.log('Setting last user to:', settings.lastLoggedUser)
    setLastLoggedUser(settings.lastLoggedUser)
  }
}

window.addEventListener('storage', () => {
  const newSettings = JSON.parse(localStorage.getItem(localCockpitSettingsKey) || '{}')
  if (newSettings === localSettings) {
    return
  }

  console.log('Local settings changed externally!')
  setLocalSettings(newSettings)
})

export const initLocalSettings = (): void => {
  loadLocalSettings()
}

window.addEventListener('vehicle-online', async (event: CustomEvent) => {
  console.log('Vehicle online!')

  // Get ID of the connected vehicle
  const vehicleId = await getKeyDataFromCockpitVehicleStorage(event.detail.vehicleAddress, 'cockpit-vehicle-id')
  console.log('Vehicle ID:', vehicleId)
  if (vehicleId) {
    setCurrentVehicle(vehicleId)
  }

  // Get settings for each user in the vehicle
  const usersSettings = await getKeyDataFromCockpitVehicleStorage(event.detail.vehicleAddress, 'settings')

  if (usersSettings && vehicleId) {
    Object.entries(usersSettings).forEach(([userId, vehicleSettings]) => {
      const settingsWithEpochs = Object.fromEntries(
        // Add epoch time to each setting
        Object.entries(vehicleSettings).map(([key, value]) => [key, { value, epochLastChangedLocally: Date.now() }])
      )
      setVehicleSettings(userId, vehicleId, settingsWithEpochs)
    })
  }
})

window.addEventListener('vehicle-offline', () => {
  console.log('Vehicle offline!')
  setCurrentVehicle(null)
})

window.addEventListener('user-changed', (event: CustomEvent) => {
  console.log('User changed:', event.detail.username)
  setCurrentUser(event.detail.username)
})

initLocalSettings()
