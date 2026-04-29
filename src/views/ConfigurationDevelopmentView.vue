<template>
  <BaseConfigurationView>
    <template #title>Development configuration</template>
    <template #content>
      <div
        class="max-h-[85vh] overflow-y-auto -mr-2 mb-2"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[85vw]' : 'max-w-[50vw]'"
      >
        <div
          class="flex flex-col justify-between items-center w-full"
          :class="interfaceStore.isOnSmallScreen ? 'scale-[80%] mt-0 -mb-3' : 'scale-95 mt-4'"
        >
          <div class="flex flex-row gap-x-[40px]">
            <v-switch
              v-model="devStore.developmentMode"
              label="Development mode"
              color="white"
              hide-details
              class="min-w-[155px]"
            />
            <v-switch
              v-model="devStore.enableBlueOsSettingsSync"
              label="BlueOS settings sync"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
            <v-switch
              v-model="devStore.enableUsageStatisticsTelemetry"
              label="Usage statistics telemetry"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
            <v-switch
              v-model="devStore.enableSystemLogging"
              label="Enable system logging"
              color="white"
              hide-details
              class="min-w-[155px]"
              @update:model-value="reloadCockpitAndWarnUser()"
            />
          </div>
          <div class="flex flex-row w-full justify-start gap-x-[40px]">
            <v-switch
              v-model="devStore.showSplashScreenOnStartup"
              label="Show splashscreen on startup"
              color="white"
              hide-details
              class="min-w-[155px]"
            />
          </div>
          <v-slider
            v-model="devStore.widgetDevInfoBlurLevel"
            label="Dev info blur level"
            min="0"
            max="10"
            class="w-[350px]"
            color="white"
            step="1"
            thumb-label="hover"
          />
        </div>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-bottom-divider>
          <template #title>
            <div class="flex justify-between">
              <span>System info</span>
              <div class="flex items-center gap-2">
                <span v-if="lastRefreshTimestamp" class="text-sm text-gray-300"> Updated {{ secondsAgo }}s ago </span>
                <v-tooltip text="Refresh">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon
                      v-bind="tooltipProps"
                      class="cursor-pointer"
                      :class="{ 'opacity-50': isRefreshing }"
                      @click.stop="refreshDiagnostic"
                    >
                      mdi-refresh
                    </v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="Copy diagnostic report to clipboard">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon v-bind="tooltipProps" class="cursor-pointer" @click.stop="copyDiagnosticReport">
                      mdi-content-copy
                    </v-icon>
                  </template>
                </v-tooltip>
              </div>
            </div>
          </template>
          <template #content>
            <div v-if="!diagnosticInfo" class="px-4 py-6 text-center text-sm text-gray-300">
              <span v-if="!isRunningInElectron">
                System info is only available in the Cockpit Standalone (Electron) build.
              </span>
              <span v-else>Loading system information...</span>
            </div>
            <div v-else class="bg-[#FFFFFF11] rounded-lg p-3 text-sm flex flex-col gap-3">
              <table class="w-full diagnostic-table">
                <tbody>
                  <tr>
                    <th>Cockpit</th>
                    <td>{{ diagnosticInfo.cockpitVersion }}</td>
                  </tr>
                  <tr>
                    <th>Runtime</th>
                    <td>
                      Electron {{ diagnosticInfo.electronVersion }} · Chromium {{ diagnosticInfo.chromeVersion }} · Node
                      {{ diagnosticInfo.nodeVersion }}
                    </td>
                  </tr>
                  <tr>
                    <th>OS</th>
                    <td>{{ diagnosticInfo.platform }} {{ diagnosticInfo.osRelease }} ({{ diagnosticInfo.arch }})</td>
                  </tr>
                  <tr>
                    <th>CPU</th>
                    <td>
                      {{ diagnosticInfo.cpuModel ?? 'unknown' }} ({{ diagnosticInfo.cpuLogicalCores }} logical cores)
                    </td>
                  </tr>
                  <tr>
                    <th>RAM</th>
                    <td>
                      total {{ formatBytes(diagnosticInfo.totalMemoryBytes) }} · free
                      <span :class="lowMemory ? 'text-red-400 font-medium' : ''">
                        {{ formatBytes(diagnosticInfo.freeMemoryBytes) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="diagnosticInfo.videosFolderDisk">
                    <th>Videos disk</th>
                    <td>
                      <code class="text-xs">{{ diagnosticInfo.videosFolderDisk.path }}</code>
                      <br />
                      <span :class="lowDisk ? 'text-red-400 font-medium' : ''">
                        {{ formatBytes(diagnosticInfo.videosFolderDisk.freeBytes) }} free
                      </span>
                      of {{ formatBytes(diagnosticInfo.videosFolderDisk.totalBytes) }} ({{
                        diskUsedPercent.toFixed(0)
                      }}% used)
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="resourceUsage">
                <h3 class="text-sm font-medium mb-1">Cockpit resource usage</h3>
                <table class="w-full diagnostic-table">
                  <tbody>
                    <tr>
                      <th>Main process</th>
                      <td>{{ resourceUsage.mainMemoryMB.toFixed(0) }} MB</td>
                    </tr>
                    <tr>
                      <th>Renderers + utility</th>
                      <td>{{ resourceUsage.renderersMemoryMB.toFixed(0) }} MB</td>
                    </tr>
                    <tr>
                      <th>GPU process</th>
                      <td>{{ resourceUsage.gpuMemoryMB.toFixed(0) }} MB</td>
                    </tr>
                    <tr>
                      <th>Total memory</th>
                      <td>{{ resourceUsage.totalMemoryMB.toFixed(0) }} MB</td>
                    </tr>
                    <tr>
                      <th>Aggregate CPU</th>
                      <td>{{ resourceUsage.cpuUsagePercent.toFixed(1) }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 class="text-sm font-medium mb-1">GPUs ({{ diagnosticInfo.gpu.allGpus.length }})</h3>
                <table v-if="diagnosticInfo.gpu.allGpus.length > 0" class="w-full diagnostic-table">
                  <thead>
                    <tr>
                      <th class="text-left">#</th>
                      <th class="text-left">Name</th>
                      <th class="text-left">Vendor</th>
                      <th class="text-left">Driver</th>
                      <th class="text-left">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(gpu, idx) in diagnosticInfo.gpu.allGpus" :key="idx">
                      <td>{{ idx }}</td>
                      <td>{{ gpu.name ?? 'unknown' }}</td>
                      <td>{{ gpu.vendor ?? 'unknown' }}</td>
                      <td>{{ gpu.driverVersion ?? 'unknown' }}</td>
                      <td>{{ gpu.active ? 'yes' : 'no' }}</td>
                    </tr>
                  </tbody>
                </table>
                <span v-else class="text-sm text-gray-400">No GPUs reported by Chromium.</span>
              </div>

              <div v-if="gpuFeatureKeys.length > 0">
                <h3 class="text-sm font-medium mb-1">GPU feature status</h3>
                <table class="w-full diagnostic-table">
                  <tbody>
                    <tr v-for="key in gpuFeatureKeys" :key="key">
                      <th>{{ key }}</th>
                      <td>
                        <span :class="featureStatusColor(diagnosticInfo.gpu.featureStatus[key])">
                          {{ diagnosticInfo.gpu.featureStatus[key] }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen" no-bottom-divider>
          <template #title>
            <div class="flex justify-between">
              <span>System logs</span>
              <span class="text-sm text-gray-300 cursor-pointer" @click.stop="deleteOldLogs">
                <v-tooltip text="Delete old logs">
                  <template #activator="{ props }">
                    <v-icon left class="mr-2" v-bind="props">mdi-delete-sweep</v-icon>
                  </template>
                </v-tooltip>
              </span>
            </div>
          </template>
          <template #content>
            <v-data-table
              :items="systemLogsData"
              density="compact"
              theme="dark"
              :headers="headers"
              class="bg-[#FFFFFF11] rounded-lg"
            >
              <template #item.name="{ item }">
                <div class="flex items-center gap-2">
                  <span>{{ item.name }}</span>
                  <div v-if="item.isCurrentSession" class="current-session-indicator" />
                </div>
              </template>
              <template #item.dateTimeMs="{ item }">
                {{ item.dateTimeFormatted }}
              </template>
              <template #item.sizeBytes="{ item }">
                {{ item.sizeFormatted }}
              </template>
              <template #item.actions="{ item }">
                <div class="flex justify-center space-x-2">
                  <div class="cursor-pointer icon-btn mdi mdi-download" @click="downloadLog(item.name)" />
                  <div class="cursor-pointer icon-btn mdi mdi-delete" @click="deleteLog(item.name)" />
                </div>
              </template>
            </v-data-table>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
// @ts-nocheck
// TODO:  As of now Vuetify does not export the necessary types for VDataTable, so we can't fix the type error.

import { parse } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onBeforeMount, onBeforeUnmount } from 'vue'
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useDiagnosticInfo } from '@/composables/diagnosticInfo'
import { useSnackbar } from '@/composables/snackbar'
import {
  type SystemLog,
  cockpitSytemLogsDB,
  getCurrentSessionLogFileName,
  getCurrentSessionLogInfo,
  systemLogDateTimeFormat,
} from '@/libs/system-logging'
import { formatBytes, isElectron } from '@/libs/utils'
import { reloadCockpitAndWarnUser } from '@/libs/utils-vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useDevelopmentStore } from '@/stores/development'

import BaseConfigurationView from './BaseConfigurationView.vue'
const devStore = useDevelopmentStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()
const {
  diagnosticInfo,
  resourceUsage,
  lastRefreshTimestamp,
  isRefreshing,
  refresh: refreshDiagnostic,
  startPolling: startDiagnosticPolling,
  stopPolling: stopDiagnosticPolling,
  buildDiagnosticReport,
} = useDiagnosticInfo()

const nowMs = ref(Date.now())
let nowTickerInterval: ReturnType<typeof setInterval> | null = null

const secondsAgo = computed(() => {
  if (!lastRefreshTimestamp.value) return 0
  return Math.max(0, Math.round((nowMs.value - lastRefreshTimestamp.value) / 1000))
})

const lowMemory = computed(() => {
  const free = diagnosticInfo.value?.freeMemoryBytes
  return free !== undefined && free < 1 * 1024 ** 3
})

const lowDisk = computed(() => {
  const free = diagnosticInfo.value?.videosFolderDisk?.freeBytes
  return free !== undefined && free < 10 * 1024 ** 3
})

const diskUsedPercent = computed(() => {
  const disk = diagnosticInfo.value?.videosFolderDisk
  if (!disk || disk.totalBytes <= 0) return 0
  return (1 - disk.freeBytes / disk.totalBytes) * 100
})

const gpuFeatureKeys = computed(() => {
  if (!diagnosticInfo.value) return []
  return Object.keys(diagnosticInfo.value.gpu.featureStatus).sort()
})

// Heuristic color for the GPU feature status string, since the exact set of values changes between
// Chromium versions but always uses 'enabled' / 'disabled' / 'unavailable' / 'software' tokens.
const featureStatusColor = (status: string): string => {
  if (!status) return ''
  const lower = status.toLowerCase()
  if (lower.includes('software_only') || lower.includes('software only')) return 'text-yellow-400'
  if (lower.includes('disabled') || lower.includes('unavailable')) return 'text-red-400'
  if (lower.includes('enabled')) return 'text-green-400'
  return ''
}

const copyDiagnosticReport = async (): Promise<void> => {
  const report = buildDiagnosticReport()
  try {
    await navigator.clipboard.writeText(report)
    openSnackbar({ message: 'Diagnostic report copied to clipboard.', variant: 'success', duration: 3000 })
  } catch (error) {
    console.error('Failed to copy diagnostic report:', error)
    openSnackbar({
      message: 'Failed to copy diagnostic report. See console for details.',
      variant: 'error',
      duration: 4000,
    })
  }
}

/* eslint-disable jsdoc/require-jsdoc */
interface SystemLogsData {
  name: string
  dateTimeFormatted: string
  sizeFormatted: string
  sizeBytes: number
  dateTimeMs: number
  isCurrentSession: boolean
}
/* eslint-enable jsdoc/require-jsdoc */

const systemLogsData = ref<SystemLogsData[]>([])
const isRunningInElectron = isElectron()
const currentSessionLogFileName = ref<string | null>(null)
let updateInterval: ReturnType<typeof setInterval> | null = null

/* eslint-disable jsdoc/require-jsdoc */
interface CurrentLogInfo {
  fileName: string
  size: number
}
/* eslint-enable jsdoc/require-jsdoc */

const headers = [
  { title: 'Name', key: 'name', sortable: false },
  { title: 'Date/Time', key: 'dateTimeMs', sortable: true },
  { title: 'Size', key: 'sizeBytes', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false },
]

const updateCurrentSessionLogSize = async (): Promise<void> => {
  if (!currentSessionLogFileName.value) {
    return
  }

  try {
    let logInfo: CurrentLogInfo | null = null

    if (isRunningInElectron) {
      // Get current log info (name and size) directly
      logInfo = (await window.electronAPI?.getCurrentElectronLogInfo()) ?? null
    } else {
      // Get current log info from IndexedDB
      logInfo = await getCurrentSessionLogInfo()
    }

    if (logInfo && logInfo.fileName === currentSessionLogFileName.value) {
      // Update the size in systemLogsData
      const index = systemLogsData.value.findIndex((log) => log.name === currentSessionLogFileName.value)
      if (index !== -1) {
        systemLogsData.value[index].sizeBytes = logInfo.size
        if (isRunningInElectron) {
          systemLogsData.value[index].sizeFormatted = formatBytes(logInfo.size)
        } else {
          // For web version, show event count
          systemLogsData.value[index].sizeFormatted = `${logInfo.size} event${logInfo.size !== 1 ? 's' : ''}`
        }
      }
    }
  } catch (error) {
    // Silently fail - don't spam console with errors
  }
}

onBeforeMount(async () => {
  // Get the current session's log file name
  if (isRunningInElectron) {
    const logInfo = await window.electronAPI?.getCurrentElectronLogInfo()
    currentSessionLogFileName.value = logInfo?.fileName ?? null
    await loadElectronLogs()
  } else {
    currentSessionLogFileName.value = getCurrentSessionLogFileName()
    await loadIndexedDBLogs()
  }

  // Start updating the current session log size every second
  updateInterval = setInterval(updateCurrentSessionLogSize, 1000)

  // Start polling system diagnostic info while this view is mounted, and a 1 Hz "now" ticker
  // so the "Updated Ns ago" label keeps updating between refreshes.
  startDiagnosticPolling(5000)
  nowTickerInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
  stopDiagnosticPolling()
  if (nowTickerInterval) {
    clearInterval(nowTickerInterval)
    nowTickerInterval = null
  }
})

const loadElectronLogs = async (): Promise<void> => {
  try {
    const electronLogs = await window.electronAPI?.getElectronLogs()
    if (electronLogs) {
      const dateTimeFormatWithoutOffset = systemLogDateTimeFormat.replace(' O', '')
      const logs = electronLogs.map((log) => {
        const dateTimeString = log.path.split('(')[1]?.split(' GMT')[0] ?? ''
        const dateTime = parse(dateTimeString, dateTimeFormatWithoutOffset, new Date())
        return {
          name: log.path,
          dateTimeFormatted: `${log.initialDate} - ${log.initialTime}`,
          sizeFormatted: formatBytes(log.size),
          sizeBytes: log.size,
          dateTimeMs: dateTime.getTime(),
          isCurrentSession: log.path === currentSessionLogFileName.value,
        }
      })
      systemLogsData.value = getSortedLogs(logs)
    }
  } catch (error) {
    console.error('Error loading electron logs:', error)
  }
}

const loadIndexedDBLogs = async (): Promise<void> => {
  const logs: SystemLogsData[] = []
  const dateTimeFormatWithoutOffset = systemLogDateTimeFormat.replace(' O', '')
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName) => {
    // Use event count for web version (lighter than estimating size)
    const eventCount = log.events.length
    const dateTimeString = logName.split('(')[1]?.split(' GMT')[0] ?? ''
    const dateTime = parse(dateTimeString, dateTimeFormatWithoutOffset, new Date())
    logs.push({
      name: logName,
      dateTimeFormatted: `${log.initialDate} - ${log.initialTime}`,
      sizeFormatted: `${eventCount} event${eventCount !== 1 ? 's' : ''}`,
      sizeBytes: eventCount, // Use event count for sorting
      dateTimeMs: dateTime.getTime(),
      isCurrentSession: logName === currentSessionLogFileName.value,
    })
  })
  systemLogsData.value = getSortedLogs(logs)
}

