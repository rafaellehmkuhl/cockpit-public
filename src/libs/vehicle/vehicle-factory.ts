import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { Signal } from '@/libs/signal'

import { ArduCopter } from './ardupilot/arducopter'
import { ArduPlane } from './ardupilot/arduplane'
import { ArduRover } from './ardupilot/ardurover'
import { ArduSub } from './ardupilot/ardusub'
import type { MAVLinkVehicleOptions } from './mavlink/vehicle'
import { PX4 } from './px4/px4'
import * as Vehicle from './vehicle'

/**
 * Class responsible for handling vehicle creation
 */
export class VehicleFactory {
  static _vehicles: WeakRef<Vehicle.Abstract>[] = []

  // Signals
  static onVehicles = new Signal<WeakRef<Vehicle.Abstract>[]>()

  /**
   * Create vehicle based on the firmware and vehicle type
   * @param {Vehicle.Firmware} firmware
   * @param {Vehicle.Type} type
   * @param {number} system_id - The system ID for the vehicle
   * @returns {Vehicle.Abstract | undefined}
   */
  static createVehicle(
    firmware: Vehicle.Firmware,
    type: Vehicle.Type,
    system_id: number
  ): Vehicle.Abstract | undefined {
    const vehicle = VehicleFactory.buildVehicle(firmware, type, system_id)

    if (vehicle === undefined) {
      unimplemented('Firmware not supported')
      return undefined
    }

    ConnectionManager.onRead.add((message) => vehicle?.onIncomingMessage(message))
    ConnectionManager.onWrite.add((message) => vehicle?.onOutgoingMessage(message))

    VehicleFactory._vehicles.push(new WeakRef(vehicle))
    VehicleFactory.onVehicles.register_caller(this.vehicles)
    VehicleFactory.onVehicles.emit()
    return vehicle
  }

  /**
   * Build a vehicle based on the firmware and vehicle type, without connecting it to anything or registering it
   * @param {Vehicle.Firmware} firmware
   * @param {Vehicle.Type} type
   * @param {number} system_id - The system ID for the vehicle
   * @param {MAVLinkVehicleOptions} options - How the vehicle talks to the vehicle it stands for
   * @returns {Vehicle.Abstract | undefined}
   */
  static buildVehicle(
    firmware: Vehicle.Firmware,
    type: Vehicle.Type,
    system_id: number,
    options: MAVLinkVehicleOptions = {}
  ): Vehicle.Abstract | undefined {
    switch (firmware) {
      case Vehicle.Firmware.ArduPilot:
        return VehicleFactory.createArduPilotVehicle(type, system_id, options)
      case Vehicle.Firmware.PX4:
        return VehicleFactory.createPX4Vehicle(type, system_id, options)
      default:
        unimplemented('Firmware not supported')
    }
  }

  /**
   * Create ArduPilot vehicle based on the category
   * @param  {Vehicle.Type} type
   * @param  {number} system_id
   * @param  {MAVLinkVehicleOptions} options
   * @returns {Vehicle.Abstract | undefined}
   */
  static createArduPilotVehicle(
    type: Vehicle.Type,
    system_id: number,
    options: MAVLinkVehicleOptions = {}
  ): Vehicle.Abstract | undefined {
    switch (type) {
      case Vehicle.Type.Copter:
        return new ArduCopter(system_id, options)
      case Vehicle.Type.Plane:
        return new ArduPlane(system_id, options)
      case Vehicle.Type.Rover:
        return new ArduRover(system_id, options)
      case Vehicle.Type.Sub:
        return new ArduSub(system_id, options)
      default:
        unimplemented('Firmware not supported')
    }
  }

  /**
   * Create PX4 vehicle based on the category
   * @param {Vehicle.Type} type
   * @param {number} system_id
   * @param {MAVLinkVehicleOptions} options
   * @returns {Vehicle.Abstract | undefined}
   */
  static createPX4Vehicle(
    type: Vehicle.Type,
    system_id: number,
    options: MAVLinkVehicleOptions = {}
  ): Vehicle.Abstract | undefined {
    return new PX4(type, system_id, options)
  }

  /**
   * Return a list of vehicles available
   * @returns {WeakRef<Vehicle.Abstract>[]}
   */
  static vehicles(): WeakRef<Vehicle.Abstract>[] {
    // Be sure to remove vehicles that does not exist anymore
    VehicleFactory._vehicles = VehicleFactory._vehicles.filter((weakRef) => weakRef.deref() !== undefined)

    return VehicleFactory._vehicles
  }
}

