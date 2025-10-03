import { spawn } from 'child_process'
import { format } from 'date-fns'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream'
import { v4 as uuid } from 'uuid'
import * as yauzl from 'yauzl'

import { getFFmpegPath } from './ffmpeg-path'

/**
 * Live video concatenation service for Electron
 *
 * This service provides real-time video concatenation capabilities using binary concatenation.
 * Video chunks are appended directly to the output file during recording. FFmpeg is only
 * used at the end to convert the binary-concatenated WebM stream into a proper MP4 file.
 * This approach eliminates the need for post-processing and provides immediate results.
 */

/**
 * The live concatenation process using binary concatenation
 */
interface LiveConcatProcess {
  /**
   * The ID of the process
   */
  id: string
  /**
   * The output path where chunks are binary-concatenated
   */
  inputPipe: string
  /**
   * The output path of the final video
   */
  outputPath: string
  /**
   * Temporary directory for this process
   */
  tempDir: string
  /**
   * Whether the process is finalized or not
   */
  isFinalized: boolean
}

const activeConcatProcesses = new Map<string, LiveConcatProcess>()

/**
 * Create a temporary directory for live video processing
 * @param {string} prefix - Prefix for the directory name
 * @returns {Promise<string>} Promise that resolves to the directory path
 */
const createTempDirectory = async (prefix: string): Promise<string> => {
  const tempDir = join(tmpdir(), `${prefix}_${uuid().slice(0, 8)}`)
  await fs.mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Write a blob to a file (via array buffer)
 * @param {Uint8Array} blobData - The blob data as Uint8Array
 * @param {string} filePath - Path where to write the file
 */
const writeBlobToFile = async (blobData: Uint8Array, filePath: string): Promise<void> => {
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, blobData)
}

/**
 * Start a live video binary concatenation process
 * @param {Uint8Array} firstChunkData - The first video chunk data
 * @param {string} recordingHash - Unique identifier for this recording
 * @returns {Promise<{id: string}>} Promise that resolves to the process information
 */
const startLiveVideoConcat = async (
  firstChunkData: Uint8Array,
  recordingHash: string
): Promise<{
  /**
   * The ID of the process
   */
  id: string
}> => {
  const processId = uuid()

  // Create temporary directory for this recording
  const tempDir = await createTempDirectory(`live_video_${recordingHash}`)

  // Write first chunk to temp directory
  const firstChunkPath = join(tempDir, 'chunk_0000.webm')
  await writeBlobToFile(firstChunkData, firstChunkPath)

  // Generate output filename based on recording start time and hash
  const recordingStartTime = new Date()
  const timeRecordingStartString = format(recordingStartTime, 'LLL dd, yyyy - HH꞉mm꞉ss O')
  const fileName = `Cockpit (${timeRecordingStartString}) #${recordingHash}`

  // Get video folder path and construct output path
  const { cockpitFolderPath } = await import('./storage')
  const videosPath = join(cockpitFolderPath, 'videos')
  await fs.mkdir(videosPath, { recursive: true })

  // Start with .webm for binary concatenation, will be converted to .mp4 during finalization
  const outputPath = join(videosPath, `${fileName}.webm`)

  // Use binary concatenation for live processing - simply copy chunks sequentially
  // Start with the first chunk as the base file
  await fs.copyFile(firstChunkPath, outputPath)

  console.log(`Live binary concat process ${processId} started with first chunk`)
  console.log(`Output path: ${outputPath}`)

  // Store process information (chunks will be binary-appended directly to the output file)
  const concatProcess: LiveConcatProcess = {
    id: processId,
    inputPipe: outputPath, // Store output path for binary appending
    outputPath,
    tempDir,
    isFinalized: false,
  }

  activeConcatProcesses.set(processId, concatProcess)

  return { id: processId }
}

/**
 * Append a chunk to an active live binary concatenation process
 * @param {string} processId - ID of the active binary concatenation process
 * @param {Uint8Array} chunkData - The chunk data to append
 * @param {number} chunkNumber - Sequential number of this chunk
 */
