import { contextBridge, ipcRenderer } from 'electron'

import type { ElectronSDLJoystickControllerStateEventData } from '@/types/joystick'

contextBridge.exposeInMainWorld('electronAPI', {
  getInfoOnSubnets: () => ipcRenderer.invoke('get-info-on-subnets'),
  getResourceUsage: () => ipcRenderer.invoke('get-resource-usage'),
  onUpdateAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback: (info: any) => void) =>
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onCheckingForUpdate: (callback: () => void) => ipcRenderer.on('checking-for-update', () => callback()),
  onUpdateNotAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-not-available', (_event, info) => callback(info)),
  onDownloadProgress: (callback: (info: any) => void) =>
    ipcRenderer.on('download-progress', (_event, info) => callback(info)),
  onElectronSDLControllerJoystickStateChange: (callback: (data: ElectronSDLJoystickControllerStateEventData) => void) =>
    ipcRenderer.on('sdl-controller-joystick-state', (_event, data) => callback(data)),
  checkSDLStatus: () => ipcRenderer.invoke('check-sdl-status'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  cancelUpdate: () => ipcRenderer.send('cancel-update'),
  setItem: async (key: string, value: Blob, subFolders?: string[]) => {
    const arrayBuffer = await value.arrayBuffer()
    await ipcRenderer.invoke('setItem', { key, value: new Uint8Array(arrayBuffer), subFolders })
  },
  getItem: async (key: string, subFolders?: string[]) => {
    const arrayBuffer = await ipcRenderer.invoke('getItem', { key, subFolders })
    return arrayBuffer ? new Blob([arrayBuffer]) : null
  },
  removeItem: async (key: string, subFolders?: string[]) => {
    await ipcRenderer.invoke('removeItem', { key, subFolders })
  },
  clear: async (subFolders?: string[]) => {
    await ipcRenderer.invoke('clear', { subFolders })
  },
  keys: async (subFolders?: string[]) => {
    return await ipcRenderer.invoke('keys', { subFolders })
  },
  openCockpitFolder: () => ipcRenderer.invoke('open-cockpit-folder'),
  openVideoFolder: () => ipcRenderer.invoke('open-video-folder'),
  openTempChunksFolder: () => ipcRenderer.invoke('open-temp-chunks-folder'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  getFileStats: (path: string) => ipcRenderer.invoke('get-file-stats', path),
  getChunkFileStats: (key: string, subFolders?: string[]) => ipcRenderer.invoke('get-chunk-file-stats', key, subFolders),
  getDefaultOutputFolder: () => ipcRenderer.invoke('get-default-output-folder'),
  // FFmpeg native processing
  // Live video processing
  createTempDirectory: (prefix: string) => ipcRenderer.invoke('create-temp-directory', prefix),
  writeBlobToFile: async (blob: Blob, filePath: string) => {
    const arrayBuffer = await blob.arrayBuffer()
    return ipcRenderer.invoke('write-blob-to-file', new Uint8Array(arrayBuffer), filePath)
  },
  startLiveVideoConcat: (firstChunkPath: string, outputPath: string) =>
    ipcRenderer.invoke('start-live-video-concat', firstChunkPath, outputPath),
  appendChunkToLiveConcat: (processId: string, chunkPath: string) =>
    ipcRenderer.invoke('append-chunk-to-live-concat', processId, chunkPath),
  finalizeLiveVideoConcat: (processId: string) => ipcRenderer.invoke('finalize-live-video-concat', processId),
  killLiveVideoConcat: (processId: string) => ipcRenderer.invoke('kill-live-video-concat', processId),
  removeTempDirectory: (dirPath: string) => ipcRenderer.invoke('remove-temp-directory', dirPath),
  onLiveVideoProgress: (
    callback: (data: {
      /**
       *
       */
      progress: number
      /**
       *
       */
      message: string
    }) => void
  ) => {
    ipcRenderer.on('live-video-progress', (_event, data) => callback(data))
  },
  offLiveVideoProgress: () => {
    ipcRenderer.removeAllListeners('live-video-progress')
  },
  convertWebmToMp4: (webmPath: string, mp4Path: string) => ipcRenderer.invoke('convert-webm-to-mp4', webmPath, mp4Path),
  onWebmToMp4Progress: (callback: (progress: number, message: string) => void) => {
    ipcRenderer.on('webm-to-mp4-progress', (_, progress: number, message: string) => {
      callback(progress, message)
    })
  },
  offWebmToMp4Progress: () => {
    ipcRenderer.removeAllListeners('webm-to-mp4-progress')
  },
  // ZIP Processing
  processZipFile: (zipFilePath: string, tempDir: string) => ipcRenderer.invoke('process-zip-file', zipFilePath, tempDir),
  onZipProcessingProgress: (callback: (progress: number, message: string) => void) => {
    ipcRenderer.on('zip-processing-progress', (_, progress: number, message: string) => {
      callback(progress, message)
    })
  },
  offZipProcessingProgress: () => {
    ipcRenderer.removeAllListeners('zip-processing-progress')
  },
  captureWorkspace: (rect?: Electron.Rectangle) => ipcRenderer.invoke('capture-workspace', rect),
  serialListPorts: () => ipcRenderer.invoke('serial-list-ports'),
  serialOpen: (path: string, baudRate?: number) => ipcRenderer.invoke('serial-open', { path, baudRate }),
  serialWrite: (path: string, data: Uint8Array) => ipcRenderer.invoke('serial-write', { path, data }),
  serialClose: (path: string) => ipcRenderer.invoke('serial-close', { path }),
  serialIsOpen: (path: string) => ipcRenderer.invoke('serial-is-open', { path }),
  /* eslint-disable jsdoc/require-jsdoc */
  onSerialData: (callback: (data: { path: string; data: number[] }) => void) => {
    ipcRenderer.on('serial-data', (_event, data) => callback(data))
  },
  linkOpen: (path: string) => ipcRenderer.invoke('link-open', { path }),
  linkWrite: (path: string, data: Uint8Array) => ipcRenderer.invoke('link-write', { path, data }),
  linkClose: (path: string) => ipcRenderer.invoke('link-close', { path }),
  onLinkData: (callback: (data: { path: string; data: number[] }) => void) => {
    ipcRenderer.on('link-data', (_event, data) => callback(data))
  },
  systemLog: (level: string, message: string) => ipcRenderer.send('system-log', { level, message }),
  getElectronLogs: () => ipcRenderer.invoke('get-electron-logs'),
  getElectronLogContent: (logName: string) => ipcRenderer.invoke('get-electron-log-content', logName),
  deleteElectronLog: (logName: string) => ipcRenderer.invoke('delete-electron-log', logName),
  deleteOldElectronLogs: () => ipcRenderer.invoke('delete-old-electron-logs'),
  setUserAgent: (userAgent: string) => ipcRenderer.invoke('set-user-agent', userAgent),
  restoreUserAgent: () => ipcRenderer.invoke('restore-user-agent'),
  getCurrentUserAgent: () => ipcRenderer.invoke('get-current-user-agent'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
})
