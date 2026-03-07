import { onUnmounted, reactive, toRefs } from 'vue'

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
  })

  let autoDismissTimeout: ReturnType<typeof setTimeout> | undefined

  const clearAutoDismiss = (): void => {
    if (autoDismissTimeout) {
      clearTimeout(autoDismissTimeout)
      autoDismissTimeout = undefined
    }
  }

  const scheduleAutoDismiss = (): void => {
    clearAutoDismiss()
    autoDismissTimeout = setTimeout(() => {
      state.showDialog = false
    }, 5000)
  }

  const handleSyncEvent = (event: SyncStatusEvent): void => {
    switch (event.type) {
      case 'sync-started':
        clearAutoDismiss()
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
        scheduleAutoDismiss()
        break

      case 'sync-aborted':
        state.isSyncing = false
        state.syncResult = 'aborted'
        state.syncError = event.reason
        state.currentStep = 'Sync aborted'
        scheduleAutoDismiss()
        break

      case 'sync-error':
        state.syncError = event.error
        state.syncResult = 'error'
        state.currentStep = 'Sync error'
        break
    }
  }

  const listenerId = settingsManager.registerSyncStatusListener(handleSyncEvent)

  onUnmounted(() => {
    settingsManager.unregisterSyncStatusListener(listenerId)
    clearAutoDismiss()
  })

  const dismissDialog = (): void => {
    state.showDialog = false
    clearAutoDismiss()
  }

  return {
    ...toRefs(state),
    dismissDialog,
  }
}
