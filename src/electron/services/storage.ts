import { dialog, ipcMain, shell } from 'electron'
import { app } from 'electron'
import * as fs from 'fs/promises'
import { dirname, join } from 'path'

// Create a new storage interface for filesystem
export const cockpitFolderPath = join(app.getPath('home'), 'Cockpit')
fs.mkdir(cockpitFolderPath, { recursive: true })

export const filesystemStorage = {
  async setItem(key: string, value: ArrayBuffer, subFolders?: string[]): Promise<void> {
    const buffer = Buffer.from(value)
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer as any)
  },
  async getItem(key: string, subFolders?: string[]): Promise<ArrayBuffer | null> {
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    try {
      const buffer = await fs.readFile(filePath)
      return new Uint8Array(buffer).buffer
    } catch (error: any) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },
  async removeItem(key: string, subFolders?: string[]): Promise<void> {
    const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
    try {
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, which is fine - just ignore it
        console.debug(`File ${key} not found, skipping deletion`)
        return
      }
      // Re-throw other errors (permission issues, etc.)
      throw error
    }
  },
  async clear(subFolders?: string[]): Promise<void> {
    const dirPath = join(cockpitFolderPath, ...(subFolders ?? []))
    await fs.rm(dirPath, { recursive: true })
  },
  async keys(subFolders?: string[]): Promise<string[]> {
    const dirPath = join(cockpitFolderPath, ...(subFolders ?? []))
    try {
      return await fs.readdir(dirPath)
    } catch (error: any) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  },
}

export const setupFilesystemStorage = (): void => {
  ipcMain.handle('setItem', async (_, data) => {
    await filesystemStorage.setItem(data.key, data.value, data.subFolders)
  })
  ipcMain.handle('getItem', async (_, data) => {
    return await filesystemStorage.getItem(data.key, data.subFolders)
  })
  ipcMain.handle('removeItem', async (_, data) => {
    await filesystemStorage.removeItem(data.key, data.subFolders)
  })
  ipcMain.handle('clear', async (_, data) => {
    await filesystemStorage.clear(data.subFolders)
  })
  ipcMain.handle('keys', async (_, data) => {
    return await filesystemStorage.keys(data.subFolders)
  })
  ipcMain.handle('open-cockpit-folder', async () => {
    await fs.mkdir(cockpitFolderPath, { recursive: true })
    await shell.openPath(cockpitFolderPath)
  })
  ipcMain.handle('open-video-folder', async () => {
    const videoFolderPath = join(cockpitFolderPath, 'videos')
    await fs.mkdir(videoFolderPath, { recursive: true })
    await shell.openPath(videoFolderPath)
  })
  ipcMain.handle('open-temp-chunks-folder', async () => {
    const tempChunksFolderPath = join(cockpitFolderPath, 'videos', 'temporary-video-chunks')
    await fs.mkdir(tempChunksFolderPath, { recursive: true })
    await shell.openPath(tempChunksFolderPath)
  })
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result
  })
  ipcMain.handle('read-directory', async (_, path: string) => {
    try {
      const files = await fs.readdir(path, { withFileTypes: true })
      return await Promise.all(
        files.map(async (file) => {
          const filePath = join(path, file.name)
          const stats = await fs.stat(filePath)
          return {
            name: file.name,
            path: filePath,
            isDirectory: file.isDirectory(),
            size: stats.size,
            mtime: stats.mtime,
          }
        })
      )
    } catch (error: any) {
      console.error('Error reading directory:', error)
      return []
    }
  })

  ipcMain.handle('delete-file', async (_, path: string) => {
    try {
      await fs.unlink(path)
    } catch (error: any) {
      console.error('Error deleting file:', error)
      throw error
    }
  })
  ipcMain.handle('open-path', async (_, path: string) => {
    try {
      await shell.openPath(path)
    } catch (error: any) {
      console.error('Error opening path:', error)
      throw error
    }
  })

  ipcMain.handle('get-default-output-folder', async () => {
    try {
      // Get user's home directory and construct the default output path
      const homeDir = app.getPath('home')
      const defaultOutputPath = join(homeDir, 'Cockpit', 'videos')

      console.log('Checking default output path:', defaultOutputPath)

      // Ensure the directory exists (create if it doesn't)
      try {
        await fs.mkdir(defaultOutputPath, { recursive: true })
        console.log('Default output folder ready:', defaultOutputPath)
        return defaultOutputPath
      } catch (error: any) {
        console.error('Failed to create default output folder:', error)
        return null
      }
    } catch (error: any) {
      console.error('Error getting default output folder:', error)
      return null
    }
  })

  ipcMain.handle('get-file-stats', async (_, path: string) => {
    try {
      const stats = await fs.stat(path)
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { exists: false }
      }
      console.error('Error getting file stats:', error)
      throw error
    }
  })

  ipcMain.handle('get-chunk-file-stats', async (_, key: string, subFolders?: string[]) => {
    try {
      const filePath = join(cockpitFolderPath, ...(subFolders ?? []), key)
      const stats = await fs.stat(filePath)
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { exists: false }
      }
      console.error('Error getting chunk file stats:', error)
      throw error
    }
  })
}
