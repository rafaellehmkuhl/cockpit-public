/**
 * Watches the BlueOS of each secondary vehicle added by its BlueOS address. Only reads from it: nothing is ever
 * written to a vehicle the user is not piloting.
 *
 * This module has no Vue dependencies; reactive orchestration lives in the `secondaryVehicles` composable.
 */

import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { getKeyDataFromCockpitVehicleStorage, getStatus } from '@/libs/blueos'
import { startBlueOsSystemTelemetry } from '@/libs/blueos-system-telemetry'

/** Persistence key for the BlueOS addresses of the secondary vehicles. Machine-local: these are addresses on the local network. */
export const secondaryBlueOsAddressesKey = 'cockpit-secondary-blueos-addresses'

/**
 * Runtime state of a secondary vehicle's BlueOS.
 */
export interface SecondaryBlueOsState {
  /**
   * Whether the BlueOS answered its last status check, or undefined while the first one is still running.
   */
  isReachable: boolean | undefined
  /**
   * Id Cockpit gave the vehicle when it was the main one, which is what it is numbered by. Undefined until it is
   * read, and null when the vehicle has none, since it has never been connected to as the main vehicle.
   */
  vehicleId: string | null | undefined
}

/**
 * A secondary vehicle whose BlueOS data is mirrored into the data lake, under its number.
 */
export interface NumberedSecondaryBlueOs {
  /**
   * Address of the vehicle's BlueOS.
   */
  address: string
  /**
   * Number the vehicle's data-lake variables are named after.
   */
  vehicleNumber: number
}

const LOG_PREFIX = '[SecondaryBlueOs]'

const statusCheckIntervalMs = 5000

const statusChecks = new Map<string, ReturnType<typeof setInterval>>()
const states = new Map<string, SecondaryBlueOsState>()

// Only read: creating the id is left to whoever connects to the vehicle as the main one.
const readVehicleId = async (address: string): Promise<string | null | undefined> => {
  try {
    const vehicleId = await getKeyDataFromCockpitVehicleStorage(address, 'cockpit-vehicle-id')
    return typeof vehicleId === 'string' ? vehicleId : null
  } catch (error) {
    console.error(`${LOG_PREFIX} Could not read the vehicle id from the BlueOS at '${address}'. ${error}`)
    return undefined
  }
}

const isBlueOsReachable = async (address: string): Promise<boolean> => {
  try {
    return await getStatus(address)
  } catch {
    return false
  }
}

/**
 * Normalizes what the user typed as a BlueOS address into the form the rest of Cockpit uses for one: a host,
 * optionally with a port, and no protocol, path or trailing slash.
 * @param {string} input Address as typed
 * @returns {string} The normalized address
 * @throws {Error} When the input is not a host
 */
export const normalizeBlueOsAddress = (input: string): string => {
  const withoutProtocol = input.trim().replace(/^https?:\/\//i, '')
  let url: URL
  try {
    url = new URL(`http://${withoutProtocol}`)
  } catch {
    throw new Error('it should be a host, like 192.168.2.2 or blueos.local')
  }
  if (url.host === '' || url.pathname.replace(/\/+$/, '') !== '' || url.search !== '' || url.username !== '') {
    throw new Error('it should be only a host, like 192.168.2.2 or blueos.local, without a path')
  }
  return url.host
}

/**
 * Starts and stops watching BlueOS instances so the watched ones match the given addresses.
 * @param {string[]} addresses BlueOS addresses that should be watched
 * @param {(address: string, state: SecondaryBlueOsState | undefined) => void} onStateChange Called whenever a
 * BlueOS's state changes, and with undefined once it is no longer watched
 * @returns {void}
 */
export const syncSecondaryBlueOsVehicles = (
  addresses: string[],
  onStateChange: (address: string, state: SecondaryBlueOsState | undefined) => void
): void => {
  const wantedAddresses = new Set(addresses)

  statusChecks.forEach((statusCheck, address) => {
    if (wantedAddresses.has(address)) return
    clearInterval(statusCheck)
    statusChecks.delete(address)
    states.delete(address)
    onStateChange(address, undefined)
    console.info(`${LOG_PREFIX} Stopped watching the BlueOS at '${address}'.`)
  })

  wantedAddresses.forEach((address) => {
    if (statusChecks.has(address)) return
    const state: SecondaryBlueOsState = { isReachable: undefined, vehicleId: undefined }
    states.set(address, state)
    onStateChange(address, { ...state })

    // Removed while a check was running
    const isStillWatched = (): boolean => states.get(address) === state

    const checkStatus = async (): Promise<void> => {
      const isReachable = await isBlueOsReachable(address)
      if (!isStillWatched()) return
      if (state.isReachable !== isReachable) {
        state.isReachable = isReachable
        onStateChange(address, { ...state })
        if (!isReachable) console.warn(`${LOG_PREFIX} The BlueOS at '${address}' is not reachable.`)
      }

      // Read again until there is one, as the vehicle gets an id once someone connects to it as the main vehicle.
      if (!isReachable || typeof state.vehicleId === 'string') return
      const vehicleId = await readVehicleId(address)
      if (!isStillWatched() || vehicleId === state.vehicleId) return
      state.vehicleId = vehicleId
      onStateChange(address, { ...state })
    }

    checkStatus()
    statusChecks.set(address, setInterval(checkStatus, statusCheckIntervalMs))
  })
}

const telemetries = new Map<
  string,
  {
    /**
cccccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccccc
     */
    vehicleNumber: number
    /**
vvvvvvvvvvvvvvvvvvvvvvv *
vvvvvvvvvvvvvvvvvvvvvvv
     */
    stop: () => void
  }
>()

const setVehicleAddressVariable = (vehicleNumber: number, address: string): void => {
  const id = `/vehicles/${vehicleNumber}/address`
  if (getDataLakeVariableInfo(id) === undefined) {
    createDataLakeVariable({
      id,
      name: `Vehicle ${vehicleNumber} address`,
      type: 'string',
      description: `The address of vehicle ${vehicleNumber}'s BlueOS, without protocol.`,
      persistent: false,
      persistValue: false,
      source: 'BlueOS',
    })
  }
  setDataLakeVariableData(id, address)
}

/**
 * Starts and stops mirroring BlueOS data into the data lake so the mirrored vehicles match the given ones. A
 * vehicle's variables are named after its number, so one whose number changes is mirrored again under the new one,
 * while the variables under the old number are left in place, since widgets may still reference them.
 * @param {NumberedSecondaryBlueOs[]} vehicles Vehicles that should be mirrored
 * @returns {void}
 */
export const syncSecondaryBlueOsTelemetry = (vehicles: NumberedSecondaryBlueOs[]): void => {
  const wantedNumbers = new Map(vehicles.map((vehicle) => [vehicle.address, vehicle.vehicleNumber]))

  telemetries.forEach((telemetry, address) => {
    if (wantedNumbers.get(address) === telemetry.vehicleNumber) return
    telemetry.stop()
    telemetries.delete(address)
  })

  wantedNumbers.forEach((vehicleNumber, address) => {
    if (telemetries.has(address)) return
    setVehicleAddressVariable(vehicleNumber, address)
    // ponytail: a few requests per second per vehicle, as for the main one. Poll less often if many are added.
    const stop = startBlueOsSystemTelemetry(() => address, {
      idPrefix: `/vehicles/${vehicleNumber}/blueos`,
      namePrefix: `Vehicle ${vehicleNumber} `,
    })
    telemetries.set(address, { vehicleNumber, stop })
  })
}