const appendChunkToLiveVideoConcat = async (
  processId: string,
  chunkData: Uint8Array,
  chunkNumber: number
): Promise<void> => {
  const process = activeConcatProcesses.get(processId)
  if (!process || process.isFinalized) {
    throw new Error(`Live concat process ${processId} not found or already finalized`)
  }

  try {
    // Save chunk to temp directory for backup
    const chunkPath = join(process.tempDir, `chunk_${chunkNumber.toString().padStart(4, '0')}.webm`)
    await writeBlobToFile(chunkData, chunkPath)

    // Append the chunk to the output file (binary concatenation)
    await fs.appendFile(process.outputPath, chunkData)
  } catch (error) {
    console.error(`Failed to append chunk to live concat process ${processId}:`, error)
    throw error
  }
}

/**
 * Finalize a live video binary concatenation process and convert to MP4 using FFmpeg
 * @param {string} processId - ID of the binary concatenation process to finalize
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
    console.log(`Live binary concat process ${processId} finalized successfully`)

    // Binary concatenation creates an invalid WebM structure with H.264 content
    // Use FFmpeg to convert to proper MP4 container with rebuilt metadata
    const outputMp4 = process.outputPath.replace('.webm', '.mp4')
    const ffmpegArgs = [
      '-i',
      process.outputPath,
      '-c:v',
      'copy', // Copy video without re-encoding
      '-c:a',
      'copy', // Copy audio without re-encoding
      '-fflags',
      '+genpts+igndts', // Generate PTS and ignore DTS issues
      '-avoid_negative_ts',
      'make_zero', // Fix timestamp issues
      '-movflags',
      '+faststart', // Optimize for web playback
      '-bsf:v',
      'h264_mp4toannexb,h264_metadata=aud=1', // Fix H.264 stream issues
      '-max_muxing_queue_size',
      '1024', // Handle timestamp discontinuities
      '-err_detect',
      'ignore_err', // Ignore minor errors during processing
      '-f',
      'mp4', // Force MP4 output format
      '-y',
      outputMp4,
    ]

    return new Promise((resolve, reject) => {
      const ffmpegPath = getFFmpegPath()
      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs)

      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString().trim()
        // Filter out common/expected warnings to reduce log noise
        if (
          !output.includes('non-existing PPS') &&
          !output.includes('Non-monotonic DTS') &&
          !output.includes('Last message repeated')
        ) {
          console.log(`Final FFmpeg (${processId}):`, output)
        }
      })

      ffmpegProcess.on('error', (error) => {
        console.error(`Critical FFmpeg process error (${processId}):`, error)
        activeConcatProcesses.delete(processId)
        reject(new Error(`Failed to fix live concatenated video: ${error.message}`))
      })

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Replace original WebM with fixed MP4 version, then remove original WebM
          fs.rename(outputMp4, process.outputPath.replace('.webm', '.mp4'))
            .then(() => fs.unlink(process.outputPath)) // Remove unfixed WebM (temp chunks are preserved separately)
            .then(async () => {
              console.log(`Live binary concat process ${processId} converted to MP4 successfully.`)
              console.log('Binary-concatenated WebM removed.')
              console.log('Temporary chunks preserved separately for backup.')

              // Generate thumbnail from the final MP4 file and store it in the database
              try {
                const finalMp4Path = process.outputPath.replace('.webm', '.mp4')
                const videoFileName = basename(finalMp4Path)
                const thumbnailFileName = `thumbnail_${videoFileName}.jpeg`
                const tempThumbnailPath = join(dirname(finalMp4Path), `temp_${thumbnailFileName}`)

                console.log(`Generating thumbnail for ${videoFileName}...`)
                await generateThumbnailFromMP4(finalMp4Path, tempThumbnailPath, 1)

                // Read the generated thumbnail and store it in the database
                const thumbnailBuffer = await fs.readFile(tempThumbnailPath)

                // Store thumbnail in the video storage database
                const { filesystemStorage } = await import('./storage')
                await filesystemStorage.setItem(thumbnailFileName, thumbnailBuffer as any, ['videos'])

                // Clean up temporary thumbnail file
                await fs.unlink(tempThumbnailPath)

                console.log(`Thumbnail generated and stored in database: ${thumbnailFileName}`)
              } catch (thumbnailError) {
                console.warn(`Failed to generate thumbnail for ${processId}:`, thumbnailError)
                // Don't fail the entire process if thumbnail generation fails
              }

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
        activeConcatProcesses.delete(processId)

        if (ffmpegProcess.killed || ffmpegProcess.exitCode !== null) return

        try {
          ffmpegProcess.kill(0) // SIGKILL
        } catch {
          return
        }

        // If we got here, it meansthe process is still running
        console.error(`Live binary concat process ${processId} timeout during format conversion`)
        reject(new Error('Video fixing process timed out'))
      }, 300000) // 5 minutes timeout for final processing
    })
  } catch (error) {
    console.error(`Error finalizing live binary concat process ${processId}:`, error)
    activeConcatProcesses.delete(processId)
    throw error
  }
}

/**
 * Generate a thumbnail from an MP4 video file using FFmpeg
 * @param {string} videoPath - Path to the MP4 video file
 * @param {string} outputPath - Path where the thumbnail should be saved
 * @param {number} timeOffset - Time offset in seconds for thumbnail extraction (default: 1 second)
 */
