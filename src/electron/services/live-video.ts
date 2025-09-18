import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { v4 as uuid } from 'uuid'

/**
 * Live video concatenation service for Electron
 *
 * This service provides real-time video concatenation capabilities using FFmpeg.
 * It handles the live processing of video chunks as they are recorded, eliminating
 * the need for post-processing.
 */

interface LiveConcatProcess {
  id: string
  ffmpegProcess: ChildProcess
  inputPipe: string
  outputPath: string
  isFinalized: boolean
}

const activeConcatProcesses = new Map<string, LiveConcatProcess>()

/**
 * Create a temporary directory for live video processing
 * @param prefix - Prefix for the directory name
 * @returns Promise that resolves to the directory path
 */
const createTempDirectory = async (prefix: string): Promise<string> => {
  const tempDir = join(tmpdir(), `${prefix}_${uuid().slice(0, 8)}`)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Write a blob to a file (via array buffer)
 * @param blobData - The blob data as Uint8Array
 * @param filePath - Path where to write the file
 */
const writeBlobToFile = async (blobData: Uint8Array, filePath: string): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, Buffer.from(blobData))
}

  /**
   * Start a live video concatenation process using binary concatenation
   * @param firstChunkPath - Path to the first video chunk
   * @param outputPath - Path where the final video will be saved
   * @param onProgress - Progress callback function
   * @returns Promise that resolves to the process information
   */
  const startLiveVideoConcat = async (
    firstChunkPath: string,
    outputPath: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<{ id: string }> => {
    const processId = uuid()

    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true })

    // For WebM files, we can use binary concatenation for live processing
    // Copy the first chunk to start the output file
    await fs.copyFile(firstChunkPath, outputPath)

    console.log(`Live video concat process ${processId} started with first chunk`)

    // Store process information (we'll append chunks directly to the output file)
    const concatProcess: LiveConcatProcess = {
      id: processId,
      ffmpegProcess: null as any, // No FFmpeg process needed for binary concat
      inputPipe: outputPath, // Store output path for binary appending
      outputPath,
      isFinalized: false
    }

    activeConcatProcesses.set(processId, concatProcess)

    if (onProgress) {
      onProgress(10, 'Live processing initialized with binary concatenation')
    }

    return { id: processId }
  }

  /**
   * Append a chunk to an active live concatenation process using binary concatenation
   * @param processId - ID of the active process
   * @param chunkPath - Path to the new chunk file
   */
  const appendChunkToLiveConcat = async (processId: string, chunkPath: string): Promise<void> => {
    const process = activeConcatProcesses.get(processId)
    if (!process || process.isFinalized) {
      throw new Error(`Live concat process ${processId} not found or already finalized`)
    }

    try {
      // Read the new chunk and append it to the output file (binary concatenation)
      const chunkData = await fs.readFile(chunkPath)
      await fs.appendFile(process.outputPath, chunkData)

      console.log(`Successfully appended chunk to live video: ${chunkPath} → ${process.outputPath}`)

    } catch (error) {
      console.error(`Failed to append chunk to live concat process ${processId}:`, error)
      throw error
    }
  }

/**
 * Finalize a live video concatenation process
 * @param processId - ID of the process to finalize
 */
