import 'floating-vue/dist/style.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import '@/libs/system-logging'

import { library } from '@fortawesome/fontawesome-svg-core'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import * as Sentry from '@sentry/vue'
// import { app as electronApp } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import FloatingVue from 'floating-vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import VueVirtualScroller from 'vue-virtual-scroller'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'
import { useOmniscientLoggerStore } from './stores/omniscientLogger'

library.add(fas, far)
loadFonts()

const app = createApp(App)

// Initialize Sentry for error tracking
// Only track usage statistics if the user has not opted out and the app is not in development mode
if (window.localStorage.getItem('cockpit-enable-usage-statistics-telemetry') && import.meta.env.DEV === false) {
  console.log('Initializing Sentry telemetry...')
  Sentry.init({
    app,
    dsn: 'https://d7329dcf760fa1cc9fa6c7a5f16f60a1@o4507696465707008.ingest.us.sentry.io/4507762984222720',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    sampleRate: 1.0, // Capture all errors
    tracesSampleRate: 1.0, // Capture all traces
    tracePropagationTargets: [],
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport), // Cache events and send them when the user comes back online
  })
  Sentry.getCurrentScope().setLevel('info')
}

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.use(router).use(vuetify).use(createPinia()).use(FloatingVue).use(VueVirtualScroller)
app.mount('#app')

// Initialize the logger store
useOmniscientLoggerStore()

console.log('Vue.js main process started.')

const isRunningElectron = navigator.userAgent.toLowerCase().includes('electron')
console.log('Running on electron?', isRunningElectron)

/**
 * Get auto updater instance
 * @returns {AppUpdater}
 * @see https://www.electron.build/auto-update
 */
function getAutoUpdater(): AppUpdater {
  // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
  // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
  const { autoUpdater } = electronUpdater
  return autoUpdater
}

if (isRunningElectron) {
  console.log('Electron main process started.')

  const autoUpdater = getAutoUpdater()

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
  })
  autoUpdater.on('update-available', () => {
    console.log('Update available.')
  })
  autoUpdater.on('update-not-available', () => {
    console.log('Update not available.')
  })
  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err)
  })
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
    console.log(log_message)
  })
  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded')
  })

  // electronApp.whenReady().then(() => {
  //   console.log('Electron app is ready.')

  //   // Check for software updates
  //   autoUpdater.checkForUpdatesAndNotify()

  //   console.log('Cockpit version:', electronApp.getVersion())
  // })
}