const generateThumbnailFromMP4 = async (videoPath: string, outputPath: string, timeOffset = 1): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i',
      videoPath,
      '-ss',
      timeOffset.toString(), // Seek to specified time
      '-vframes',
      '1', // Extract only 1 frame
      '-vf',
      'scale=660:370', // Scale to thumbnail size (matches extractThumbnailFromVideo)
      '-q:v',
      '2', // High quality
      '-y', // Overwrite output file
      outputPath,
    ]

    const ffmpegPath = getFFmpegPath()
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs)

    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim()
      // Only log significant errors, filter out common warnings
      if (output.includes('error') || output.includes('Error') || output.includes('failed')) {
        console.warn(`FFmpeg thumbnail warning: ${output}`)
      }
    })

    ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg thumbnail generation error:`, error)
      reject(new Error(`Failed to generate thumbnail: ${error.message}`))
    })

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Thumbnail generated successfully: ${outputPath}`)
        resolve()
      } else {
        console.error(`FFmpeg failed to generate thumbnail (exit code: ${code})`)
        reject(new Error(`FFmpeg thumbnail generation failed (exit code: ${code})`))
      }
    })

    // Set timeout for thumbnail generation
    setTimeout(() => {
      if (ffmpegProcess.killed || ffmpegProcess.exitCode !== null) return

      try {
        ffmpegProcess.kill(0) // SIGKILL
      } catch {
        return
      }

      // If we got here, it means the process is still running
      console.error(`Thumbnail generation timeout for ${videoPath}`)
      reject(new Error('Thumbnail generation timeout'))
    }, 300000) // 5 minutes timeout for thumbnail generation
  })
}

/**
 * Process a ZIP file containing video chunks using the live binary concatenation pipeline
 * @param {string} zipFilePath - Path to the ZIP file
 * @param {function(number, string): void} onProgress - Progress callback function
 * @returns {Promise<string>} Promise resolving to final MP4 path
 */
