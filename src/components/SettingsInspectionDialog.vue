<template>
  <v-card
    class="settings-inspector rounded-lg"
    :style="[
      interfaceStore.globalGlassMenuStyles,
      {
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        maxHeight: '80vh',
        width: '800px',
        overflowY: 'auto',
      },
    ]"
  >
    <v-card-title class="text-h6 font-weight-bold py-4 text-center">Settings Inspection - All Users & Vehicles</v-card-title>
    <v-card-text class="px-8">
      <div v-if="Object.keys(settings).length > 0">
        <div v-for="(userSettings, userId) in settings" :key="userId" class="user-section mb-8">
          <v-expansion-panels v-model="expandedUsers[userId]" multiple>
            <v-expansion-panel>
              <v-expansion-panel-title class="text-h6 font-weight-bold user-header">
                <v-icon class="mr-2">mdi-account</v-icon>
                User: {{ userId }}
                <span class="text-caption ml-2">({{ Object.keys(userSettings).length }} vehicles)</span>
                <span v-if="userId === currentUser" class="current-indicator ml-2">CURRENT</span>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div v-for="(vehicleSettings, vehicleId) in userSettings" :key="vehicleId" class="vehicle-section mb-6">
                  <v-expansion-panels v-model="expandedVehicles[`${userId}_${vehicleId}`]" multiple>
                    <v-expansion-panel>
                      <v-expansion-panel-title class="text-subtitle-1 font-weight-medium vehicle-header">
                        <v-icon class="mr-2">mdi-car</v-icon>
                        Vehicle: {{ vehicleId }}
                        <span class="text-caption ml-2">({{ Object.keys(vehicleSettings).length }} settings)</span>
                        <span v-if="vehicleId === currentVehicle && userId === currentUser" class="current-indicator ml-2">CURRENT</span>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <v-table density="compact" class="settings-table mb-4">
                          <thead>
                            <tr>
                              <th class="text-left">Setting Key</th>
                              <th class="text-left">Value</th>
                              <th class="text-left">Last Changed</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="(setting, key) in getSortedSettings(vehicleSettings)"
                              :key="key + '_' + setting.epochLastChangedLocally"
                            >
                              <td class="text-wrap" style="max-width: 250px">{{ key }}</td>
                              <td class="text-wrap" style="max-width: 250px">{{ formatValue(setting.value) }}</td>
                              <td style="min-width: 150px">
                                <div v-if="setting.epochLastChangedLocally === 0">--</div>
                                <div v-else>
                                  <div>{{ new Date(setting.epochLastChangedLocally).toLocaleString() }}</div>
                                  <div class="text-caption text-grey">Epoch: {{ setting.epochLastChangedLocally }}</div>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </v-table>
                        <div v-if="Object.keys(vehicleSettings).length === 0" class="text-center py-4 text-grey">
                          No settings found for this vehicle
                        </div>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </div>
      <div v-else class="text-center py-4">No settings found</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { settingsManager } from '@/libs/settings-management'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { CockpitSetting, LocalSyncedSettings } from '@/types/settings-management'

const interfaceStore = useAppInterfaceStore()
const settings = ref<LocalSyncedSettings>(settingsManager.getLocalSettings())

const currentUser = ref('')
const currentVehicle = ref('')

// Track expanded state for accordion panels
const expandedUsers = ref<Record<string, number[]>>({})
const expandedVehicles = ref<Record<string, number[]>>({})

/**
 * Sorts settings by last changed timestamp in descending order (most recent first)
 * @param vehicleSettings - The vehicle settings object to sort
 * @returns The sorted settings as [key, setting] entries
 */
const getSortedSettings = (vehicleSettings: Record<string, CockpitSetting>): Record<string, CockpitSetting> => {
  if (!vehicleSettings || Object.keys(vehicleSettings).length === 0) return {}
  return Object.entries(vehicleSettings)
    .sort(([, a], [, b]) => b.epochLastChangedLocally - a.epochLastChangedLocally)
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as Record<string, CockpitSetting>)
}

