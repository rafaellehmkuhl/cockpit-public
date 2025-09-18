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

    // Binary concatenation creates invalid WebM structure with H.264 content
    // Fix by converting to proper MP4 container with rebuilt metadata
    const outputMp4 = process.outputPath.replace('.webm', '.mp4')
    const ffmpegArgs = [
      '-i', process.outputPath,
      '-c', 'copy',                    // Don't re-encode, just fix container
      '-fflags', '+genpts',            // Generate presentation timestamps
      '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
      '-movflags', '+faststart',       // Optimize for web playback
      '-y',
      outputMp4
    ]

    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

      ffmpegProcess.stderr.on('data', (data) => {
        console.log(`Final FFmpeg (${processId}):`, data.toString().trim())
      })

      ffmpegProcess.on('error', (error) => {
        console.error(`Critical FFmpeg process error (${processId}):`, error)
        activeConcatProcesses.delete(processId)
        reject(new Error(`Failed to fix live concatenated video: ${error.message}`))
      })

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Replace original WebM with fixed MP4 version, then remove original
          fs.rename(outputMp4, process.outputPath.replace('.webm', '.mp4'))
            .then(() => fs.unlink(process.outputPath)) // Remove broken WebM
            .then(() => {
              console.log(`Live concat process ${processId} converted to MP4 successfully`)
              activeConcatProcesses.delete(processId)
              resolve()
            })
            .catch((error) => {
              console.error(`Failed to finalize MP4 conversion:`, error)
              activeConcatProcesses.delete(processId)
              reject(new Error(`Failed to finalize video: ${error.message}`))
            })
        } else {
          console.error(`FFmpeg failed to convert live video to MP4 (exit code: ${code})`)
          activeConcatProcesses.delete(processId)
          reject(new Error(`FFmpeg failed to fix video structure (exit code: ${code})`))
        }
      })

      // Set timeout for finalization - this is critical for video playability
      setTimeout(() => {
        console.error(`Live concat process ${processId} timeout during fixing`)
        ffmpegProcess.kill('SIGKILL')
        activeConcatProcesses.delete(processId)
        reject(new Error('Video fixing process timed out'))
      }, 60000) // 60 second timeout for final processing
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