const processVideoChunksZip = async (
  zipFilePath: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> => {
  console.debug(`Processing ZIP file '${zipFilePath}'.`)

  if (!zipFilePath) {
    throw new Error('zipFilePath is undefined or empty')
  }

  // Create temporary directory for extraction
  const tempDir = await createTempDirectory('zip-processing')
  console.debug(`Created temp directory for ZIP processing: ${tempDir}`)

  onProgress?.(10, 'Extracting ZIP file...')

  // Extract ZIP file
  const extractPath = join(tempDir, 'extracted')
  await fs.mkdir(extractPath, { recursive: true })

  // Extract ZIP file using yauzl
  const extractedFiles: string[] = []

  console.debug(`Starting ZIP extraction from ${zipFilePath} to ${extractPath}.`)

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr) {
        console.error('Error opening ZIP file:', openErr)
        reject(openErr)
        return
      }

      if (!zipfile) {
        reject(new Error('Failed to open ZIP file'))
        return
      }

      console.debug('ZIP file opened successfully')

      let extractedCount = 0
      let totalEntries = 0

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        totalEntries++
        if (/\/$/.test(entry.fileName)) {
          // Directory entry - skip
          zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) {
            console.error('Error opening read stream for:', entry.fileName, streamErr)
            reject(streamErr)
            return
          }

          if (!readStream) {
            console.log('No read stream for:', entry.fileName)
            zipfile.readEntry()
            return
          }

          const outputPath = join(extractPath, entry.fileName)
          console.log('Extracting to:', outputPath)

          // Ensure directory exists
          fs.mkdir(dirname(outputPath), { recursive: true })
            .then(() => {
              const writeStream = createWriteStream(outputPath)

              pipeline(readStream, writeStream, (pipeErr) => {
                if (pipeErr) {
                  console.error('Error extracting file:', entry.fileName, pipeErr)
                  reject(pipeErr)
                  return
                }

                // Preserve original timestamps from ZIP entry
                if (entry.getLastModDate) {
                  const lastModDate = entry.getLastModDate()
                  fs.utimes(outputPath, lastModDate, lastModDate).catch((utimesErr) => {
                    console.warn(`Failed to set timestamps for ${entry.fileName}:`, utimesErr)
                  })
                  console.log(`Preserved timestamp for ${entry.fileName}: ${lastModDate}`)
                }

                extractedFiles.push(outputPath)
                extractedCount++
                console.log(`Successfully extracted: ${entry.fileName} -> ${outputPath}`)

                // Update progress
                const progress = 10 + (extractedCount / totalEntries) * 20
                onProgress?.(progress, `Extracting ${entry.fileName}...`)

                zipfile.readEntry()
              })
            })
            .catch((mkdirErr) => {
              console.error('Error creating directory for:', entry.fileName, mkdirErr)
              reject(mkdirErr)
            })
        })
      })

      zipfile.on('end', () => {
        console.log('ZIP extraction completed. Total entries:', totalEntries, 'Extracted files:', extractedFiles.length)
        onProgress?.(30, 'ZIP extraction completed')
        resolve()
      })

      zipfile.on('error', (zipErr) => {
        console.error('ZIP file error:', zipErr)
        reject(zipErr)
      })
    })
  })

  onProgress?.(30, 'Processing video chunks using live concatenation pipeline...')

  // Find video chunk files - look for common video formats and chunk patterns
  const chunkFiles = extractedFiles
    .filter((file) => {
      const fileName = basename(file)
      const ext = fileName.split('.').pop()?.toLowerCase()

      console.log(`Checking file: ${fileName}, extension: ${ext}`)

      // Look for files that are likely video chunks
      const isVideoFile =
        file.endsWith('.webm') ||
        file.endsWith('.mp4') ||
        file.endsWith('.mkv') ||
        ext === 'webm' ||
        ext === 'mp4' ||
        ext === 'mkv'

      // Test each pattern individually for debugging
      const hashChunkPattern = /^[a-f0-9]+_\d+$/.test(fileName)
      const chunkPattern = /chunk_\d+/.test(fileName)
      const underscorePattern = /_\d+\./.test(fileName)
      const hashChunkNoExtPattern = /^[a-f0-9]+_\d+/.test(fileName)
      const numberOnlyPattern = /^\d+$/.test(fileName)

      const isChunkPattern =
        hashChunkPattern || chunkPattern || underscorePattern || hashChunkNoExtPattern || numberOnlyPattern

      const isChunk = isVideoFile || isChunkPattern

      return isChunk
    })
    .sort() // Sort to ensure correct order

  console.log('Found chunk files:', chunkFiles)
  console.log('Chunk files count:', chunkFiles.length)

  let finalChunkFiles = chunkFiles
  if (chunkFiles.length === 0) {
    // More detailed error message
    const allFiles = extractedFiles.map((f) => basename(f)).join(', ')
    console.error('No video chunks found. All extracted files:', allFiles)

    // If no chunks found but we have files, let's try to use all files as potential chunks
    if (extractedFiles.length > 0) {
      console.log('No chunks detected by pattern matching, trying to use all extracted files as chunks')
      finalChunkFiles = extractedFiles
    } else {
      throw new Error(`No video chunks found in ZIP file. Extracted files: ${allFiles}`)
    }
  }

  // Sort chunks by their chunk number to ensure proper order (needed for hash/date extraction)
  const sortedChunkFiles = finalChunkFiles.sort((a, b) => {
    const aFileName = basename(a)
    const bFileName = basename(b)

    // Extract chunk numbers from filenames like "7bbb3eab_0", "7bbb3eab_1", etc.
    const aMatch = aFileName.match(/_(\d+)$/)
    const bMatch = bFileName.match(/_(\d+)$/)

    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10)
      const bNum = parseInt(bMatch[1], 10)
      return aNum - bNum
    }

    // Fallback to string comparison if no numbers found
    return aFileName.localeCompare(bFileName)
  })

  console.log(`Sorted chunk files: ${sortedChunkFiles.map((f) => basename(f))}`)

  // Filter out any chunks that don't exist or are empty
  console.log('Verifying chunk files exist and filtering valid chunks...')
  const validChunkFiles: string[] = []

  for (const file of sortedChunkFiles) {
    try {
      const stats = await fs.stat(file)
      if (stats.size > 0) {
        console.log(`Valid chunk: ${basename(file)} (${stats.size} bytes)`)
        validChunkFiles.push(file)
      } else {
        console.log(`Skipping empty chunk: ${basename(file)} (0 bytes)`)
      }
    } catch (error: any) {
      console.log(`Skipping missing chunk: ${basename(file)} (${error.message})`)
    }
  }

  console.log(`Found ${validChunkFiles.length} valid chunks out of ${sortedChunkFiles.length} total chunks`)

  if (validChunkFiles.length === 0) {
    throw new Error('No valid chunk files found to process')
  }

  // Extract hash from the first chunk filename (format: "hash_chunkNumber")
  const firstChunkPath = validChunkFiles[0]
  const firstChunkBaseName = basename(firstChunkPath)
  console.log(`First chunk filename: ${firstChunkBaseName}`)

  const hashMatch = firstChunkBaseName.match(/^([a-f0-9]+)_\d+/)
  const hash = hashMatch ? hashMatch[1] : firstChunkBaseName.slice(0, 8) // Fallback to first 8 chars
  console.log(`Extracted hash: ${hash}`)

  // Get creation date from ZIP entry metadata (preferred) or filesystem metadata (fallback)
  onProgress?.(35, 'Extracting file metadata...')
  let creationDate: Date | undefined

  try {
    // Try to get timestamp from ZIP entry metadata first
    const firstChunkFileName = basename(firstChunkPath)
    const zipEntry = extractedFiles.find((file) => basename(file) === firstChunkFileName)

    if (zipEntry) {
      // Read the ZIP file to get entry metadata
      await new Promise<void>((resolve, reject) => {
        yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
          if (err) {
            reject(err)
            return
          }

          zipfile.readEntry()
          zipfile.on('entry', (entry) => {
            if (entry.fileName === firstChunkFileName) {
              if (entry.getLastModDate) {
                creationDate = entry.getLastModDate()
                console.log(`Using ZIP entry timestamp: ${creationDate}`)
                zipfile.close()
                resolve()
              } else {
                zipfile.close()
                reject(new Error('No timestamp available in ZIP entry'))
              }
            } else {
              zipfile.readEntry()
            }
          })

          zipfile.on('end', () => {
            reject(new Error('Entry not found in ZIP'))
          })
        })
      })
    } else {
      throw new Error('ZIP entry not found')
    }
  } catch (error) {
    // Fallback to filesystem metadata
    console.log('No ZIP entry metadata found, using filesystem metadata')
    const firstChunkStats = await fs.stat(firstChunkPath)
    console.log(`File stats for ${basename(firstChunkPath)}:`)
    console.log(`  birthtime: ${firstChunkStats.birthtime}`)
    console.log(`  mtime: ${firstChunkStats.mtime}`)
    console.log(`  atime: ${firstChunkStats.atime}`)
    console.log(`  ctime: ${firstChunkStats.ctime}`)

    creationDate = firstChunkStats.birthtime || firstChunkStats.mtime // Use birthtime (creation) or mtime (modification) as fallback
    console.log(`Using filesystem creation date: ${creationDate}`)
  }

  // Fallback to current date if no creation date is available
  if (!creationDate) {
    creationDate = new Date()
    console.log(`No creation date found, using current date: ${creationDate}`)
  }

  // Generate filename following the live recording pattern: "{missionName} ({datetime}) #{hash}"
  const timeRecordingStartString = format(creationDate, 'LLL dd, yyyy - HH꞉mm꞉ss O')
  const baseFileName = `Cockpit (${timeRecordingStartString}) #${hash}`
  console.log(`Generated filename: ${baseFileName}`)

  // Get the default output folder for videos
  const { cockpitFolderPath } = await import('./storage')
  console.log('cockpitFolderPath:', cockpitFolderPath)

  const videosPath = join(cockpitFolderPath, 'videos')
  console.log('videosPath:', videosPath)

  await fs.mkdir(videosPath, { recursive: true })
  console.log('Created videos directory')

  const outputPath = join(videosPath, `${baseFileName}.webm`) // Start with .webm like live processing
  console.log('outputPath:', outputPath)

  // Find .ass telemetry files and copy them to the output directory
  const assFiles = extractedFiles.filter((file) => {
    const assFileName = basename(file)
    const ext = assFileName.split('.').pop()?.toLowerCase()
    return ext === 'ass'
  })

  console.log(`Found .ass files: ${assFiles.map((f) => basename(f))}`)

  // Copy .ass files to the output directory with the same name as the video file
  if (assFiles.length > 0) {
    onProgress?.(35, 'Copying telemetry files...')
    const outputDir = dirname(outputPath)

    for (const assFile of assFiles) {
      try {
        const originalFileName = basename(assFile)
        // Use the same base filename as the video but with .ass extension
        const destPath = join(outputDir, `${baseFileName}.ass`)
        await fs.copyFile(assFile, destPath)
        console.log(`Copied .ass file: ${originalFileName} -> ${destPath}`)
      } catch (error) {
        console.warn(`Failed to copy .ass file ${basename(assFile)}:`, error)
      }
    }
  }

  // Use the live binary concatenation pipeline instead of FFmpeg concat demuxer
  try {
    // Read first chunk and start live binary concatenation
    console.log(`Starting live binary concatenation with first chunk: ${basename(firstChunkPath)}`)
    const firstChunkData = await fs.readFile(firstChunkPath)

    const { id: processId } = await startLiveVideoConcat(new Uint8Array(firstChunkData), hash)
    console.log(`Live binary concatenation process started with ID: ${processId}`)

    // Append all remaining chunks using binary concatenation
    for (let i = 1; i < validChunkFiles.length; i++) {
      const chunkPath = validChunkFiles[i]
      console.log(`Appending chunk ${i + 1}/${validChunkFiles.length}: ${basename(chunkPath)}`)

      // Read chunk data and append
      const chunkData = await fs.readFile(chunkPath)
      await appendChunkToLiveVideoConcat(processId, new Uint8Array(chunkData), i)

      // Update progress
      const progress = 40 + (i / validChunkFiles.length) * 40
      onProgress?.(progress, `Processing chunk ${i + 1}/${validChunkFiles.length}`)
    }

    console.log('All chunks appended, finalizing...')

    // Finalize the binary concatenation (this will convert to MP4 with proper metadata using FFmpeg)
    await finalizeLiveVideoConcat(processId)

    console.log('ZIP processing completed using live binary concatenation pipeline')

    // The finalizeLiveVideoConcat function already handles thumbnail generation
    // and converts the binary-concatenated output to proper MP4 format using FFmpeg
  } catch (error) {
    console.error('Error in live binary concatenation pipeline:', error)
    throw error
  }

  onProgress?.(100, 'Processing completed!')

  // Return the final MP4 path (finalizeLiveVideoConcat converts .webm to .mp4)
  const finalMp4Path = outputPath.replace('.webm', '.mp4')
  return finalMp4Path
}

