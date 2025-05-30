<template>
  <div ref="mapBase" class="page-base" :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
    <div :id="mapId" ref="map" class="map">
      <v-tooltip location="top" :text="centerHomeButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            v-bind="tooltipProps"
            class="absolute right-[166px] m-3 bottom-button bg-slate-50"
            :class="!home ? 'active-events-on-disabled' : ''"
            :color="followerTarget == WhoToFollow.HOME ? 'red' : ''"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-home-map-marker"
            size="x-small"
            :disabled="!home"
            @click.stop="targetFollower.goToTarget(WhoToFollow.HOME, true)"
            @dblclick.stop="targetFollower.follow(WhoToFollow.HOME)"
          />
        </template>
      </v-tooltip>

      <v-tooltip location="top" :text="centerVehicleButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            v-bind="tooltipProps"
            class="absolute m-3 bottom-button right-[124px] bg-slate-50"
            :class="!vehiclePosition ? 'active-events-on-disabled' : ''"
            :color="followerTarget == WhoToFollow.VEHICLE ? 'red' : ''"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-airplane-marker"
            size="x-small"
            :disabled="!vehiclePosition"
            @click.stop="targetFollower.goToTarget(WhoToFollow.VEHICLE, true)"
            @dblclick.stop="targetFollower.follow(WhoToFollow.VEHICLE)"
          />
        </template>
      </v-tooltip>

      <v-tooltip location="top" :text="vehicleDownloadMissionButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            v-bind="tooltipProps"
            class="absolute m-3 bottom-button right-[82px] bg-slate-50"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            :disabled="!vehicleStore.isVehicleOnline"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-download"
            size="x-small"
            @click.stop="downloadMissionFromVehicle"
          />
        </template>
      </v-tooltip>
      <v-tooltip location="top" :text="vehicleExecuteMissionButtonTooltipText">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-if="showButtons"
            v-bind="tooltipProps"
            class="absolute mb-3 ml-1 bottom-button right-[52px] bg-slate-50"
            :class="!vehicleStore.isVehicleOnline ? 'active-events-on-disabled' : ''"
            :disabled="!vehicleStore.isVehicleOnline"
            elevation="2"
            style="z-index: 1002; border-radius: 0px"
            icon="mdi-play"
            size="x-small"
            @click.stop="executeMissionOnVehicle"
          />
        </template>
      </v-tooltip>
    </div>
  </div>

  <div v-if="showContextMenu" class="context-menu" :style="{ top: menuPosition.top, left: menuPosition.left }">
    <ul @click.stop="">
      <li @click="onMenuOptionSelect('goto')">GoTo</li>
      <li @click="onMenuOptionSelect('set-default-map-position')">Set default map position</li>
      <li @click="onMenuOptionSelect('place-poi')">Place point of interest</li>
    </ul>
  </div>

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">Map widget settings</v-card-title>
      <v-card-text>
        <v-switch
          v-model="widget.options.showVehiclePath"
          class="my-1"
          label="Show vehicle path"
          :color="widget.options.showVehiclePath ? 'white' : undefined"
          hide-details
        />
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-progress-linear
    v-if="fetchingMission"
    :model-value="missionFetchProgress"
    height="10"
    absolute
    bottom
    color="white"
    :style="`top: ${topProgressBarDisplacement}`"
  />
  <p
    v-if="fetchingMission"
    :style="{ top: topProgressBarDisplacement }"
    class="absolute left-[7px] mt-4 flex text-md font-bold text-white z-30 drop-shadow-md"
  >
    Loading mission...
  </p>

  <PoiManager ref="poiManagerMapWidgetRef" />
</template>

<script setup lang="ts">
import { useElementHover, useRefHistory } from '@vueuse/core'
import { formatDistanceToNow } from 'date-fns'
import L, { type LatLngTuple, Map } from 'leaflet'
import {
  type InstanceType,
  type Ref,
  computed,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRefs,
  watch,
} from 'vue'

