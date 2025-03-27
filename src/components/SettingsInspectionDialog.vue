<template>
  <v-dialog v-model="show" max-width="800px">
    <v-card class="rounded-lg settings-dialog" :style="[interfaceStore.globalGlassMenuStyles, { border: '1px solid rgba(255, 255, 255, 0.1)' }]">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">Settings Inspection</v-card-title>
      <v-card-text class="px-8">
        <div v-if="currentUserSettings" class="mb-6">
          <div class="text-h6 mb-2">User: {{ currentUser }}</div>
          <div v-for="(vehicleSettings, vehicleId) in currentUserSettings" :key="vehicleId" class="ml-4 mb-4">
            <div class="text-subtitle-1 mb-2">Vehicle: {{ vehicleId }}</div>
            <v-table density="compact" class="settings-table mb-4">
              <thead>
                <tr>
                  <th class="text-left">Setting Key</th>
                  <th class="text-left">Value</th>
                  <th class="text-left">Last Changed</th>
                  <th class="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(setting, key) in vehicleSettings" :key="key">
                  <td class="text-wrap" style="max-width: 200px">{{ key }}</td>
                  <td class="text-wrap" style="max-width: 200px">{{ formatValue(setting.value) }}</td>
                  <td>{{ new Date(setting.epochLastChangedLocally).toLocaleString() }}</td>
                  <td>
                    <v-chip
                      :color="hasLocalStorageDiff(currentUser, vehicleId, key, setting) ? 'error' : 'success'"
                      size="small"
                    >
                      {{ hasLocalStorageDiff(currentUser, vehicleId, key, setting) ? 'Different' : 'Synced' }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </div>
        <div v-else class="text-center py-4">
          No settings found for current user
        </div>
      </v-card-text>
      <v-divider class="mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeDialog">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { settingsManager } from '@/libs/settings-management'
import { useAppInterfaceStore } from '@/stores/appInterface'

/**
 * Props for the SettingsInspectionDialog component
 */
const props = defineProps<{
  /**
   * Whether the dialog is shown or not
   */
  show: boolean
}>()

/**
 * Emits for the SettingsInspectionDialog component
 */
const emit = defineEmits<{
  /**
   * Emitted when the dialog visibility changes
   */
  'update:show': [value: boolean]
}>()

const interfaceStore = useAppInterfaceStore()
const show = ref(props.show)

watch(() => props.show, (newValue) => {
  show.value = newValue
})

watch(show, (newValue) => {
  emit('update:show', newValue)
})

const currentUser = computed(() => {
  // @ts-ignore - accessing private property
  return settingsManager.currentUser
})

const settings = computed(() => {
  // @ts-ignore - accessing private property
  return settingsManager.localSyncedSettings
})

const currentUserSettings = computed(() => {
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
 * Checks if there is a difference between the in-memory setting and the one stored in localStorage
 * @param userId - The ID of the user
 * @param vehicleId - The ID of the vehicle
 * @param key - The setting key
 * @param setting - The current setting value
 * @returns boolean indicating if there is a difference
 */
const hasLocalStorageDiff = (userId: string, vehicleId: string, key: string, setting: any): boolean => {
  const storedSettings = JSON.parse(localStorage.getItem('cockpit-synced-settings') || '{}')
  const storedSetting = storedSettings[userId]?.[vehicleId]?.[key]
  return !storedSetting || storedSetting.epochLastChangedLocally !== setting.epochLastChangedLocally
}

/**
 * Closes the dialog by setting show to false
 */
const closeDialog = (): void => {
  show.value = false
}

defineExpose({
  show
})
</script>

<style scoped>
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
}

.v-table td {
  color: rgba(255, 255, 255, 0.8) !important;
  word-break: break-word;
}

.text-wrap {
  white-space: normal !important;
  word-break: break-word !important;
}

.v-table tr:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.v-card {
  background-color: rgba(30, 30, 30, 0.95) !important;
}

.v-card-title {
  color: white !important;
}
</style>