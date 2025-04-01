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
        width: '600px',
        overflowY: 'auto',
      },
    ]"
  >
    <v-card-title class="text-h6 font-weight-bold py-4 text-center">Settings Inspection</v-card-title>
    <v-card-text class="px-8">
      <div v-if="currentUserSettings" class="mb-6">
        <div class="text-h6 mb-2">User: {{ currentUser }}</div>
        <div class="text-subtitle-1 mb-2">Vehicle: {{ currentVehicle }}</div>
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
              v-for="(setting, key) in getSortedSettings(currentUserSettings)"
              :key="key + '_' + setting.epochLastChangedLocally"
            >
              <td class="text-wrap" style="max-width: 200px">{{ key }}</td>
              <td class="text-wrap" style="max-width: 200px">{{ formatValue(setting.value) }}</td>
              <td>
                <div v-if="setting.epochLastChangedLocally === 0">--</div>
                <div v-else>
                  <div>{{ new Date(setting.epochLastChangedLocally).toLocaleString() }}</div>
                  <div class="text-caption text-grey">Epoch: {{ setting.epochLastChangedLocally }}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <div v-else class="text-center py-4">No settings found for current user</div>
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

const currentUserSettings = computed(() => {
  if (!settings.value || !currentUser.value || !currentVehicle.value) return null
  return settings.value[currentUser.value][currentVehicle.value] || null
})

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
  if (typeof value === 'object') return '{...}'
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
</style>
