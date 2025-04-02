import ky, { HTTPError } from 'ky'

import { type ActionConfig } from '@/libs/joystick/protocols/cockpit-actions'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { ExternalWidgetSetupInfo } from '@/types/widgets'

/**
 * Cockpits extra json format. Taken from extensions in BlueOS and (eventually) other places
 */
interface ExtrasJson {
  /**
   *  The version of the cockpit API that the extra json is compatible with
   */
  target_cockpit_api_version: string
  /**
   *  The target system that the extra json is compatible with, in our case, "cockpit"
   */
  target_system: string
  /**
   *  A list of widgets that the extra json contains. src/types/widgets.ts
   */
  widgets: ExternalWidgetSetupInfo[]
  /**
   * A list of available cockpit actions offered by the extension.
   */
  actions: ActionConfig[]
}

/**
 * Service object from BlueOS
 */
interface Service {
  /**
   * Metadata of the service
   */
  metadata?: {
    /**
     * Extras of the service
     */
    extras?: {
      /**
       * Cockpit extra json url
       */
      cockpit?: string
    }
    /**
     * Works in relative paths
     */
    works_in_relative_paths?: boolean
    /**
     * Sanitized name of the service
     */
    sanitized_name?: string
  }
  /**
   * Port of the service
   */
  port?: number
}

export const NoPathInBlueOsErrorName = 'NoPathInBlueOS'

const defaultTimeout = 10000

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagPath: string
): Promise<Record<string, any> | any> => {
  try {
    const options = { timeout: defaultTimeout, retry: 0 }
    return await ky.get(`http://${vehicleAddress}/bag/v1.0/get/${bagPath}`, options).json()
  } catch (error) {
    const errorBody = await (error as HTTPError).response.json()
    if (errorBody.detail === 'Invalid path') {
      const noPathError = new Error(`No data available in BlueOS storage for path '${bagPath}'.`)
      noPathError.name = NoPathInBlueOsErrorName
      throw noPathError
    }
    throw new Error(`Could not get bag of holdings for ${bagPath}. ${error}`)
  }
}

export const getKeyDataFromCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string
): Promise<any | undefined> => {
  return await getBagOfHoldingFromVehicle(vehicleAddress, `cockpit/${storageKey}`)
}

const blueOsServiceUrl = (vehicleAddress: string, service: Service): string => {
  const worksInRelativePaths = service.metadata?.works_in_relative_paths
  const sanitizedName = service.metadata?.sanitized_name
  const port = service.port
  return worksInRelativePaths
    ? `http://${vehicleAddress}/extensionv2/${sanitizedName}`
    : `http://${vehicleAddress}:${port}`
}

const getServicesFromBlueOS = async (vehicleAddress: string): Promise<Service[]> => {
  const options = { timeout: defaultTimeout, retry: 0 }
  const services = (await ky.get(`http://${vehicleAddress}/helper/v1.0/web_services`, options).json()) as Service[]
  return services
}

export const getExtrasJsonFromBlueOsService = async (
  vehicleAddress: string,
  service: Service
): Promise<ExtrasJson | null> => {
  const options = { timeout: defaultTimeout, retry: 0 }
  if (service.metadata?.extras?.cockpit === undefined) {
    return null
  }
  const baseUrl = blueOsServiceUrl(vehicleAddress, service)
  const fullUrl = baseUrl + service.metadata?.extras?.cockpit
  const extraJson: ExtrasJson = await ky.get(fullUrl, options).json()
  return extraJson
}

export const getWidgetsFromBlueOS = async (): Promise<ExternalWidgetSetupInfo[]> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    await new Promise((r) => setTimeout(r, 1000))
  }

  const services = await getServicesFromBlueOS(vehicleStore.globalAddress)
  const widgets: ExternalWidgetSetupInfo[] = []
  await Promise.all(
    services.map(async (service) => {
      const extraJson = await getExtrasJsonFromBlueOsService(vehicleStore.globalAddress, service)
      const baseUrl = blueOsServiceUrl(vehicleStore.globalAddress, service)
      if (extraJson !== null) {
        widgets.push(
          ...extraJson.widgets.map((widget) => {
            return {
              ...widget,
              iframe_url: baseUrl + widget.iframe_url,
              iframe_icon: baseUrl + widget.iframe_icon,
            }
          })
        )
      }
    })
  )

  return widgets
}

