import { v4 as uuidv4 } from 'uuid'

import {
  CockpitSetting,
  KeyValueVehicleUpdateQueue,
  LocalSyncedSettings,
  OldCockpitSetting,
  SettingsListener,
  SettingsListeners,
  UserChangedEvent,
  VehicleOnlineEvent,
  VehicleSettings,
} from '@/types/settings-management'

import {
  getKeyDataFromCockpitVehicleStorage,
  NoPathInBlueOsErrorName,
  setKeyDataOnCockpitVehicleStorage,
} from './blueos'
import { deserialize, isEqual, sleep } from './utils'
const defaultSettings: VehicleSettings = {}
const syncedSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'
const nullValue = 'null'
const keyValueUpdateDebounceTime = 2000
const oldStyleSettingsKey = 'cockpit-old-style-settings'
/**
 * Manager for synced settings
 *
 * This class is responsible for managing the synced settings on Cockpit.
 * It is responsible for syncing settings between the local storage and the vehicle storage.
 *
 * The settings are stored in the local storage under the key `cockpit-synced-settings`.
 * The key is a JSON object that maps user IDs to vehicle IDs, which in turn map to key-value pairs.
 *
 * The settings are synced to the vehicle storage under the path `settings/{userId}/{key}`.
 *
 * The key-value pair contain an epoch time of when the setting was last changed locally.
 *
 * When a setting is changed, the change is pushed to the vehicle update queue.
 * When the vehicle comes online, the settings are synced with the vehicle.
 *
 * When the topside (local storage) and the vehicle have different values for the same setting, the value with the
 * newest epoch is preferred. If the epochs are the same, the value from the vehicle are preferred.
 */
class SettingsManager {
  private listeners: SettingsListeners = {}
  private keyValueUpdateTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
  private lastLocalSyncedSettingsForComparison: LocalSyncedSettings = {}
  private currentUser: string = nullValue
  private currentVehicle: string = nullValue
  private currentVehicleAddress: string = nullValue
  private keyValueVehicleUpdateQueue: KeyValueVehicleUpdateQueue = {}

  /**
   * Constructor for the SettingsManager
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
      const msg = `[SettingsManager] Updating value of key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`
      console.log(msg)
      const newSetting = {
        epochLastChangedLocally: newEpoch,
        value: value,
      }
      const localSettings = this.getLocalSettings()
      localSettings[userId][vehicleId][key] = newSetting
      this.setLocalSettings(localSettings)

      this.pushKeyValueUpdateToVehicleUpdateQueue(vehicleId, userId, key, value, newEpoch)

      this.notifyListeners(key)
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

    const localSettings = this.getLocalSettings()

    if (localSettings[userId][vehicleId][key] === undefined) {
      return undefined
    }

    return localSettings[userId][vehicleId][key].value
  }

  /**
   * Registers a listener for local settings changes
   * @param {string} key - The key of the setting to listen for
   * @param {SettingsListener} callback - The callback to call when the setting changes
   * @returns {string} The key of the setting that was listened to
   */
  public registerListener = (key: string, callback: SettingsListener): string => {
    const listenerId = uuidv4()
    if (!this.listeners[key]) {
      this.listeners[key] = []
    }
    this.listeners[key].push({ id: listenerId, callback })
    return listenerId
  }

  /**
   * Unregisters a listener for local settings changes
   * @param {string} key - The key of the setting to unregister the listener for
   * @param {string} listenerId - The id of the listener to unregister
   * @returns {void}
   */
  public unregisterListener = (key: string, listenerId: string): void => {
    if (!this.listeners[key]) {
      return
    }
    this.listeners[key] = this.listeners[key].filter((listener) => listener.id !== listenerId)
  }

  /**
   * Retrieves the current local settings
   * @returns {LocalSyncedSettings} The local settings
   */
  private getLocalSettings = (): LocalSyncedSettings => {
    const storedLocalSettings = localStorage.getItem(syncedSettingsKey)
    if (storedLocalSettings) {
      return JSON.parse(storedLocalSettings)
    }
    return {}
  }

