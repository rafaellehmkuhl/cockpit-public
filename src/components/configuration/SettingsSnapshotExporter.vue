<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-row items-center gap-2">
      <v-btn variant="tonal" prepend-icon="mdi-folder-arrow-down-outline" @click="exportSnapshot">
        Export settings snapshot
      </v-btn>
      <span v-if="lastExportFolder" class="text-sm opacity-70">Last saved to {{ lastExportFolder }}</span>
    </div>
    <span v-if="exporting" class="text-sm opacity-70">Writing snapshot...</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { settingsManager } from '@/libs/settings-management'

const exporting = ref(false)
const lastExportFolder = ref<string | undefined>(undefined)

onMounted(() => {
  lastExportFolder.value = localStorage.getItem('last-settings-export-folder') ?? undefined
})

/**
 * Builds the snapshot filename from the settings of the currently connected user and vehicle.
 * @param {LocalSyncedSettings} settings The full local settings tree
 * @returns {string} The filename to write the snapshot to
 */
const snapshotFileName = (settings: ReturnType<typeof settingsManager.getLocalSettings>): string => {
  const userSettings = settings[settingsManager.currentUsername]
  const vehicleSettings = userSettings[settingsManager.currentVehicleId]
  const settingsCount = Object.keys(vehicleSettings).length
  const stamp = new Date().toISOString().replaceAll(':', '-')
  return `cockpit-settings-${settingsCount}-keys-${stamp}.json`
}

const exportSnapshot = async (): Promise<void> => {
  exporting.value = true

  const settings = settingsManager.getLocalSettings()
  const snapshot = {
    exportedAt: new Date().toISOString(),
    user: settingsManager.currentUsername,
    vehicle: settingsManager.currentVehicleId,
    settings: settings[settingsManager.currentUsername][settingsManager.currentVehicleId],
  }

  const folder = await window.electronAPI.selectCockpitFolder()
  const fileName = snapshotFileName(settings)
  await window.electronAPI.setCockpitFolderPath(`${folder}/${fileName}`)

  localStorage.setItem('last-settings-export-folder', folder)
  lastExportFolder.value = folder

  JSON.stringify(snapshot, null, 2)

  exporting.value = false
}
</script>
