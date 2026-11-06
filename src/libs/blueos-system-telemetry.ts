import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { counterDeltaToMbps, getCpusInfo, getCpuTempCelsius, getNetworkInfo, getStatus } from '@/libs/blueos'

// Registered on the first reading instead of up front, so a BlueOS that is not up yet, or a CPU or network
// interface that only shows up later, still gets its variables.
const setBlueOsVariable = (id: string, name: string, value: number): void => {
  if (getDataLakeVariableInfo(id) === undefined) {
    createDataLakeVariable({ id, name, type: 'number', persistent: false, persistValue: false, source: 'BlueOS' })
  }
  setDataLakeVariableData(id, value)
}

/**
 * Options of {@link startBlueOsSystemTelemetry}.
 */
export interface BlueOsSystemTelemetryOptions {
  /**
   * Prefix of the data-lake variable ids, 'blueos' unless the variables belong to a vehicle other than the main one.
   */
  idPrefix?: string
  /**
   * Prefix of the data-lake variable names, telling apart the variables of different vehicles.
   */
  namePrefix?: string
  /**
   * Called on every network reading, with the bytes each interface has transmitted so far.
   */
  onNetworkInfo?: (totalUploadedBytesPerInterface: Record<string, number>, timestamp: number) => void
}

/**
 * Mirrors a BlueOS's system information (CPU temperature, load and frequency, network traffic) into the data lake,
 * polling it every second.
 * @param {() => string} getAddress Returns the address of the BlueOS, read on every poll
 * @param {BlueOsSystemTelemetryOptions} [options] Naming of the variables, and a hook on the network readings
 * @returns {() => void} Stops the polling
 */
export const startBlueOsSystemTelemetry = (
  getAddress: () => string,
  { idPrefix = 'blueos', namePrefix = '', onNetworkInfo }: BlueOsSystemTelemetryOptions = {}
): (() => void) => {
  const setVariable = (path: string, name: string, value: number): void =>
    setBlueOsVariable(`${idPrefix}/${path}`, `${namePrefix}${name}`, value)

  // Store the recent network readings of each interface, which the published speeds are measured across

  // eslint-disable-next-line jsdoc/require-jsdoc, prettier/prettier
  const networkReadingsHistory: Map<string, { bytesReceived: number; bytesTransmitted: number; timestamp: number }[]> = new Map()

  // Long enough to span several counter refreshes, which is what makes the published speed the real rate.
  const speedAveragingWindowMs = 10000

  const interval = setInterval(async () => {
    try {
      const blueosStatus = await getStatus(getAddress())
      if (!blueosStatus) {
        throw new Error('BlueOS is not available.')
      }
    } catch (error) {
      console.error(error)
      return
    }

    // Update CPU temperature in the data lake
    try {
      const temp = await getCpuTempCelsius(getAddress())
      setVariable('cpu/tempC', 'CPU Temperature', temp)
    } catch (error) {
      console.error(`Failed to update CPU temperature in data lake: ${error}`)
    }

    // Update information about the CPU cores in the data lake
    try {
      const updatedCpusInfos = await getCpusInfo(getAddress())
      updatedCpusInfos.forEach((cpu) => {
        setVariable(`${cpu.name}/usage`, `BlueOS CPU '${cpu.name}' usage`, cpu.usage)
        setVariable(`${cpu.name}/frequency`, `BlueOS CPU '${cpu.name}' frequency`, cpu.frequency)
      })
      const averageUsage = updatedCpusInfos.reduce((acc, cpu) => acc + cpu.usage, 0) / updatedCpusInfos.length
      const averageFrequency = updatedCpusInfos.reduce((acc, cpu) => acc + cpu.frequency, 0) / updatedCpusInfos.length
      setVariable('cpu/usageAverage', 'BlueOS CPU Usage (average)', averageUsage)
      setVariable('cpu/frequencyAverage', 'BlueOS CPU Frequency (average)', averageFrequency)
    } catch (error) {
      console.error(`Failed to update CPU load in data lake: ${error}`)
    }

    // Update network information in the data lake
    try {
      const updatedNetworkInfos = await getNetworkInfo(getAddress())
      const currentTimestamp = Date.now()
      const totalUploadedBytesPerInterface: Record<string, number> = {}

      updatedNetworkInfos.forEach((networkInterface) => {
        const interfacePath = `network/${networkInterface.name}`
        const interfaceName = `BlueOS network '${networkInterface.name}'`
        totalUploadedBytesPerInterface[networkInterface.name] = networkInterface.total_transmitted_B

        // Convert total bytes to megabytes (MB)
        const totalReceivedMB = networkInterface.total_received_B / (1024 * 1024)
        const totalTransmittedMB = networkInterface.total_transmitted_B / (1024 * 1024)

        // Update total values in MB
        setVariable(`${interfacePath}/totalReceivedMB`, `${interfaceName} total received (MB)`, totalReceivedMB)
        setVariable(
          `${interfacePath}/totalTransmittedMB`,
          `${interfaceName} total transmitted (MB)`,
          totalTransmittedMB
        )

        // Calculate and update speeds
        const windowStart = currentTimestamp - speedAveragingWindowMs
        const storedReadings = networkReadingsHistory.get(networkInterface.name) ?? []
        const readings = storedReadings.filter((reading) => reading.timestamp > windowStart)
        // A gap longer than the window leaves nothing inside it, and publishing nothing would leave the
        // previous rate standing as if it were current, so the newest reading is measured against instead.
        const oldestReading = readings[0] ?? storedReadings[storedReadings.length - 1]
        if (oldestReading) {
          const spanMs = currentTimestamp - oldestReading.timestamp
          setVariable(
            `${interfacePath}/downloadSpeedMbps`,
            `${interfaceName} download speed (Mbps)`,
            counterDeltaToMbps(networkInterface.total_received_B - oldestReading.bytesReceived, spanMs)
          )
          setVariable(
            `${interfacePath}/uploadSpeedMbps`,
            `${interfaceName} upload speed (Mbps)`,
            counterDeltaToMbps(networkInterface.total_transmitted_B - oldestReading.bytesTransmitted, spanMs)
          )
        }

        // Store current reading for next calculation
        readings.push({
          bytesReceived: networkInterface.total_received_B,
          bytesTransmitted: networkInterface.total_transmitted_B,
          timestamp: currentTimestamp,
        })
        networkReadingsHistory.set(networkInterface.name, readings)
      })

      onNetworkInfo?.(totalUploadedBytesPerInterface, currentTimestamp)
    } catch (error) {
      console.error(`Failed to update network information in data lake: ${error}`)
    }
  }, 1000)
  return () => clearInterval(interval)
}
