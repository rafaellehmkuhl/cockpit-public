<template>
  <v-dialog v-model="dialogVisible" persistent max-width="520" :scrim="isSyncing">
    <v-card class="rounded-lg pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="d-flex align-center gap-2 pb-1">
        <v-icon :class="{ 'animate-spin': isSyncing }" size="24">mdi-sync</v-icon>
        <span class="text-lg font-bold">Settings Sync</span>
        <v-spacer />
        <v-chip v-if="syncResult" :color="resultColor" size="small" variant="tonal">
          {{ resultLabel }}
        </v-chip>
      </v-card-title>

      <v-card-subtitle class="pb-2">
        <template v-if="syncReason === 'vehicle-online'"> Vehicle came online — syncing settings </template>
        <template v-else-if="syncReason === 'user-changed'"> User changed — syncing settings </template>
        <div v-if="currentUser || currentVehicleId" class="text-xs mt-1 opacity-70">
          User: <strong>{{ currentUser }}</strong> &middot; Vehicle: <strong>{{ shortVehicleId }}</strong>
        </div>
      </v-card-subtitle>

      <v-card-text class="pt-2 pb-1">
        <div class="mb-3">
          <div class="text-sm mb-1 opacity-80">{{ currentStep }}</div>
          <v-progress-linear
            :indeterminate="isSyncing && pushProgress.total === 0"
            :model-value="progressPercent"
            :color="progressColor"
            height="6"
            rounded
          />
          <div v-if="pushProgress.total > 0" class="text-xs mt-1 opacity-60">
            {{ pushProgress.pushed }} pushed, {{ pushProgress.skipped }} unchanged ({{ pushProgress.total }} total)
          </div>
        </div>

        <div v-if="syncError" class="text-error text-sm mb-2">
          {{ syncError }}
        </div>

        <v-expand-transition>
          <div v-if="resolvedSettings.length > 0">
            <v-divider class="mb-2 opacity-20" />
            <div class="text-xs font-bold mb-1 opacity-70">Resolved settings ({{ resolvedSettings.length }})</div>
            <div class="max-h-[200px] overflow-y-auto">
              <div
                v-for="setting in resolvedSettings"
                :key="setting.key"
                class="d-flex align-center gap-2 py-1 text-xs"
              >
                <v-icon :color="resolutionColor(setting.resolution)" size="14">
                  {{ resolutionIcon(setting.resolution) }}
                </v-icon>
                <span class="truncate flex-1" :title="setting.key">{{ setting.key }}</span>
                <span class="opacity-50 text-[10px] shrink-0">{{ resolutionLabel(setting.resolution) }}</span>
              </div>
            </div>
          </div>
        </v-expand-transition>
      </v-card-text>

      <v-progress-linear
        v-if="autoCloseActive"
        :model-value="autoCloseProgress"
        color="white"
        height="3"
        class="mt-1 opacity-40"
      />
      <v-card-actions class="pt-1 justify-between">
        <span v-if="autoCloseActive" class="text-xs opacity-50 pl-2">Closing automatically...</span>
        <span v-else />
        <div class="d-flex gap-1">
          <v-btn v-if="autoCloseActive" size="small" variant="text" @click="cancelAutoClose">Keep open</v-btn>
          <v-btn size="small" variant="text" @click="dismissDialog">
            {{ isSyncing ? 'Dismiss' : 'Close' }}
          </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useSyncStatus } from '@/composables/useSyncStatus'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { SyncSettingResolution } from '@/types/settings-management'

const interfaceStore = useAppInterfaceStore()

const {
  isSyncing,
  syncReason,
  currentStep,
  resolvedSettings,
  pushProgress,
  syncResult,
  syncError,
  currentUser,
  currentVehicleId,
  showDialog,
  autoCloseActive,
  autoCloseProgress,
  dismissDialog,
  cancelAutoClose,
} = useSyncStatus()

const dialogVisible = computed({
  get: () => showDialog.value,
  set: (val: boolean) => {
    if (!val) dismissDialog()
  },
})

const shortVehicleId = computed(() => {
  const id = currentVehicleId.value
  if (!id || id.length <= 12) return id
  return `${id.slice(0, 8)}...`
})

const progressPercent = computed(() => {
  if (pushProgress.value.total === 0) return 0
  const processed = pushProgress.value.pushed + pushProgress.value.skipped
  return (processed / pushProgress.value.total) * 100
})

const resultColor = computed(() => {
  switch (syncResult.value) {
    case 'success':
      return 'success'
    case 'aborted':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return undefined
  }
})

const resultLabel = computed(() => {
  switch (syncResult.value) {
    case 'success':
      return 'Complete'
    case 'aborted':
      return 'Aborted'
    case 'error':
      return 'Error'
    default:
      return ''
  }
})

const progressColor = computed(() => {
  if (syncResult.value === 'error') return 'error'
  if (syncResult.value === 'aborted') return 'warning'
  if (syncResult.value === 'success') return 'success'
  return 'primary'
})

const resolutionIcon = (resolution: SyncSettingResolution): string => {
  switch (resolution) {
    case 'from-vehicle':
      return 'mdi-download'
    case 'from-local':
      return 'mdi-upload'
    case 'same':
      return 'mdi-check'
    case 'new-on-vehicle':
      return 'mdi-download-outline'
    case 'new-on-local':
      return 'mdi-upload-outline'
  }
}

const resolutionColor = (resolution: SyncSettingResolution): string => {
  switch (resolution) {
    case 'from-vehicle':
      return 'info'
    case 'from-local':
      return 'warning'
    case 'same':
      return 'success'
    case 'new-on-vehicle':
      return 'info'
    case 'new-on-local':
      return 'warning'
  }
}

const resolutionLabel = (resolution: SyncSettingResolution): string => {
  switch (resolution) {
    case 'from-vehicle':
      return 'from vehicle'
    case 'from-local':
      return 'from local'
    case 'same':
      return 'in sync'
    case 'new-on-vehicle':
      return 'new (vehicle)'
    case 'new-on-local':
      return 'new (local)'
  }
}
</script>

<style scoped>
.animate-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
