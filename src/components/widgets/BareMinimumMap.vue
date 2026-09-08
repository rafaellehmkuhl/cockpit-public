<template>
  <div class="bmm-root">
    <div ref="mapHost" class="bmm-map" />
    <div class="bmm-hud">
      <div ref="viewHost" class="bmm-view">center — · z—</div>
      <canvas ref="fpsHost" class="bmm-fps" width="240" height="72" />
      <div v-if="status" class="bmm-status">{{ status }}</div>
    </div>
    <InteractionDialog
      v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen"
      title="Bare Minimum Map"
      variant="text-only"
    >
      <template #content>
        <div class="flex flex-col gap-3 py-2 min-w-[280px]">
          <v-switch v-model="widget.options.follow" label="Follow" hide-details color="white" density="compact" />
          <v-switch v-model="widget.options.showWps" label="Waypoints" hide-details color="white" density="compact" />
          <v-switch
            v-model="widget.options.showWpNums"
            label="Waypoint numbers"
            hide-details
            color="white"
            density="compact"
          />
          <v-switch v-model="widget.options.showPath" label="Path" hide-details color="white" density="compact" />
          <v-select
            v-model="widget.options.pathLen"
            :items="pathLens"
            item-title="title"
            item-value="value"
            label="Path length"
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-radio-group v-model="widget.options.tiles" inline hide-details label="Tiles">
            <v-radio label="Esri" value="esri" />
            <v-radio label="OSM" value="osm" />
          </v-radio-group>
          <v-btn size="small" variant="outlined" :loading="fetching" @click="fetchWps">Fetch waypoints</v-btn>
        </div>
      </template>
    </InteractionDialog>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable jsdoc/require-jsdoc */
import 'leaflet/dist/leaflet.css'

import { onBeforeMount, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import { type BareMinimumMapHandle, BMM_DEFAULTS, mountBareMinimumMap } from '@/libs/bare-minimum-map'
import { degrees } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type Waypoint, defaultLoadingCallback } from '@/types/mission'
import { type Widget } from '@/types/widgets'

import InteractionDialog from '../InteractionDialog.vue'

const props = defineProps<{
  widget: Widget
}>()
const widget = toRefs(props).widget
const widgetStore = useWidgetManagerStore()
const vehicle = useMainVehicleStore()
const mission = useMissionStore()

const mapHost = ref<HTMLElement>()
const viewHost = ref<HTMLElement>()
const fpsHost = ref<HTMLCanvasElement>()
const status = ref('')
const fetching = ref(false)
const pathLens = [
  { title: 'Off', value: 0 },
  { title: '100', value: 100 },
  { title: '1k', value: 1000 },
  { title: '10k', value: 10000 },
  { title: '50k', value: 50000 },
]

type BmmTestApi = {
  zoomBy: (d: number) => void
  fetch: () => Promise<void>
  wpCount: () => number
}

let engine: BareMinimumMapHandle | null = null
let ro: ResizeObserver | null = null

// Read Pinia outside a Vue effect (rAF in the engine). Do not wrap this in computed/watch.
const getPos = (): { lat: number; lng: number; hdg?: number } | null => {
  const lat = vehicle.coordinates.latitude
  const lng = vehicle.coordinates.longitude
  // Same gate as Map.vue: unset coords are 0, and 0 is not a real vehicle fix here.
  if (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const yaw = vehicle.attitude.yaw
  return { lat, lng, hdg: Number.isFinite(yaw) ? degrees(yaw) : undefined }
}

const flattenWps = (wps: Waypoint[]): number[] => {
  const out: number[] = []
  for (const w of wps) {
    const lat = w.coordinates?.[0]
    const lng = w.coordinates?.[1]
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push(lat, lng)
  }
  return out
}

const applyOptions = (): void => {
  engine?.setOptions({
    follow: !!widget.value.options.follow,
    showWps: !!widget.value.options.showWps,
    showWpNums: !!widget.value.options.showWpNums,
    showPath: !!widget.value.options.showPath,
    pathLen: Number(widget.value.options.pathLen) || 0,
    tiles: widget.value.options.tiles === 'osm' ? 'osm' : 'esri',
  })
}

const fetchWps = async (): Promise<void> => {
  fetching.value = true
  status.value = 'fetching waypoints…'
  try {
    const wps = await Promise.race([
      vehicle.fetchMission(defaultLoadingCallback),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('fetch waypoints timed out')), 45000)),
    ])
    engine?.setWps(flattenWps(wps))
    status.value = `wps ${wps.length}`
  } catch (e) {
    status.value = e instanceof Error ? e.message : String(e)
  } finally {
    fetching.value = false
  }
}

onBeforeMount(() => {
  widget.value.options = { ...BMM_DEFAULTS, ...widget.value.options }
})

onMounted(() => {
  if (!mapHost.value) return
  engine = mountBareMinimumMap(mapHost.value, getPos, viewHost.value, fpsHost.value)
  applyOptions()
  const already = flattenWps(mission.vehicleMission)
  if (already.length) engine.setWps(already)
  ro = new ResizeObserver(() => engine?.invalidate())
  ro.observe(mapHost.value)
  ;(globalThis as unknown as { __BMM?: BmmTestApi }).__BMM = {
    zoomBy: (d: number): void => engine?.zoomBy(d),
    fetch: (): Promise<void> => fetchWps(),
    wpCount: (): number => engine?.wpCount() ?? 0,
  }
})

onUnmounted(() => {
  ro?.disconnect()
  engine?.destroy()
  engine = null
  ;(globalThis as unknown as { __BMM?: unknown }).__BMM = undefined
})

watch(
  () => widget.value.options,
  () => applyOptions(),
  { deep: true }
)
</script>

<style scoped>
.bmm-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #111;
  overflow: hidden;
}
.bmm-map {
  width: 100%;
  height: 100%;
}
.bmm-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 500;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 280px;
  font: 11px/1.3 ui-monospace, Menlo, monospace;
  color: #fff;
}
.bmm-view,
.bmm-status {
  background: rgb(0 0 0 / 55%);
  border: 1px solid rgb(255 255 255 / 15%);
  border-radius: 4px;
  padding: 4px 6px;
}
.bmm-fps {
  display: block;
  width: 240px;
  height: 72px;
}
</style>

<style>
.bmm-veh {
  background: none;
  border: none;
}
.bmm-veh svg {
  display: block;
  transform-origin: 50% 50%;
}
.bmm-wp-labels {
  pointer-events: none;
}
</style>
