import { onUnmounted, reactive } from 'vue'
import { App, createApp } from 'vue'

import SettingsSyncConflictDialogComponent from '@/components/SettingsSyncConflictDialog.vue'
import vuetify from '@/plugins/vuetify'

/**
 * The settings for the conflict that needs to be resolved.
 */
interface ConflictSettings {
  /**
   * Identificator for the key that is conflicting.
   * @type {string}
   */
  key: string

  /**
   * The value that is currently stored in Cockpit
   * @type {unknown}
   */
  cockpitValue: unknown

  /**
   * The value that is currently stored in the external system (BlueOS)
   * @type {unknown}
   */
  blueOsValue: unknown
}

/**
 * Provides methods to control the settings conflict dialog.
 * @param { string } key
 * @param { unknown } cockpitValue
 * @param { unknown } blueOsValue
 */
export default function useSettingsSyncConflictDialog(key: string, cockpitValue: unknown, blueOsValue: unknown): void {
  let dialogApp: App<Element> | null = null

  const mountDialog = (): void => {
    const mountPoint = document.createElement('div')
    document.body.appendChild(mountPoint)
    dialogApp = createApp(SettingsSyncConflictDialogComponent, {
      ...dialogProps,
    })
    dialogApp.use(vuetify)
    dialogApp.mount(mountPoint)
  }

  const showDialog = (options: ConflictSettings): Promise<void> => {
    return new Promise(() => {
      Object.assign(dialogProps, options, { showDialog: true })
    })
  }

  const closeDialog = (): void => {
    dialogProps.showDialog = false
    if (dialogApp) {
      dialogApp.unmount()
      dialogApp = null
    }
  }

  onUnmounted(() => {
    if (dialogApp) {
      dialogApp.unmount()
    }
  })
}