export const getActionsFromBlueOS = async (): Promise<ActionConfig[]> => {
  const vehicleStore = useMainVehicleStore()

  // Wait until we have a global address
  while (vehicleStore.globalAddress === undefined) {
    await new Promise((r) => setTimeout(r, 1000))
  }

  const services = await getServicesFromBlueOS(vehicleStore.globalAddress)
  const actions: ActionConfig[] = []
  await Promise.all(
    services.map(async (service) => {
      try {
        const extraJson = await getExtrasJsonFromBlueOsService(vehicleStore.globalAddress, service)
        if (extraJson !== null) {
          actions.push(...extraJson.actions)
        }
      } catch (error) {
        console.error(`Could not get actions from BlueOS service ${service.metadata?.sanitized_name}. ${error}`)
      }
    })
  )

  return actions
}

export const setBagOfHoldingOnVehicle = async (
  vehicleAddress: string,
  bagName: string,
  bagData: Record<string, any> | any
): Promise<void> => {
  try {
    await ky.post(`http://${vehicleAddress}/bag/v1.0/set/${bagName}`, { json: bagData, timeout: defaultTimeout })
  } catch (error) {
    throw new Error(`Could not set bag of holdings for ${bagName}. ${error}`)
  }
}

export const setKeyDataOnCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string,
  storageData: Record<string, any> | any
): Promise<void> => {
  await setBagOfHoldingOnVehicle(vehicleAddress, `cockpit/${storageKey}`, storageData)
}

/* eslint-disable jsdoc/require-jsdoc */
type RawIpInfo = { ip: string; service_type: string; interface_type: string }
type IpInfo = { ipv4Address: string; interfaceType: string }
/* eslint-enable jsdoc/require-jsdoc */

export const getIpsInformationFromVehicle = async (vehicleAddress: string): Promise<IpInfo[]> => {
  try {
    const url = `http://${vehicleAddress}/beacon/v1.0/services`
    const rawIpsInfo: RawIpInfo[] = await ky.get(url, { timeout: defaultTimeout }).json()
    return rawIpsInfo
      .filter((ipInfo) => ipInfo['service_type'] === '_http')
      .map((ipInfo) => ({ ipv4Address: ipInfo.ip, interfaceType: ipInfo.interface_type }))
  } catch (error) {
    throw new Error(`Could not get information about IPs on BlueOS. ${error}`)
  }
}

/* eslint-disable jsdoc/require-jsdoc */
type RawM2rServiceInfo = { name: string; version: string; sha: string; build_date: string; authors: string }
type RawM2rInfo = { version: number; service: RawM2rServiceInfo }
/* eslint-enable jsdoc/require-jsdoc */

export const getMavlink2RestVersion = async (vehicleAddress: string): Promise<string> => {
  try {
    const url = `http://${vehicleAddress}/mavlink2rest/info`
    const m2rRawInfo: RawM2rInfo = await ky.get(url, { timeout: defaultTimeout }).json()
    return m2rRawInfo.service.version
  } catch (error) {
    throw new Error(`Could not get Mavlink2Rest version. ${error}`)
  }
}

/* eslint-disable jsdoc/require-jsdoc */
type RawArdupilotFirmwareInfo = { version: string; type: string }
/* eslint-enable jsdoc/require-jsdoc */

export const getArdupilotVersion = async (vehicleAddress: string): Promise<string> => {
  try {
    const url = `http://${vehicleAddress}/ardupilot-manager/v1.0/firmware_info`
    const ardupilotFirmwareRawInfo: RawArdupilotFirmwareInfo = await ky.get(url, { timeout: defaultTimeout }).json()
    return ardupilotFirmwareRawInfo.version
  } catch (error) {
    throw new Error(`Could not get Ardupilot firmware version. ${error}`)
  }
}

export const getStatus = async (vehicleAddress: string): Promise<boolean> => {
  try {
    const url = `http://${vehicleAddress}/status`
    const result = await ky.get(url, { timeout: defaultTimeout })
    return result.ok
  } catch (error) {
    throw new Error(`Could not get BlueOS status. ${error}`)
  }
}

// eslint-disable-next-line jsdoc/require-jsdoc
type RawCpuTempInfo = { name: string; temperature: number; maximum_temperature: number; critical_temperature: number }

export const getCpuTempCelsius = async (vehicleAddress: string): Promise<number> => {
  try {
    const url = `http://${vehicleAddress}/system-information/system/temperature`
    const cpuTempRawInfo: RawCpuTempInfo[] = await ky.get(url, { timeout: defaultTimeout }).json()
    return cpuTempRawInfo[0].temperature
  } catch (error) {
    throw new Error(`Could not get temperature of the BlueOS CPU. ${error}`)
  }
}
