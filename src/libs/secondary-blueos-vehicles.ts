/**
 * Watches the BlueOS of each secondary vehicle added by its BlueOS address. Only reads from it: nothing is ever
 * written to a vehicle the user is not piloting.
 *
 * This module has no Vue dependencies; reactive orchestration lives in the `secondaryVehicles` composable.
 */

import { getStatus } from '@/libs/blueos'

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
}

const LOG_PREFIX = '[SecondaryBlueOs]'

const statusCheckIntervalMs = 5000

const statusChecks = new Map<string, ReturnType<typeof setInterval>>()
const states = new Map<string, SecondaryBlueOsState>()

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
    const state: SecondaryBlueOsState = { isReachable: undefined }
    states.set(address, state)
    onStateChange(address, { ...state })

    const checkStatus = async (): Promise<void> => {
      const isReachable = await isBlueOsReachable(address)
      // Removed while the check was running
      if (states.get(address) !== state || state.isReachable === isReachable) return
      state.isReachable = isReachable
      onStateChange(address, { ...state })
      if (!isReachable) console.warn(`${LOG_PREFIX} The BlueOS at '${address}' is not reachable.`)
    }

    checkStatus()
    statusChecks.set(address, setInterval(checkStatus, statusCheckIntervalMs))
  })
}
