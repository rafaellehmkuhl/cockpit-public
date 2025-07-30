import { v4 as uuidv4 } from 'uuid'

import {
  CockpitSetting,
  KeyValueVehicleUpdateQueue,
  LocalSyncedSettings,
  NoVehicleIdErrorName,
  OldCockpitSetting,
  OldCockpitSettingsPackage,
  SettingsListener,
  SettingsListeners,
  SettingsPackage,
  UserChangedEvent,
  UserSettings,
  VehicleOnlineEvent,
  VehicleSettings,
} from '@/types/settings-management'

import {
  getKeyDataFromCockpitVehicleStorage,
  NoPathInBlueOsErrorName,
  setKeyDataOnCockpitVehicleStorage,
} from './blueos'
import { deserialize, isEqual, sleep, tryACoupleOfTimes } from './utils'

export const oldStyleSettingsKey = 'cockpit-old-style-settings'
export const vehicleOldStyleSettingsKey = 'old-style-settings'
export const vehicleNewStyleSettingsKey = 'settings'
export const syncedSettingsKey = 'cockpit-synced-settings'
export const cockpitLastConnectedVehicleKey = 'cockpit-last-connected-vehicle-id'
export const cockpitLastConnectedUserKey = 'cockpit-last-connected-user'
export const fallbackUsername = 'fallback-user'
export const fallbackVehicleId = 'fallback-vehicle'
const nullValue = 'null'
const possibleNullValues = [fallbackUsername, fallbackVehicleId, nullValue, null, undefined, '']
const keyValueUpdateDebounceTime = 100

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
  public currentUser: string = fallbackUsername
  public currentVehicle: string = fallbackVehicleId
  private listeners: SettingsListeners = {}
  private keyValueUpdateTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
  private lastLocalUserVehicleSettings: SettingsPackage = {}
  private currentVehicleAddress: string = nullValue
  private keyValueVehicleUpdateQueue: KeyValueVehicleUpdateQueue = {}
  private initialLoadingComplete = false

  /**
   * Constructor for the SettingsManager
   */
  constructor() {
    console.log('[SettingsManager]', 'Initializing settings manager.')
    this.initLocalSettings()
    this.initialLoadingComplete = true
    console.log('[SettingsManager]', 'Settings manager initialized.')
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
    if (this.isNullValue(userId)) {
      userId = this.currentUser || fallbackUsername
    }
    if (this.isNullValue(vehicleId)) {
      vehicleId = this.currentVehicle || fallbackVehicleId
    }

    if (this.keyValueUpdateTimeouts[key]) {
      clearTimeout(this.keyValueUpdateTimeouts[key])
    }

    this.keyValueUpdateTimeouts[key] = setTimeout(async () => {
      const newEpoch = epochChange !== undefined ? epochChange : Date.now()
      console.log(`[SettingsManager] Updating value of key '${key}' for user '${userId}' and vehicle '${vehicleId}'.`)
      const newSetting = {
        epochLastChangedLocally: newEpoch,
        value: value,
      }
      const localSettings = this.getLocalSettings()
      localSettings[userId!][vehicleId!][key] = newSetting
      this.setLocalSettings(localSettings)
      this.performSideEffectOfSettingLocalSettings()

      this.pushKeyValueUpdateToVehicleUpdateQueue(vehicleId!, userId!, key, value, newEpoch)
    }, keyValueUpdateDebounceTime)
  }

  /**
   * Gets a key-value pair from the local settings
   * @param {string} key - The key of the setting to get
   * @param {string} userId - The ID of the user to which the setting belongs
   * @param {string} vehicleId - The ID of the vehicle to which the setting belongs
   * @returns {any} The value of the setting
   */
  public getKeyValue = (key: string, userId?: string, vehicleId?: string): any | undefined => {
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
  }

  private setLocalSettingsForUserAndVehicle = (userId: string, vehicleId: string, settings: SettingsPackage): void => {
    const localSettings = this.getLocalSettings()

    if (!localSettings[userId]) {
      localSettings[userId] = {}
    }

    localSettings[userId][vehicleId] = settings
    this.setLocalSettings(localSettings)
  }

  private isNullValue = (value: string | undefined | null): boolean => {
    return possibleNullValues.includes(value) || value === undefined
  }

  /**
   * Performs the side effect of setting local settings. TODO: Check if this is needed.
   * @returns {void}
   */
  private performSideEffectOfSettingLocalSettings = (): void => {
    if (!this.initialLoadingComplete) {
      return
    }

    const settings = this.getLocalSettings()
    if (this.lastLocalUserVehicleSettings !== undefined && Object.keys(settings).length > 0) {
      if (settings[this.currentUser] && settings[this.currentUser][this.currentVehicle]) {
        Object.keys(settings[this.currentUser][this.currentVehicle]).forEach((key) => {
          const oldSetting = this.lastLocalUserVehicleSettings[key]
          const newSetting = settings[this.currentUser][this.currentVehicle][key]
          if (!isEqual(oldSetting, newSetting)) {
            this.notifyListenersAboutKeyChange(key, newSetting)
          }
        })
        this.lastLocalUserVehicleSettings = { ...settings[this.currentUser][this.currentVehicle] }
      }
    }
  }

  /**
   * Retrieves the last connected user
   * @returns {string} The last connected user
   */
  private retrieveLastConnectedUser = (): string | null => {
    return localStorage.getItem(cockpitLastConnectedUserKey)
  }

  /**
   * Retrieves the last connected vehicle
   * @returns {string} The last connected vehicle
   */
  private retrieveLastConnectedVehicle = (): string | null => {
    return localStorage.getItem(cockpitLastConnectedVehicleKey)
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

  private getMigratedOldStyleSettingsPackage = (oldStyleSettings: OldCockpitSettingsPackage): SettingsPackage => {
    const newSettings: SettingsPackage = {}
    Object.keys(oldStyleSettings).forEach((key) => {
      newSettings[key] = {
        epochLastChangedLocally: 0,
        value: oldStyleSettings[key],
      }
    })

    return newSettings
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
    return Boolean(localSettings) && Boolean(localSettings[userId]) && Boolean(localSettings[userId][vehicleId])
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

  private getValidSettingsFromVehicle = async (vehicleAddress: string): Promise<VehicleSettings> => {
    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const getSettingsFn = (): Promise<VehicleSettings | undefined> => getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'settings')
    const maybeSettings = await tryACoupleOfTimes(getSettingsFn, 0, 300)
    if (maybeSettings !== undefined) {
      return maybeSettings
    } else {
      console.warn(`[SettingsManager] No settings found on vehicle. Using empty settings.`)
      return {}
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

  private getVehicleIdFromVehicle = async (vehicleAddress: string): Promise<string> => {
    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const getVehicleIdFn = (): Promise<string | undefined> => getKeyDataFromCockpitVehicleStorage(vehicleAddress, 'cockpit-vehicle-id')
    const maybeId = await tryACoupleOfTimes(getVehicleIdFn, 0, 300)
    if (typeof maybeId === 'string') {
      return maybeId
    } else {
      console.error(`[SettingsManager] Vehicle ID is not defined. Generating a new one.`)
      return this.generateAndPushNewVehicleId(vehicleAddress)
    }
  }

  private generateAndPushNewVehicleId = async (vehicleAddress: string): Promise<string> => {
    const newVehicleId = uuidv4()
    console.log(`Trying to set new vehicle ID '${newVehicleId}' on vehicle '${vehicleAddress}'.`)

    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const setVehicleIdFn = (): Promise<void> => setKeyDataOnCockpitVehicleStorage(vehicleAddress, 'cockpit-vehicle-id', newVehicleId)
    await tryACoupleOfTimes(setVehicleIdFn, 0, 300)

    console.log(`Successfully set new vehicle ID '${newVehicleId}' on vehicle '${vehicleAddress}'.`)

    return newVehicleId
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
    const vehicleSettings = await this.getValidSettingsFromVehicle(vehicleAddress)
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
    return !this.isNullValue(this.currentVehicleAddress)
  }

  private areVehicleSettingsInNewStyle = (vehicleSettings: VehicleSettings): boolean => {
    // Check if there are keys (users) in the vehicle settings
    if (Object.keys(vehicleSettings).length === 0) {
      return false
    }

    // Check if the values are SettingsPackage
    return Object.values(vehicleSettings).every((userSettings) => {
      return userSettings.epochLastChangedLocally !== undefined
    })
  }

  /**
   * Backs up the current vehicle settings
   * @param {string} vehicleAddress - The address of the vehicle to backup settings for
   */
  private backupOldStyleVehicleSettingsIfNeeded = async (vehicleAddress: string): Promise<void> => {
    console.info(`[SettingsManager] Looking for old-style settings backup on vehicle '${vehicleAddress}'.`)

    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const getOldStyleSettingsFn = (): Promise<OldCockpitSettingsPackage> => getKeyDataFromCockpitVehicleStorage(vehicleAddress, vehicleOldStyleSettingsKey)
    const oldStyleVehicleSettingsBackup = await tryACoupleOfTimes(getOldStyleSettingsFn, 0, 300)

    if (oldStyleVehicleSettingsBackup !== undefined) {
      console.info('[SettingsManager] Found old-style settings backup on vehicle. Skipping backup.')
      return
    }

    console.info('[SettingsManager] Retrieving current vehicle settings.')
    const vehicleSettings = await this.getValidSettingsFromVehicle(vehicleAddress)

    if (Object.keys(vehicleSettings).length === 0) {
      console.warn('[SettingsManager] No vehicle settings found. Skipping backup.')
      return
    } else if (this.areVehicleSettingsInNewStyle(vehicleSettings)) {
      console.info('[SettingsManager] Vehicle settings are already in new style. Skipping backup.')
      return
    }

    console.info('[SettingsManager] No old-style settings backup found on vehicle. Backing up current settings.')

    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const setOldStyleSettingsFn = (): Promise<void> => setKeyDataOnCockpitVehicleStorage(vehicleAddress, vehicleOldStyleSettingsKey, vehicleSettings)
    await tryACoupleOfTimes(setOldStyleSettingsFn, 0, 300)
    console.info('[SettingsManager] Successfully backed up old-style vehicle settings.')
  }

  private migrateOldStyleVehicleSettingsIfNeeded = async (vehicleAddress: string): Promise<void> => {
    console.info('[SettingsManager] Checking if vehicle settings are in the new style already.')

    const vehicleSettings = await this.getValidSettingsFromVehicle(vehicleAddress)
    if (Object.keys(vehicleSettings).length === 0) {
      console.warn('[SettingsManager] No settings found on vehicle. Skipping migration.')
      return
    }

    if (this.areVehicleSettingsInNewStyle(vehicleSettings)) {
      console.info('[SettingsManager] Vehicle settings are already in new style. Skipping migration.')
      return
    }

    console.info('[SettingsManager] Migrating old-style vehicle settings to new style.')

    const migratedSettings: VehicleSettings = {}
    for (const user of Object.keys(vehicleSettings)) {
      const vehicleUserSettings: SettingsPackage | OldCockpitSetting = vehicleSettings[user]
      const newStyleVehicleUserSettings = this.getMigratedOldStyleSettingsPackage(vehicleUserSettings)
      migratedSettings[user] = newStyleVehicleUserSettings
    }

    // eslint-disable-next-line vue/max-len, prettier/prettier, max-len
    const setNewStyleSettingsFn = (): Promise<void> => setKeyDataOnCockpitVehicleStorage(vehicleAddress, vehicleNewStyleSettingsKey, migratedSettings)
    await tryACoupleOfTimes(setNewStyleSettingsFn, 0, 300)
    console.info('[SettingsManager] Successfully migrated old-style vehicle settings to new style.')
  }

  /**
   * Syncs local settings with vehicle settings, keeping the most recent based on epoch time
   * @param {string} vehicleAddress - The address of the vehicle to sync with
   * @param {string} vehicleId - The ID of the vehicle to sync with
   * @returns {Promise<LocalSyncedSettings>} A promise that resolves when sync is complete
   */
  private getBestSettingsBetweenLocalAndVehicle = async (
    vehicleAddress: string,
    vehicleId: string
  ): Promise<LocalSyncedSettings> => {
    console.log('[SettingsManager]', `Syncing settings for vehicle '${vehicleId}' at address '${vehicleAddress}'.`)

    // Get settings from vehicle
    const vehicleSettings = await this.getValidSettingsFromVehicle(vehicleAddress)
    const localSettings = this.getLocalSettings()
    const usersOnVehicle = Object.keys(vehicleSettings)
    const usersOnLocal = Object.keys(localSettings)

    // Create a Set to ensure uniqueness, then convert back to array
    const usersToSync = [...new Set([...usersOnVehicle, ...usersOnLocal])]

    const mergedSettings: LocalSyncedSettings = {}

    for (const user of usersToSync) {
      const vehicleUserSettings: SettingsPackage = vehicleSettings[user] || {}
      const localUserSettings: UserSettings = localSettings[user] || {}
      const localUserVehicleSettings: SettingsPackage = localUserSettings[vehicleId] || {}

      mergedSettings[user] = {}
      mergedSettings[user][vehicleId] = {}

      Object.keys({ ...localUserVehicleSettings, ...vehicleUserSettings }).forEach((key) => {
        console.debug('[SettingsManager]', `Comparing key '${key}'.`)
        const vehicleSetting = vehicleUserSettings[key]
        const localSetting = localUserVehicleSettings[key]

        /* eslint-disable vue/max-len, prettier/prettier, max-len */
        const hasLocalSettings = localSetting !== undefined
        const hasVehicleSettings = vehicleSetting !== undefined

        const localSettingsIsNewer = hasLocalSettings && localSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally
        const vehicleSettingsIsNewer = hasVehicleSettings && vehicleSetting.epochLastChangedLocally > localSetting.epochLastChangedLocally

        switch (true) {
          case hasLocalSettings && hasVehicleSettings && isEqual(localSetting, vehicleSetting):
            console.debug(`[SettingsManager] Setting key '${key}' to local version (both local and vehicle versions are defined and equal).`)
            mergedSettings[user][vehicleId][key] = localSetting
            break
          case !hasLocalSettings && !hasVehicleSettings:
            console.info(`[SettingsManager] Skipping key '${key}' (both local and vehicle versions are undefined).`)
            break
          case hasLocalSettings && !hasVehicleSettings:
            console.info(`[SettingsManager] Setting key '${key}' to local version (local version is defined and vehicle version is undefined or old).`)
            mergedSettings[user][vehicleId][key] = localSetting
            break
          case hasVehicleSettings && !hasLocalSettings:
            console.info(`[SettingsManager] Setting key '${key}' to vehicle version (vehicle version is defined and local version is undefined or old).`)
            mergedSettings[user][vehicleId][key] = vehicleSetting
            break
          case localSettingsIsNewer:
            console.info(`[SettingsManager] Setting key '${key}' to local version (local version is newer than vehicle version).`)
            mergedSettings[user][vehicleId][key] = localSetting
            break
          case vehicleSettingsIsNewer:
            console.info(`[SettingsManager] Setting key '${key}' to vehicle version (vehicle version is newer than local version).`)
            mergedSettings[user][vehicleId][key] = vehicleSetting
            break
          default:
            mergedSettings[user][vehicleId][key] = {
              epochLastChangedLocally: 0,
              value: vehicleSetting,
            }
            break
        }
      })
    }

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
    // First of all, backup old-style settings (if not done yet)
    const oldStyleSettingsBackup = localStorage.getItem(oldStyleSettingsKey)
    if (oldStyleSettingsBackup && Object.keys(deserialize(oldStyleSettingsBackup)).length > 0) {
      console.log('[SettingsManager]', 'Found a backup of cockpit old style settings. Skipping creation of a new one.')
    } else {
      console.warn('[SettingsManager]', 'Did not find a backup for cockpit old style settings. Creating one.')
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

    // Load last connected user from storage
    console.log('[SettingsManager]', 'Retrieving last connected user from storage.')
    const storedLastConnectedUser = this.retrieveLastConnectedUser()
    if (this.isNullValue(storedLastConnectedUser)) {
      console.log('[SettingsManager]', 'No last connected user found in storage. Setting to fallback user.')
      this.currentUser = fallbackUsername
    } else {
      console.log('[SettingsManager]', `Last connected user found in storage: '${storedLastConnectedUser}'.`)
      this.currentUser = storedLastConnectedUser as string
    }

    // Load last connected vehicle from storage
    console.log('[SettingsManager]', 'Retrieving last connected vehicle from storage.')
    const storedLastConnectedVehicle = this.retrieveLastConnectedVehicle()
    if (this.isNullValue(storedLastConnectedVehicle)) {
      console.log('[SettingsManager]', 'No last connected vehicle found in storage. Setting to fallback vehicle.')
      this.currentVehicle = fallbackVehicleId
    } else {
      console.log('[SettingsManager]', `Last connected vehicle found in storage: '${storedLastConnectedVehicle}'.`)
      this.currentVehicle = storedLastConnectedVehicle as string
    }

    // Generate some new settings for current user/vehicle (if needed)
    if (this.hasSettingsForUserAndVehicle(this.currentUser, this.currentVehicle)) {
      // We are good to go
      console.info(`[SettingsManager] We have settings for user '${this.currentUser}' and vehicle '${this.currentVehicle}'. No need for migrations.`)
    } else {
      // Migrate all old-style local settings to the new format
      console.warn(`[SettingsManager] No settings for user '${this.currentUser}' and vehicle '${this.currentVehicle}'. Trying to use fallback settings.`)

      let fallbackSettings: SettingsPackage = {}
      if (this.hasSettingsForUserAndVehicle(this.currentUser, fallbackVehicleId)) {
        console.info(`[SettingsManager] We have settings for user '${this.currentUser}' and vehicle '${fallbackVehicleId}'. Using it instead.`)
        fallbackSettings = this.getSettingsForUserAndVehicle(this.currentUser, fallbackVehicleId)
      } else {
        console.warn(`[SettingsManager] No settings for user '${this.currentUser}' and vehicle '${fallbackVehicleId}'. Trying next fallback settings.`)
        if (this.hasSettingsForUserAndVehicle(fallbackUsername, fallbackVehicleId)) {
          console.info(`[SettingsManager] We have settings for user '${fallbackUsername}' and vehicle '${fallbackVehicleId}'. Using it instead.`)
          fallbackSettings = this.getSettingsForUserAndVehicle(fallbackUsername, fallbackVehicleId)
        } else {
          console.warn(`[SettingsManager] No settings for user '${fallbackUsername}' and vehicle '${fallbackVehicleId}'. Migrating old-style settings.`)
          const oldStyleSettings: OldCockpitSettingsPackage = deserialize(localStorage.getItem(oldStyleSettingsKey)!)
          fallbackSettings = this.getMigratedOldStyleSettingsPackage(oldStyleSettings)
        }
      }

      // TODO: Run without the side effect or it will break stuff
      this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, fallbackSettings)
    }
  }

  /**
   * Handles a vehicle getting online
   * @param {string} vehicleAddress - The address of the vehicle
   */
  public handleVehicleGettingOnline = async (vehicleAddress: string): Promise<void> => {
    console.log('[SettingsManager]', 'Handling vehicle getting online!')
    // const previousVehicle = this.retrieveLastConnectedVehicle()

    // Before anything else, back up old-style vehicle settings in the vehicle, if needed
    await this.backupOldStyleVehicleSettingsIfNeeded(vehicleAddress)

    // Then migrate local old-style settings to the vehicle, if needed
    await this.migrateOldStyleVehicleSettingsIfNeeded(vehicleAddress)

    // Set the current vehicle address
    console.log(`[SettingsManager] Setting current vehicle address to: '${vehicleAddress}'.`)
    this.currentVehicleAddress = vehicleAddress

    // Get ID of the connected vehicle
    const vehicleId = await this.getVehicleIdFromVehicle(vehicleAddress)
    console.log('[SettingsManager]', 'Got vehicle ID:', vehicleId)

    // Set the current vehicle ID
    console.log(`[SettingsManager] Setting current vehicle ID to: '${vehicleId}'.`)
    this.currentVehicle = vehicleId

    let toBeUsedUser: string | undefined | undefined = undefined
    let toBeUsedVehicle: string | undefined | undefined = undefined

    const userVehicleCombinationsToTryInOrder = [
      { user: this.currentUser, vehicle: this.currentVehicle },
      { user: this.currentUser, vehicle: this.retrieveLastConnectedVehicle() },
      { user: this.currentUser, vehicle: fallbackVehicleId },
      { user: fallbackUsername, vehicle: this.retrieveLastConnectedVehicle() },
      { user: fallbackUsername, vehicle: fallbackVehicleId },
    ]

    for (const combination of userVehicleCombinationsToTryInOrder) {
      if (combination.user && combination.vehicle && this.hasSettingsForUserAndVehicle(combination.user, combination.vehicle)) {
        console.info(`[SettingsManager] Found settings for user '${combination.user}' and vehicle '${combination.vehicle}'.`)
        toBeUsedUser = combination.user
        toBeUsedVehicle = combination.vehicle
        break
      } else {
        console.warn(`[SettingsManager] No settings for user '${combination.user}' and vehicle '${combination.vehicle}'.`)
      }
    }

    let toBeUsedSettings: SettingsPackage = {}

    if (toBeUsedUser && toBeUsedVehicle) {
      toBeUsedSettings = this.getSettingsForUserAndVehicle(toBeUsedUser, toBeUsedVehicle)
    } else {
      console.warn(`[SettingsManager] No settings found for any user/vehicle combination. Migrating old-style settings.`)
      const oldStyleSettings: OldCockpitSettingsPackage = deserialize(localStorage.getItem(oldStyleSettingsKey)!)
      toBeUsedSettings = this.getMigratedOldStyleSettingsPackage(oldStyleSettings)
    }

    // Set the local settings for the user/vehicle combination that we found (or the migrated old-style settings)
    this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, toBeUsedSettings)

    // Now that we have local settings for the current user and vehicle, we can get the best settings between local and vehicle
    const bestSettingsWithVehicle = await this.getBestSettingsBetweenLocalAndVehicle(vehicleAddress, vehicleId)
    const bestSettingsForCurrentUserAndVehicle = bestSettingsWithVehicle[this.currentUser][this.currentVehicle]

    // Set the local settings to the best settings between local and vehicle for the current user and vehicle
    this.setLocalSettingsForUserAndVehicle(this.currentUser, this.currentVehicle, bestSettingsForCurrentUserAndVehicle)

    // Push the best settings to the vehicle
    await this.pushSettingsToVehicleUpdateQueue(
      this.currentUser,
      this.currentVehicle,
      this.currentVehicleAddress,
      bestSettingsForCurrentUserAndVehicle
    )

    // Update last connected vehicle to the current one
    this.saveLastConnectedVehicle(this.currentVehicle)
  }

  /**
   * Handles a user changing
   * @param {string} username - The new username
   */
  public handleUserChanging = async (username: string): Promise<void> => {
    console.log('[SettingsManager]', `Will handle user change from '${this.currentUser}' to '${username}'.`)
    const previousUser = this.retrieveLastConnectedUser()
    this.currentUser = username || fallbackUsername
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
        console.log(`[SettingsManager] No settings found for last connected user. Copying from fallback user.`)
        const fallbackUserSettings = this.getSettingsForUserAndVehicle(fallbackUsername, this.currentVehicle)
        newSettings = this.getMergedSettings(fallbackUserSettings, newSettings)
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
    this.performSideEffectOfSettingLocalSettings()

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
  console.log('[SettingsManager]', `Vehicle online event received. Will handle vehicle getting online with address '${event.detail.vehicleAddress}'.`)
  await settingsManager.handleVehicleGettingOnline(event.detail.vehicleAddress)
})

/**
 * Event handler for when the user changes
 * @param event - The custom event containing username
 */
window.addEventListener('user-changed', (event: UserChangedEvent) => {
  console.log('[SettingsManager]', `User change event received. Will handle user change from '${settingsManager.currentUser}' to '${event.detail.username}'.`)
  settingsManager.handleUserChanging(event.detail.username)
})

/**
 * Event handler for when the storage changes
 * @param event - The custom event containing new settings
 */
window.addEventListener('storage', () => {
  console.log('[SettingsManager]', 'Storage change event received. Will handle storage change.')
  settingsManager.handleStorageChanging()
})