/**
 * Setup live video IPC handlers for Electron main process
 */
export const setupLiveVideoService = (): void => {
  /**
   * Start live video binary concatenation
   */
  ipcMain.handle('start-live-video-concat', async (_, firstChunkData: Uint8Array, recordingHash: string) => {
    try {
      const result = await startLiveVideoConcat(firstChunkData, recordingHash)
      return result
    } catch (error) {
      console.error('Error starting live video binary concat:', error)
      throw error
    }
  })

  /**
   * Append chunk to live binary concatenation
   */
  ipcMain.handle(
    'append-chunk-to-live-video-concat',
    async (_, processId: string, chunkData: Uint8Array, chunkNumber: number) => {
      try {
        await appendChunkToLiveVideoConcat(processId, chunkData, chunkNumber)
      } catch (error) {
        console.error('Error appending chunk to live binary concat:', error)
        throw error
      }
    }
  )

  /**
   * Finalize live video binary concatenation and convert to MP4
   */
  ipcMain.handle('finalize-live-video-concat', async (_, processId: string) => {
    try {
      await finalizeLiveVideoConcat(processId)
    } catch (error) {
      console.error('Error finalizing live video binary concat:', error)
      throw error
    }
  })

  /**
   * Process ZIP file with video chunks
   */
  ipcMain.handle('process-video-chunks-zip', async (event, zipFilePath: string) => {
    try {
      return await processVideoChunksZip(zipFilePath, (progress, message) => {
        // Send progress updates to renderer process
        event.sender.send('video-chunks-zip-processing-progress', progress, message)
      })
    } catch (error) {
      console.error('Error processing ZIP file:', error)
      throw error
    }
  })

  /**
   * Process standalone WebM file by creating a concat process and finalizing it
   */
  ipcMain.handle('process-standalone-webm', async (_, videoFileName: string) => {
    try {
      const { cockpitFolderPath } = await import('./storage')
      const videosPath = join(cockpitFolderPath, 'videos')
      const webmFilePath = join(videosPath, videoFileName)

      console.log(`Processing standalone WebM: ${webmFilePath}`)

      // Extract hash from filename (format: "... #hash.webm")
      const hashMatch = videoFileName.match(/#([a-f0-9-]+)\.webm$/)
      if (!hashMatch) {
        throw new Error('Could not extract recording hash from filename')
      }
      const recordingHash = hashMatch[1]

      // Create a concat process entry for the existing WebM file
      const processId = recordingHash
      activeConcatProcesses.set(processId, {
        id: processId,
        inputPipe: webmFilePath,
        outputPath: webmFilePath,
        tempDir: '', // Not needed for finalization only
        isFinalized: false,
      })

      // Finalize the video (convert WebM to MP4)
      await finalizeLiveVideoConcat(processId)

      return webmFilePath.replace('.webm', '.mp4')
    } catch (error) {
      console.error('Error processing standalone WebM:', error)
      throw error
    }
  })
}
