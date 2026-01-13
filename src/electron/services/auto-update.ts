import { BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'

import { Architecture, Platform } from '../../types/platform'
import { getSystemInfo } from './system-info'

/**
 * Setup auto updater
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
  const systemInfo = getSystemInfo()

  const autoUpdater: AppUpdater = electronUpdater.autoUpdater
  autoUpdater.logger = console
  autoUpdater.autoDownload = false // Prevent automatic downloads

  // On macOS ARM64, use the latest-arm64 channel to download the correct architecture
  // The channel name determines the metadata file: 'latest-arm64' -> 'latest-arm64-mac.yml'
  if (systemInfo.platform === Platform.MACOS && systemInfo.processArch === Architecture.ARM64) {
    autoUpdater.channel = 'latest-arm64'
    console.log('Set auto-updater channel to latest-arm64 for macOS ARM64')
  }

  autoUpdater
    .checkForUpdates()
    .then((e) => console.info(e))
    .catch((e) => console.error(e))

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow.webContents.send('update-not-available', info)
  })

  autoUpdater.on('download-progress', (progressInfo) => {
    mainWindow.webContents.send('download-progress', progressInfo)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info)
  })

  // Add handlers for update control
  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.on('cancel-update', () => {
    autoUpdater.removeAllListeners('update-downloaded')
    autoUpdater.removeAllListeners('download-progress')
  })
}
