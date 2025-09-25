import { ChildProcess, spawn } from 'child_process'
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { createReadStream, createWriteStream } from 'fs'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { v4 as uuid } from 'uuid'
import * as yauzl from 'yauzl'
import { format } from 'date-fns'

/**
 * Live video concatenation service for Electron
 *
 * This service provides real-time video concatenation capabilities using FFmpeg.
 * It handles the live processing of video chunks as they are recorded, eliminating
 * the need for post-processing.
 */

/**
 *
 */
interface LiveConcatProcess {
  /**
   *
   */
  id: string
  /**
   *
   */
  ffmpegProcess: ChildProcess
  /**
   *
   */
  inputPipe: string
  /**
   *
   */
  outputPath: string
  /**
   *
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
 * Start a live video concatenation process using binary concatenation
 * @param {string} firstChunkPath - Path to the first video chunk
 * @param {string} outputPath - Path where the final video will be saved
 * @param {function(number, string): void} onProgress - Progress callback function
 * @returns {Promise<{id: string}>} Promise that resolves to the process information
 */
const startLiveVideoConcat = async (
  firstChunkPath: string,
  outputPath: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{
  /**
   * ID of the process
   */
  id: string
}> => {
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
    isFinalized: false,
  }

  activeConcatProcesses.set(processId, concatProcess)

  if (onProgress) {
    onProgress(10, 'Live processing initialized with binary concatenation')
  }

  return { id: processId }
}

/**
 * Append a chunk to an active live concatenation process using binary concatenation
 * @param {string} processId - ID of the active process
 * @param {string} chunkPath - Path to the new chunk file
 */
const appendChunkToLiveConcat = async (processId: string, chunkPath: string): Promise<void> => {
  const process = activeConcatProcesses.get(processId)
  if (!process || process.isFinalized) {
    throw new Error(`Live concat process ${processId} not found or already finalized`)
  }

  try {
    // Read the new chunk and append it to the output file (binary concatenation)
    const chunkData = await fs.readFile(chunkPath)
    await fs.appendFile(process.outputPath, new Uint8Array(chunkData))

    console.log(`Successfully appended chunk to live video: ${chunkPath} → ${process.outputPath}`)
  } catch (error) {
    console.error(`Failed to append chunk to live concat process ${processId}:`, error)
    throw error
  }
}

/**
 * Finalize a live video concatenation process
 * @param {string} processId - ID of the process to finalize
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
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

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
              console.log(`Live concat process ${processId} converted to MP4 successfully`)
              console.log(`Unfixed WebM removed, MP4 created: ${process.outputPath.replace('.webm', '.mp4')}`)
              console.log(`Temporary chunks preserved separately for backup`)

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
        console.error(`Live concat process ${processId} timeout during fixing`)
        ffmpegProcess.kill('SIGKILL')
        activeConcatProcesses.delete(processId)
        reject(new Error('Video fixing process timed out'))
      }, 120000) // 120 second timeout for final processing
    })
  } catch (error) {
    console.error(`Error finalizing live concat process ${processId}:`, error)
    activeConcatProcesses.delete(processId)
    throw error
  }
}

/**
 * Kill a live video concatenation process
 * @param {string} processId - ID of the process to kill
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
 * Convert a WebM file to MP4 format with proper metadata fixing
 * @param {string} webmPath - Path to the input WebM file
 * @param {string} mp4Path - Path where the output MP4 file should be saved
 * @param {function(number, string): void} onProgress - Optional callback for progress updates
 */
const convertWebmToMp4 = async (
  webmPath: string,
  mp4Path: string,
  onProgress?: (progress: number, message: string) => void
): Promise<void> => {
  onProgress?.(10, 'Starting WebM to MP4 conversion...')

  const ffmpegArgs = [
    '-i',
    webmPath,
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
    mp4Path,
  ]

  return new Promise((resolve, reject) => {
    onProgress?.(20, 'Running FFmpeg conversion...')

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim()
      // Filter out common warnings and only log significant errors
      if (output.includes('error') || output.includes('Error') || output.includes('failed')) {
        console.warn(`FFmpeg conversion warning: ${output}`)
      }
      // Update progress based on FFmpeg output
      if (output.includes('time=')) {
        onProgress?.(60, 'Processing video stream...')
      }
    })

    ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg conversion error:`, error)
      reject(new Error(`Failed to convert WebM to MP4: ${error.message}`))
    })

    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          onProgress?.(80, 'Conversion successful, generating thumbnail...')

          // Generate thumbnail from the converted MP4 file
          const videoFileName = basename(mp4Path)
          const thumbnailFileName = `thumbnail_${videoFileName}.jpeg`
          const tempThumbnailPath = join(dirname(mp4Path), `temp_${thumbnailFileName}`)

          console.log(`Generating thumbnail for ${videoFileName}...`)
          await generateThumbnailFromMP4(mp4Path, tempThumbnailPath, 1)

          // Read the generated thumbnail and store it in the database
          const thumbnailBuffer = await fs.readFile(tempThumbnailPath)

          // Store thumbnail in the video storage database
          const { filesystemStorage } = await import('./storage')
          await filesystemStorage.setItem(thumbnailFileName, thumbnailBuffer as any, ['videos'])

          // Clean up temporary thumbnail file
          await fs.unlink(tempThumbnailPath)

          console.log(`Thumbnail generated and stored in database: ${thumbnailFileName}`)

          // Only delete the original WebM file if conversion was successful
          try {
            await fs.unlink(webmPath)
            console.log(`Original WebM file deleted: ${webmPath}`)
            onProgress?.(100, 'WebM to MP4 conversion completed successfully!')
          } catch (deleteError) {
            console.warn(`Failed to delete original WebM file: ${webmPath}`, deleteError)
            onProgress?.(100, 'WebM to MP4 conversion completed (original WebM file preserved)')
          }

          resolve()
        } catch (thumbnailError) {
          console.warn(`Failed to generate thumbnail:`, thumbnailError)
          // Don't fail the entire process if thumbnail generation fails
          onProgress?.(100, 'WebM to MP4 conversion completed (thumbnail generation failed)')
          resolve()
        }
      } else {
        console.error(`FFmpeg failed to convert WebM to MP4 (exit code: ${code})`)
        // Don't delete the WebM file if conversion failed
        reject(new Error(`FFmpeg conversion failed (exit code: ${code})`))
      }
    })

    // Set timeout for conversion
    setTimeout(() => {
      console.error(`WebM to MP4 conversion timeout for ${webmPath}`)
      ffmpegProcess.kill('SIGKILL')
      // Don't delete the WebM file if conversion times out
      reject(new Error('WebM to MP4 conversion timeout'))
    }, 120000) // 120 second timeout
  })
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

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

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
      console.error(`Thumbnail generation timeout for ${videoPath}`)
      ffmpegProcess.kill('SIGKILL')
      reject(new Error('Thumbnail generation timeout'))
    }, 30000) // 30 second timeout
  })
}

/**
 * Remove a temporary directory and all its contents
 * @param {string} dirPath - Path to the directory to remove
 */
const removeTempDirectory = async (dirPath: string): Promise<void> => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (error) {
    console.warn(`Failed to remove temp directory ${dirPath}:`, error)
  }
}


/**
 * Process a ZIP file containing video chunks using the live concatenation pipeline
 * @param {string} zipFilePath - Path to the ZIP file
 * @param {string} tempDir - Temporary directory for extraction and processing
 * @param {function(number, string): void} onProgress - Progress callback function
 */
const processZipFile = async (
  zipFilePath: string,
  tempDir: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> => {
  console.log('processZipFile called with:')
  console.log('  zipFilePath:', zipFilePath)
  console.log('  tempDir:', tempDir)

  if (!zipFilePath) {
    throw new Error('zipFilePath is undefined or empty')
  }

  if (!tempDir) {
    throw new Error('tempDir is undefined or empty')
  }

  onProgress?.(10, 'Extracting ZIP file...')

  // Extract ZIP file
  const extractPath = join(tempDir, 'extracted')
  console.log('Extract path:', extractPath)
  await fs.mkdir(extractPath, { recursive: true })

  // Extract ZIP file using yauzl
  const extractedFiles: string[] = []

  console.log('Starting ZIP extraction from:', zipFilePath)
  console.log('Extraction target:', extractPath)

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening ZIP file:', err)
        reject(err)
        return
      }

      if (!zipfile) {
        reject(new Error('Failed to open ZIP file'))
        return
      }

      console.log('ZIP file opened successfully')

      let extractedCount = 0
      let totalEntries = 0

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        totalEntries++
        console.log(`Processing ZIP entry: ${entry.fileName}`)

        if (/\/$/.test(entry.fileName)) {
          // Directory entry - skip
          console.log('Skipping directory entry:', entry.fileName)
          zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.error('Error opening read stream for:', entry.fileName, err)
            reject(err)
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

              pipeline(readStream, writeStream, (err) => {
                if (err) {
                  console.error('Error extracting file:', entry.fileName, err)
                  reject(err)
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
    .filter(file => {
      const fileName = basename(file)
      const ext = fileName.split('.').pop()?.toLowerCase()

      console.log(`Checking file: ${fileName}, extension: ${ext}`)

      // Look for files that are likely video chunks
      const isVideoFile = file.endsWith('.webm') ||
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

      const isChunkPattern = hashChunkPattern || chunkPattern || underscorePattern || hashChunkNoExtPattern || numberOnlyPattern

      const isChunk = isVideoFile || isChunkPattern

      return isChunk
    })
    .sort() // Sort to ensure correct order

  console.log('Found chunk files:', chunkFiles)
  console.log('Chunk files count:', chunkFiles.length)

  let finalChunkFiles = chunkFiles
  if (chunkFiles.length === 0) {
    // More detailed error message
    const allFiles = extractedFiles.map(f => basename(f)).join(', ')
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

  console.log('Sorted chunk files:', sortedChunkFiles.map(f => basename(f)))

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
  const firstChunkFileName = basename(firstChunkPath)
  console.log(`First chunk filename: ${firstChunkFileName}`)

  const hashMatch = firstChunkFileName.match(/^([a-f0-9]+)_\d+/)
  const hash = hashMatch ? hashMatch[1] : firstChunkFileName.slice(0, 8) // Fallback to first 8 chars
  console.log(`Extracted hash: ${hash}`)

  // Get creation date from ZIP entry metadata (preferred) or filesystem metadata (fallback)
  onProgress?.(35, 'Extracting file metadata...')
  let creationDate: Date

  try {
    // Try to get timestamp from ZIP entry metadata first
    const firstChunkFileName = basename(firstChunkPath)
    const zipEntry = extractedFiles.find(file => basename(file) === firstChunkFileName)

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

  // Generate filename following the live recording pattern: "{missionName} ({datetime}) #{hash}"
  const timeRecordingStartString = format(creationDate, 'LLL dd, yyyy - HH꞉mm꞉ss O')
  const fileName = `Cockpit (${timeRecordingStartString}) #${hash}`
  console.log(`Generated filename: ${fileName}`)

  // Get the default output folder for videos
  const { cockpitFolderPath } = await import('./storage')
  console.log('cockpitFolderPath:', cockpitFolderPath)

  const videosPath = join(cockpitFolderPath, 'videos')
  console.log('videosPath:', videosPath)

  await fs.mkdir(videosPath, { recursive: true })
  console.log('Created videos directory')

  const outputPath = join(videosPath, `${fileName}.webm`) // Start with .webm like live processing
  console.log('outputPath:', outputPath)

  // Find .ass telemetry files and copy them to the output directory
  const assFiles = extractedFiles.filter(file => {
    const fileName = basename(file)
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ext === 'ass'
  })

  console.log('Found .ass files:', assFiles.map(f => basename(f)))

  // Copy .ass files to the output directory with the same name as the video file
  if (assFiles.length > 0) {
    onProgress?.(35, 'Copying telemetry files...')
    const outputDir = dirname(outputPath)

    for (const assFile of assFiles) {
      try {
        const originalFileName = basename(assFile)
        // Use the same base filename as the video but with .ass extension
        const destPath = join(outputDir, `${fileName}.ass`)
        await fs.copyFile(assFile, destPath)
        console.log(`Copied .ass file: ${originalFileName} -> ${destPath}`)
      } catch (error) {
        console.warn(`Failed to copy .ass file ${basename(assFile)}:`, error)
      }
    }
  }

  onProgress?.(40, 'Starting live concatenation pipeline...')

  // Use the live concatenation pipeline instead of FFmpeg concat demuxer
  try {
    // Start live concatenation with the first chunk
    console.log(`Starting live concatenation with first chunk: ${basename(firstChunkPath)}`)

    const { id: processId } = await startLiveVideoConcat(firstChunkPath, outputPath, onProgress)
    console.log(`Live concatenation process started with ID: ${processId}`)

    // Append all remaining chunks using the live concatenation pipeline
    for (let i = 1; i < validChunkFiles.length; i++) {
      const chunkPath = validChunkFiles[i]
      console.log(`Appending chunk ${i + 1}/${validChunkFiles.length}: ${basename(chunkPath)}`)

      await appendChunkToLiveConcat(processId, chunkPath)

      // Update progress
      const progress = 40 + (i / validChunkFiles.length) * 40
      onProgress?.(progress, `Processing chunk ${i + 1}/${validChunkFiles.length}`)
    }

    console.log('All chunks appended, finalizing...')

    // Finalize the live concatenation (this will convert to MP4 with proper metadata)
    await finalizeLiveVideoConcat(processId)

    console.log('ZIP processing completed using live concatenation pipeline')

    // The finalizeLiveVideoConcat function already handles thumbnail generation
    // and converts the output to MP4 format

  } catch (error) {
    console.error('Error in live concatenation pipeline:', error)
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

  /**
   * Convert WebM file to MP4 format
   */
  ipcMain.handle('convert-webm-to-mp4', async (event, webmPath: string, mp4Path: string) => {
    try {
      await convertWebmToMp4(webmPath, mp4Path, (progress, message) => {
        // Send progress updates to renderer process
        event.sender.send('webm-to-mp4-progress', progress, message)
      })
    } catch (error) {
      console.error('Error converting WebM to MP4:', error)
      throw error
    }
  })

  /**
   * Process ZIP file with video chunks
   */
  ipcMain.handle('process-zip-file', async (event, zipFilePath: string, tempDir: string) => {
    console.log('IPC handler process-zip-file called with:')
    console.log('  zipFilePath:', zipFilePath)
    console.log('  tempDir:', tempDir)
    console.log('  zipFilePath type:', typeof zipFilePath)
    console.log('  tempDir type:', typeof tempDir)

    try {
      await processZipFile(zipFilePath, tempDir, (progress, message) => {
        // Send progress updates to renderer process
        event.sender.send('zip-processing-progress', progress, message)
      })
    } catch (error) {
      console.error('Error processing ZIP file:', error)
      throw error
    }
  })
}
