import { onUnmounted, reactive, toRefs } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { settingsManager } from '@/libs/settings-management'
import type { SyncReason, SyncSettingDetail, SyncStatusEvent } from '@/types/settings-management'

/**
 *
 */
interface SyncState {
  /**
   *
   */
  isSyncing: boolean
  /**
   *
   */
  syncReason: SyncReason | null
  /**
   *
   */
  currentStep: string
  /**
   *
   */
  resolvedSettings: SyncSettingDetail[]
  /**
   *
   */
  pushProgress: {
    /**
     *
     */
    pushed: number
    /**
     *
     */
    skipped: number
    /**
     *
     */
    total: number
  }
  /**
   *
   */
  syncResult: 'success' | 'aborted' | 'error' | null
  /**
   *
   */
  syncError: string | null
  /**
   *
   */
  currentUser: string
  /**
   *
   */
  currentVehicleId: string
  /**
   *
   */
  showDialog: boolean
  /**
   *
   */
  autoCloseActive: boolean
  /**
   *
   */
  autoCloseProgress: number
}

/**
 * Composable that tracks settings sync status by listening to SettingsManager events
 * @returns {object} Reactive sync state and a method to dismiss the dialog
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSyncStatus() {
  const state = reactive<SyncState>({
    isSyncing: false,
    syncReason: null,
    currentStep: '',
    resolvedSettings: [],
    pushProgress: { pushed: 0, skipped: 0, total: 0 },
    syncResult: null,
    syncError: null,
    currentUser: '',
    currentVehicleId: '',
    showDialog: false,
    autoCloseActive: false,
    autoCloseProgress: 100,
  })

  const dismissDialog = (): void => {
    state.showDialog = false
    state.autoCloseActive = false
  }

  const startAutoClose = (): void => {
    state.autoCloseActive = true
    state.autoCloseProgress = 100
    const intervalMs = 50
    const step = (intervalMs / 3000) * 100
    const interval = setInterval(() => {
      if (!state.autoCloseActive) {
        clearInterval(interval)
        return
      }
      state.autoCloseProgress -= step
      if (state.autoCloseProgress <= 0) {
        clearInterval(interval)
        dismissDialog()
      }
    }, intervalMs)
  }

  const cancelAutoClose = (): void => {
    state.autoCloseActive = false
  }

  const handleSyncEvent = (event: SyncStatusEvent): void => {
    switch (event.type) {
      case 'sync-started':
        cancelAutoClose()
        state.isSyncing = true
        state.syncReason = event.reason
        state.currentUser = event.user
        state.currentVehicleId = event.vehicleId
        state.currentStep = 'Starting sync'
        state.resolvedSettings = []
        state.pushProgress = { pushed: 0, total: 0 }
        state.syncResult = null
        state.syncError = null
        state.showDialog = true
        break

      case 'sync-step':
        state.currentStep = event.step
        break

      case 'setting-resolved':
        state.resolvedSettings.push(event.detail)
        break

      case 'push-started':
        state.pushProgress = { pushed: 0, total: event.totalKeys }
        break

      case 'push-progress':
        state.pushProgress = { pushed: event.pushed, skipped: event.skipped, total: event.total }
        break

      case 'push-skipped':
        break

      case 'sync-completed':
        state.isSyncing = false
        state.syncResult = 'success'
        state.currentStep = 'Sync complete'
        startAutoClose()
        break

      case 'sync-aborted':
        state.isSyncing = false
        state.syncResult = 'aborted'
        state.syncError = event.reason
        state.currentStep = 'Sync aborted'
        startAutoClose()
        break

      case 'sync-error':
        state.syncError = event.error
        state.syncResult = 'error'
        state.currentStep = 'Sync error'
        break

      case 'key-pushed':
        openSnackbar({
          message: `Pushing '${event.key}' to vehicle (${event.vehicleId.slice(0, 8)}) for user '${event.user}'`,
          variant: 'info',
          duration: 5000,
        })
        break
    }
  }

  const listenerId = settingsManager.registerSyncStatusListener(handleSyncEvent)

  onUnmounted(() => {
    settingsManager.unregisterSyncStatusListener(listenerId)
    cancelAutoClose()
  })

  return {
    ...toRefs(state),
    dismissDialog,
    cancelAutoClose,
  }
}