const finalizeLiveVideoConcat = async (processId: string): Promise<void> => {
  const process = activeConcatProcesses.get(processId)
  if (!process) {
    throw new Error(`Live concat process ${processId} not found`)
  }

  if (process.isFinalized) {
    return // Already finalized
  }

  process.isFinalized = true

  try {
    console.log(`Live concat process ${processId} finalized successfully (binary concatenation)`)

    // For binary concatenation, we're already done - the file has been built incrementally
    // We might want to run a quick FFmpeg process to fix any potential issues
    const ffmpegArgs = [
      '-i', process.outputPath,
      '-c', 'copy',
      '-fflags', '+genpts',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      '-y',
      `${process.outputPath}.fixed.webm`
    ]

    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

      ffmpegProcess.stderr.on('data', (data) => {
        console.log(`Final FFmpeg (${processId}):`, data.toString().trim())
      })

      ffmpegProcess.on('error', (error) => {
        console.warn(`Final FFmpeg process error (${processId}):`, error)
        // Don't fail - the binary concatenated file might still be usable
        resolve()
      })

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Replace original with fixed version
          fs.rename(`${process.outputPath}.fixed.webm`, process.outputPath)
            .then(() => {
              console.log(`Live concat process ${processId} finalized and fixed successfully`)
              activeConcatProcesses.delete(processId)
              resolve()
            })
            .catch(() => {
              // If rename fails, original file is still there
              console.log(`Live concat process ${processId} finalized (could not apply fixes)`)
              activeConcatProcesses.delete(processId)
              resolve()
            })
        } else {
          console.log(`Live concat process ${processId} finalized (FFmpeg fixes failed, using original)`)
          activeConcatProcesses.delete(processId)
          resolve()
        }
      })

      // Set timeout for finalization
      setTimeout(() => {
        console.warn(`Live concat process ${processId} timeout, using original file`)
        ffmpegProcess.kill('SIGKILL')
        activeConcatProcesses.delete(processId)
        resolve()
      }, 30000) // 30 second timeout for final processing
    })

  } catch (error) {
    console.error(`Error finalizing live concat process ${processId}:`, error)
    activeConcatProcesses.delete(processId)
    throw error
  }
}

/**
 * Kill a live video concatenation process
 * @param processId - ID of the process to kill
 */
const killLiveVideoConcat = async (processId: string): Promise<void> => {
  const process = activeConcatProcesses.get(processId)
  if (!process) {
    return // Process not found, already cleaned up
  }

  // For binary concatenation, we don't have an active FFmpeg process to kill
  // Just mark as finalized and clean up
  process.isFinalized = true
  activeConcatProcesses.delete(processId)

  console.log(`Live concat process ${processId} forcefully stopped`)
}

/**
 * Remove a temporary directory and all its contents
 * @param dirPath - Path to the directory to remove
 */
const removeTempDirectory = async (dirPath: string): Promise<void> => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (error) {
    console.warn(`Failed to remove temp directory ${dirPath}:`, error)
  }
}

/**
 * Setup live video IPC handlers for Electron main process
 */
export const setupLiveVideoService = (): void => {
  /**
   * Create temporary directory for live processing
   */
  ipcMain.handle('create-temp-directory', async (_, prefix: string) => {
    try {
      return await createTempDirectory(prefix)
    } catch (error) {
      console.error('Error creating temp directory:', error)
      throw error
    }
  })

  /**
   * Write blob data to file
   */
  ipcMain.handle('write-blob-to-file', async (_, blobData: Uint8Array, filePath: string) => {
    try {
      await writeBlobToFile(blobData, filePath)
    } catch (error) {
      console.error('Error writing blob to file:', error)
      throw error
    }
  })

  /**
   * Start live video concatenation
   */
  ipcMain.handle('start-live-video-concat', async (event, firstChunkPath: string, outputPath: string) => {
    try {
      const result = await startLiveVideoConcat(firstChunkPath, outputPath, (progress, message) => {
        // Send progress updates back to renderer
        event.sender.send('live-video-progress', { progress, message })
      })
      return result
    } catch (error) {
      console.error('Error starting live video concat:', error)
      throw error
    }
  })

  /**
   * Append chunk to live concatenation
   */
  ipcMain.handle('append-chunk-to-live-concat', async (_, processId: string, chunkPath: string) => {
    try {
      await appendChunkToLiveConcat(processId, chunkPath)
    } catch (error) {
      console.error('Error appending chunk to live concat:', error)
      throw error
    }
  })

  /**
   * Finalize live video concatenation
   */
  ipcMain.handle('finalize-live-video-concat', async (_, processId: string) => {
    try {
      await finalizeLiveVideoConcat(processId)
    } catch (error) {
      console.error('Error finalizing live video concat:', error)
      throw error
    }
  })

  /**
   * Kill live video concatenation process
   */
  ipcMain.handle('kill-live-video-concat', async (_, processId: string) => {
    try {
      await killLiveVideoConcat(processId)
    } catch (error) {
      console.error('Error killing live video concat:', error)
      throw error
    }
  })

  /**
   * Remove temporary directory
   */
  ipcMain.handle('remove-temp-directory', async (_, dirPath: string) => {
    try {
      await removeTempDirectory(dirPath)
    } catch (error) {
      console.error('Error removing temp directory:', error)
      throw error
    }
  })
}