  /**
   * Sets the local settings
   * @param {LocalSyncedSettings} settings - The new local settings
   */
  private setLocalSettings = (settings: LocalSyncedSettings): void => {
    console.log('[SettingsManager]', 'Setting/saving local settings.')
    localStorage.setItem(syncedSettingsKey, JSON.stringify(settings))
    this.lastLocalSyncedSettingsForComparison = settings
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
   * Backs up old-style settings
   * @returns {void}
   */
  private backupOldStyleSettings = (): void => {
    // Store all local storage key-value pairs under the key 'cockpit-old-style-settings'
    const oldStyleSettings: Record<string, any> = {}
    for (const key of Object.keys(localStorage).filter((k) => k !== syncedSettingsKey && k !== oldStyleSettingsKey)) {
      const value = localStorage.getItem(key)
      if (value) {
        oldStyleSettings[key] = deserialize(value)
      }
    }
    localStorage.setItem(oldStyleSettingsKey, JSON.stringify(oldStyleSettings))
  }

  /**
   * Notifies listeners of local settings changes
   * @param {string} key - The key of the setting that changed
   * @returns {void}
   */
  private notifyListeners = (key: string): void => {
    const userId = this.currentUser
    const vehicleId = this.currentVehicle
    const newSettings = this.getLocalSettings()
    const listeners = this.listeners[key]
    if (!listeners) {
      return
    }
    listeners.forEach((listener) => {
      console.log('[SettingsManager]', `Notifying listener ${listener.id} for key '${key}'.`)
      listener.callback(newSettings[userId][vehicleId][key])
    })
  }

  /**
   * Checks if settings exist for the specified user and vehicle
   * @param {string} userId - The user ID to check
   * @param {string} vehicleId - The vehicle ID to check
   * @returns {boolean} True if settings exist for the user/vehicle pair, false otherwise
   */
  private hasSettingsForUserAndVehicle = (userId: string, vehicleId: string): boolean => {
    const localSettings = this.getLocalSettings()
    return Boolean(localSettings[userId] && localSettings[userId][vehicleId])
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

    const localSettings = this.getLocalSettings()
    if (localSettings[fromUserId] && localSettings[fromUserId][fromVehicleId]) {
      if (!localSettings[toUserId]) {
        localSettings[toUserId] = {}
      }
      localSettings[toUserId][toVehicleId] = JSON.parse(JSON.stringify(localSettings[fromUserId][fromVehicleId]))
      this.setLocalSettings(localSettings)
    }
  }

  /**
   * Copies default settings to a user/vehicle
   * @param {string} userId - The user ID to copy settings to
   * @param {string} vehicleId - The vehicle ID to copy settings to
   */
  private copyDefaultSettings = (userId: string, vehicleId: string): void => {
    console.log('[SettingsManager]', `Copying default settings to user=${userId}/vehicle=${vehicleId}`)
    const localSettings = this.getLocalSettings()
    if (!localSettings[userId]) {
      localSettings[userId] = {}
    }
    localSettings[userId][vehicleId] = defaultSettings
    this.setLocalSettings(localSettings)
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

    while (Object.keys(this.keyValueVehicleUpdateQueue[vehicleId]).length !== 0) {
      const updatesForVehicle = Object.entries(this.keyValueVehicleUpdateQueue[vehicleId])
      for (const [userId, updatesForUser] of updatesForVehicle) {
        for (const [key, update] of Object.entries(updatesForUser)) {
          console.log(
            '[SettingsManager]',
            `Sending new value of key '${key}' for user '${userId}' to vehicle '${vehicleId}'.`
          )
          try {
            const setting = {
              epochLastChangedLocally: update.epochChange,
              value: update.value,
            }
            await setKeyDataOnCockpitVehicleStorage(vehicleAddress, `settings/${userId}/${key}`, setting)
            delete this.keyValueVehicleUpdateQueue[vehicleId][userId][key]
          } catch (error) {
            const msg = `Error sending key '${key}' for user '${userId}' to vehicle '${vehicleId}'.`
            console.error('[SettingsManager]', msg, error)
          }
        }
      }
      await sleep(1000)
    }
  }

  /**
   * Backs up the current vehicle settings
   * @param {string} vehicleAddress - The address of the vehicle to backup settings for
   */
  private backupOldStyleVehicleSettingsIfNeeded = async (vehicleAddress: string): Promise<void> => {
    let oldStyleSettings = undefined
    try {
      oldStyleSettings = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'old-style-settings')
    } catch (oldStyleSettingFetchError) {
      if (!(oldStyleSettingFetchError instanceof Error) || oldStyleSettingFetchError.name !== NoPathInBlueOsErrorName) {
        return
      }
    }

    if (oldStyleSettings === undefined || Object.keys(oldStyleSettings).length === 0) {
      console.warn(`No old-style settings found on vehicle. Backing up current settings.`)
      try {
        const vehicleSettings = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
        await setKeyDataOnCockpitVehicleStorage(vehicleAddress, 'old-style-settings', vehicleSettings)
      } catch (backupError) {
        console.error(`Error backing up current vehicle settings for vehicle '${vehicleAddress}'.`, backupError)
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

    // Back up current vehicle settings
    this.backupOldStyleVehicleSettingsIfNeeded(vehicleAddress)

    if (!vehicleSettings) {
      console.warn(`No settings found on vehicle '${vehicleId}'.`)
      vehicleSettings = {}
    }

    if (!vehicleSettings[userId]) {
      console.warn(`No settings found for user '${userId}' on vehicle '${vehicleId}'.`)
      vehicleSettings[userId] = {}
    }

    const localSettings = this.getLocalSettings()

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
      console.log('[SettingsManager]', 'User settings on vehicle are undefined or empty. Using local settings.')
      if (localUserVehicleSettings !== undefined && Object.keys(localUserVehicleSettings).length > 0) {
        Object.assign(mergedSettings, localUserVehicleSettings)
      } else {
        console.log('[SettingsManager]', 'No local settings found. Using settings for null vehicle.')
        const nullVehicleSettings = localSettings[userId][nullValue]
        if (nullVehicleSettings !== undefined && Object.keys(nullVehicleSettings).length > 0) {
          Object.assign(mergedSettings, nullVehicleSettings)
        } else {
          console.log('[SettingsManager]', 'No settings found for null vehicle. Using settings for null user.')
          const nullUserSettings = localSettings[nullValue][nullValue]
          if (nullUserSettings !== undefined && Object.keys(nullUserSettings).length > 0) {
            Object.assign(mergedSettings, nullUserSettings)
          } else {
            console.log('[SettingsManager]', 'No settings found for null user. Using default settings.')
            Object.assign(mergedSettings, defaultSettings)
          }
        }
      }
    } else {
      Object.entries({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach(([key, localSetting]) => {
        console.log('[SettingsManager]', `Comparing key '${key}'.`)
        const vehicleSetting = vehicleUserSettings[key]

        /* eslint-disable vue/max-len, prettier/prettier, max-len */
        const hasLocalSettings = localSetting !== undefined
        const hasVehicleSettings = vehicleSetting !== undefined

        const hasNewLocalSettings = hasLocalSettings && localSetting.value !== undefined && localSetting.epochLastChangedLocally !== undefined
        const hasNewVehicleSettings = hasVehicleSettings && vehicleSetting.value !== undefined && vehicleSetting.epochLastChangedLocally !== undefined

        const hasOldLocalSettings = hasLocalSettings && (localSetting.value === undefined || localSetting.epochLastChangedLocally === undefined)
        const hasOldVehicleSettings = hasVehicleSettings && (vehicleSetting.value === undefined || vehicleSetting.epochLastChangedLocally === undefined)

        const bothSettingsAreNew = hasNewLocalSettings && hasNewVehicleSettings
        const bothSettingsAreOld = hasOldLocalSettings && hasOldVehicleSettings

        const localSettingsIsNewer = bothSettingsAreNew && localSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally
        const vehicleSettingsIsNewer = bothSettingsAreNew && vehicleSetting.epochLastChangedLocally > localSetting.epochLastChangedLocally
        /* eslint-enable vue/max-len, prettier/prettier, max-len */

        switch (true) {
          case hasNewLocalSettings && hasNewVehicleSettings && isEqual(localSetting, vehicleSetting):
            console.log('[SettingsManager] Both local and vehicle settings are defined and equal.')
            console.log(`[SettingsManager] Setting key '${key}' to local setting.`)
            mergedSettings[key] = localSetting
            break
          case !hasLocalSettings && !hasVehicleSettings:
            console.log('[SettingsManager] Both local and vehicle settings are undefined.')
            console.log(`[SettingsManager] Setting key '${key}' to undefined.`)
            mergedSettings[key] = {
              epochLastChangedLocally: Date.now(),
              value: undefined,
            }
            break
          case hasNewLocalSettings && !hasNewVehicleSettings:
            console.log('[SettingsManager] Local setting is defined and vehicle setting is undefined or old.')
            console.log(`[SettingsManager] Setting key '${key}' to local setting.`)
            mergedSettings[key] = localSetting
            break
          case hasNewVehicleSettings && !hasNewLocalSettings:
            console.log('[SettingsManager] Vehicle setting is defined and local setting is undefined or old.')
            console.log(`[SettingsManager] Setting key '${key}' to vehicle setting.`)
            mergedSettings[key] = vehicleSetting
            break
          case localSettingsIsNewer:
            console.log('[SettingsManager] Both settings are defined but local setting is newer than vehicle setting.')
            console.log(`[SettingsManager] Setting key '${key}' to local setting.`)
            mergedSettings[key] = localSetting
            break
          case vehicleSettingsIsNewer:
            console.log('[SettingsManager] Both settings are defined but vehicle setting is newer than local setting.')
            console.log(`[SettingsManager] Setting key '${key}' to vehicle setting.`)
            mergedSettings[key] = vehicleSetting
            break
          case bothSettingsAreOld:
            console.log('[SettingsManager] Both settings are defined but both are old.')
            console.log(`[SettingsManager] Setting key '${key}' to vehicle setting.`)
            mergedSettings[key] = {
              epochLastChangedLocally: 0,
              value: vehicleSetting,
            }
            break
          default:
            console.log('[SettingsManager] Unknown case.')
            console.log(`[SettingsManager] Not setting key '${key}' since it is undefined on both sides.`)
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
    this.setLocalSettings(localSettings)

    // Push all key-value updates to the vehicle update queue
    Object.entries(mergedSettings).forEach(([key, setting]) => {
      if (
        vehicleUserSettings !== undefined &&
        vehicleUserSettings[key] !== undefined &&
        !isEqual(vehicleUserSettings[key], setting)
      ) {
        this.pushKeyValueUpdateToVehicleUpdateQueue(
          vehicleId,
          userId,
          key,
          setting.value,
          setting.epochLastChangedLocally
        )
      }
    })

    await this.sendKeyValueUpdatesToVehicle(vehicleAddress, vehicleId)
  }

  /**
   * Handles changing the current user or vehicle
   * @param {string} userId - The user ID to set
   * @param {string} vehicleId - The vehicle ID to set
   */
  private handleChangingCurrentUserOrVehicle = (userId: string, vehicleId: string): void => {
    console.log('[SettingsManager]', 'Handling change of current user or vehicle.')

    if (!localStorage.getItem(oldStyleSettingsKey)) {
      console.log('[SettingsManager]', 'No backup for old-style settings found. Creating one.')
      this.backupOldStyleSettings()
    }

    const storedLastConnectedUser = this.retrieveLastConnectedUser()
    const storedLastConnectedVehicle = this.retrieveLastConnectedVehicle()

    console.log('[SettingsManager]', `Stored last connected user: ${storedLastConnectedUser}`)
    console.log('[SettingsManager]', `Current user: ${this.currentUser}`)
    console.log('[SettingsManager]', `Stored last connected vehicle: ${storedLastConnectedVehicle}`)
    console.log('[SettingsManager]', `Current vehicle: ${this.currentVehicle}`)

    // Check if we have settings for current user/vehicle
    if (this.hasSettingsForUserAndVehicle(userId, vehicleId)) {
      // We are good to go
      console.log('[SettingsManager]', 'We have settings for current user/vehicle. No need for migrations.')
    } else {
      // No settings for current user/vehicle, copy from last connected
      if (this.hasSettingsForUserAndVehicle(storedLastConnectedUser, storedLastConnectedVehicle)) {
        console.log(
          '[SettingsManager]',
          'No settings for current user/vehicle. Copying settings from last connected user/vehicle.'
        )
        this.copySettings(storedLastConnectedUser, storedLastConnectedVehicle, userId, vehicleId)
      } else {
        // No settings for last connected user/vehicle, copy default settings
        console.log('[SettingsManager]', 'No settings for last connected user/vehicle, copying default settings.')
        this.copyDefaultSettings(userId, vehicleId)
      }
    }
    // Update last connected to current
    this.saveLastConnectedUser(userId)
    this.saveLastConnectedVehicle(vehicleId)
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

    this.handleChangingCurrentUserOrVehicle(this.currentUser, this.currentVehicle)
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

    // Set the current vehicle address
    console.log(`[SettingsManager] Setting current vehicle address to: '${vehicleAddress}'`)
    this.currentVehicleAddress = vehicleAddress

    // Get ID of the connected vehicle
    const vehicleId = await this.getVehicleIdFromVehicle(vehicleAddress)
    console.log('[SettingsManager]', 'Vehicle ID:', vehicleId)
    if (vehicleId && typeof vehicleId === 'string' && this.currentUser !== undefined && this.currentUser !== '') {
      await this.syncSettingsWithVehicle(this.currentUser, vehicleId, vehicleAddress)
      this.handleChangingCurrentUserOrVehicle(this.currentUser, vehicleId)
    }
  }

  /**
   * Handles a user changing
   * @param {string} username - The new username
   */
  public handleUserChanging = async (username: string): Promise<void> => {
    console.log('[SettingsManager]', `User changed to '${username}'.`)
    this.currentUser = username || nullValue

    // Handle user change
    // Check if we have settings for the new user and current vehicle
    if (!this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      const lastUser = this.retrieveLastConnectedUser()
      if (lastUser && this.hasSettingsForUserAndVehicle(lastUser, this.currentVehicle)) {
        this.copySettings(lastUser, this.currentVehicle, this.currentUser, this.currentVehicle)
      }
    }

    if (this.currentVehicleAddress !== nullValue) {
      await this.syncSettingsWithVehicle(this.currentUser, this.currentVehicle, this.currentVehicleAddress)
    }
    this.handleChangingCurrentUserOrVehicle(this.currentUser, this.currentVehicle)
  }

  /**
   * Handles a storage change
   */
  public handleStorageChanging = (): void => {
    const newSettings = this.getLocalSettings()
    if (newSettings === this.lastLocalSyncedSettingsForComparison) {
      return
    }

    console.log('[SettingsManager]', 'Local settings changed externally!')
    Object.keys(newSettings).forEach((key) => {
      if (newSettings[key] !== this.lastLocalSyncedSettingsForComparison[key]) {
        console.log('[SettingsManager]', `Notifying listeners for key '${key}'.`)
        this.notifyListeners(key)
      }
    })
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