import blueboatMarkerImage from '@/assets/blueboat-marker.png'
import brov2MarkerImage from '@/assets/brov2-marker.png'
import genericVehicleMarkerImage from '@/assets/generic-vehicle-marker.png'
import PoiManager from '@/components/poi/PoiManager.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees } from '@/libs/utils'
import { TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { PointOfInterest, WaypointCoordinates } from '@/types/mission'
import type { Widget } from '@/types/widgets'

// Define widget props
// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{ widget: Widget }>()
const widget = toRefs(props).widget
const interfaceStore = useAppInterfaceStore()
const { showDialog } = useInteractionDialog()

// Instantiate the necessary stores
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()

// Declare the general variables
const map: Ref<Map | undefined> = ref()
const zoom = ref(missionStore.defaultMapZoom)
const mapCenter = ref<WaypointCoordinates>(missionStore.defaultMapCenter)
const home = ref()
const mapId = computed(() => `map-${widget.value.hash}`)
const showButtons = ref(false)

const poiManagerMapWidgetRef = ref<InstanceType<typeof PoiManager> | null>(null)
const mapWidgetPoiMarkers = ref<{ [id: string]: L.Marker }>({})

// Register the usage of the coordinate variables for logging
datalogger.registerUsage(DatalogVariable.latitude)
datalogger.registerUsage(DatalogVariable.longitude)

// Before mounting:
// - set initial widget options if they don't exist
// - enable auto update for target follower
onBeforeMount(() => {
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showVehiclePath: true,
    }
  }
  targetFollower.enableAutoUpdate()
})

// Configure the available map tile providers
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 23,
  maxNativeZoom: 19,
  attribution: '© OpenStreetMap',
})

const esri = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© Esri World Imagery',
  }
)

// Overlays
const seamarks = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenSeaMap contributors',
})

const marineProfile = L.tileLayer.wms('https://geoserver.openseamap.org/geoserver/gwc/service/wms', {
  layers: 'gebco2021:gebco_2021',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  attribution: '© GEBCO, OpenSeaMap',
  tileSize: 256,
  maxZoom: 19,
})

const baseMaps = {
  'OpenStreetMap': osm,
  'Esri World Imagery': esri,
}

const overlays = {
  'Seamarks': seamarks,
  'Marine Profile': marineProfile,
}

// Show buttons when the mouse is over the widget
const mapBase = ref<HTMLElement>()
const isMouseOver = useElementHover(mapBase)

const zoomControl = L.control.zoom({ position: 'bottomright' })
const layerControl = L.control.layers(baseMaps, overlays)

watch(showButtons, () => {
  if (map.value === undefined) return
  if (showButtons.value) {
    map.value.addControl(zoomControl)
    map.value.addControl(layerControl)
  } else {
    map.value.removeControl(zoomControl)
    map.value.removeControl(layerControl)
  }
})

watch(isMouseOver, () => {
  showButtons.value = isMouseOver.value
})

onMounted(async () => {
  // Bind leaflet instance to map element
  map.value = L.map(mapId.value, {
    layers: [osm, esri, seamarks, marineProfile],
    attributionControl: false,
  }).setView(mapCenter.value as LatLngTuple, zoom.value) as Map

  // Remove default zoom control
  map.value.removeControl(map.value.zoomControl)

  // Update center value after panning
  map.value.on('moveend', () => {
    if (map.value === undefined) return
    let { lat, lng } = map.value.getCenter()
    if (lat && lng) {
      mapCenter.value = [lat, lng]
    }
  })

  // Update zoom value after zooming
  map.value.on('zoomend', () => {
    if (map.value === undefined) return
    zoom.value = map.value?.getZoom() ?? mapCenter.value
  })

  // Add click event listener to the map
  map.value.on('click', () => {
    if (map.value === undefined) return
    map.value.on('click', onMapClick)
  })

  // Add context menu event listener to the map
  map.value.on('contextmenu', () => {
    hideContextMenuAndMarker()
  })

  // Enable auto update for target follower
  targetFollower.enableAutoUpdate()

  window.addEventListener('keydown', onKeydown)

  // Pan map to vehicle on mounting if it's position is available, otherwise pan to home
  if (vehiclePosition.value) {
    targetFollower.goToTarget(WhoToFollow.VEHICLE)
  } else {
    targetFollower.goToTarget(WhoToFollow.HOME)
  }
})

