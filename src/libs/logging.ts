import { differenceInSeconds, format } from 'date-fns'
import localforage from 'localforage'
import Swal from 'sweetalert2'

import { useMainVehicleStore } from '@/stores/mainVehicle'

import { degrees } from './utils'

/**
 * Manager logging vehicle data and others
 */
class DataLogger {
  currentLoggerInterval: ReturnType<typeof setInterval> | undefined = undefined
  currentCockpitLog: {
    /**
     * Universal Linux epoch time (milliseconds since January 1st, 1970, UTC)
     */
    epoch: number
    /**
     * Seconds passed since the beggining of the logging
     */
    seconds: number
    /**
     * The actual vehicle data
     */
    data: Record<string, number | string>
  }[] = []

  /**
   * Start an intervaled logging
   * @param {number} interval - The time to wait between two logs
   */
  startLogging(interval = 1000): void {
    if (this.logging()) {
      Swal.fire({ title: 'Error', text: 'A log is already being generated.', icon: 'error', timer: 3000 })
      return
    }

    const vehicleStore = useMainVehicleStore()
    const cockpitLogsDB = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: 'cockpitLogsDB',
      storeName: 'cockpit-logs-db',
      version: 1.0,
      description: 'Local backups of Cockpit logs to be retrieved in case of failure.',
    })

    const initialTime = new Date()
    const fileName = `Cockpit (${format(initialTime, 'LLL dd, yyyy - HH꞉mm꞉ss O')}).clog`
    this.currentCockpitLog = []

    this.currentLoggerInterval = setInterval(async () => {
      const timeNow = new Date()
      const secondsNow = differenceInSeconds(timeNow, initialTime)

      const sensorsData: Record<string, number | string> = {}
      sensorsData['roll'] = degrees(vehicleStore.attitude.roll)
      sensorsData['pitch'] = degrees(vehicleStore.attitude.pitch)
      sensorsData['heading'] = degrees(vehicleStore.attitude.yaw)
      sensorsData['depth'] = vehicleStore.altitude.msl || NaN
      sensorsData['mode'] = vehicleStore.mode || 'Unknown'
      sensorsData['batteryVoltage'] = vehicleStore.powerSupply.voltage || NaN
      sensorsData['batteryCurrent'] = vehicleStore.powerSupply.current || NaN
      sensorsData['gpsVisibleSatellites'] = vehicleStore.statusGPS.visibleSatellites || NaN
      sensorsData['gpsFixType'] = vehicleStore.statusGPS.fixType || 'Unknown'
      sensorsData['latitude'] = vehicleStore.coordinates.latitude || NaN
      sensorsData['longitude'] = vehicleStore.coordinates.longitude || NaN

      this.currentCockpitLog.push({ epoch: timeNow.getTime(), seconds: secondsNow, data: sensorsData })

      await cockpitLogsDB.setItem(fileName, this.currentCockpitLog)
    }, interval)
  }

  /**
   * Stop the current logging operation
   */
  stopLogging(): void {
    if (!this.logging()) {
      Swal.fire({ title: 'Error', text: 'No log is being generated.', icon: 'error', timer: 3000 })
      return
    }

    clearInterval(this.currentLoggerInterval)
  }

  /**
   * Wether the logger is currently logging or not
   * @returns {boolean}
   */
  logging(): boolean {
    return this.currentLoggerInterval !== undefined
  }
}

export const datalogger = new DataLogger()
