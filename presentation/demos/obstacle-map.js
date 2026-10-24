// The obstacle-course map shared by the phone page and the console: satellite imagery, the boat with its no-go
// circle, and every obstacle the audience dropped. MapLibre comes from /vendor so its worker stays same-origin.
import { Map as MapLibreMap, Marker, NavigationControl } from '/vendor/maplibre/maplibre-gl.mjs'

const EARTH_RADIUS_M = 6371000

const satellite = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
}

/**
 * Distance between two positions, in meters.
 * @param {{lat: number, lon: number}} a - First position
 * @param {{lat: number, lon: number}} b - Second position
 * @returns {number} Great-circle distance
 */
export const distanceM = (a, b) => {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

const circlePolygon = ({ lat, lon }, radiusM) => {
  const ring = []
  for (let i = 0; i <= 48; i++) {
    const angle = (2 * Math.PI * i) / 48
    const north = radiusM * Math.cos(angle)
    const east = radiusM * Math.sin(angle)
    ring.push([
      lon + (east / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI),
      lat + (north / EARTH_RADIUS_M) * (180 / Math.PI),
    ])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
}

const boatElement = (size) => {
  const element = document.createElement('div')
  element.style.cssText = `width:${size}px;height:${size}px;filter:drop-shadow(0 0 4px rgba(0,0,0,.7))`
  element.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M12 2 L19 21 L12 17 L5 21 Z"
    fill="#4fa483" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`
  return element
}

/**
 * Builds the obstacle-course map in a container.
 * @param {HTMLElement} container - Where the map goes
 * @param {object} options - Options
 * @param {number} options.minDistance - Radius of the no-go circle around the boat, in meters
 * @param {boolean} [options.zoomButtons] - Whether to show zoom buttons
 * @param {(spot: {lat: number, lon: number}) => void} [options.onTap] - Called with where the map was tapped
 * @returns {{setVehicle: Function, setObstacles: Function, recenter: Function, resize: Function}} Controls
 */
export const createObstacleMap = (container, { minDistance, zoomButtons = false, onTap }) => {
  const map = new MapLibreMap({
    container,
    style: satellite,
    center: [-48.4525, -27.5935],
    zoom: 16,
    attributionControl: { compact: true },
    // Taps drop obstacles, so a double tap must not zoom: only dragging and pinching move the map.
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  })
  map.touchZoomRotate.disableRotation()
  if (zoomButtons) map.addControl(new NavigationControl({ showCompass: false }), 'top-left')

  let vehicle = null
  let obstacles = []
  let boat = null
  let follow = true
  let loaded = false

  const draw = () => {
    if (!loaded) return
    map.getSource('obstacles').setData({
      type: 'FeatureCollection',
      features: obstacles.map((o) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.lon, o.lat] }, properties: {} })),
    })
    if (!vehicle) return
    map.getSource('no-go').setData(circlePolygon(vehicle, minDistance))
    boat ??= new Marker({ element: boatElement(34), rotationAlignment: 'map' }).setLngLat([vehicle.lon, vehicle.lat]).addTo(map)
    boat.setLngLat([vehicle.lon, vehicle.lat]).setRotation(vehicle.hdg ?? 0)
  }

  map.on('load', () => {
    const empty = { type: 'FeatureCollection', features: [] }
    map.addSource('no-go', { type: 'geojson', data: empty })
    map.addSource('obstacles', { type: 'geojson', data: empty })
    map.addLayer({ id: 'no-go-fill', type: 'fill', source: 'no-go', paint: { 'fill-color': '#d2686a', 'fill-opacity': 0.15 } })
    map.addLayer({
      id: 'no-go-line',
      type: 'line',
      source: 'no-go',
      paint: { 'line-color': '#d2686a', 'line-width': 2, 'line-dasharray': [2, 2] },
    })
    map.addLayer({
      id: 'obstacles',
      type: 'circle',
      source: 'obstacles',
      paint: { 'circle-radius': 9, 'circle-color': '#d2686a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    })
    loaded = true
    draw()
  })
  // Panning by hand stops the map from following the boat until recenter() is called.
  map.on('dragstart', () => (follow = false))
  if (onTap) map.on('click', (event) => onTap({ lat: event.lngLat.lat, lon: event.lngLat.lng }))

  return {
    setVehicle(next) {
      if (!next) return
      const first = !vehicle
      vehicle = next
      draw()
      if (first) map.jumpTo({ center: [next.lon, next.lat], zoom: 17.5 })
      else if (follow) map.easeTo({ center: [next.lon, next.lat], duration: 250 })
    },
    setObstacles(list) {
      obstacles = list
      draw()
    },
    recenter() {
      follow = true
      if (vehicle) map.easeTo({ center: [vehicle.lon, vehicle.lat], zoom: Math.max(map.getZoom(), 17) })
    },
    resize: () => map.resize(),
  }
}
