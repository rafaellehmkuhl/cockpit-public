import {
  CockpitSetting,
  KeyValueVehicleUpdateQueue,
  LocalSyncedSettings,
  OldCockpitSetting,
  SettingsListener,
  UserChangedEvent,
  VehicleOnlineEvent,
  VehicleSettings,
} from '@/types/settings-management'

import { getKeyDataFromCockpitVehicleStorage, setKeyDataOnCockpitVehicleStorage } from './blueos'
import { sleep } from './utils'

const defaultSettings: VehicleSettings = {}
const syncedSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'
const nullValue = 'null'
const keyValueUpdateDebounceTime = 2000

/**
 *
 */
class SettingsManager {
  private listeners: Record<string, SettingsListener> = {}
  private keyValueUpdateTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
  private localSyncedSettings: LocalSyncedSettings = {}
  private currentUser: string = nullValue
  private currentVehicle: string = nullValue
  private keyValueVehicleUpdateQueue: KeyValueVehicleUpdateQueue = {}

  /**
   *
   */
  constructor() {
    this.initLocalSettings()
  }

  /**
   * Sets a key-value pair in the local settings
   * @param {string} key - The key of the setting to update
   * @param {any} value - The new value of the setting
   * @param {number} epochChange - The epoch time of the setting to update
   * @param {string} userId - The ID of the user to which the setting belongs
   * @param {string} vehicleId - The ID of the vehicle to which the setting belongs
   */
  public setKeyValue = async (
    key: string,
    value: any,
    epochChange?: number,
    userId?: string,
    vehicleId?: string
  ): Promise<void> => {
    if (userId === undefined || userId === null || userId === '') {
      userId = this.currentUser || nullValue
    }
    if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
      vehicleId = this.currentVehicle || nullValue
    }
    if (this.keyValueUpdateTimeouts[key]) {
      clearTimeout(this.keyValueUpdateTimeouts[key])
    }
    this.keyValueUpdateTimeouts[key] = setTimeout(async () => {
      const newEpoch = epochChange !== undefined ? epochChange : Date.now()
      console.log(
        '[SettingsManager]',
        `Updating value of key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`
      )
      const newSetting = {
        epochLastChangedLocally: newEpoch,
        value: value,
      }
      this.localSyncedSettings[userId][vehicleId][key] = newSetting
      this.saveLocalSettings()

      this.pushKeyValueUpdateToVehicleUpdateQueue(vehicleId, userId, key, value, newEpoch)
    }, keyValueUpdateDebounceTime)
  }

  /**
   * Gets a key-value pair from the local settings
   * @param {string} key - The key of the setting to get
   * @param {string} userId - The ID of the user to which the setting belongs
   * @param {string} vehicleId - The ID of the vehicle to which the setting belongs
   * @returns {any} The value of the setting
   */
  public getKeyValue = (key: string, userId?: string, vehicleId?: string): any => {
    if (userId === undefined) {
      userId = this.currentUser
    }

    if (vehicleId === undefined) {
      vehicleId = this.currentVehicle
    }

    if (this.localSyncedSettings[userId][vehicleId][key] === undefined) {
      return undefined
    }

    return this.localSyncedSettings[userId][vehicleId][key].value
  }

  /**
   * Registers a listener for local settings changes
   * @param {string} key - The key of the setting to listen for
   * @param {SettingsListener} callback - The callback to call when the setting changes
   * @returns {void}
   */
  public registerListener = (key: string, callback: SettingsListener): void => {
    this.listeners[key] = callback
  }

  /**
   * Unregisters a listener for local settings changes
   * @param {string} key - The key of the setting to unregister the listener for
   * @returns {void}
   */
  public unregisterListener = (key: string): void => {
    delete this.listeners[key]
  }

  /**
   * Sets the local settings
   * @param {LocalSyncedSettings} settings - The new local settings
   */
  private setLocalSettings = (settings: LocalSyncedSettings): void => {
    Object.assign(this.localSyncedSettings, settings)
  }

  /**
   * Retrieves the current local settings
   * @returns {LocalSyncedSettings} The local settings
   */
  private retrieveLocalSettings = (): LocalSyncedSettings => {
    const storedLocalSettings = localStorage.getItem(syncedSettingsKey)
    if (storedLocalSettings) {
      return JSON.parse(storedLocalSettings)
    }
    return {}
  }

  /**
   * Saves the current local settings
   * @returns {void}
   */
  private saveLocalSettings = (): void => {
    console.log('[SettingsManager]', 'Saving local settings.')
    localStorage.setItem(syncedSettingsKey, JSON.stringify(this.localSyncedSettings))
  }

  /**
   * Retrieves the last connected user
   * @returns {string} The last connected user
   */
  private retrieveLastConnectedUser = (): string => {
    return localStorage.getItem(cockpitLastConnectedUserKey) || nullValue
  }

  /**
   * Retrieves the last connected vehicle
   * @returns {string} The last connected vehicle
   */
  private retrieveLastConnectedVehicle = (): string => {
    return localStorage.getItem(cockpitLastConnectedVehicleKey) || nullValue
  }

  /**
   * Saves the last connected user
   * @param {string} userId - The user ID to save
   * @returns {void}
   */
  private saveLastConnectedUser = (userId: string): void => {
    console.log('[SettingsManager]', 'Saving last connected user:', userId)
    localStorage.setItem(cockpitLastConnectedUserKey, userId)
  }

  /**
   * Saves the last connected vehicle
   * @param {string} vehicleId - The vehicle ID to save
   * @returns {void}
   */
  private saveLastConnectedVehicle = (vehicleId: string): void => {
    console.log('[SettingsManager]', 'Saving last connected vehicle:', vehicleId)
    localStorage.setItem(cockpitLastConnectedVehicleKey, vehicleId)
  }

  /**
   * Loads the local settings
   * @returns {void}
   */
  private loadLocalSettings = (): void => {
    console.log('[SettingsManager]', 'Loading local settings.')
    const storedLocalSettings = this.retrieveLocalSettings()
    console.log('[SettingsManager]', 'Setting local settings to:', storedLocalSettings)
    this.setLocalSettings(storedLocalSettings)
  }

  /**
   * Notifies listeners of local settings changes
   * @param {LocalSyncedSettings} newSettings - The new local settings
   * @returns {void}
   */
  private notifyListeners = (newSettings: LocalSyncedSettings): void => {
    Object.entries(this.listeners).forEach(([, callback]) => {
      callback(newSettings)
    })
  }

  /**
   * Checks if settings exist for the specified user and vehicle
   * @param {string} userId - The user ID to check
   * @param {string} vehicleId - The vehicle ID to check
   * @returns {boolean} True if settings exist for the user/vehicle pair, false otherwise
   */
  private hasSettingsForUserAndVehicle = (userId: string, vehicleId: string): boolean => {
    return Boolean(this.localSyncedSettings[userId] && this.localSyncedSettings[userId][vehicleId])
  }

  /**
   * Copies settings from one user/vehicle to another
   * @param {string} fromUserId - Source user ID
   * @param {string} fromVehicleId - Source vehicle ID
   * @param {string} toUserId - Destination user ID
   * @param {string} toVehicleId - Destination vehicle ID
   */
  private copySettings = (fromUserId: string, fromVehicleId: string, toUserId: string, toVehicleId: string): void => {
    console.log(
      '[SettingsManager]',
      `Copying settings from user=${fromUserId}/vehicle=${fromVehicleId} to user=${toUserId}/vehicle=${toVehicleId}`
    )
    if (this.localSyncedSettings[fromUserId] && this.localSyncedSettings[fromUserId][fromVehicleId]) {
      if (!this.localSyncedSettings[toUserId]) {
        this.localSyncedSettings[toUserId] = {}
      }
      this.localSyncedSettings[toUserId][toVehicleId] = JSON.parse(
        JSON.stringify(this.localSyncedSettings[fromUserId][fromVehicleId])
      )
      this.saveLocalSettings()
    }
  }

  /**
   * Copies default settings to a user/vehicle
   * @param {string} userId - The user ID to copy settings to
   * @param {string} vehicleId - The vehicle ID to copy settings to
   */
  private copyDefaultSettings = (userId: string, vehicleId: string): void => {
    console.log('[SettingsManager]', `Copying default settings to user=${userId}/vehicle=${vehicleId}`)
    if (!this.localSyncedSettings[userId]) {
      this.localSyncedSettings[userId] = {}
    }
    this.localSyncedSettings[userId][vehicleId] = defaultSettings
    this.saveLocalSettings()
  }

  /**
   * Adds a new key-value update to the vehicle update queue
   * @param {string} vehicleId - The ID of the vehicle to which the update belongs
   * @param {string} userId - The ID of the user to which the update belongs
   * @param {string} key - The key of the setting to update
   * @param {any} value - The new value of the setting
   * @param {number} epochChange - The epoch time of the setting to update
   */
  private pushKeyValueUpdateToVehicleUpdateQueue = (
    vehicleId: string,
    userId: string,
    key: string,
    value: any,
    epochChange: number
  ): void => {
    if (!this.keyValueVehicleUpdateQueue[vehicleId]) {
      this.keyValueVehicleUpdateQueue[vehicleId] = {}
    }
    if (!this.keyValueVehicleUpdateQueue[vehicleId][userId]) {
      this.keyValueVehicleUpdateQueue[vehicleId][userId] = {}
    }
    this.keyValueVehicleUpdateQueue[vehicleId][userId][key] = { value, epochChange }
  }

  /**
   * Sends key value updates to a vehicle
   * @param {string} vehicleAddress - The address of the vehicle to send updates to
   * @param {string} vehicleId - The ID of the vehicle to which the updates belong
   */
  private sendKeyValueUpdatesToVehicle = async (vehicleAddress: string, vehicleId: string): Promise<void> => {
    if (
      !this.keyValueVehicleUpdateQueue[vehicleId] ||
      Object.keys(this.keyValueVehicleUpdateQueue[vehicleId]).length === 0
    ) {
      return
    }

    const updatesForVehicle = Object.entries(this.keyValueVehicleUpdateQueue[vehicleId])
    for (const [userId, updatesForUser] of updatesForVehicle) {
      for (const [key, update] of Object.entries(updatesForUser)) {
        console.log(
          '[SettingsManager]',
          `Sending new value of key '${key}' for user '${userId}' to vehicle '${vehicleId}'.`
        )
        await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${userId}/${key}`, update.value)
        delete this.keyValueVehicleUpdateQueue[vehicleId][userId][key]
      }
    }
  }

  /**
   * Syncs local settings with vehicle settings, keeping the most recent based on epoch time
   * @param {string} userId - The user ID to sync settings for
   * @param {string} vehicleId - The vehicle ID to sync settings for
   * @param {string} vehicleAddress - The address of the vehicle to sync with
   * @returns {Promise<void>} A promise that resolves when sync is complete
   */
  private syncSettingsWithVehicle = async (
    userId: string,
    vehicleId: string,
    vehicleAddress: string
  ): Promise<void> => {
    console.log('[SettingsManager]', `Syncing settings for user=${userId}/vehicle=${vehicleId}`)

    if (userId === undefined || userId === null || userId === '') {
      userId = this.currentUser || nullValue
    }

    if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
      vehicleId = this.currentVehicle || nullValue
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
    if (!this.localSyncedSettings[userId]) {
      this.localSyncedSettings[userId] = {}
    }
    if (!this.localSyncedSettings[userId][vehicleId]) {
      this.localSyncedSettings[userId][vehicleId] = {}
    }

    const localUserVehicleSettings = this.localSyncedSettings[userId][vehicleId]

    // Cast vehicleUserSettings to the right type since we don't know its exact structure
    const vehicleUserSettings = vehicleSettings[userId] as Record<string, CockpitSetting | OldCockpitSetting>

    // Merge settings, keeping the most recent based on epoch time
    const mergedSettings: VehicleSettings = {}

    if (vehicleUserSettings === undefined || Object.keys(vehicleUserSettings).length === 0) {
      console.log('[SettingsManager]', 'User settings on vehicle are undefined or empty. Using local settings.')
      Object.assign(mergedSettings, localUserVehicleSettings)
    } else {
      Object.entries({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach(([key, localSetting]) => {
        console.log('[SettingsManager]', `Comparing key '${key}'.`)
        const vehicleSetting = vehicleUserSettings[key]

        /* eslint-disable vue/max-len, prettier/prettier, max-len */
        const hasVehicleSettings = vehicleSetting !== undefined
        const hasNewVehicleSettings =
          hasVehicleSettings && vehicleSetting.value !== undefined && vehicleSetting.epochLastChangedLocally !== undefined
        const hasOldVehicleSettings =
          hasVehicleSettings &&
          (vehicleSetting.value === undefined || vehicleSetting.epochLastChangedLocally === undefined)
        const hasLocalSettings = localSetting !== undefined
        const hasNewLocalSettings =
          hasLocalSettings && localSetting.value !== undefined && localSetting.epochLastChangedLocally !== undefined
        const hasOldLocalSettings =
          hasLocalSettings && (localSetting.value === undefined || localSetting.epochLastChangedLocally === undefined)
        const bothSettingsAreNew = hasNewLocalSettings && hasNewVehicleSettings
        const localSettingsIsNewer =
          bothSettingsAreNew && localSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally
        const vehicleSettingsIsNewer =
          bothSettingsAreNew && vehicleSetting.epochLastChangedLocally > localSetting.epochLastChangedLocally
        const bothSettingsAreOld = hasOldLocalSettings && hasOldVehicleSettings
        /* eslint-enable vue/max-len, prettier/prettier, max-len */

        switch (true) {
          case !hasLocalSettings && !hasVehicleSettings:
            console.log('[SettingsManager]', 'Both local and vehicle settings are undefined.')
            console.log('[SettingsManager]', `Setting key '${key}' to undefined.`)
            mergedSettings[key] = {
              epochLastChangedLocally: Date.now(),
              value: undefined,
            }
            break
          case hasNewLocalSettings && !hasNewVehicleSettings:
            console.log('[SettingsManager]', 'Local setting is defined and vehicle setting is undefined or old.')
            console.log('[SettingsManager]', `Setting key '${key}' to local setting.`)
            mergedSettings[key] = localSetting
            break
          case !hasNewLocalSettings && hasNewVehicleSettings:
            console.log('[SettingsManager]', 'Vehicle setting is defined and local setting is undefined or old.')
            console.log('[SettingsManager]', `Setting key '${key}' to vehicle setting.`)
            mergedSettings[key] = vehicleSetting
            break
          case localSettingsIsNewer:
            console.log(
              '[SettingsManager]',
              'Both settings are defined but local setting is newer than vehicle setting.'
            )
            console.log('[SettingsManager]', `Setting key '${key}' to local setting.`)
            mergedSettings[key] = localSetting
            break
          case vehicleSettingsIsNewer:
            console.log(
              '[SettingsManager]',
              'Both settings are defined but vehicle setting is newer than local setting.'
            )
            console.log('[SettingsManager]', `Setting key '${key}' to vehicle setting.`)
            mergedSettings[key] = vehicleSetting
            break
          case bothSettingsAreOld:
            console.log('[SettingsManager]', 'Both settings are defined but both are old.')
            console.log('[SettingsManager]', `Setting key '${key}' to vehicle setting.`)
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
    this.localSyncedSettings[userId][vehicleId] = mergedSettings
    this.saveLocalSettings()

    await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${userId}`, mergedSettings)
  }

  /**
   * Handles changing the current user or vehicle
   */
  private handleChangingCurrentUserOrVehicle = (): void => {
    console.log('[SettingsManager]', 'Handling change of current user or vehicle.')
    // Load local settings from storage
    if (
      this.localSyncedSettings === undefined ||
      this.localSyncedSettings === null ||
      Object.keys(this.localSyncedSettings).length === 0
    ) {
      this.loadLocalSettings()
    }

    const storedLastConnectedUser = this.retrieveLastConnectedUser()
    const storedLastConnectedVehicle = this.retrieveLastConnectedVehicle()

    console.log('[SettingsManager]', `Stored last connected user: ${storedLastConnectedUser}`)
    console.log('[SettingsManager]', `Stored last connected vehicle: ${storedLastConnectedVehicle}`)

    // Check if we have settings for current user/vehicle
    if (this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      // We are good to go
      console.log('[SettingsManager]', 'We have settings for current user/vehicle. No need for migrations.')
    } else {
      // No settings for current user/vehicle, copy from last connected
      if (this.hasSettingsForUserAndVehicle(storedLastConnectedUser, storedLastConnectedVehicle)) {
        console.log(
          '[SettingsManager]',
          'No settings for current user/vehicle. Copying settings from last connected user/vehicle.'
        )
        this.copySettings(storedLastConnectedUser, storedLastConnectedVehicle, this.currentUser, this.currentVehicle)
      } else {
        // No settings for last connected user/vehicle, copy default settings
        console.log('[SettingsManager]', 'No settings for last connected user/vehicle, copying default settings.')
        this.copyDefaultSettings(this.currentUser, this.currentVehicle)
      }
    }
    // Update last connected to current
    this.saveLastConnectedUser(this.currentUser)
    this.saveLastConnectedVehicle(this.currentVehicle)
  }

  /**
   * Initialize local settings and set up the state based on the flowchart
   */
  private initLocalSettings = (): void => {
    // Load last connected user from storage
    console.log('[SettingsManager]', 'Retrieving last connected user.')
    const storedLastConnectedUser = this.retrieveLastConnectedUser()
    console.log('[SettingsManager]', 'Setting current user to:', storedLastConnectedUser)
    this.currentUser = storedLastConnectedUser

    // Load last connected vehicle from storage
    console.log('[SettingsManager]', 'Retrieving last connected vehicle.')
    const storedLastConnectedVehicle = this.retrieveLastConnectedVehicle()
    console.log('[SettingsManager]', 'Setting current vehicle to:', storedLastConnectedVehicle)
    this.currentVehicle = storedLastConnectedVehicle

    console.log('[SettingsManager]', `Current user: ${this.currentUser} / Current vehicle: ${this.currentVehicle}`)

    this.handleChangingCurrentUserOrVehicle()
  }

  /**
   * Gets the vehicle ID from the vehicle
   * @param {string} vehicleAddress - The address of the vehicle
   * @returns {Promise<string>} The vehicle ID
   */
  private getVehicleIdFromVehicle = async (vehicleAddress: string): Promise<string> => {
    let vehicleId = undefined
    while (vehicleId === undefined) {
      await sleep(1000)
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
   * Handles a vehicle getting online
   * @param {string} vehicleAddress - The address of the vehicle
   */
  public handleVehicleGettingOnline = async (vehicleAddress: string): Promise<void> => {
    console.log('[SettingsManager]', 'Vehicle online!')

    // Get ID of the connected vehicle
    const vehicleId = await this.getVehicleIdFromVehicle(vehicleAddress)
    console.log('[SettingsManager]', 'Vehicle ID:', vehicleId)
    if (vehicleId && typeof vehicleId === 'string' && this.currentUser !== undefined && this.currentUser !== '') {
      await this.syncSettingsWithVehicle(this.currentUser, vehicleId, vehicleAddress)
    }

    this.handleChangingCurrentUserOrVehicle()

    // Start update loop
    setInterval(async () => {
      await this.sendKeyValueUpdatesToVehicle(vehicleAddress, this.currentVehicle)
    }, 1000)
  }

  /**
   * Handles a user changing
   * @param {string} username - The new username
   */
  public handleUserChanging = (username: string): void => {
    console.log('[SettingsManager]', 'User changed:', username)
    this.currentUser = username || nullValue

    // Handle user change
    // Check if we have settings for the new user and current vehicle
    if (!this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      const lastUser = this.retrieveLastConnectedUser()
      if (lastUser && this.hasSettingsForUserAndVehicle(lastUser, this.currentVehicle)) {
        this.copySettings(lastUser, this.currentVehicle, this.currentUser, this.currentVehicle)
      }
    }

    this.handleChangingCurrentUserOrVehicle()
  }

  /**
   * Handles a storage change
   */
  public handleStorageChanging = (): void => {
    const newSettings = this.retrieveLocalSettings()
    if (newSettings === this.localSyncedSettings) {
      return
    }

    console.log('[SettingsManager]', 'Local settings changed externally!')
    this.setLocalSettings(newSettings)
    this.notifyListeners(newSettings)
  }
}

export const settingsManager = new SettingsManager()

/**
 * Event handler for when a vehicle comes online
 * @param event - The custom event containing vehicle address
 */
window.addEventListener('vehicle-online', async (event: VehicleOnlineEvent) => {
  await settingsManager.handleVehicleGettingOnline(event.detail.vehicleAddress)
})

/**
 * Event handler for when the user changes
 * @param event - The custom event containing username
 */
window.addEventListener('user-changed', (event: UserChangedEvent) => {
  settingsManager.handleUserChanging(event.detail.username)
})

/**
 * Event handler for when the storage changes
 * @param event - The custom event containing new settings
 */
window.addEventListener('storage', () => {
  settingsManager.handleStorageChanging()
})
