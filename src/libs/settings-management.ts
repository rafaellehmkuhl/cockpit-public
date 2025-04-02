import { v4 as uuidv4 } from 'uuid'

import {
  CockpitSetting,
  KeyValueVehicleUpdateQueue,
  LocalSyncedSettings,
  NoVehicleIdErrorName,
  OldCockpitSetting,
  SettingsListener,
  SettingsListeners,
  SettingsPackage,
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
const syncedSettingsKey = 'cockpit-synced-settings'
const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'
const nullValue = 'null'
const keyValueUpdateDebounceTime = 100
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
  public currentUser: string = nullValue
  public currentVehicle: string = nullValue
  private listeners: SettingsListeners = {}
  private keyValueUpdateTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
  private lastLocalUserVehicleSettings: SettingsPackage = {}
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
  public getLocalSettings = (): LocalSyncedSettings => {
    const storedLocalSettings = localStorage.getItem(syncedSettingsKey)
    if (storedLocalSettings) {
      return deserialize(storedLocalSettings)
    }
    return {}
  }

  /**
   * Sets the local settings
   * @param {LocalSyncedSettings} newSettings - The new local settings
   */
  private setLocalSettings = (newSettings: LocalSyncedSettings): void => {
    console.log('[SettingsManager]', 'Setting/saving local settings.')
    localStorage.setItem(syncedSettingsKey, JSON.stringify(newSettings))

    if (this.lastLocalUserVehicleSettings !== undefined && Object.keys(newSettings).length > 0) {
      if (newSettings[this.currentUser] && newSettings[this.currentUser][this.currentVehicle]) {
        Object.keys(newSettings[this.currentUser][this.currentVehicle]).forEach((key) => {
          const oldSetting = this.lastLocalUserVehicleSettings[key]
          const newSetting = newSettings[this.currentUser][this.currentVehicle][key]
          if (!isEqual(oldSetting, newSetting)) {
            this.notifyListenersAboutKeyChange(key, newSetting)
          }
        })
        this.lastLocalUserVehicleSettings = { ...newSettings[this.currentUser][this.currentVehicle] }
      }
    }
  }

  private setLocalSettingsForUserAndVehicle = (userId: string, vehicleId: string, settings: SettingsPackage): void => {
    const localSettings = this.getLocalSettings()

    if (!localSettings[userId]) {
      localSettings[userId] = {}
    }

    localSettings[userId][vehicleId] = settings
    this.setLocalSettings(localSettings)
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
  private backupLocalOldStyleSettings = (): void => {
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
   * @param {CockpitSetting} newSetting - The new setting
   * @returns {void}
   */
  private notifyListenersAboutKeyChange = (key: string, newSetting: CockpitSetting): void => {
    const listeners = this.listeners[key]
    if (!listeners) {
      return
    }
    listeners.forEach((listener) => {
      listener.callback(newSetting)
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

  private getSettingsForUserAndVehicle = (userId: string, vehicleId: string): SettingsPackage => {
    const localSettings = this.getLocalSettings()

    if (!localSettings[userId]) {
      return {}
    }
    if (!localSettings[userId][vehicleId]) {
      return {}
    }

    return localSettings[userId][vehicleId]
  }

  private getMergedSettings = (settings1: SettingsPackage, settings2: SettingsPackage): SettingsPackage => {
    const mergedSettings: SettingsPackage = {}

    Object.keys({ ...settings1, ...settings2 }).forEach((key) => {
      const setting1 = settings1[key]
      const setting2 = settings2[key]

      if (setting1 && setting2) {
        mergedSettings[key] = setting1.epochLastChangedLocally > setting2.epochLastChangedLocally ? setting1 : setting2
      } else if (setting1) {
        mergedSettings[key] = setting1
      } else if (setting2) {
        mergedSettings[key] = setting2
      }
    })

    return mergedSettings
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

  private getValidVehicleSettingsOrThrow = async (vehicleAddress: string): Promise<VehicleSettings> => {
    try {
      return await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
    } catch (error) {
      if ((error as Error).name === NoPathInBlueOsErrorName) {
        // No settings found on vehicle. Consider it empty.
        return {}
      } else {
        // We had an error getting the settings from the vehicle. We cannot continue otherwise we can be wrongly overwriding the vehicle settings.
        throw error
      }
    }
  }

  private confirmVehicleIdOrThrow = async (vehicleAddress: string, vehicleId: string): Promise<void> => {
    try {
      const idOnVehicle = await getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'cockpit-vehicle-id')
      if (idOnVehicle !== vehicleId) {
        throw new Error(
          `Vehicle ID mismatch. Expected '${vehicleId}' and got '${idOnVehicle}' for vehicle on address '${vehicleAddress}'.`
        )
      }
    } catch (error) {
      if ((error as Error).name === NoPathInBlueOsErrorName) {
        const noVehicleIdError = new Error(`Could not confirm vehicle ID. ${error}`)
        noVehicleIdError.name = NoVehicleIdErrorName
        throw noVehicleIdError
      } else {
        throw new Error(`Could not confirm vehicle ID. ${error}`)
      }
    }
  }

  /**
   * Sends key value updates to a vehicle
   * @param {string} userId - The ID of the user to which the updates belong
   * @param {string} vehicleId - The ID of the vehicle to which the updates belong
   * @param {string} vehicleAddress - The address of the vehicle to send updates to
   */
  private sendKeyValueUpdatesToVehicle = async (
    userId: string,
    vehicleId: string,
    vehicleAddress: string
  ): Promise<void> => {
    if (
      !this.keyValueVehicleUpdateQueue[vehicleId] ||
      !this.keyValueVehicleUpdateQueue[vehicleId]?.[userId] ||
      Object.keys(this.keyValueVehicleUpdateQueue[vehicleId][userId]).length === 0
    ) {
      return
    }

    // Let's first get the settings from the vehicle, so we only update the settings that have changed
    const vehicleSettings = await this.getValidVehicleSettingsOrThrow(vehicleAddress)
    await this.confirmVehicleIdOrThrow(vehicleAddress, vehicleId)

    while (Object.keys(this.keyValueVehicleUpdateQueue[vehicleId][userId]).length !== 0) {
      const updatesForUser = Object.entries(this.keyValueVehicleUpdateQueue[vehicleId][userId])
      for (const [key, update] of updatesForUser) {
        if (vehicleSettings[userId] && vehicleSettings[userId][key]) {
          const noValue = update.value === undefined
          const sameValue = isEqual(vehicleSettings[userId][key].value, update.value)
          const vehicleSettingIsNewer = vehicleSettings[userId][key].epochLastChangedLocally > update.epochChange
          if (noValue || sameValue || vehicleSettingIsNewer) {
            delete this.keyValueVehicleUpdateQueue[vehicleId][userId][key]
            continue
          }
        }
        console.log(`[SettingsManager] Sending updated key '${key}' for user '${userId}' to vehicle '${vehicleId}'.`)
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
      await sleep(1000)
    }
  }

  private hasVehicleAddress = (): boolean => {
    return ![nullValue, undefined, null, ''].includes(this.currentVehicleAddress)
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
  private getBestUserVehicleSettingsBetweenLocalAndVehicle = async (
    userId: string,
    vehicleId: string,
    vehicleAddress: string
  ): Promise<SettingsPackage> => {
    console.log('[SettingsManager]', `Syncing settings for user=${userId}/vehicle=${vehicleId}`)

    // Get settings from vehicle
    let vehicleSettings = await this.getValidVehicleSettingsOrThrow(vehicleAddress)
    await this.confirmVehicleIdOrThrow(vehicleAddress, vehicleId)

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
    const mergedSettings: SettingsPackage = {}

    Object.keys({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach((key) => {
      console.debug('[SettingsManager]', `Comparing key '${key}'.`)
      const vehicleSetting = vehicleUserSettings[key]
      const localSetting = localUserVehicleSettings[key]

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

      switch (true) {
        case hasNewLocalSettings && hasNewVehicleSettings && isEqual(localSetting, vehicleSetting):
          console.debug(`[SettingsManager] Setting key '${key}' to local version (both local and vehicle versions are defined and equal).`)
          mergedSettings[key] = localSetting
          break
        case !hasLocalSettings && !hasVehicleSettings:
          console.info(`[SettingsManager] Setting key '${key}' to undefined (both local and vehicle versions are undefined).`)
          mergedSettings[key] = {
            epochLastChangedLocally: Date.now(),
            value: undefined,
          }
          break
        case hasNewLocalSettings && !hasNewVehicleSettings:
          console.info(`[SettingsManager] Setting key '${key}' to local version (local version is defined and vehicle version is undefined or old).`)
          mergedSettings[key] = localSetting
          break
        case hasNewVehicleSettings && !hasNewLocalSettings:
          console.info(`[SettingsManager] Setting key '${key}' to vehicle version (vehicle version is defined and local version is undefined or old).`)
          mergedSettings[key] = vehicleSetting
          break
        case localSettingsIsNewer:
          console.info(`[SettingsManager] Setting key '${key}' to local version (local version is newer than vehicle version).`)
          mergedSettings[key] = localSetting
          break
        case vehicleSettingsIsNewer:
          console.info(`[SettingsManager] Setting key '${key}' to vehicle version (vehicle version is newer than local version).`)
          mergedSettings[key] = vehicleSetting
          break
        case bothSettingsAreOld:
          console.info(`[SettingsManager] Setting key '${key}' to vehicle version (both settings are defined but both are old).`)
          mergedSettings[key] = {
            epochLastChangedLocally: 0,
            value: vehicleSetting,
          }
          break
        default:
          console.info(`[SettingsManager] Not setting key '${key}' (unknown case).`)
          break
      }
      /* eslint-enable vue/max-len, prettier/prettier, max-len */

      // If the epochLastChangedLocally is undefined, set it to the current time
      if (
        mergedSettings[key] !== undefined &&
        mergedSettings[key].value !== undefined &&
        mergedSettings[key].epochLastChangedLocally === undefined
      ) {
        mergedSettings[key].epochLastChangedLocally = Date.now()
      }
    })

    return mergedSettings
  }

  private pushSettingsToVehicleUpdateQueue = async (
    userId: string,
    vehicleId: string,
    vehicleAddress: string,
    userVehicleSettings: SettingsPackage
  ): Promise<void> => {
    // Push all key-value updates to the vehicle update queue
    Object.entries(userVehicleSettings).forEach(([key, setting]) => {
      this.pushKeyValueUpdateToVehicleUpdateQueue(
        vehicleId,
        userId,
        key,
        setting.value,
        setting.epochLastChangedLocally
      )
    })

    await this.sendKeyValueUpdatesToVehicle(userId, vehicleId, vehicleAddress)
  }

  /**
   * Initialize local settings and set up the state based on the flowchart
   */
  private initLocalSettings = (): void => {
    // First of all, backup old-style settings if not done yet
    if (!localStorage.getItem(oldStyleSettingsKey)) {
      console.log('[SettingsManager]', 'No backup for old-style settings found. Creating one.')
      this.backupLocalOldStyleSettings()
    }

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

    // Check if we have settings for current user/vehicle
    if (this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      // We are good to go
      console.log('[SettingsManager]', 'We have settings for current user/vehicle. No need for migrations.')
    } else {
      console.log(`[SettingsManager] No settings for current user/vehicle.`)
      // No settings for current user/vehicle, copy from last connected
      if (this.hasSettingsForUserAndVehicle(storedLastConnectedUser, storedLastConnectedVehicle)) {
        console.log(`[SettingsManager] Copying settings from last connected user/vehicle.`)
        const altSettings1 = this.getSettingsForUserAndVehicle(storedLastConnectedUser, storedLastConnectedVehicle)
        const newSettings = this.getMergedSettings(altSettings1, {})
        this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, newSettings)
      } else {
        // No settings for last connected user/vehicle, copy default settings
        console.log('[SettingsManager]', 'No settings for last connected user/vehicle, copying from null user/vehicle.')
        const altSettings2 = this.getSettingsForUserAndVehicle(nullValue, nullValue)
        const newSettings = this.getMergedSettings(altSettings2, {})
        this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, newSettings)
      }
    }
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
    console.log('[SettingsManager]', 'Handling vehicle getting online!')
    const previousVehicle = this.retrieveLastConnectedVehicle()

    // Before anything else, back up old-style vehicle settings if needed
    this.backupOldStyleVehicleSettingsIfNeeded(vehicleAddress)

    // Set the current vehicle address
    console.log(`[SettingsManager] Setting current vehicle address to: '${vehicleAddress}'.`)
    this.currentVehicleAddress = vehicleAddress

    // Get ID of the connected vehicle
    const vehicleId = await this.getVehicleIdFromVehicle(vehicleAddress)
    if (vehicleId && typeof vehicleId === 'string') {
      this.currentVehicle = vehicleId
    } else {
      this.currentVehicle = nullValue
    }

    console.log('[SettingsManager]', 'Vehicle ID:', vehicleId)

    let newSettings: SettingsPackage = {}
    let wasAbleToGetBestSettings = false

    // First of all, sync settings with vehicle if possible, so we have both with the "best" values for that user/vehicle combination
    try {
      const bestSettingsWithVehicle = await this.getBestUserVehicleSettingsBetweenLocalAndVehicle(
        this.currentUser,
        this.currentVehicle,
        this.currentVehicleAddress
      )
      newSettings = this.getMergedSettings(bestSettingsWithVehicle, newSettings)
      wasAbleToGetBestSettings = true
    } catch (error) {
      console.error('[SettingsManager]', 'Error getting best settings with vehicle.', error)
    }

    // Make sure we have the best settings we can get for the new user and current vehicle
    if (this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      console.log('[SettingsManager]', 'We have settings for current user/vehicle. No need for migrations.')
      const currentUserVehicleSettings = this.getSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)
      newSettings = this.getMergedSettings(currentUserVehicleSettings, newSettings)
    } else {
      console.log(`[SettingsManager] No settings for user '${this.currentUser}' and vehicle '${this.currentVehicle}'.`)
      if (previousVehicle && this.hasSettingsForUserAndVehicle(this.currentUser, previousVehicle)) {
        console.log(`[SettingsManager] Copying settings from last connected vehicle '${previousVehicle}'.`)
        const lastVehicleSettings = this.getSettingsForUserAndVehicle(this.currentUser, previousVehicle)
        newSettings = this.getMergedSettings(lastVehicleSettings, newSettings)
      } else {
        console.log(`[SettingsManager] No settings found for last connected vehicle. Copying from null vehicle.`)
        const nullUserSettings = this.getSettingsForUserAndVehicle(this.currentUser, nullValue)
        newSettings = this.getMergedSettings(nullUserSettings, newSettings)
      }
    }

    if (wasAbleToGetBestSettings) {
      await this.pushSettingsToVehicleUpdateQueue(
        this.currentUser,
        this.currentVehicle,
        this.currentVehicleAddress,
        newSettings
      )
    }

    this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, newSettings)

    // Update last connected to current
    this.saveLastConnectedVehicle(vehicleId)
  }

  /**
   * Handles a user changing
   * @param {string} username - The new username
   */
  public handleUserChanging = async (username: string): Promise<void> => {
    console.log('[SettingsManager]', `Handling user change from '${this.currentUser}' to '${username}'.`)
    const previousUser = this.retrieveLastConnectedUser()
    this.currentUser = username || nullValue
    console.log('[SettingsManager]', `User changed to '${this.currentUser}'.`)

    let newSettings: SettingsPackage = {}
    let wasAbleToGetBestSettings = false

    // First of all, sync settings with vehicle if possible, so we have both with the "best" values for that user/vehicle combination
    if (this.hasVehicleAddress()) {
      console.log('[SettingsManager]', 'Has vehicle address! Getting best settings with vehicle.')
      try {
        const bestSettingsWithVehicle = await this.getBestUserVehicleSettingsBetweenLocalAndVehicle(
          this.currentUser,
          this.currentVehicle,
          this.currentVehicleAddress
        )
        newSettings = this.getMergedSettings(bestSettingsWithVehicle, newSettings)
        wasAbleToGetBestSettings = true
      } catch (error) {
        console.error('[SettingsManager]', 'Error getting best settings with vehicle.', error)
      }
    }

    // Make sure we have the best settings we can get for the new user and current vehicle
    if (this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      console.log('[SettingsManager]', 'We have settings for current user/vehicle. No need for migrations.')
      const currentUserVehicleSettings = this.getSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)
      newSettings = this.getMergedSettings(currentUserVehicleSettings, newSettings)
    } else {
      console.log(`[SettingsManager] No settings for user '${this.currentUser}' and vehicle '${this.currentVehicle}'.`)
      if (previousUser && this.hasSettingsForUserAndVehicle(previousUser, this.currentVehicle)) {
        console.log(`[SettingsManager] Copying settings from last connected user '${previousUser}'.`)
        const lastUserSettings = this.getSettingsForUserAndVehicle(previousUser, this.currentVehicle)
        newSettings = this.getMergedSettings(lastUserSettings, newSettings)
      } else {
        console.log(`[SettingsManager] No settings found for last connected user. Copying from null user.`)
        const nullUserSettings = this.getSettingsForUserAndVehicle(nullValue, this.currentVehicle)
        newSettings = this.getMergedSettings(nullUserSettings, newSettings)
      }
    }

    if (this.hasVehicleAddress() && wasAbleToGetBestSettings) {
      await this.pushSettingsToVehicleUpdateQueue(
        this.currentUser,
        this.currentVehicle,
        this.currentVehicleAddress,
        newSettings
      )
    }

    this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, newSettings)

    this.saveLastConnectedUser(this.currentUser)
  }

  /**
   * Handles a storage change
   */
  public handleStorageChanging = (): void => {
    console.log('[SettingsManager]', 'Handling storage change!')
    const newSettings = this.getLocalSettings()
    const userVehicleSettings = this.getSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)
    if (isEqual(this.lastLocalUserVehicleSettings, userVehicleSettings)) {
      return
    }

    console.log('[SettingsManager]', 'Local settings changed externally!')
    Object.keys(newSettings).forEach((key) => {
      if (userVehicleSettings[key] !== this.lastLocalUserVehicleSettings[key]) {
        this.notifyListenersAboutKeyChange(key, userVehicleSettings[key])
      }
    })

    if (this.hasVehicleAddress()) {
      this.pushSettingsToVehicleUpdateQueue(
        this.currentUser,
        this.currentVehicle,
        this.currentVehicleAddress,
        userVehicleSettings
      )
    }
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