// Before unmounting:
// - disable auto update for target follower
// - remove event listeners
onBeforeUnmount(() => {
  targetFollower.disableAutoUpdate()
  window.removeEventListener('keydown', onKeydown)

  if (map.value) {
    map.value.off('click', onMapClick)
    map.value.off('contextmenu')
    // Clean up POI markers
    Object.values(mapWidgetPoiMarkers.value).forEach((marker) => marker.remove())
    mapWidgetPoiMarkers.value = {}
  }
})

// Pan when variables change
watch(mapCenter, (newCenter, oldCenter) => {
  if (newCenter.toString() === oldCenter.toString()) return
  map.value?.panTo(newCenter as LatLngTuple)

  // Update the tooltip content of the home marker
  homeMarker.value?.getTooltip()?.setContent(`Home: ${newCenter[0].toFixed(6)}, ${newCenter[1].toFixed(6)}`)
})

// Keep map binded
watch(map, (newMap, oldMap) => {
  if (map.value === undefined) return
  if (newMap?.options !== undefined) return

  map.value = oldMap
})

// Zoom when the variable changes
watch(zoom, (newZoom, oldZoom) => {
  if (newZoom === oldZoom) return
  map.value?.setZoom(zoom.value)
})

// Re-render the map when the widget changes
watch(props.widget, () => {
  map.value?.invalidateSize()
})

// Allow following a given target
const followerTarget = ref<WhoToFollow | undefined>(undefined)
const targetFollower = new TargetFollower(
  (newTarget: WhoToFollow | undefined) => (followerTarget.value = newTarget),
  (newCenter: WaypointCoordinates) => (mapCenter.value = newCenter)
)
targetFollower.setTrackableTarget(WhoToFollow.VEHICLE, () => vehiclePosition.value)
targetFollower.setTrackableTarget(WhoToFollow.HOME, () => home.value)

// Calculate live vehicle position
const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude
    ? ([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude] as WaypointCoordinates)
    : undefined
)

// Calculate live vehicle heading
const vehicleHeading = computed(() => (vehicleStore.attitude.yaw ? degrees(vehicleStore.attitude?.yaw) : 0))

// Calculate time since last vehicle heartbeat
const timeAgoSeenText = computed(() => {
  const lastBeat = vehicleStore.lastHeartbeat
  return lastBeat ? `${formatDistanceToNow(lastBeat ?? 0, { includeSeconds: true })} ago` : 'never'
})

// Save vehicle position history
const { history: vehiclePositionHistory } = useRefHistory(vehiclePosition)

// Update home position when location is available
// Try to update home position based on browser geolocation
navigator?.geolocation?.watchPosition(
  (position) => (home.value = [position.coords.latitude, position.coords.longitude]),
  (error) => console.error(`Failed to get position: (${error.code}) ${error.message}`),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
)

// If home position is updated and map was not yet centered on it, center
let mapNotYetCenteredInHome = true
watch([home, map], async () => {
  if (home.value === mapCenter.value || !map.value || !mapNotYetCenteredInHome) return
  targetFollower.goToTarget(WhoToFollow.HOME)
  mapNotYetCenteredInHome = false
})

// Create marker for the vehicle
const vehicleMarker = ref<L.Marker>()
watch(vehicleStore.coordinates, () => {
  if (!map.value || !vehiclePosition.value) return

  if (vehicleMarker.value === undefined) {
    let vehicleIconUrl = genericVehicleMarkerImage

    if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
      vehicleIconUrl = blueboatMarkerImage
    } else if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) {
      vehicleIconUrl = brov2MarkerImage
    }

    const vehicleMarkerIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `<img src="${vehicleIconUrl}" style="width: 64px; height: 64px;">`,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    })

    vehicleMarker.value = L.marker(vehiclePosition.value, { icon: vehicleMarkerIcon })

    const vehicleMarkerTooltip = L.tooltip({
      content: 'No data available',
      className: 'waypoint-tooltip',
      offset: [40, 0],
    })
    vehicleMarker.value.bindTooltip(vehicleMarkerTooltip)
    map.value.addLayer(vehicleMarker.value)
  }
  vehicleMarker.value.setLatLng(vehiclePosition.value)
})

