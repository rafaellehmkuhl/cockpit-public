import * as Connection from '@/libs/connection/connection'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'

import { setGenericVariable } from './cockpit-basics'
import { Package } from './connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from './connection/m2r/messages/mavlink2rest-enum'
import { WebSocketConnection } from './connection/websocket-connection'
import { Type } from './vehicle/protocol/protocol'

export type MavlinkConnection = {
  /**
   * An human-readable name identifier for the connection.
   */
  name: string
  /**
   * The URI of the MAVLink2REST server endpoint.
   */
  address: Connection.URI
}
export const mavlinkConnections: MavlinkConnection[] = []

const onMessage = (connectionName: string, message: Uint8Array): void => {
  if (!connectionName) {
    throw new Error('A connection name is required.')
  }

  const textDecoder = new TextDecoder()
  let mavlink_message: Package
  const text_message = textDecoder.decode(message)
  try {
    mavlink_message = JSON.parse(text_message) as Package
  } catch (error) {
    const pattern = /Ok\((\d+)\)/
    const match = pattern.exec(text_message)
    if (match) return
    console.error(`Failed to parse mavlink message: ${text_message}`)
    return
  }

  if (mavlink_message.message.type === MAVLinkType.AHRS2) {
    const ahrsMessage = mavlink_message.message as Message.Ahrs2
    setGenericVariable(`/${connectionName}/ahrs2/altitude`, ahrsMessage.altitude, ['altitude', 'depth', 'position'])
    setGenericVariable(`/${connectionName}/ahrs2/latitude`, ahrsMessage.lat, ['position', 'distance'])
    setGenericVariable(`/${connectionName}/ahrs2/pitch`, ahrsMessage.pitch, ['angle', 'pitch', 'orientation'])
    setGenericVariable(`/${connectionName}/ahrs2/yaw`, ahrsMessage.yaw, ['angle', 'yaw', 'heading', 'orientation'])
  }

  if (mavlink_message.message.type === MAVLinkType.VFR_HUD) {
    const vfrHudMessage = mavlink_message.message as Message.VfrHud
    setGenericVariable(`/${connectionName}/vfrHud/alt`, vfrHudMessage.alt, ['altitude', 'depth'])
    setGenericVariable(`/${connectionName}/vfrHud/heading`, vfrHudMessage.heading, [
      'angle',
      'yaw',
      'heading',
      'orientation',
    ])
  }
}

export const createMavlinkConnection = (name: string, uri: Connection.URI): void => {
  const connection = new WebSocketConnection(uri, Type.MAVLink2Rest)
  connection.onRead.add((message) => onMessage(name, message))
  mavlinkConnections.push({ name, address: uri })
}

createMavlinkConnection('main-vehicle', new Connection.URI('ws://main-vehicle.local/mavlink2rest/ws/mavlink'))
