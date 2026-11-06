import { describe, expect, it } from 'vitest'

import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { applyCruiseSpeedCommand } from '@/libs/mission/cruise-speed'
import { type MissionCommand, type Waypoint, AltitudeReferenceType, MissionCommandType } from '@/types/mission'

const command = (mavCmd: MavCmd, param2 = 0): MissionCommand => ({
  type: MissionCommandType.MAVLINK_NAV_COMMAND,
  command: mavCmd,
  param1: 1,
  param2,
  param3: -1,
  param4: 0,
})

const waypoint = (commands: MissionCommand[]): Waypoint => ({
  id: 'wp',
  coordinates: [0, 0],
  altitude: 0,
  altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
  commands,
})

describe('applyCruiseSpeedCommand', () => {
  it('replaces the speed command of the first planned item, leaving the home alone', () => {
    const home = waypoint([])
    const first = waypoint([command(MavCmd.MAV_CMD_NAV_WAYPOINT), command(MavCmd.MAV_CMD_DO_CHANGE_SPEED, 9)])
    applyCruiseSpeedCommand([home, first], 2)
    expect(home.commands).toEqual([])
    expect(first.commands.map((c) => [c.command, c.param2])).toEqual([
      [MavCmd.MAV_CMD_NAV_WAYPOINT, 0],
      [MavCmd.MAV_CMD_DO_CHANGE_SPEED, 2],
    ])
  })

  it('only drops a stale speed command when there is no speed to command', () => {
    const first = waypoint([command(MavCmd.MAV_CMD_DO_CHANGE_SPEED, 9)])
    applyCruiseSpeedCommand([waypoint([]), first], null)
    expect(first.commands).toEqual([])
  })

  it('does nothing to a mission with only its home', () => {
    const home = waypoint([])
    applyCruiseSpeedCommand([home], 2)
    expect(home.commands).toEqual([])
  })
})