// If vehicle position was not available and now it is, start following it
watch(vehiclePosition, (_, oldPosition) => {
  if (followerTarget.value === WhoToFollow.VEHICLE || oldPosition !== undefined) return
  targetFollower.follow(WhoToFollow.VEHICLE)
})

// Dinamically update data of the vehicle tooltip
watch([vehiclePosition, vehicleHeading, timeAgoSeenText, () => vehicleStore.isArmed], () => {
  if (vehicleMarker.value === undefined) return

  vehicleMarker.value.getTooltip()?.setContent(`
    <p>Coordinates: ${vehiclePosition.value?.[0].toFixed(6)}, ${vehiclePosition.value?.[1].toFixed(6)}</p>
    <p>Velocity: ${vehicleStore.velocity.ground?.toFixed(2) ?? 'N/A'} m/s</p>
    <p>Heading: ${vehicleHeading.value.toFixed(2)}°</p>
    <p>${vehicleStore.isArmed ? 'Armed' : 'Disarmed'}</p>
    <p>Last seen: ${timeAgoSeenText.value}</p>
  `)

  // Update the rotation
  const iconElement = vehicleMarker.value.getElement()?.querySelector('img')
  if (iconElement) {
    iconElement.style.transform = `rotate(${vehicleHeading.value}deg)`
  }
})

// Create marker for the home position
const homeMarker = ref<L.Marker>()
watch(home, () => {
  if (map.value === undefined) return

  const position = home.value
  if (position === undefined) return

  if (homeMarker.value === undefined) {
    homeMarker.value = L.marker(position as LatLngTuple)
    const homeMarkerIcon = L.divIcon({ className: 'marker-icon', iconSize: [32, 32], iconAnchor: [16, 16], html: 'H' })
    homeMarker.value.setIcon(homeMarkerIcon)
    const homeMarkerTooltip = L.tooltip({ content: 'No data available', className: 'waypoint-tooltip' })
    homeMarker.value.bindTooltip(homeMarkerTooltip)
    map.value.addLayer(homeMarker.value)
  }
  homeMarker.value.setLatLng(home.value)
})

// Create polyline for the vehicle path
const missionWaypointsPolyline = ref()
watch(missionStore.currentPlanningWaypoints, (newWaypoints) => {
  if (map.value === undefined) return
  if (missionWaypointsPolyline.value === undefined) {
    const coordinates = newWaypoints.map((w) => w.coordinates)
    missionWaypointsPolyline.value = L.polyline(coordinates, { color: '#358AC3' }).addTo(map.value)
  }
  missionWaypointsPolyline.value.setLatLngs(newWaypoints.map((w) => w.coordinates))

  // Add a marker for each point
  newWaypoints.forEach((waypoint, idx) => {
    const marker = L.marker(waypoint.coordinates)
    const markerIcon = L.divIcon({ className: 'marker-icon', iconSize: [32, 32], iconAnchor: [16, 16], html: `${idx}` })
    marker.setIcon(markerIcon)
    map.value?.addLayer(marker)
  })
})

// Create polyline for the vehicle path
const vehicleHistoryPolyline = ref<L.Polyline>()
watch(vehiclePositionHistory, (newPoints) => {
  if (map.value === undefined || newPoints === undefined) return

  if (vehicleHistoryPolyline.value === undefined) {
    vehicleHistoryPolyline.value = L.polyline([], { color: '#ffff00' }).addTo(map.value)
  }

  const latLongHistory = newPoints.filter((posHis) => posHis.snapshot !== undefined).map((posHis) => posHis.snapshot)
  vehicleHistoryPolyline.value.setLatLngs(latLongHistory as L.LatLngExpression[])
})

