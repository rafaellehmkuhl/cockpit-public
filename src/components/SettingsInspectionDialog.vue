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
        <div v-for="(vehicleSettings, vehicleId) in currentUserSettings" :key="vehicleId" class="ml-4 mb-4">
          <div class="text-subtitle-1 mb-2">Vehicle: {{ vehicleId }}</div>
          <v-table :key="updateCounter" density="compact" class="settings-table mb-4">
            <thead>
              <tr>
                <th class="text-left">Setting Key</th>
                <th class="text-left">Value</th>
                <th class="text-left">Last Changed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(setting, key) in vehicleSettings" :key="key + '_' + setting.epochLastChangedLocally">
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
      </div>
      <div v-else class="text-center py-4">No settings found for current user</div>
    </v-card-text>
    <v-divider class="mx-10" />
    <v-card-actions>
      <div class="flex justify-between items-center pa-2 w-full h-full">
        <v-btn color="white" variant="text" @click="show = false">Hide</v-btn>
      </div>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { settingsManager } from '@/libs/settings-management'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { CockpitSetting, LocalSyncedSettings, SettingsListener } from '@/types/settings-management'

/**
 * Props for the SettingsInspectionDialog component
 */
const props = defineProps<{
  /**
   * Whether the inspector is shown or not
   */
  show: boolean
}>()

/**
 * Emits for the SettingsInspectionDialog component
 */
const emit = defineEmits<{
  /**
   * Emitted when the visibility changes
   */
  'update:show': [value: boolean]
}>()

const interfaceStore = useAppInterfaceStore()
const show = ref(props.show)
const updateCounter = ref(0)
const settingsData = ref<LocalSyncedSettings>(settingsManager.getLocalSettings())

watch(
  () => props.show,
  (newValue) => {
    show.value = newValue
  }
)

watch(show, (newValue) => {
  emit('update:show', newValue)
})

const currentUser = ref('')

const settings = computed(() => {
  return settingsData.value
})

const currentUserSettings = computed(() => {
  if (!settings.value || !currentUser.value) return null
  return settings.value[currentUser.value] || null
})

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

/**
 * Handler for settings changes
 * @param newSettings - The new settings object
 * @param newSetting
 */
const handleSettingsChange = (newSetting: CockpitSetting): void => {
  console.log('[SettingsInspector] Settings updated:', newSetting)
  settingsData.value = settingsManager.getLocalSettings()
  updateCounter.value++ // Force table re-render
}

setInterval(() => {
  currentUser.value = settingsManager.currentUser
}, 100)

const listeners: SettingsListener[] = []

onMounted(() => {
  // Register listeners for all settings keys
  const allSettings = settingsManager.getLocalSettings()
  Object.keys(allSettings).forEach((userId) => {
    Object.keys(allSettings[userId]).forEach((vehicleId) => {
      Object.keys(allSettings[userId][vehicleId]).forEach((key) => {
        listeners.push(settingsManager.registerListener(key, handleSettingsChange))
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
        settingsManager.unregisterListener(
          key,
          listeners.find((listener) => listener.key === key)
        )
      })
    })
  })
})

defineExpose({
  show,
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