/**
 * Create vehicle from message
 * @param {Uint8Array} message
 */
function createVehicleFromMessage(message: Uint8Array): void {
  // Remove from event as soon we have a single vehicle
  if (!VehicleFactory.vehicles().isEmpty()) {
    ConnectionManager.onRead.remove(createVehicleFromMessage)
    return
  }

  const textDecoder = new TextDecoder()
  const mavlink_message = JSON.parse(textDecoder.decode(message)) as Package
  const { system_id, component_id } = mavlink_message.header
  if (mavlink_message.message.type !== MAVLinkType.HEARTBEAT) {
    return
  }

  const heartbeat = mavlink_message.message as Message.Heartbeat
  if (heartbeat.autopilot.type === MavAutopilot.MAV_AUTOPILOT_INVALID) return
  const kind = vehicleKindFromHeartbeat(heartbeat, system_id, component_id)
  if (kind === undefined) return
  VehicleFactory.createVehicle(kind.firmware, kind.type, system_id)
}

/**
 * Firmware and type of a vehicle
 */
export interface VehicleKind {
  /**
   * Autopilot firmware the vehicle runs
   */
  firmware: Vehicle.Firmware
  /**
   * Kind of vehicle, which picks the vehicle class
   */
  type: Vehicle.Type
}

/**
 * Firmware and type of the vehicle a heartbeat announces
 * @param {Message.Heartbeat} heartbeat
 * @param {number} system_id
 * @param {number} component_id
 * @returns {VehicleKind | undefined} Undefined when Cockpit does not support it
 */
export function vehicleKindFromHeartbeat(
  heartbeat: Message.Heartbeat,
  system_id: number,
  component_id: number
): VehicleKind | undefined {
  switch (heartbeat.autopilot.type) {
    case MavAutopilot.MAV_AUTOPILOT_ARDUPILOTMEGA:
      return arduPilotVehicleKind(heartbeat, system_id, component_id)
    case MavAutopilot.MAV_AUTOPILOT_PX4:
      return { firmware: Vehicle.Firmware.PX4, type: Vehicle.Type.Copter }
    default:
      console.warn(`Vehicle not supported: ${system_id}/${component_id}: ${heartbeat.autopilot.type}`)
      return undefined
  }
}

/**
 * Kind of ArduPilot vehicle based on the heartbeat
 * @param {Message.Heartbeat} heartbeat
 * @param {number} system_id
 * @param {number} component_id
 * @returns {VehicleKind | undefined} Undefined when Cockpit does not support it
 */
function arduPilotVehicleKind(
  heartbeat: Message.Heartbeat,
  system_id: number,
  component_id: number
): VehicleKind | undefined {
  switch (heartbeat.mavtype.type) {
    case MavType.MAV_TYPE_SUBMARINE:
      return { firmware: Vehicle.Firmware.ArduPilot, type: Vehicle.Type.Sub }
    case MavType.MAV_TYPE_GROUND_ROVER:
    case MavType.MAV_TYPE_SURFACE_BOAT:
      return { firmware: Vehicle.Firmware.ArduPilot, type: Vehicle.Type.Rover }
    case MavType.MAV_TYPE_FLAPPING_WING:
    case MavType.MAV_TYPE_VTOL_TILTROTOR:
    case MavType.MAV_TYPE_VTOL_QUADROTOR:
    case MavType.MAV_TYPE_VTOL_DUOROTOR:
    case MavType.MAV_TYPE_FIXED_WING:
      return { firmware: Vehicle.Firmware.ArduPilot, type: Vehicle.Type.Plane }
    case MavType.MAV_TYPE_TRICOPTER:
    case MavType.MAV_TYPE_COAXIAL:
    case MavType.MAV_TYPE_HEXAROTOR:
    case MavType.MAV_TYPE_HELICOPTER:
    case MavType.MAV_TYPE_OCTOROTOR:
    case MavType.MAV_TYPE_DODECAROTOR:
    case MavType.MAV_TYPE_QUADROTOR:
      return { firmware: Vehicle.Firmware.ArduPilot, type: Vehicle.Type.Copter }
    default:
      console.warn(`ArduPilot vehicle type not supported: ${system_id}/${component_id}: ${heartbeat.mavtype.type}`)
      return undefined
  }
}

ConnectionManager.onRead.add(createVehicleFromMessage)