// Handle context menu toggling and selection
const showContextMenu = ref(false)
const clickedLocation = ref<[number, number] | null>(null)
const menuPosition = reactive({ top: '0px', left: '0px' })
const contextMenuMarker = ref<L.Marker>()

// Handle map click event to show the context menu
const onMapClick = (event: L.LeafletMouseEvent): void => {
  if (contextMenuMarker.value !== undefined && map.value !== undefined) {
    contextMenuMarker.value?.removeFrom(map.value)
  }

  // Check if event.latlng is defined and has the required properties
  if (event?.latlng?.lat != null && event?.latlng?.lng != null) {
    clickedLocation.value = [event.latlng.lat, event.latlng.lng]
    showContextMenu.value = true

    // Calculate and update menu position
    const mapElement = map.value?.getContainer()
    if (mapElement) {
      const { x, y } = mapElement.getBoundingClientRect()
      menuPosition.left = `${event.originalEvent.clientX - x}px`
      menuPosition.top = `${event.originalEvent.clientY - y}px`
    }
  } else {
    console.error('Invalid event structure:', event)
  }
}

const onMenuOptionSelect = async (option: string): Promise<void> => {
  switch (option) {
    case 'goto':
      if (clickedLocation.value) {
        // Define default values
        const hold = 0
        const acceptanceRadius = 0
        const passRadius = 0
        const yaw = 0
        const altitude = vehicleStore.coordinates.altitude ?? 0

        const latitude = clickedLocation.value[0]
        const longitude = clickedLocation.value[1]

        try {
          await vehicleStore.goTo(hold, acceptanceRadius, passRadius, yaw, latitude, longitude, altitude)
        } catch (error) {
          openSnackbar({ message: `GoTo request failed: ${(error as Error).message}`, variant: 'error' })
        }
      }
      break

    case 'set-default-map-position':
      missionStore.setDefaultMapPosition(mapCenter.value, zoom.value)
      break

    case 'place-poi':
      if (clickedLocation.value && poiManagerMapWidgetRef.value) {
        poiManagerMapWidgetRef.value.openDialog(clickedLocation.value)
      } else if (!clickedLocation.value) {
        openSnackbar({ message: 'Cannot place Point of Interest without map coordinates.', variant: 'error' })
        console.error('Cannot open POI dialog without click coordinates for new POI')
      } else if (!poiManagerMapWidgetRef.value) {
        openSnackbar({ message: 'POI Manager (map widget) is not available.', variant: 'error' })
        console.error('Cannot open POI dialog, POI Manager (map widget) ref is not set.')
      }
      break

    default:
      console.warn('Unknown menu option selected:', option)
  }

  // hide the context menu after an option is selected
  showContextMenu.value = false
}

const hideContextMenuAndMarker = (): void => {
  showContextMenu.value = false
  clickedLocation.value = null
  if (map.value !== undefined && contextMenuMarker.value !== undefined) {
    map.value.removeLayer(contextMenuMarker.value)
  }
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    hideContextMenuAndMarker()
  }
}

// Allow fetching missions
const fetchingMission = ref(false)
const missionFetchProgress = ref(0)
const downloadMissionFromVehicle = async (): Promise<void> => {
  fetchingMission.value = true
  missionFetchProgress.value = 0
  while (missionStore.currentPlanningWaypoints.length > 0) {
    missionStore.currentPlanningWaypoints.pop()
  }
  const loadingCallback = async (loadingPerc: number): Promise<void> => {
    missionFetchProgress.value = loadingPerc
  }
  try {
    const missionItemsInVehicle = await vehicleStore.fetchMission(loadingCallback)
    missionItemsInVehicle.forEach((w) => {
      missionStore.currentPlanningWaypoints.push(w)
    })
    openSnackbar({ variant: 'success', message: 'Mission download succeed!', duration: 3000 })
  } catch (error) {
    showDialog({ variant: 'error', title: 'Mission download failed', message: error as string, timer: 5000 })
  } finally {
    fetchingMission.value = false
  }
}

// Allow executing missions
const executeMissionOnVehicle = async (): Promise<void> => {
  try {
    await vehicleStore.startMission()
  } catch (error) {
    openSnackbar({ message: 'Failed to start mission.', variant: 'error' })
  }
}