const getSortedLogs = (logs: SystemLogsData[]): SystemLogsData[] => {
  return logs.sort((a, b) => b.dateTimeMs - a.dateTimeMs)
}

const downloadLog = async (logName: string): Promise<void> => {
  try {
    if (isRunningInElectron) {
      await downloadLogFromElectron(logName)
    } else {
      await downloadLogFromDB(logName)
    }
  } catch (error) {
    console.error('Error downloading log:', error)
  }
}

const downloadLogFromElectron = async (logName: string): Promise<void> => {
  try {
    const content = await window.electronAPI?.getElectronLogContent(logName)
    if (!content) {
      throw new Error('Failed to get electron log content')
    }

    const logBlob = new Blob([content], { type: 'text/plain' })
    saveAs(logBlob, logName)
  } catch (error) {
    console.error('Error downloading electron log:', error)
    throw error
  }
}

const downloadLogFromDB = async (logName: string): Promise<void> => {
  const log = await cockpitSytemLogsDB.getItem(logName)
  const logParts = JSON.stringify(log, null, 2)
  const logBlob = new Blob([logParts], { type: 'application/json' })
  saveAs(logBlob, logName)
}

const deleteLog = async (logName: string): Promise<void> => {
  try {
    if (isRunningInElectron) {
      // Delete from electron-log
      await window.electronAPI?.deleteElectronLog(logName)
      systemLogsData.value = systemLogsData.value.filter((log) => log.name !== logName)
    } else {
      // Delete from IndexedDB
      await cockpitSytemLogsDB.removeItem(logName)
      systemLogsData.value = systemLogsData.value.filter((log) => log.name !== logName)
    }
  } catch (error) {
    console.error('Error deleting log:', error)
  }
}

