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

/**
 * OldCockpitSetting is the type of the settings before the settings manager was introduced.
 */
export type OldCockpitSetting = any

/**
 * SettingsListener is the type of the listener for the settings manager.
 */
export type SettingsListener = (newSettings: LocalSettings) => void

/**
 * A queue of key value updates for a vehicle
 * Only the most recent change is stored for each vehicle/user/key combination
 */
export interface KeyValueVehicleUpdateQueue {
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

/**
 * VehicleOnlineEvent is the type of the event for when a vehicle comes online.
 */
export type VehicleOnlineEvent = CustomEvent<{
  /**
   * The address of the vehicle that came online
   */
  vehicleAddress: string
}>

/**
 * UserChangedEvent is the type of the event for when a user changes.
 */
export type UserChangedEvent = CustomEvent<{
  /**
   * The username of the user that changed
   */
  username: string
}>

/**
 * Define the custom event types for the settings management
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