// Set dynamic styles for correct displacement of the bottom buttons when the widget is below the bottom bar
const widgetStore = useWidgetManagerStore()
const bottomButtonsDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).bottom, 0)}px`
})

const topProgressBarDisplacement = computed(() => {
  return `${Math.max(-widgetStore.widgetClearanceForVisibleArea(widget.value).top, 0)}px`
})

const vehicleDownloadMissionButtonTooltipText = computed(() => {
  return vehicleStore.isVehicleOnline
    ? 'Download the mission that is stored in the vehicle.'
    : 'Cannot download mission (vehicle offline).'
})

const vehicleExecuteMissionButtonTooltipText = computed(() => {
  return vehicleStore.isVehicleOnline
    ? 'Execute the mission that is stored in the vehicle.'
    : 'Cannot execute mission (vehicle offline).'
})

const centerHomeButtonTooltipText = computed(() => {
  if (home.value === undefined) {
    return 'Cannot center map on home (home position undefined).'
  }
  if (followerTarget.value === WhoToFollow.HOME) {
    return 'Tracking home position. Click to stop tracking.'
  }
  return 'Click once to center on home or twice to track it.'
})

const centerVehicleButtonTooltipText = computed(() => {
  if (!vehicleStore.isVehicleOnline) {
    return 'Cannot center map on vehicle (vehicle offline).'
  }
  if (vehiclePosition.value === undefined) {
    return 'Cannot center map on vehicle (vehicle position undefined).'
  }
  if (followerTarget.value === WhoToFollow.VEHICLE) {
    return 'Tracking vehicle position. Click to stop tracking.'
  }
  return 'Click once to center on vehicle or twice to track it.'
})

// POI Marker Management Functions for Map Widget
const poiIconConfig = (poi: PointOfInterest): L.DivIconOptions => {
  const poiIconHtml = `
    <div class="poi-marker-container">
      <div class="poi-marker-background" style="background-color: ${poi.color}80;"></div>
      <i class="v-icon notranslate mdi ${poi.icon}" style="color: rgba(255, 255, 255, 0.7); position: relative; z-index: 2;"></i>
    </div>
  `

  return {
    html: poiIconHtml,
    className: 'poi-marker-icon-widget',
    iconSize: [32, 32], // Match the actual container size
    iconAnchor: [16, 32], // Center horizontally, bottom vertically (like a pin)
  }
}

const addPoiMarkerToMapWidget = (poi: PointOfInterest): void => {
  if (!map.value || !map.value.getContainer()) return

  const poiMarkerIcon = L.divIcon(poiIconConfig(poi))

  const marker = L.marker(poi.coordinates as LatLngTuple, { icon: poiMarkerIcon, draggable: true }).addTo(map.value)

  const tooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  const tooltipConfig = { permanent: false, direction: 'top', offset: [-14, -64], className: 'poi-tooltip-widget' }
  marker.bindTooltip(tooltipContent, tooltipConfig)

  marker.on('drag', (event) => {
    const newCoords = event.target.getLatLng()
    const updatedTooltipContent = `
      <strong>${poi.name}</strong><br>
      ${poi.description ? poi.description + '<br>' : ''}
      Lat: ${newCoords.lat.toFixed(8)}, Lng: ${newCoords.lng.toFixed(8)}
    `
    marker.getTooltip()?.setContent(updatedTooltipContent)
  })

  marker.on('dragend', (event) => {
    const newCoords = event.target.getLatLng()
    missionStore.movePointOfInterest(poi.id, [newCoords.lat, newCoords.lng])
  })

  marker.on('click', (event) => {
    L.DomEvent.stopPropagation(event)
    if (poiManagerMapWidgetRef.value) {
      // Get fresh POI data from store instead of using potentially stale poi object
      const freshPoi = missionStore.pointsOfInterest.find((p) => p.id === poi.id)
      if (freshPoi) {
        poiManagerMapWidgetRef.value.openDialog(undefined, freshPoi)
      } else {
        console.warn('POI not found in store:', poi.id)
      }
    }
  })

  mapWidgetPoiMarkers.value[poi.id] = marker
}

const updatePoiMarkerOnMapWidget = (poi: PointOfInterest): void => {
  if (!map.value || !map.value.getContainer() || !mapWidgetPoiMarkers.value[poi.id]) return

  const marker = mapWidgetPoiMarkers.value[poi.id]
  marker.setLatLng(poi.coordinates as LatLngTuple)

  marker.setIcon(L.divIcon(poiIconConfig(poi)))

  const updatedTooltipContent = `
    <strong>${poi.name}</strong><br>
    ${poi.description ? poi.description + '<br>' : ''}
    Lat: ${poi.coordinates[0].toFixed(8)}, Lng: ${poi.coordinates[1].toFixed(8)}
  `
  marker.getTooltip()?.setContent(updatedTooltipContent)
}

const removePoiMarkerFromMapWidget = (poiId: string): void => {
  if (!map.value || !mapWidgetPoiMarkers.value[poiId]) return

  mapWidgetPoiMarkers.value[poiId].remove()
  delete mapWidgetPoiMarkers.value[poiId]
}

// Watch for changes in POIs from the store and update markers on this map widget
watch(
  () => missionStore.pointsOfInterest,
  async (newPois) => {
    if (!map.value || !map.value.getContainer()) {
      await nextTick() // Wait for map to potentially become available
      if (!map.value || !map.value.getContainer()) {
        console.warn('Map.vue: POI watcher - map not ready after nextTick.')
        return
      }
    }

    const newPoiIds = new Set(newPois.map((p) => p.id))

    Object.keys(mapWidgetPoiMarkers.value).forEach((poiId) => {
      if (!newPoiIds.has(poiId)) {
        removePoiMarkerFromMapWidget(poiId)
      }
    })

    newPois.forEach((poi) => {
      if (mapWidgetPoiMarkers.value[poi.id]) {
        updatePoiMarkerOnMapWidget(poi)
      } else {
        addPoiMarkerToMapWidget(poi)
      }
    })
  },
  { deep: true, immediate: true }
)

// Ensure POIs are drawn when the map instance becomes available
watch(
  map,
  (currentMapInstance) => {
    if (currentMapInstance && currentMapInstance.getContainer()) {
      missionStore.pointsOfInterest.forEach((poi) => {
        if (!mapWidgetPoiMarkers.value[poi.id]) {
          addPoiMarkerToMapWidget(poi)
        } else {
          updatePoiMarkerOnMapWidget(poi) // Update if already exists, in case details changed
        }
      })
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.page-base {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map {
  position: absolute;
  z-index: 0;
  height: 100%;
  width: 100%;
}

.marker-icon {
  color: white;
  background-color: #358ac3;
  padding: 0.75rem;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 800;
}

.waypoint-tooltip {
  background-color: white;
  padding: 0.75rem;
  border: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: black;
}

.leaflet-control-zoom {
  bottom: v-bind('bottomButtonsDisplacement');
}

.context-menu {
  position: absolute;
  z-index: 1003;
  background-color: rgba(255, 255, 255, 0.9);
  /* White with slight transparency */
  border: 1px solid #ccc;
  /* Optional: adds a subtle border */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  /* Optional: adds a slight shadow for depth */
  border-radius: 4px;
  /* Optional: rounds the corners */
  top: 50px;
  left: 50px;
}

.context-menu ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.context-menu ul li {
  padding: 5px 10px;
  cursor: pointer;
}

.context-menu ul li:hover {
  background-color: #ddd;
}

.active-events-on-disabled {
  pointer-events: all;
}

.bottom-button {
  bottom: v-bind('bottomButtonsDisplacement');
}

.poi-marker-icon-widget {
  /* Style for POI markers in map widget, if needed */
  font-size: 20px;
  cursor: pointer;
  background: none;
  color: white;
  border: none;
}

.poi-marker-container {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poi-marker-background {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.7);
  z-index: 1;
}

.poi-tooltip-widget {
  /* Style for POI tooltips in map widget */
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
}
</style>
