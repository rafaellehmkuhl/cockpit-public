// Writes the Cockpit settings file for the talk, to import from Settings → General → Manage Cockpit settings:
// the feed connection, the camera actions, two views (the sensor plotters, and the gimbal widget) and their
// indicators. The camera key goes into a data lake variable the actions read, so it never shows on screen.
//   node cockpit-settings.mjs <out.json> [server] [control key]
// The server defaults to the VPS; pass http://localhost:8765 and no key for the local fallback.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [out, server = 'https://apdc2026.rlehmk.dev', controlKey = ''] = process.argv.slice(2)
if (!out) throw new Error('usage: node cockpit-settings.mjs <out.json> [server] [control key]')
const feedUrl = server.replace(/^http/, 'ws')
const keyVariable = 'apdc-control-key'

// Stable ids, so importing the file again replaces what an earlier import made instead of adding to it.
const hashFor = (name) => {
  const h = createHash('sha1').update(`apdc2026:${name}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

const indicator = (displayName, variableName, iconName, variableUnit, extra = {}) => ({
  hash: hashFor(`indicator:${variableName}`),
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
    widgets: [
      {
        hash: hashFor('diy:gimbal'),
        component: 'DoItYourself',
        name: 'Gimbal camera',
        position: { x: 0.2, y: 0.08 },
        size: { width: 0.6, height: 0.84 },
        options: diyOptions('widget'),
      },
    ],
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
      { name: 'Bottom-center container', widgets: [] },
      { name: 'Bottom-right container', widgets: [] },
    ],
  },
]

const camera = (path) => `${server}/camera/${path}`
const headers = controlKey ? { 'x-control-key': `{{ ${keyVariable} }}` } : {}
const action = (name, method, url, urlParams = {}) => [`http-request-action (${name})`, { name, url, method, headers, urlParams, body: '' }]
const actions = Object.fromEntries([
  action('Gimbal: look ahead', 'GET', camera('attitude'), { roll: '0', pitch: '0', yaw: '0' }),
  action('Gimbal: look down and right', 'GET', camera('attitude'), { pitch: '-45', yaw: '90' }),
  action('Gimbal: look left', 'GET', camera('attitude'), { pitch: '-15', yaw: '-90' }),
  action('Gimbal: tilt', 'GET', camera('attitude'), { roll: '20' }),
  action('Camera: take a photo', 'POST', camera('photo')),
  action('Camera: start recording', 'POST', camera('record/start')),
  action('Camera: stop recording', 'POST', camera('record/stop')),
])

const settings = {
  'cockpit-generic-websocket-connections': [feedUrl],
  'cockpit-http-request-actions': actions,
  'cockpit-views-group-v1': { hash: hashFor('profile'), name: 'APDC 2026', views },
  'cockpit-current-view-index-v1': 0,
  // The obstacles sit tens of metres from the boat, so the map opens close in on the SITL's home and keeps up with it.
  'cockpit-user-last-map-center': [-27.5935, -48.4525],
  'cockpit-user-last-map-zoom': 18,
  'cockpit-map-follow-vehicle': true,
  // Nothing should pop up on stage: neither the offer of the vehicle's default views nor the tutorial.
  'cockpit-vehicle-defaults-handled': true,
  'cockpit-has-seen-tutorial': true,
  ...(controlKey && {
    'cockpit-persistent-data-lake-variables': [
      {
        id: keyVariable,
        name: 'APDC demo server key',
        type: 'string',
        description: 'Sent as x-control-key by the camera actions, so only this Cockpit drives the demo camera.',
        persistent: true,
        persistValue: true,
      },
    ],
    'cockpit-persistent-data-lake-values': { [keyVariable]: controlKey },
  }),
}
writeFileSync(out, JSON.stringify(settings, null, 2) + '\n')
console.log(`Wrote ${out} for ${server}${controlKey ? ', with the control key' : ''}`)
