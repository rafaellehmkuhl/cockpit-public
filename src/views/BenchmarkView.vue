<template>
  <div class="flex flex-col items-center p-8 h-screen bg-[#111827] text-white overflow-y-auto">
    <h1 class="text-2xl font-bold mb-6">Performance Benchmark</h1>

    <div class="flex gap-4 items-end mb-8 flex-wrap justify-center">
      <div class="flex flex-col gap-1">
        <label class="text-sm text-gray-400">Message rate (msg/s)</label>
        <select v-model.number="targetHz" :disabled="running" class="bg-[#1f2937] text-white px-3 py-2 rounded-md">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
          <option :value="500">500</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm text-gray-400">Duration (seconds)</label>
        <select v-model.number="durationSec" :disabled="running" class="bg-[#1f2937] text-white px-3 py-2 rounded-md">
          <option :value="10">10</option>
          <option :value="30">30</option>
          <option :value="60">60</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm text-gray-400">Listeners per variable</label>
        <select
          v-model.number="listenersPerVar"
          :disabled="running"
          class="bg-[#1f2937] text-white px-3 py-2 rounded-md"
        >
          <option :value="0">0 (ingestion only)</option>
          <option :value="1">1</option>
          <option :value="5">5</option>
          <option :value="10">10</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-sm text-gray-400">Render widgets</label>
        <select v-model="renderWidgets" :disabled="running" class="bg-[#1f2937] text-white px-3 py-2 rounded-md">
          <option :value="false">Off</option>
          <option :value="true">On</option>
        </select>
      </div>
      <v-btn v-if="!running" color="blue" class="rounded-md" @click="runBenchmark">Start Benchmark</v-btn>
      <v-btn v-else color="red" class="rounded-md" @click="stopBenchmark">Stop</v-btn>
    </div>

    <div
      v-if="widgetsActive"
      class="mb-4"
      style="
        display: grid;
        grid-template-columns: repeat(4, 200px);
        grid-auto-rows: 200px;
        gap: 12px;
        justify-content: center;
      "
    >
      <div class="col-span-2 bench-widget-cell">
        <component :is="PlotterComponent" :widget="plotterRollWidget" />
      </div>
      <div class="col-span-2 bench-widget-cell">
        <component :is="PlotterComponent" :widget="plotterPitchWidget" />
      </div>
      <div class="col-span-2 row-span-2 bench-widget-cell">
        <component :is="AttitudeComponent" :widget="attitudeWidget" />
      </div>
      <div class="col-span-2 row-span-2 bench-widget-cell">
        <component :is="MapComponent" :widget="mapWidget" />
      </div>
      <div class="col-span-2 bench-widget-cell">
        <component :is="PlotterComponent" :widget="plotterYawWidget" />
      </div>
      <div class="bench-widget-cell">
        <component :is="CompassComponent" :widget="compassWidget" />
      </div>
      <div class="bench-widget-cell">
        <component :is="VirtualHorizonComponent" :widget="virtualHorizonWidget" />
      </div>
    </div>
    <div
      v-if="widgetsActive"
      class="mb-4"
      style="
        display: grid;
        grid-template-columns: repeat(4, 200px);
        grid-auto-rows: 100px;
        gap: 12px;
        justify-content: center;
        margin-top: 12px;
      "
    >
      <div class="bg-[#0a0f1a] rounded-lg overflow-hidden flex items-center justify-center">
        <component :is="VeryGenericIndicatorComponent" :mini-widget="indicatorVoltageWidget" />
      </div>
      <div class="bg-[#0a0f1a] rounded-lg overflow-hidden flex items-center justify-center">
        <component :is="VeryGenericIndicatorComponent" :mini-widget="indicatorAltWidget" />
      </div>
      <div class="bg-[#0a0f1a] rounded-lg overflow-hidden flex items-center justify-center">
        <component :is="BatteryIndicatorComponent" :mini-widget="batteryWidget" />
      </div>
      <div class="bg-[#0a0f1a] rounded-lg overflow-hidden flex items-center justify-center">
        <component :is="DepthIndicatorComponent" :mini-widget="depthWidget" />
      </div>
      <div class="bg-[#0a0f1a] rounded-lg overflow-hidden flex items-center justify-center">
        <component :is="RelativeAltitudeIndicatorComponent" :mini-widget="relAltWidget" />
      </div>
    </div>

    <div v-if="running" class="w-full max-w-3xl mb-4">
      <div class="flex justify-between text-sm text-gray-400 mb-1">
        <span>Running...</span>
        <span>{{ elapsedSec.toFixed(1) }}s / {{ durationSec }}s</span>
      </div>
      <div class="w-full bg-[#1f2937] rounded-full h-2 mb-3">
        <div class="bg-blue-500 h-2 rounded-full transition-all" :style="{ width: `${progressPct}%` }" />
      </div>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div class="bg-[#1f2937] rounded-lg p-3 flex justify-between items-center">
          <span class="text-gray-400">FPS</span>
          <span class="text-xl font-mono text-green-400">{{ liveFps.toFixed(0) }}</span>
        </div>
        <div class="bg-[#1f2937] rounded-lg p-3 flex justify-between items-center">
          <span class="text-gray-400">Memory</span>
          <span class="text-xl font-mono text-blue-400">{{ liveMemory.toFixed(1) }} MB</span>
        </div>
        <div class="bg-[#1f2937] rounded-lg p-3 flex justify-between items-center">
          <span class="text-gray-400">CPU</span>
          <span class="text-xl font-mono text-orange-400">{{ liveCpu.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div v-if="latestReport" class="w-full max-w-3xl space-y-4">
      <div v-if="savedBaseline" class="bg-[#1a2332] border border-blue-900 rounded-lg p-3 text-sm text-gray-400">
        Comparing against baseline from {{ savedBaseline.timestamp }}
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="bg-[#1f2937] rounded-lg p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-semibold text-gray-300">FPS over time</span>
            <span class="text-xs font-mono text-gray-400">
              avg {{ latestReport.avgFps.toFixed(0) }} / min {{ latestReport.minFps.toFixed(0) }}
            </span>
          </div>
          <canvas ref="fpsCanvasRef" class="w-full rounded" height="120" />
        </div>
        <div class="bg-[#1f2937] rounded-lg p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-semibold text-gray-300">Memory over time</span>
            <span class="text-xs font-mono text-gray-400">peak {{ latestReport.peakMemoryMB.toFixed(0) }} MB</span>
          </div>
          <canvas ref="memCanvasRef" class="w-full rounded" height="120" />
        </div>
        <div class="bg-[#1f2937] rounded-lg p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-semibold text-gray-300">CPU over time</span>
            <span class="text-xs font-mono text-gray-400">
              avg {{ latestReport.avgCpuPercent.toFixed(0) }}% / peak {{ latestReport.peakCpuPercent.toFixed(0) }}%
            </span>
          </div>
          <canvas ref="cpuCanvasRef" class="w-full rounded" height="120" />
        </div>
      </div>

      <div class="bg-[#1f2937] rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3">Summary</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Messages processed</div>
            <div class="text-xl font-mono">
              {{ latestReport.totalMessages.toLocaleString() }}
              <span v-if="savedBaseline" :class="deltaClass(latestReport.totalMessages, savedBaseline.totalMessages)">
                {{ deltaText(latestReport.totalMessages, savedBaseline.totalMessages) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Actual throughput</div>
            <div class="text-xl font-mono">
              {{ latestReport.actualMsgPerSec.toFixed(0) }} msg/s
              <span
                v-if="savedBaseline"
                :class="deltaClass(latestReport.actualMsgPerSec, savedBaseline.actualMsgPerSec)"
              >
                {{ deltaText(latestReport.actualMsgPerSec, savedBaseline.actualMsgPerSec) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Avg FPS</div>
            <div class="text-xl font-mono" :class="fpsColor(latestReport.avgFps)">
              {{ latestReport.avgFps.toFixed(1) }}
              <span v-if="savedBaseline" :class="deltaClass(latestReport.avgFps, savedBaseline.avgFps)">
                {{ deltaText(latestReport.avgFps, savedBaseline.avgFps) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Min FPS</div>
            <div class="text-xl font-mono" :class="fpsColor(latestReport.minFps)">
              {{ latestReport.minFps.toFixed(1) }}
              <span v-if="savedBaseline" :class="deltaClass(latestReport.minFps, savedBaseline.minFps)">
                {{ deltaText(latestReport.minFps, savedBaseline.minFps) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Peak Memory (MB)</div>
            <div class="text-xl font-mono">
              {{ latestReport.peakMemoryMB.toFixed(1) }}
              <span v-if="savedBaseline" :class="deltaClass(savedBaseline.peakMemoryMB, latestReport.peakMemoryMB)">
                {{ deltaText(latestReport.peakMemoryMB, savedBaseline.peakMemoryMB, true) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Avg CPU (%)</div>
            <div class="text-xl font-mono">
              {{ latestReport.avgCpuPercent.toFixed(1) }}
              <span v-if="savedBaseline" :class="deltaClass(savedBaseline.avgCpuPercent, latestReport.avgCpuPercent)">
                {{ deltaText(latestReport.avgCpuPercent, savedBaseline.avgCpuPercent, true) }}
              </span>
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Vars per message</div>
            <div class="text-xl font-mono">{{ latestReport.varsPerMessage.toFixed(1) }}</div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Widgets rendered</div>
            <div class="text-xl font-mono">{{ latestReport.widgetsRendered }}</div>
          </div>
        </div>
      </div>

      <div v-if="Object.keys(latestReport.perfMetrics).length > 0" class="bg-[#1f2937] rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3">Hot Path Timing</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-gray-400 border-b border-gray-700">
              <tr>
                <th class="py-2 pr-4">Label</th>
                <th class="py-2 pr-4 text-right">Calls</th>
                <th class="py-2 pr-4 text-right">Mean (ms)</th>
                <th class="py-2 pr-4 text-right">Min (ms)</th>
                <th class="py-2 pr-4 text-right">Max (ms)</th>
                <th class="py-2 text-right">Total (ms)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(metric, label) in latestReport.perfMetrics" :key="label" class="border-b border-gray-800">
                <td class="py-2 pr-4 font-mono text-blue-300">{{ label }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ metric.count.toLocaleString() }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ metric.meanMs.toFixed(4) }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ metric.minMs.toFixed(4) }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ metric.maxMs.toFixed(4) }}</td>
                <td class="py-2 text-right font-mono">{{ metric.totalMs.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-[#1f2937] rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3">Long Tasks (>50ms)</h2>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Count</div>
            <div
              class="text-xl font-mono"
              :class="latestReport.longTaskCount > 0 ? 'text-yellow-400' : 'text-green-400'"
            >
              {{ latestReport.longTaskCount }}
            </div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Total blocked</div>
            <div class="text-xl font-mono">{{ latestReport.longTaskTotalMs.toFixed(1) }}ms</div>
          </div>
          <div class="bg-[#111827] rounded p-3">
            <div class="text-gray-400">Worst single</div>
            <div class="text-xl font-mono">{{ latestReport.longTaskWorstMs.toFixed(1) }}ms</div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 justify-end">
        <v-btn variant="outlined" class="rounded-md" @click="saveBaseline">Save as baseline</v-btn>
        <v-btn v-if="savedBaseline" variant="outlined" color="red" class="rounded-md" @click="clearBaseline">
          Clear baseline
        </v-btn>
        <v-btn variant="outlined" class="rounded-md" @click="copyReport">Copy JSON</v-btn>
      </div>
    </div>

    <div v-if="runHistory.length > 0" class="w-full max-w-3xl mt-8 space-y-4">
      <div class="bg-[#1f2937] rounded-lg p-4">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-lg font-semibold">Run History</h2>
          <v-btn variant="text" size="small" color="red" class="rounded-md" @click="clearHistory">Clear all</v-btn>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-gray-400 border-b border-gray-700">
              <tr>
                <th class="py-2 pr-3">Time</th>
                <th class="py-2 pr-3 text-right">Rate</th>
                <th class="py-2 pr-3 text-right">Throughput</th>
                <th class="py-2 pr-3 text-right">Avg FPS</th>
                <th class="py-2 pr-3 text-right">Min FPS</th>
                <th class="py-2 pr-3 text-right">Memory</th>
                <th class="py-2 pr-3 text-right">Listeners</th>
                <th class="py-2 pr-3 text-right">Widgets</th>
                <th class="py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in runHistory" :key="run.timestamp" class="border-b border-gray-800">
                <td class="py-2 pr-3 text-gray-400 text-xs">{{ formatTimestamp(run.timestamp) }}</td>
                <td class="py-2 pr-3 text-right font-mono">{{ run.targetHz }}</td>
                <td class="py-2 pr-3 text-right font-mono">{{ run.actualMsgPerSec.toFixed(0) }}</td>
                <td class="py-2 pr-3 text-right font-mono" :class="fpsColor(run.avgFps)">
                  {{ run.avgFps.toFixed(1) }}
                </td>
                <td class="py-2 pr-3 text-right font-mono" :class="fpsColor(run.minFps)">
                  {{ run.minFps.toFixed(1) }}
                </td>
                <td class="py-2 pr-3 text-right font-mono">{{ run.peakMemoryMB.toFixed(0) }}</td>
                <td class="py-2 pr-3 text-right font-mono">{{ run.listenersPerVariable }}</td>
                <td class="py-2 pr-3 text-right font-mono">{{ run.widgetsRendered ?? 0 }}</td>
                <td class="py-2 text-center">
                  <span
                    class="cursor-pointer text-gray-400 hover:text-white mdi mdi-content-copy mr-2"
                    title="Copy JSON"
                    @click="copyHistoryRun(run)"
                  />
                  <span
                    class="cursor-pointer text-gray-400 hover:text-red-400 mdi mdi-delete"
                    title="Delete"
                    @click="deleteHistoryRun(run.timestamp)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import localforage from 'localforage'
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { getAllDataLakeVariablesInfo, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { SyntheticMavlinkGenerator } from '@/libs/benchmark/synthetic-mavlink'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import {
  type PerfMetric,
  disableInstrumentation,
  enableInstrumentation,
  getPerfReport,
  resetPerfReport,
} from '@/libs/performance-instrumentation'
import { isElectron } from '@/libs/utils'
import { ArduSub } from '@/libs/vehicle/ardupilot/ardusub'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { MiniWidget, Widget } from '@/types/widgets'
import { MiniWidgetType, WidgetType } from '@/types/widgets'

const PlotterComponent = defineAsyncComponent(() => import('@/components/widgets/Plotter.vue'))
const AttitudeComponent = defineAsyncComponent(() => import('@/components/widgets/Attitude.vue'))
const CompassComponent = defineAsyncComponent(() => import('@/components/widgets/Compass.vue'))
const MapComponent = defineAsyncComponent(() => import('@/components/widgets/Map.vue'))
const VirtualHorizonComponent = defineAsyncComponent(() => import('@/components/widgets/VirtualHorizon.vue'))
const VeryGenericIndicatorComponent = defineAsyncComponent(
  () => import('@/components/mini-widgets/VeryGenericIndicator.vue')
)
const BatteryIndicatorComponent = defineAsyncComponent(() => import('@/components/mini-widgets/BatteryIndicator.vue'))
const DepthIndicatorComponent = defineAsyncComponent(() => import('@/components/mini-widgets/DepthIndicator.vue'))
const RelativeAltitudeIndicatorComponent = defineAsyncComponent(
  () => import('@/components/mini-widgets/RelativeAltitudeIndicator.vue')
)

const vehicleStore = useMainVehicleStore()
let benchmarkVehicle: ArduSub | null = null

const BASELINE_STORAGE_KEY = 'cockpit-benchmark-baseline'
const WIDGET_COUNT = 12

const benchmarkRunsDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Benchmark Runs',
  storeName: 'cockpit-benchmark-runs',
  version: 1,
  description: 'History of performance benchmark runs.',
})

/**
 * Benchmark result snapshot
 */
interface BenchmarkReport {
  /** Target message rate in Hz */
  targetHz: number
  /** Actual measured throughput in msg/s */
  actualMsgPerSec: number
  /** Total messages processed */
  totalMessages: number
  /** Test duration in seconds */
  durationSec: number
  /** Average FPS during the test */
  avgFps: number
  /** Minimum FPS sample observed */
  minFps: number
  /** Peak memory usage in MB */
  peakMemoryMB: number
  /** Average CPU usage percentage during the test */
  avgCpuPercent: number
  /** Peak CPU usage percentage during the test */
  peakCpuPercent: number
  /** Average data lake variable updates per MAVLink message */
  varsPerMessage: number
  /** Number of synthetic listeners per variable during the test */
  listenersPerVariable: number
  /** Total number of synthetic listener callback invocations */
  listenerCallbackCount: number
  /** Number of widgets rendered during the test */
  widgetsRendered: number
  /** Instrumented hot-path timing metrics */
  perfMetrics: Record<string, PerfMetric>
  /** Number of long tasks (>50ms) detected during the benchmark */
  longTaskCount: number
  /** Total time blocked by long tasks in milliseconds */
  longTaskTotalMs: number
  /** Duration of the worst single long task in milliseconds */
  longTaskWorstMs: number
  /** FPS samples collected during the test (per-frame resolution) */
  fpsHistory: number[]
  /** Memory samples in MB collected during the test */
  memoryHistory: number[]
  /** CPU usage percentage samples collected during the test */
  cpuHistory: number[]
  /** ISO timestamp of the report */
  timestamp: string
}

// Synthetic widget props for benchmark rendering
const plotterRollWidget = reactive<Widget>({
  hash: 'bench-plotter-roll',
  component: WidgetType.Plotter,
  position: { x: 0, y: 0 },
  size: { width: 0.17, height: 0.24 },
  name: 'Roll',
  options: { dataLakeVariableId: '/mavlink/1/1/ATTITUDE/roll', maxSamples: 500, limitSamples: true },
})

const plotterPitchWidget = reactive<Widget>({
  hash: 'bench-plotter-pitch',
  component: WidgetType.Plotter,
  position: { x: 0.17, y: 0 },
  size: { width: 0.17, height: 0.24 },
  name: 'Pitch',
  options: { dataLakeVariableId: '/mavlink/1/1/ATTITUDE/pitch', maxSamples: 500, limitSamples: true },
})

const attitudeWidget = reactive<Widget>({
  hash: 'bench-attitude',
  component: WidgetType.Attitude,
  position: { x: 0.34, y: 0 },
  size: { width: 0.17, height: 0.24 },
  name: 'Attitude',
  options: {
    rollVariableId: '/mavlink/1/1/ATTITUDE/roll',
    pitchVariableId: '/mavlink/1/1/ATTITUDE/pitch',
  },
})

const compassWidget = reactive<Widget>({
  hash: 'bench-compass',
  component: WidgetType.Compass,
  position: { x: 0.34, y: 0.24 },
  size: { width: 0.17, height: 0.22 },
  name: 'Compass',
  options: {
    yawVariableId: '/mavlink/1/1/ATTITUDE/yaw',
  },
})

const indicatorVoltageWidget = reactive<MiniWidget>({
  hash: 'bench-indicator-voltage',
  component: MiniWidgetType.VeryGenericIndicator,
  name: 'Voltage',
  options: {
    displayName: 'Voltage',
    variableName: '/mavlink/1/1/SYS_STATUS/voltage_battery',
    iconName: 'mdi-lightning-bolt',
    variableUnit: 'mV',
    variableMultiplier: 1,
    decimalPlaces: 0,
  },
})

const indicatorAltWidget = reactive<MiniWidget>({
  hash: 'bench-indicator-alt',
  component: MiniWidgetType.VeryGenericIndicator,
  name: 'Altitude',
  options: {
    displayName: 'Alt',
    variableName: '/mavlink/1/1/GLOBAL_POSITION_INT/relative_alt',
    iconName: 'mdi-arrow-up-down',
    variableUnit: 'mm',
    variableMultiplier: 1,
    decimalPlaces: 0,
  },
})

const virtualHorizonWidget = reactive<Widget>({
  hash: 'bench-virtual-horizon',
  component: WidgetType.VirtualHorizon,
  position: { x: 0.51, y: 0 },
  size: { width: 0.17, height: 0.24 },
  name: 'VirtualHorizon',
  options: {
    rollVariableId: '/mavlink/1/1/ATTITUDE/roll',
    pitchVariableId: '/mavlink/1/1/ATTITUDE/pitch',
  },
})

const plotterYawWidget = reactive<Widget>({
  hash: 'bench-plotter-yaw',
  component: WidgetType.Plotter,
  position: { x: 0.51, y: 0.24 },
  size: { width: 0.17, height: 0.22 },
  name: 'Yaw',
  options: { dataLakeVariableId: '/mavlink/1/1/ATTITUDE/yaw', maxSamples: 500, limitSamples: true },
})

const mapWidget = reactive<Widget>({
  hash: 'bench-map',
  component: WidgetType.Map,
  position: { x: 0, y: 0.24 },
  size: { width: 0.35, height: 0.22 },
  name: 'Map',
  options: { showVehiclePath: true, showCoordinateGrid: false },
})

const batteryWidget = reactive<MiniWidget>({
  hash: 'bench-battery',
  component: MiniWidgetType.BatteryIndicator,
  name: 'Battery',
  options: {
    voltageVariableId: '/mavlink/1/1/SYS_STATUS/voltage_battery',
    currentVariableId: '/mavlink/1/1/SYS_STATUS/current_battery',
    remainingVariableId: '/mavlink/1/1/SYS_STATUS/battery_remaining',
  },
})

const depthWidget = reactive<MiniWidget>({
  hash: 'bench-depth',
  component: MiniWidgetType.DepthIndicator,
  name: 'Depth',
  options: {
    depthVariableId: '/mavlink/1/1/AHRS2/altitude',
  },
})

const relAltWidget = reactive<MiniWidget>({
  hash: 'bench-rel-alt',
  component: MiniWidgetType.RelativeAltitudeIndicator,
  name: 'RelAlt',
  options: {
    altitudeVariableId: '/mavlink/1/1/GLOBAL_POSITION_INT/relative_alt',
  },
})

const { width: winW, height: winH } = useWindowSize()
const tileSize = 200
const gapSize = 12
const tile2 = tileSize * 2 + gapSize

const sizeTile1x1 = computed(() => ({ width: tileSize / winW.value, height: tileSize / winH.value }))
const sizeTile2x1 = computed(() => ({ width: tile2 / winW.value, height: tileSize / winH.value }))
const sizeTile2x2 = computed(() => ({ width: tile2 / winW.value, height: tile2 / winH.value }))

watch(
  [sizeTile1x1, sizeTile2x1, sizeTile2x2],
  () => {
    Object.assign(plotterRollWidget.size, sizeTile2x1.value)
    Object.assign(plotterPitchWidget.size, sizeTile2x1.value)
    Object.assign(plotterYawWidget.size, sizeTile2x1.value)
    Object.assign(attitudeWidget.size, {
      width: sizeTile2x2.value.width * 0.85,
      height: sizeTile2x2.value.height * 0.85,
    })
    Object.assign(mapWidget.size, sizeTile2x2.value)
    Object.assign(compassWidget.size, sizeTile1x1.value)
    Object.assign(virtualHorizonWidget.size, sizeTile1x1.value)
  },
  { immediate: true }
)

const targetHz = ref(500)
const durationSec = ref(10)
const listenersPerVar = ref(10)
const renderWidgets = ref(true)
const running = ref(false)
const elapsedSec = ref(0)
const progressPct = ref(0)
const latestReport = ref<BenchmarkReport | null>(null)
const liveFps = ref(0)
const liveMemory = ref(0)
const liveCpu = ref(0)
const savedBaseline = ref<BenchmarkReport | null>(loadBaseline())
const runHistory = ref<BenchmarkReport[]>([])
const widgetsActive = computed(() => renderWidgets.value && (running.value || latestReport.value !== null))

const fpsCanvasRef = ref<HTMLCanvasElement | null>(null)
const memCanvasRef = ref<HTMLCanvasElement | null>(null)
const cpuCanvasRef = ref<HTMLCanvasElement | null>(null)

const generator = new SyntheticMavlinkGenerator()
let progressTimer: ReturnType<typeof setInterval> | null = null
let resourceTimer: ReturnType<typeof setInterval> | null = null
let lastFrameTime = 0
let fpsSamples: number[] = []
let memorySamples: number[] = []
let cpuSamples: number[] = []
let peakMemory = 0
let peakCpu = 0
let benchmarkStartTime = 0
let rafId = 0
let syntheticListenerIds: Array<{
  /**
llllllllllllllllllllllllllllllllll *
llllllllllllllllllllllllllllllllll
   */
  variableId: string
  /**
vvvvvvvvvvvvvvvvvvvv *
vvvvvvvvvvvvvvvvvvvv
   */
  listenerId: string
}> = []
let syntheticListenerCallCount = 0

const chartBg = '#111827'
const fpsLineColor = '#4ade80'
const fpsRefLineColor = '#374151'
const memLineColor = '#60a5fa'

onMounted(loadHistory)

/**
 * Load all runs from IndexedDB into runHistory, sorted newest first
 */
async function loadHistory(): Promise<void> {
  const runs: BenchmarkReport[] = []
  await benchmarkRunsDB.iterate<BenchmarkReport, void>((value) => {
    runs.push(value)
  })
  runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  runHistory.value = runs
}

/**
 * Save a benchmark run to IndexedDB
 * @param {BenchmarkReport} report - The report to persist
 */
async function saveRunToHistory(report: BenchmarkReport): Promise<void> {
  await benchmarkRunsDB.setItem(report.timestamp, report)
  runHistory.value = [report, ...runHistory.value]
}

/**
 * Delete a single run from history
 * @param {string} timestamp - The timestamp key of the run to delete
 */
async function deleteHistoryRun(timestamp: string): Promise<void> {
  await benchmarkRunsDB.removeItem(timestamp)
  runHistory.value = runHistory.value.filter((r) => r.timestamp !== timestamp)
}

/**
 * Clear all run history from IndexedDB
 */
async function clearHistory(): Promise<void> {
  await benchmarkRunsDB.clear()
  runHistory.value = []
}

/**
 * Copy a history run's JSON to clipboard
 * @param {BenchmarkReport} report
 */
function copyHistoryRun(report: BenchmarkReport): void {
  navigator.clipboard.writeText(JSON.stringify(report, null, 2))
}

/**
 * Format an ISO timestamp for display
 * @param {string} iso - ISO timestamp string
 * @returns {string} Formatted date/time
 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Load saved baseline from localStorage
 * @returns {BenchmarkReport | null} The saved baseline or null
 */
function loadBaseline(): BenchmarkReport | null {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as BenchmarkReport) : null
  } catch {
    return null
  }
}

/**
 * Save current report as baseline
 */
function saveBaseline(): void {
  if (!latestReport.value) return
  localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(latestReport.value))
  savedBaseline.value = { ...latestReport.value }
}

/**
 * Clear saved baseline
 */
function clearBaseline(): void {
  localStorage.removeItem(BASELINE_STORAGE_KEY)
  savedBaseline.value = null
}

/**
 * Format a delta between two values as a percentage string
 * @param {number} current - Current value
 * @param {number} baseline - Baseline value
 * @param {boolean} invertColor - If true, lower is better (e.g., memory)
 * @returns {string} Formatted delta string like "+12%" or "-5%"
 */
function deltaText(current: number, baseline: number, invertColor = false): string {
  if (baseline === 0) return ''
  const pct = ((current - baseline) / Math.abs(baseline)) * 100
  const sign = pct >= 0 ? '+' : ''
  const label = invertColor ? `${sign}${pct.toFixed(0)}%` : `${sign}${pct.toFixed(0)}%`
  return label
}

/**
 * CSS class for delta coloring (green=better, red=worse)
 * @param {number} current - Current value (higher is better unless inverted)
 * @param {number} baseline - Baseline value
 * @returns {string} Tailwind class
 */
function deltaClass(current: number, baseline: number): string {
  if (baseline === 0) return ''
  return current >= baseline ? 'text-xs text-green-400 ml-1' : 'text-xs text-red-400 ml-1'
}

/**
 * Register synthetic listeners on all current data lake variables
 * @param {number} count - Number of listeners to register per variable
 */
function registerSyntheticListeners(count: number): void {
  if (count <= 0) return
  const variables = getAllDataLakeVariablesInfo()
  const syntheticCallback = (): void => {
    syntheticListenerCallCount++
  }
  for (const variableId of Object.keys(variables)) {
    for (let i = 0; i < count; i++) {
      const listenerId = listenDataLakeVariable(variableId, syntheticCallback)
      syntheticListenerIds.push({ variableId, listenerId })
    }
  }
}

/**
 * Remove all synthetic listeners registered during the benchmark
 */
function removeSyntheticListeners(): void {
  for (const { variableId, listenerId } of syntheticListenerIds) {
    unlistenDataLakeVariable(variableId, listenerId)
  }
  syntheticListenerIds = []
}

/**
 * Render a line chart on the given canvas
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @param {number[]} data - Array of data points to plot
 * @param {string} lineColor - CSS color for the line
 * @param {number} refLine - Optional horizontal reference line value
 * @param {number} fixedMax - Optional fixed maximum for Y axis
 */
function renderChart(
  canvas: HTMLCanvasElement,
  data: number[],
  lineColor: string,
  refLine?: number,
  fixedMax?: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const w = rect.width
  const h = rect.height
  const padding = 2

  ctx.fillStyle = chartBg
  ctx.fillRect(0, 0, w, h)

  if (data.length < 2) return

  const maxVal = fixedMax ?? Math.max(...data, 1) * 1.1
  const minVal = 0

  if (refLine !== undefined) {
    const refY = padding + (h - 2 * padding) * (1 - (refLine - minVal) / (maxVal - minVal))
    ctx.strokeStyle = fpsRefLineColor
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, refY)
    ctx.lineTo(w, refY)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#6b7280'
    ctx.font = '10px monospace'
    ctx.fillText(`${refLine}`, 4, refY - 3)
  }

  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.beginPath()

  const step = w / (data.length - 1)
  for (let i = 0; i < data.length; i++) {
    const x = i * step
    const y = padding + (h - 2 * padding) * (1 - (data[i] - minVal) / (maxVal - minVal))
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${maxVal.toFixed(0)}`, w - 4, padding + 10)
  ctx.fillText(`${minVal.toFixed(0)}`, w - 4, h - padding)
}

/**
 * Render both charts using the collected samples
 */
const cpuLineColor = '#f97316'

/**
 * Render all charts using the collected samples
 */
function renderCharts(): void {
  if (fpsCanvasRef.value) {
    renderChart(fpsCanvasRef.value, fpsSamples, fpsLineColor, 60)
  }
  if (memCanvasRef.value) {
    renderChart(memCanvasRef.value, memorySamples, memLineColor)
  }
  if (cpuCanvasRef.value) {
    renderChart(cpuCanvasRef.value, cpuSamples, cpuLineColor, undefined, 100)
  }
}

/**
 * Per-frame sampler running via requestAnimationFrame.
 * Records instantaneous FPS (1000 / frame delta) on every frame.
 */
function sampleFrame(): void {
  const now = performance.now()
  if (lastFrameTime > 0) {
    const delta = now - lastFrameTime
    if (delta > 0) {
      fpsSamples.push(1000 / delta)
    }
  }
  lastFrameTime = now

  if (running.value) {
    rafId = requestAnimationFrame(sampleFrame)
  }
}

/**
 * Async resource sampler that collects memory and CPU usage.
 * Uses Electron API when available, falls back to performance.memory for web.
 */
async function sampleResources(): Promise<void> {
  if (isElectron() && window.electronAPI?.getResourceUsage) {
    try {
      const usage = await window.electronAPI.getResourceUsage()
      memorySamples.push(usage.totalMemoryMB)
      if (usage.totalMemoryMB > peakMemory) peakMemory = usage.totalMemoryMB
      cpuSamples.push(usage.cpuUsagePercent)
      if (usage.cpuUsagePercent > peakCpu) peakCpu = usage.cpuUsagePercent
      return
    } catch {
      // Fall through to browser fallback
    }
  }

  const mem = (performance as any).memory?.usedJSHeapSize
  if (mem) {
    const mb = mem / (1024 * 1024)
    memorySamples.push(mb)
    if (mb > peakMemory) peakMemory = mb
  }
}

const textEncoder = new TextEncoder()

/**
 * Get or create a vehicle instance for the benchmark
 * @returns {ArduSub} A vehicle instance that can process MAVLink messages
 */
function getOrCreateBenchmarkVehicle(): ArduSub {
  const connected = vehicleStore.mainVehicle
  if (connected) return connected as ArduSub
  if (!benchmarkVehicle) {
    benchmarkVehicle = new ArduSub(1)
  }
  return benchmarkVehicle
}

/**
 * Handler for each synthetic message
 * @param {Package} pkg - The synthetic MAVLink package
 */
function handleSyntheticMessage(pkg: Package): void {
  getOrCreateBenchmarkVehicle().onIncomingMessage(textEncoder.encode(JSON.stringify(pkg)))
}

/**
 * Start the benchmark run
 */
function runBenchmark(): void {
  resetPerfReport()
  enableInstrumentation()
  syntheticListenerCallCount = 0
  fpsSamples = []
  memorySamples = []
  cpuSamples = []
  lastFrameTime = 0
  peakMemory = 0
  peakCpu = 0
  elapsedSec.value = 0
  progressPct.value = 0
  liveFps.value = 0
  liveMemory.value = 0
  liveCpu.value = 0
  running.value = true
  latestReport.value = null
  benchmarkStartTime = performance.now()

  nextTick(() => {
    rafId = requestAnimationFrame(sampleFrame)
    generator.start(targetHz.value, handleSyntheticMessage)

    setTimeout(() => {
      registerSyntheticListeners(listenersPerVar.value)
    }, 500)

    resourceTimer = setInterval(sampleResources, 100)

    progressTimer = setInterval(() => {
      const elapsed = (performance.now() - benchmarkStartTime) / 1000
      elapsedSec.value = elapsed
      progressPct.value = Math.min(100, (elapsed / durationSec.value) * 100)
      if (fpsSamples.length > 0) liveFps.value = fpsSamples[fpsSamples.length - 1]
      if (memorySamples.length > 0) liveMemory.value = memorySamples[memorySamples.length - 1]
      if (cpuSamples.length > 0) liveCpu.value = cpuSamples[cpuSamples.length - 1]

      if (elapsed >= durationSec.value) {
        finishBenchmark()
      }
    }, 1000)
  })
}

/**
 * Stop the benchmark early
 */
function stopBenchmark(): void {
  finishBenchmark()
}

/**
 * Finish the benchmark and generate the report
 */
function finishBenchmark(): void {
  generator.stop()
  removeSyntheticListeners()
  disableInstrumentation()
  running.value = false
  cancelAnimationFrame(rafId)

  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (resourceTimer) {
    clearInterval(resourceTimer)
    resourceTimer = null
  }

  const actualDuration = (performance.now() - benchmarkStartTime) / 1000
  const perfReport = getPerfReport()

  const avgFps = fpsSamples.length > 0 ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0
  const minFps = fpsSamples.length > 0 ? Math.min(...fpsSamples) : 0

  const setVarCount = perfReport.metrics['dataLake:setVariable']?.count ?? 0
  const msgCount = generator.messagesGenerated || 1

  const lt = perfReport.longTasks
  const report: BenchmarkReport = {
    targetHz: targetHz.value,
    actualMsgPerSec: generator.messagesGenerated / actualDuration,
    totalMessages: generator.messagesGenerated,
    durationSec: actualDuration,
    avgFps,
    minFps,
    peakMemoryMB: peakMemory,
    avgCpuPercent: cpuSamples.length > 0 ? cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length : 0,
    peakCpuPercent: peakCpu,
    varsPerMessage: setVarCount / msgCount,
    listenersPerVariable: listenersPerVar.value,
    listenerCallbackCount: syntheticListenerCallCount,
    widgetsRendered: renderWidgets.value ? WIDGET_COUNT : 0,
    perfMetrics: perfReport.metrics,
    longTaskCount: lt.length,
    longTaskTotalMs: lt.reduce((sum, t) => sum + t.duration, 0),
    longTaskWorstMs: lt.length > 0 ? Math.max(...lt.map((t) => t.duration)) : 0,
    fpsHistory: [...fpsSamples],
    memoryHistory: [...memorySamples],
    cpuHistory: [...cpuSamples],
    timestamp: new Date().toISOString(),
  }

  latestReport.value = report
  saveRunToHistory(report)

  nextTick(renderCharts)
}

/**
 * Color class for FPS based on value
 * @param {number} fps
 * @returns {string} Tailwind color class
 */
function fpsColor(fps: number): string {
  if (fps >= 55) return 'text-green-400'
  if (fps >= 30) return 'text-yellow-400'
  return 'text-red-400'
}

/**
 * Copy the current report to clipboard as JSON
 */
function copyReport(): void {
  if (!latestReport.value) return
  navigator.clipboard.writeText(JSON.stringify(latestReport.value, null, 2))
}
</script>

<style scoped>
.bench-widget-cell {
  background: #0a0f1a;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
}
</style>
