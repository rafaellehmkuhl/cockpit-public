// Writes the Cockpit settings file for the talk, to import from Settings → General → Manage Cockpit settings:
// the feed connection, the camera actions, two views (the sensor plotters, and the gimbal widget) and their
// indicators. The camera key goes into a data lake variable the actions read, so it never shows on screen.
//   node cockpit-settings.mjs <out.json> [server] [control key] [camera rtsp url] [boat mavlink url]
// The server defaults to the VPS; pass http://localhost:8765 and no key for the local fallback. With the camera's RTSP
// URL, the file also adds that stream and a view showing it beside the gimbal widget (Cockpit standalone only). With
// the boat's MAVLink URL, importing the file also connects Cockpit to the SITL boat.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [out, server = 'https://apdc2026.rlehmk.dev', controlKey = '', cameraRtspUrl = '', boatMavlinkUrl = ''] = process.argv.slice(2)
if (!out) throw new Error('usage: node cockpit-settings.mjs <out.json> [server] [control key] [camera rtsp url] [boat mavlink url]')
const cameraStreamName = 'Gimbal camera feed'
const feedUrl = server.replace(/^http/, 'ws')
const keyVariable = 'apdc-control-key'

// Stable ids, so importing the file again replaces what an earlier import made instead of adding to it.
const hashFor = (name) => {
  const h = createHash('sha1').update(`apdc2026:${name}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

// `view` keeps the ids unique when the same variable has an indicator on more than one view.
const indicator = (displayName, variableName, iconName, variableUnit, extra = {}, view = '') => ({
  hash: hashFor(`indicator:${view ? `${view}:` : ''}${variableName}`),
  component: 'VeryGenericIndicator',
  name: displayName,
  options: { displayName, variableName, iconName, variableUnit, variableMultiplier: 1, ...extra },
})
const viewSelector = (view) => ({ hash: hashFor(`view-selector:${view}`), component: 'ViewSelector', name: 'ViewSelector', options: {} })

const plotter = (name, variable, lineColor, y) => ({
  hash: hashFor(`plotter:${variable}`),
  component: 'Plotter',
  name,
  position: { x: 0.03, y },
  size: { width: 0.94, height: 0.27 },
  options: { dataLakeVariableId: variable, lineColor, lineThickness: 2, backgroundColor: 'rgba(10, 20, 22, 0.75)' },
})

const diyFile = (widget, part) =>
  readFileSync(new URL(`./diy-widget/${widget}.${part}`, import.meta.url), 'utf8').replace('https://apdc2026.rlehmk.dev', server)
// The widgets draw their own surface, so Cockpit's glass background stays off.
const diyOptions = (widget) => ({
  html: diyFile(widget, 'html'),
  css: diyFile(widget, 'css'),
  js: diyFile(widget, 'js'),
  scopedScript: true,
  inheritCockpitStyles: false,
})

// What the gimbal camera sees, streamed by the VPS, full screen, with the gimbal widget in the bottom-right corner.
// Positions are fractions of the screen; these keep the gimbal at least 30 px from the right edge and from the bottom
// bar on a window as small as 1425x867, and further on anything larger.
function cameraFeedView() {
  return {
    hash: hashFor('view:camera-feed'),
    name: 'Camera feed',
    showBottomBarOnBoot: true,
    visible: true,
    widgets: [
      // Earlier widgets are drawn on top, so the gimbal comes before the video it sits on.
      {
        hash: hashFor('diy:camera-feed'),
        component: 'DoItYourself',
        name: 'Gimbal camera',
        position: { x: 0.725, y: 0.65 },
        size: { width: 0.25, height: 0.25 },
        options: diyOptions('widget'),
      },
      {
        hash: hashFor('video:camera-feed'),
        component: 'VideoPlayer',
        name: 'Gimbal camera feed',
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 },
        options: { internalStreamName: cameraStreamName, videoFitStyle: 'cover' },
      },
    ],
    miniWidgetContainers: [
      { name: 'Bottom-left container', widgets: [viewSelector('camera-feed')] },
      {
        name: 'Bottom-center container',
        widgets: [
          indicator('Roll', 'external/camera/roll', 'mdi-horizontal-rotate-clockwise', '°', { decimalPlaces: 0 }, 'camera-feed'),
          indicator('Pitch', 'external/camera/pitch', 'mdi-arrow-up-down', '°', { decimalPlaces: 0 }, 'camera-feed'),
          indicator('Yaw', 'external/camera/yaw', 'mdi-compass-outline', '°', { decimalPlaces: 0 }, 'camera-feed'),
        ],
      },
      { name: 'Bottom-right container', widgets: [] },
    ],
  }
}

const views = [
  {
    hash: hashFor('view:sensors'),
    name: 'Payload sensors',
    showBottomBarOnBoot: true,
    visible: true,
    widgets: [
      plotter('Temperature', 'external/watertemp', 'rgba(232, 112, 96, 1)', 0.04),
      plotter('Salinity', 'external/salinity', 'rgba(86, 160, 230, 1)', 0.355),
      plotter('Luminosity', 'external/luminosity', 'rgba(232, 196, 84, 1)', 0.67),
    ],
    miniWidgetContainers: [
      { name: 'Bottom-left container', widgets: [viewSelector('sensors')] },
      {
        name: 'Bottom-center container',
        widgets: [
          indicator('Temperature', 'external/watertemp', 'mdi-thermometer', '°C', { decimalPlaces: 1 }),
          indicator('Salinity', 'external/salinity', 'mdi-water-opacity', 'PSU', { decimalPlaces: 1 }),
          indicator('Luminosity', 'external/luminosity', 'mdi-white-balance-sunny', 'lux', { decimalPlaces: 0 }),
        ],
      },
      { name: 'Bottom-right container', widgets: [] },
    ],
  },
  {
    hash: hashFor('view:gimbal'),
    name: 'Gimbal camera',
    showBottomBarOnBoot: true,
    visible: true,
    // Demo 2 drives the camera from Cockpit's actions and shows it on the payload console; the DIY widget that draws it
    // in Cockpit only arrives with demo 3, on the camera feed view.
    widgets: [],
    miniWidgetContainers: [
      { name: 'Bottom-left container', widgets: [viewSelector('gimbal')] },
      {
        name: 'Bottom-center container',
        widgets: [
          indicator('Roll', 'external/camera/roll', 'mdi-horizontal-rotate-clockwise', '°', { decimalPlaces: 0 }),
          indicator('Pitch', 'external/camera/pitch', 'mdi-arrow-up-down', '°', { decimalPlaces: 0 }),
          indicator('Yaw', 'external/camera/yaw', 'mdi-compass-outline', '°', { decimalPlaces: 0 }),
          indicator('Photos', 'external/camera/photos', 'mdi-camera', '', { decimalPlaces: 0 }),
          indicator('Recording', 'external/camera/recording', 'mdi-record-rec', '', { useStringVariable: true }),
        ],
      },
      { name: 'Bottom-right container', widgets: [] },
    ],
  },
  ...(cameraRtspUrl ? [cameraFeedView()] : []),
  {
    hash: hashFor('view:obstacle-run'),
    name: 'Obstacle run',
    showBottomBarOnBoot: true,
    visible: true,
    widgets: [
      {
        hash: hashFor('diy:obstacle-run'),
        component: 'DoItYourself',
        name: 'Obstacle run',
        position: { x: 0.74, y: 0.03 },
        size: { width: 0.24, height: 0.3 },
        options: diyOptions('obstacle-run'),
      },
      {
        hash: hashFor('map:obstacle-run'),
        component: 'Map',
        name: 'Map',
        position: { x: 0, y: 0 },
        size: { width: 1, height: 1 },
        options: {},
      },
    ],
    miniWidgetContainers: [
      { name: 'Bottom-left container', widgets: [viewSelector('obstacle-run')] },
      {
        name: 'Bottom-center container',
        widgets: [{ hash: hashFor('armer:obstacle-run'), component: 'ArmerButton', name: 'ArmerButton', options: {} }],
      },
      { name: 'Bottom-right container', widgets: [] },
    ],
  },
]

const camera = (path) => `${server}/camera/${path}`
const headers = controlKey ? { 'x-control-key': `{{ ${keyVariable} }}` } : {}
const action = (name, method, url, urlParams = {}) => [`http-request-action (${name})`, { name, url, method, headers, urlParams, body: '' }]

// Every camera command exists over HTTP and over MAVLink. The buttons and the joystick run a JavaScript action that
// picks one by the switch in the gimbal widget, which sets this data lake variable.
const protocolVariable = 'apdc-camera-protocol'
const targetVariable = (axis) => `apdc-gimbal-target-${axis}`
const targetAtVariable = 'apdc-gimbal-target-at'
// MAVLink commands go to the camera's component id, which the demo server answers and the autopilot ignores.
const MAVLINK_CAMERA_COMPONENT = 100
const field = (value) => ({ type: 'number', value: String(value) })
const commandLong = (name, command, params) => [
  `mavlink-message-action (${name})`,
  {
    name,
    messageType: 'COMMAND_LONG',
    messageConfig: {
      target_system: field(1),
      target_component: field(MAVLINK_CAMERA_COMPONENT),
      command: { type: 'type_struct_enum', value: command },
      confirmation: field(0),
      ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`param${i + 1}`, field(params[i] ?? 0)])),
    },
  },
]
const mavlinkActions = Object.fromEntries([
  // MAV_MOUNT_MODE_MAVLINK_TARGETING (2), with pitch, roll and yaw in degrees.
  commandLong('MAVLink · Gimbal: point', 'MAV_CMD_DO_MOUNT_CONTROL', [
    `{{ ${targetVariable('pitch')} }}`, `{{ ${targetVariable('roll')} }}`, `{{ ${targetVariable('yaw')} }}`, 0, 0, 0, 2,
  ]),
  commandLong('MAVLink · Camera: take a photo', 'MAV_CMD_IMAGE_START_CAPTURE', [0, 0, 1]),
  commandLong('MAVLink · Camera: start recording', 'MAV_CMD_VIDEO_START_CAPTURE', [0, 0]),
  commandLong('MAVLink · Camera: stop recording', 'MAV_CMD_VIDEO_STOP_CAPTURE', [0]),
])

// MAVLink points the gimbal at absolute angles, so a step adds to the target sent just before, or else to where the
// camera points now, which keeps quick presses adding up before the camera's new state comes back on the feed.
const pointOverMavlink = (change) => `  const recent = Date.now() - (Number(cockpit.getDataLakeVariableData('${targetAtVariable}')) || 0) < 1500
  const base = (axis) => Number(cockpit.getDataLakeVariableData(recent ? \`apdc-gimbal-target-\${axis}\` : \`external/camera/\${axis}\`)) || 0
  const target = { roll: base('roll'), pitch: base('pitch'), yaw: base('yaw') }
  ${change}
  target.roll = Math.max(-45, Math.min(45, target.roll))
  target.pitch = Math.max(-90, Math.min(30, target.pitch))
  for (const axis of ['roll', 'pitch', 'yaw']) cockpit.setDataLakeVariableData(\`apdc-gimbal-target-\${axis}\`, target[axis])
  cockpit.setDataLakeVariableData('${targetAtVariable}', Date.now())
  cockpit.executeActionCallback('mavlink-message-action (MAVLink · Gimbal: point)')`
const runMavlink = (name) => `  cockpit.executeActionCallback('mavlink-message-action (MAVLink · ${name})')`
const set = (attitude) => `Object.assign(target, ${JSON.stringify(attitude)})`
const add = (axis, degrees) => `target.${axis} += ${degrees}`

// name, its HTTP endpoint and parameters, and what the MAVLink path does.
const cameraCommands = [
  ['Gimbal: look ahead', 'GET', 'attitude', { roll: '0', pitch: '0', yaw: '0' }, pointOverMavlink(set({ roll: 0, pitch: 0, yaw: 0 }))],
  ['Gimbal: look down and right', 'GET', 'attitude', { pitch: '-45', yaw: '90' }, pointOverMavlink(set({ pitch: -45, yaw: 90 }))],
  ['Gimbal: look left', 'GET', 'attitude', { pitch: '-15', yaw: '-90' }, pointOverMavlink(set({ pitch: -15, yaw: -90 }))],
  ['Gimbal: tilt', 'GET', 'attitude', { roll: '20' }, pointOverMavlink(set({ roll: 20 }))],
  // Small steps from wherever the camera points: yaw right is positive, pitch up is positive.
  ['Gimbal: step up', 'GET', 'move', { pitch: '5' }, pointOverMavlink(add('pitch', 5))],
  ['Gimbal: step down', 'GET', 'move', { pitch: '-5' }, pointOverMavlink(add('pitch', -5))],
  ['Gimbal: step left', 'GET', 'move', { yaw: '-5' }, pointOverMavlink(add('yaw', -5))],
  ['Gimbal: step right', 'GET', 'move', { yaw: '5' }, pointOverMavlink(add('yaw', 5))],
  // Straight at the DevCon logo floating in the camera's world (camera-world.html).
  ['Gimbal: look at the logo', 'GET', 'attitude', { roll: '0', pitch: '10', yaw: '-35' }, pointOverMavlink(set({ roll: 0, pitch: 10, yaw: -35 }))],
  ['Camera: take a photo', 'POST', 'photo', {}, runMavlink('Camera: take a photo')],
  ['Camera: start recording', 'POST', 'record/start', {}, runMavlink('Camera: start recording')],
  ['Camera: stop recording', 'POST', 'record/stop', {}, runMavlink('Camera: stop recording')],
]
const actions = Object.fromEntries(
  cameraCommands.map(([name, method, path, params]) => action(`HTTP · ${name}`, method, camera(path), params))
)
const javascriptActions = Object.fromEntries(
  cameraCommands.map(([name, , , , overMavlink]) => [
    `javascript-action (${name})`,
    {
      name,
      code: `// Sent over whichever protocol the switch in the gimbal widget picks.
if (cockpit.getDataLakeVariableData('${protocolVariable}') === 'mavlink') {
${overMavlink}
} else {
  cockpit.executeActionCallback('http-request-action (HTTP · ${name})')
}
`,
    },
  ])
)

// The 8BitDo Ultimate 2C reports the standard gamepad layout, so these are its buttons as Cockpit numbers them.
const cockpitAction = (id, name) => ({ action: { protocol: 'cockpit-action', id, name } })
const cameraAction = (name) => cockpitAction(`javascript-action (${name})`, name)
const roverMode = (mode) => cockpitAction(`ardupilot_rover_mode_${mode.toLowerCase()}`, `${mode[0]}${mode.slice(1).toLowerCase()} Mode (ArduPilot Rover)`)
const noFunction = { action: { protocol: 'other', id: 'no_function', name: 'No function' } }
const axis = (name, min, max) => ({ action: { protocol: 'data-lake-variable', id: `inputs/mavlink/axis-${name}`, name: `Axis ${name.toUpperCase()}` }, min, max })
const buttons = (assigned) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, assigned[i] ?? noFunction]))
const joystickMapping = {
  name: 'APDC 2026 · 8BitDo Ultimate 2C',
  hash: hashFor('joystick:8bitdo'),
  // ArduRover drives from MANUAL_CONTROL's y (steering) and z (throttle) only, so both go on the left stick, like an RC
  // car: up and down for throttle, sideways to turn. Cockpit's boat default put throttle on the right stick and the
  // left stick's vertical on x, which Rover ignores, so pushing the left stick forward only turned the boat.
  axesCorrespondencies: {
    0: axis('y', -1000, 1000),
    1: axis('z', 1000, -1000),
    2: { ...noFunction, min: -1000, max: 1000 },
    3: { ...noFunction, min: -1000, max: 1000 },
  },
  buttonsCorrespondencies: {
    regular: buttons({
      0: cameraAction('Camera: take a photo'), // A
      1: roverMode('MANUAL'), // B
      2: cameraAction('Camera: start recording'), // X
      3: cameraAction('Camera: stop recording'), // Y
      4: cockpitAction('go_to_previous_view', 'Go to previous view'), // LB
      5: cockpitAction('go_to_next_view', 'Go to next view'), // RB
      6: roverMode('HOLD'), // LT
      7: cockpitAction('apdc-obstacle-run-start', 'Obstacle run: start'), // RT
      8: cockpitAction('mavlink_disarm', 'Mavlink disarm'), // select
      9: cockpitAction('mavlink_arm', 'Mavlink arm'), // start
      10: cockpitAction('apdc-obstacle-run-reset', 'Obstacle run: reset'), // left stick click
      11: cameraAction('Gimbal: look at the logo'), // right stick click
      // The d-pad steps the gimbal 5° at a time; the presets stay in the actions menu.
      12: cameraAction('Gimbal: step up'), // d-pad up
      13: cameraAction('Gimbal: step down'), // d-pad down
      14: cameraAction('Gimbal: step left'), // d-pad left
      15: cameraAction('Gimbal: step right'), // d-pad right
      16: cameraAction('Gimbal: look ahead'), // home
    }),
    shift: buttons({}),
  },
}

const settings = {
  // Kept on this computer rather than synced, so the presentation build's importer writes these to local storage.
  'this-computer': {
    // No BlueOS answers at localhost, so the vehicle sync gives up at once instead of after minutes, and the points of
    // interest from the phones are accepted as soon as the boat connects.
    'cockpit-vehicle-address': 'localhost',
    'cockpit-prevent-auto-vehicle-discovery-dialog': true,
    ...(boatMavlinkUrl ? { 'cockpit-vehicle-custom-main-connection-uri': { data: boatMavlinkUrl, enabled: true } } : {}),
  },
  ...(cameraRtspUrl
    ? { 'cockpit-streams-correspondency': [{ name: cameraStreamName, externalId: cameraRtspUrl, protocol: 'rtsp', rtspUrl: cameraRtspUrl }] }
    : {}),
  'cockpit-joystick-functions-mapping-v1': joystickMapping,
  'cockpit-generic-websocket-connections': [feedUrl],
  'cockpit-http-request-actions': actions,
  'cockpit-mavlink-message-actions': mavlinkActions,
  'cockpit-javascript-actions': javascriptActions,
  'cockpit-views-group-v1': { hash: hashFor('profile'), name: 'APDC 2026', views },
  'cockpit-current-view-index-v1': 0,
  // The obstacles sit tens of metres from the boat, so the map opens close in on the SITL's home and keeps up with it.
  'cockpit-user-last-map-center': [-27.5935, -48.4525],
  'cockpit-user-last-map-zoom': 18,
  'cockpit-map-follow-vehicle': true,
  // Nothing should pop up on stage: neither the offer of the vehicle's default views nor the tutorial, nor the splash screen.
  'cockpit-show-splash-screen-on-startup': false,
  'cockpit-vehicle-defaults-handled': true,
  'cockpit-has-seen-tutorial': true,
  'cockpit-persistent-data-lake-variables': [
    ...(controlKey
      ? [
          {
            id: keyVariable,
            name: 'APDC demo server key',
            type: 'string',
            description: 'Sent as x-control-key by the camera actions, so only this Cockpit drives the demo camera.',
            persistent: true,
            persistValue: true,
          },
        ]
      : []),
    {
      id: protocolVariable,
      name: 'Camera protocol',
      type: 'string',
      description: "Which protocol the camera actions use, 'http' or 'mavlink'; the gimbal widget's switch sets it.",
      persistent: true,
      persistValue: true,
    },
    ...['pitch', 'roll', 'yaw'].map((axis) => ({
      id: targetVariable(axis),
      name: `Gimbal target ${axis}`,
      type: 'number',
      description: `The ${axis} the MAVLink gimbal command sends, in degrees.`,
      persistent: true,
      persistValue: false,
    })),
    {
      id: targetAtVariable,
      name: 'Gimbal target time',
      type: 'number',
      description: 'When the last MAVLink gimbal target was set, so quick steps add up.',
      persistent: true,
      persistValue: false,
    },
  ],
  'cockpit-persistent-data-lake-values': { ...(controlKey ? { [keyVariable]: controlKey } : {}), [protocolVariable]: 'http' },
}
writeFileSync(out, JSON.stringify(settings, null, 2) + '\n')
console.log(`Wrote ${out} for ${server}${controlKey ? ', with the control key' : ''}`)
