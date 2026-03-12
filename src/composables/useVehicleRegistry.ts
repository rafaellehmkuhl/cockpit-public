import { computed } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { settingsManager } from '@/libs/settings-management'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { SyncStatusEvent } from '@/types/settings-management'
import type { VehicleRegistryEntry } from '@/types/vehicle-registry'

const vehicleRegistry = useBlueOsStorage<VehicleRegistryEntry[]>('cockpit-vehicle-registry', [])

const autoRegisterVehicle = (event: SyncStatusEvent): void => {
  if (event.type !== 'sync-started' || event.reason !== 'vehicle-online') return
  const existing = vehicleRegistry.value.find((v) => v.hash === event.vehicleId)
  const address = useMainVehicleStore().globalAddress
  if (existing) {
    existing.address = address
    existing.lastConnectedAt = Date.now()
  } else {
    vehicleRegistry.value.push({
      hash: event.vehicleId,
      name: `Vehicle ${event.vehicleId.slice(0, 8)}`,
      address,
      lastConnectedAt: Date.now(),
    })
  }
}

settingsManager.registerSyncStatusListener(autoRegisterVehicle)

/**
 * Composable for managing a registry of known vehicles
 * Vehicles are identified by their hash (UUID stored on-board via BlueOS).
 * Each entry tracks the user-assigned name and last known address.
 * @returns {object} Vehicle registry interface
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useVehicleRegistry() {
  const vehicles = computed(() => vehicleRegistry.value)

  /**
   * Finds a vehicle entry by its hash
   * @param {string} hash - The vehicle hash to look up
   * @returns {VehicleRegistryEntry | undefined} The matching entry
   */
  const findByHash = (hash: string): VehicleRegistryEntry | undefined => {
    return vehicleRegistry.value.find((v) => v.hash === hash)
  }

  /**
   * Registers a new vehicle or updates an existing one's address and last-connected timestamp
   * @param {string} hash - The vehicle hash
   * @param {string} address - The vehicle's current IP/address
   * @param {string} name - Optional display name (only used for new vehicles; won't overwrite existing names)
   */
  const registerOrUpdate = (hash: string, address: string, name?: string): void => {
    const existing = vehicleRegistry.value.find((v) => v.hash === hash)
    if (existing) {
      existing.address = address
      existing.lastConnectedAt = Date.now()
    } else {
      vehicleRegistry.value.push({
        hash,
        name: name ?? `Vehicle ${hash.slice(0, 8)}`,
        address,
        lastConnectedAt: Date.now(),
      })
    }
  }

  /**
   * Renames a vehicle in the registry
   * @param {string} hash - The vehicle hash
   * @param {string} newName - The new display name
   */
  const renameVehicle = (hash: string, newName: string): void => {
    const entry = vehicleRegistry.value.find((v) => v.hash === hash)
    if (entry) {
      entry.name = newName
    }
  }

  /**
   * Removes a vehicle from the registry
   * @param {string} hash - The vehicle hash to remove
   */
  const removeVehicle = (hash: string): void => {
    const index = vehicleRegistry.value.findIndex((v) => v.hash === hash)
    if (index !== -1) {
      vehicleRegistry.value.splice(index, 1)
    }
  }

  /**
   * Switches the active connection to a different vehicle by its registry hash.
   * Updates the global address and reloads Cockpit.
   * @param {string} hash - The vehicle hash to switch to
   */
  const switchToVehicle = (hash: string): void => {
    const entry = vehicleRegistry.value.find((v) => v.hash === hash)
    if (!entry) return

    const mainVehicleStore = useMainVehicleStore()
    if (mainVehicleStore.globalAddress === entry.address) return

    mainVehicleStore.globalAddress = entry.address
    reloadCockpitAndWarnUser()
  }

  return {
    vehicles,
    findByHash,
    registerOrUpdate,
    renameVehicle,
    removeVehicle,
    switchToVehicle,
  }
}
