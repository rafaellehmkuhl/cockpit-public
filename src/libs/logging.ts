/* eslint-disable vue/max-len */
/* eslint-disable prettier/prettier */
/* eslint-disable max-len */
import { differenceInSeconds, format } from 'date-fns'
import localforage from 'localforage'
import Swal from 'sweetalert2'

import { useMainVehicleStore } from '@/stores/mainVehicle'

import { degrees } from './utils'

/**
 * Format for a standalone cockpit log
 */
export interface CockpitStandardLogPoint {
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
}

/**
 * Format for a standalone cockpit log
 */
export type CockpitStandardLog = CockpitStandardLogPoint[]

/**
 * Manager logging vehicle data and others
 */
class DataLogger {
  currentLoggerInterval: ReturnType<typeof setInterval> | undefined = undefined
  currentCockpitLog: CockpitStandardLog = []

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

  /**
   * Get desired part of a log based on timestamp
   * @param {CockpitStandardLog} completeLog The log from which the slice should be taken from
   * @param {Date} initialTime The timestamp from which the log should be started from
   * @param {Date} finalTime The timestamp in which the log should be terminated
   * @returns {CockpitStandardLog} The actual log
   */
  getSlice(completeLog: CockpitStandardLog, initialTime: Date, finalTime: Date): CockpitStandardLog {
    return completeLog
      .filter((logPoint) => logPoint.epoch > initialTime.getTime() && logPoint.epoch < finalTime.getTime())
      .map((logPoint) => ({ ...logPoint, ...{ seconds: differenceInSeconds(new Date(logPoint.epoch), initialTime) } }))
  }
}

export const assFromClog = (log: CockpitStandardLog, videoWidth: number, videoHeight: number): string => {
  let assFile = `[Script Info]
Title: Cockpit Subtitle Telemetry file
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,1,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  log.forEach((logPoint) => {
    const roll = Number(logPoint.data['roll']).toFixed(2)
    const pitch = Number(logPoint.data['pitch']).toFixed(2)
    const heading = Number(logPoint.data['heading']).toFixed(2)
    const depth = Number(logPoint.data['depth']).toFixed(2)
    const mode = logPoint.data['mode']
    const batteryVoltage = Number(logPoint.data['batteryVoltage']).toFixed(2)
    const batteryCurrent = Number(logPoint.data['batteryCurrent']).toFixed(2)
    const gpsVisibleSatellites = logPoint.data['gpsVisibleSatellites']
    const gpsFixType = logPoint.data['gpsFixType']
    const latitude = Number(logPoint.data['latitude']).toFixed(6)
    const longitude = Number(logPoint.data['longitude']).toFixed(6)
    const secondsStart = logPoint.seconds.toFixed(0)
    const secondsFinish = (logPoint.seconds + 1).toFixed(0)
    assFile = assFile.concat(`\nDialogue: 0,0:0:${secondsStart}.00,0:0:${secondsFinish}.00,Default,,${0.1*videoWidth},0,${0.05*videoHeight},,Heading: ${heading} \\NPitch: ${pitch} \\NRoll: ${roll} \\NDepth: ${depth}`)
    assFile = assFile.concat(`\nDialogue: 0,0:0:${secondsStart}.00,0:0:${secondsFinish}.00,Default,,${0.4*videoWidth},0,${0.05*videoHeight},,Mode: ${mode} \\NVoltage: ${batteryVoltage}\\NCurrent: ${batteryCurrent}`)
    assFile = assFile.concat(`\nDialogue: 0,0:0:${secondsStart}.00,0:0:${secondsFinish}.00,Default,,${0.7*videoWidth},0,${0.05*videoHeight},,GPS status: ${gpsFixType}\\NSatellites: ${gpsVisibleSatellites}\\NLatitude: ${latitude}\\NLongitude: ${longitude}`)
  })
  assFile = assFile.concat('\n')

  console.log(assFile)
  return assFile
}

export const datalogger = new DataLogger()