/**
 * Formats a value for display in the table
 * @param value - The value to format
 * @returns A string representation of the value
 */
const formatValue = (value: any): string => {
  if (value === undefined || value === null) return 'undefined'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

let settingsChangeUpdateTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Handler for settings changes
 * @param newSettings - The new settings object
 * @param newSetting
 * @param key
 */
const handleSettingsChange = (newSetting: CockpitSetting, key: string): void => {
  if (settingsChangeUpdateTimeout) {
    clearTimeout(settingsChangeUpdateTimeout)
  }
  settingsChangeUpdateTimeout = setTimeout(() => {
    settings.value = settingsManager.getLocalSettings()
  }, 100)
}

setInterval(() => {
  currentUser.value = settingsManager.currentUser
  currentVehicle.value = settingsManager.currentVehicle
}, 100)

const listenersIds: Record<string, string> = {}

onMounted(() => {
  // Register listeners for all settings keys
  const allSettings = settingsManager.getLocalSettings()
  Object.keys(allSettings).forEach((userId) => {
    Object.keys(allSettings[userId]).forEach((vehicleId) => {
      Object.keys(allSettings[userId][vehicleId]).forEach((key) => {
        listenersIds[key] = settingsManager.registerListener(key, (newSetting) => handleSettingsChange(newSetting, key))
      })
    })
  })

  // Initialize expansion state - expand current user and vehicle by default
  setTimeout(() => {
    if (currentUser.value) {
      expandedUsers.value[currentUser.value] = [0]
      if (currentVehicle.value) {
        expandedVehicles.value[`${currentUser.value}_${currentVehicle.value}`] = [0]
      }
    }
  }, 100)
})

onBeforeUnmount(() => {
  // Unregister listeners for all settings keys
  const allSettings = settingsManager.getLocalSettings()
  Object.keys(allSettings).forEach((userId) => {
    Object.keys(allSettings[userId]).forEach((vehicleId) => {
      Object.keys(allSettings[userId][vehicleId]).forEach((key) => {
        settingsManager.unregisterListener(key, listenersIds[key])
      })
    })
  })
})
</script>

<style scoped>
.settings-inspector {
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5) !important;
}

.settings-table {
  background: transparent;
}

.v-table {
  color: white !important;
}

.v-table th {
  color: rgba(255, 255, 255, 0.9) !important;
  background-color: rgba(255, 255, 255, 0.1) !important;
  font-weight: bold !important;
  white-space: nowrap !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 1 !important;
}

.v-table td {
  color: rgba(255, 255, 255, 0.8) !important;
  word-break: break-word;
}

.text-wrap {
  white-space: normal !important;
  word-break: break-word !important;
}

.text-caption {
  font-size: 0.75rem !important;
  opacity: 0.7;
}

.text-grey {
  color: rgba(255, 255, 255, 0.6) !important;
}

.v-table tr:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.v-card {
  background-color: rgba(30, 30, 30, 0.95) !important;
}

.v-card-title {
  color: white !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 2 !important;
  background-color: rgba(30, 30, 30, 0.95) !important;
}

.user-section {
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  padding-left: 16px;
}

.vehicle-section {
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  padding-left: 12px;
  margin-left: 16px;
}

.user-header {
  background-color: rgba(33, 150, 243, 0.1) !important;
  color: white !important;
}

.vehicle-header {
  background-color: rgba(76, 175, 80, 0.1) !important;
  color: white !important;
}

.current-indicator {
  background-color: rgba(255, 193, 7, 0.8);
  color: black !important;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}

:deep(.v-expansion-panel-title) {
  color: white !important;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 8px 16px 16px !important;
}

:deep(.v-expansion-panel) {
  background-color: rgba(255, 255, 255, 0.02) !important;
  margin-bottom: 8px !important;
}
</style>
