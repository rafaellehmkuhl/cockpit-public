import { createDataLakeVariable, getAllDataLakeVariablesInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { counterDeltaToMbps, getCpusInfo, getCpuTempCelsius, getNetworkInfo, getStatus } from '@/libs/blueos'

/**
 * Mirrors a BlueOS's system information (CPU temperature, load and frequency, network traffic) into the data lake,
 * polling it every second.
 * @param {() => string} getAddress Returns the address of the BlueOS, read on every poll
 * @param {(totalUploadedBytesPerInterface: Record<string, number>, timestamp: number) => void} [onNetworkInfo]
 * Called on every network reading, with the bytes each interface has transmitted so far
 * @returns {Promise<void>}
 */
export const startBlueOsSystemTelemetry = async (
  getAddress: () => string,
  onNetworkInfo?: (totalUploadedBytesPerInterface: Record<string, number>, timestamp: number) => void
): Promise<void> => {
  // Register BlueOS variables in the data lake
  const blueOsVariables = {
    cpuTemp: { id: 'blueos/cpu/tempC', name: 'CPU Temperature', type: 'number' },
    cpuUsageAverage: { id: 'blueos/cpu/usageAverage', name: 'BlueOS CPU Usage (average)', type: 'number' },
    cpuFrequencyAverage: {
      id: 'blueos/cpu/frequencyAverage',
      name: 'BlueOS CPU Frequency (average)',
      type: 'number',
    },
  }

  const cpuUsageVariableId = (cpuName: string): string => `blueos/${cpuName}/usage`
  const cpuFrequencyVariableId = (cpuName: string): string => `blueos/${cpuName}/frequency`

  // Network variable ID functions
  const networkTotalReceivedMBVariableId = (interfaceName: string): string =>
    `blueos/network/${interfaceName}/totalReceivedMB`
  const networkTotalTransmittedMBVariableId = (interfaceName: string): string =>
    `blueos/network/${interfaceName}/totalTransmittedMB`
  const networkUploadSpeedMbpsVariableId = (interfaceName: string): string =>
    `blueos/network/${interfaceName}/uploadSpeedMbps`
  const networkDownloadSpeedMbpsVariableId = (interfaceName: string): string =>
    `blueos/network/${interfaceName}/downloadSpeedMbps`

  // Store the recent network readings of each interface, which the published speeds are measured across

  // eslint-disable-next-line jsdoc/require-jsdoc, prettier/prettier
  const networkReadingsHistory: Map<string, { bytesReceived: number; bytesTransmitted: number; timestamp: number }[]> = new Map()

  // Long enough to span several counter refreshes, which is what makes the published speed the real rate.
  const speedAveragingWindowMs = 10000

  const cpusInfos = await getCpusInfo(getAddress())
  cpusInfos.forEach((cpu) => {
    Object.assign(blueOsVariables, {
      [`${cpu.name}_usage`]: {
        id: cpuUsageVariableId(cpu.name),
        name: `BlueOS CPU '${cpu.name}' usage`,
        type: 'number',
      },
    })
    Object.assign(blueOsVariables, {
      [`${cpu.name}_frequency`]: {
        id: cpuFrequencyVariableId(cpu.name),
        name: `BlueOS CPU '${cpu.name}' frequency`,
        type: 'number',
      },
    })
  })

  // Register network variables for each interface
  const networkInfos = await getNetworkInfo(getAddress())
  networkInfos.forEach((networkInterface) => {
    Object.assign(blueOsVariables, {
      [`${networkInterface.name}_totalReceivedMB`]: {
        id: networkTotalReceivedMBVariableId(networkInterface.name),
        name: `BlueOS network '${networkInterface.name}' total received (MB)`,
        type: 'number',
      },
      [`${networkInterface.name}_totalTransmittedMB`]: {
        id: networkTotalTransmittedMBVariableId(networkInterface.name),
        name: `BlueOS network '${networkInterface.name}' total transmitted (MB)`,
        type: 'number',
      },
      [`${networkInterface.name}_uploadSpeedMbps`]: {
        id: networkUploadSpeedMbpsVariableId(networkInterface.name),
        name: `BlueOS network '${networkInterface.name}' upload speed (Mbps)`,
        type: 'number',
      },
      [`${networkInterface.name}_downloadSpeedMbps`]: {
        id: networkDownloadSpeedMbpsVariableId(networkInterface.name),
        name: `BlueOS network '${networkInterface.name}' download speed (Mbps)`,
        type: 'number',
      },
    })
  })

  Object.values(blueOsVariables).forEach((variable) => {
    if (!Object.values(getAllDataLakeVariablesInfo()).find((v) => v.id === variable.id)) {
      // @ts-ignore: The type is right, only being incorrectly inferred by TS
      createDataLakeVariable({ ...variable, persistent: false, persistValue: false, source: 'BlueOS' })
    }
  })

  setInterval(async () => {
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
      setDataLakeVariableData(blueOsVariables.cpuTemp.id, temp)
    } catch (error) {
      console.error(`Failed to update CPU temperature in data lake: ${error}`)
    }

    // Update information about the CPU cores in the data lake
    try {
      const updatedCpusInfos = await getCpusInfo(getAddress())
      updatedCpusInfos.forEach((cpu) => {
        setDataLakeVariableData(cpuUsageVariableId(cpu.name), cpu.usage)
        setDataLakeVariableData(cpuFrequencyVariableId(cpu.name), cpu.frequency)
      })
      const averageUsage = updatedCpusInfos.reduce((acc, cpu) => acc + cpu.usage, 0) / updatedCpusInfos.length
      const averageFrequency = updatedCpusInfos.reduce((acc, cpu) => acc + cpu.frequency, 0) / updatedCpusInfos.length
      setDataLakeVariableData(blueOsVariables.cpuUsageAverage.id, averageUsage)
      setDataLakeVariableData(blueOsVariables.cpuFrequencyAverage.id, averageFrequency)
    } catch (error) {
      console.error(`Failed to update CPU load in data lake: ${error}`)
    }

    // Update network information in the data lake
    try {
      const updatedNetworkInfos = await getNetworkInfo(getAddress())
      const currentTimestamp = Date.now()
      const totalUploadedBytesPerInterface: Record<string, number> = {}

      updatedNetworkInfos.forEach((networkInterface) => {
        totalUploadedBytesPerInterface[networkInterface.name] = networkInterface.total_transmitted_B

        // Convert total bytes to megabytes (MB)
        const totalReceivedMB = networkInterface.total_received_B / (1024 * 1024)
        const totalTransmittedMB = networkInterface.total_transmitted_B / (1024 * 1024)

        // Update total values in MB
        setDataLakeVariableData(networkTotalReceivedMBVariableId(networkInterface.name), totalReceivedMB)
        setDataLakeVariableData(networkTotalTransmittedMBVariableId(networkInterface.name), totalTransmittedMB)

        // Calculate and update speeds
        const windowStart = currentTimestamp - speedAveragingWindowMs
        const storedReadings = networkReadingsHistory.get(networkInterface.name) ?? []
        const readings = storedReadings.filter((reading) => reading.timestamp > windowStart)
        // A gap longer than the window leaves nothing inside it, and publishing nothing would leave the
        // previous rate standing as if it were current, so the newest reading is measured against instead.
        const oldestReading = readings[0] ?? storedReadings[storedReadings.length - 1]
        if (oldestReading) {
          const spanMs = currentTimestamp - oldestReading.timestamp
          setDataLakeVariableData(
            networkDownloadSpeedMbpsVariableId(networkInterface.name),
            counterDeltaToMbps(networkInterface.total_received_B - oldestReading.bytesReceived, spanMs)
          )
          setDataLakeVariableData(
            networkUploadSpeedMbpsVariableId(networkInterface.name),
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
}