const deleteOldLogs = async (): Promise<void> => {
  try {
    if (isRunningInElectron) {
      // Delete old logs from electron-log
      const deletedFiles = await window.electronAPI?.deleteOldElectronLogs()
      if (deletedFiles) {
        systemLogsData.value = systemLogsData.value.filter((log) => !deletedFiles.includes(log.name))
      }
    } else {
      await deleteOldLogsFromDB()
    }
  } catch (error) {
    console.error('Error deleting old logs:', error)
  }
}

const deleteOldLogsFromDB = async (): Promise<void> => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const logsToDelete: string[] = []
  await cockpitSytemLogsDB.iterate((log: SystemLog, logName: string) => {
    const logDate = new Date(log.initialDate)
    if (logDate < yesterday) {
      logsToDelete.push(logName)
    }
  })

  for (const logName of logsToDelete) {
    await cockpitSytemLogsDB.removeItem(logName)
  }

  systemLogsData.value = systemLogsData.value.filter((log) => {
    const logDate = new Date(log.initialDate)
    return logDate >= yesterday
  })
}
</script>
<style scoped>
.custom-header {
  background-color: #333 !important;
  color: #fff;
}

.current-session-indicator {
  width: 8px;
  height: 8px;
  margin-top: 2px;
  border-radius: 50%;
  background-color: #ef4444;
  animation: blink 1.5s infinite;
}

.diagnostic-table th {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  padding: 2px 8px 2px 0;
  vertical-align: top;
  white-space: nowrap;
}
.diagnostic-table td {
  padding: 2px 0;
  vertical-align: top;
  word-break: break-word;
}
.diagnostic-table thead th {
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  padding-bottom: 4px;
  margin-bottom: 4px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
