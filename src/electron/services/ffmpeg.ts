import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { spawn } from 'child_process'

/**
 * FFmpeg processing service for Electron main process
 *
 * This service provides video processing capabilities using native FFmpeg installation.
 * It handles concatenating video chunks from WebRTC streams into complete video files,
 * with robust error handling for corrupted H.264 streams and multiple fallback strategies.
 *
 * Key features:
 * - Three-tier processing strategy (concat demuxer → concat protocol → re-encoding)
 * - Smart failure detection even when FFmpeg reports success
 * - Optimized for both clean 1080p and corrupted 4K video chunks
 * - Comprehensive progress tracking and error recovery
 */
export class FFmpegService {
  /** Path to the FFmpeg executable (defaults to system PATH) */
  private ffmpegPath: string
  /** Path to the FFprobe executable (defaults to system PATH) */
  private ffprobePath: string

  /**
   * Initialize the FFmpeg service with custom executable paths
   * @param ffmpegPath - Path to FFmpeg binary, defaults to 'ffmpeg' (system PATH)
   * @param ffprobePath - Path to FFprobe binary, defaults to 'ffprobe' (system PATH)
   */
  constructor(ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe') {
    this.ffmpegPath = ffmpegPath
    this.ffprobePath = ffprobePath
  }

  /**
   * Check if FFmpeg is available on the system
   *
   * Attempts to run 'ffmpeg -version' to verify the binary is accessible
   * and functional. Used during initialization to ensure video processing
   * capabilities are available before attempting operations.
   *
   * @returns Promise that resolves to true if FFmpeg is available, false otherwise
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // Spawn FFmpeg with version flag to test availability
      const process = spawn(this.ffmpegPath, ['-version'])

      // Handle case where FFmpeg binary is not found
      process.on('error', () => {
        resolve(false)
      })

      // Check exit code - 0 indicates success
      process.on('close', (code) => {
        resolve(code === 0)
      })

      // Timeout protection to prevent hanging on broken installations
      setTimeout(() => {
        process.kill()
        resolve(false)
      }, 5000)
    })
  }

  /**
   * Get FFmpeg version information
   *
   * Extracts version string from FFmpeg binary for logging and debugging purposes.
   * Useful for troubleshooting compatibility issues and ensuring the correct
   * FFmpeg version is being used.
   *
   * @returns Promise that resolves to the version string (e.g., "7.1.1") or "unknown"
   * @throws Error if FFmpeg is not found or fails to execute
   */
  async getFFmpegVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Run FFmpeg version command and capture output
      const process = spawn(this.ffmpegPath, ['-version'])
      let output = ''

      // Collect stdout data containing version information
      process.stdout.on('data', (data) => {
        output += data.toString()
      })

      // Handle FFmpeg binary not found
      process.on('error', (error) => {
        reject(new Error(`FFmpeg not found: ${error.message}`))
      })

      process.on('close', (code) => {
        if (code === 0) {
          // Parse version from output like "ffmpeg version 7.1.1 Copyright..."
          const versionMatch = output.match(/ffmpeg version ([^\s]+)/)
          resolve(versionMatch ? versionMatch[1] : 'unknown')
        } else {
          reject(new Error('Failed to get FFmpeg version'))
        }
      })
    })
  }

  /**
   * Process video chunks by concatenating them using FFmpeg
   *
   * This is the core video processing method that implements a three-tier strategy
   * for handling different types of video chunk corruption:
   *
   * 1. Concat Demuxer: Fast, accurate timestamps (best for clean chunks)
   * 2. Concat Protocol: Faster, handles corruption better (fallback for corrupted chunks)
   * 3. Re-encoding: Slowest but fixes everything (last resort)
   *
   * The method includes smart failure detection that catches cases where FFmpeg
   * reports success but actually processed very few frames due to corruption.
   *
   * @param inputFiles - Array of paths to video chunk files to concatenate
   * @param outputPath - Path where the final concatenated video should be saved
   * @param onProgress - Optional callback for progress updates (0-100%)
   * @throws Error if no input files provided or if all processing methods fail
   */
  async processVideoChunks(
    inputFiles: string[],
    outputPath: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    if (inputFiles.length === 0) {
      throw new Error('No input files provided')
    }

    // Ensure output directory exists before attempting to write
    await fs.mkdir(dirname(outputPath), { recursive: true })

    // Create a temporary file list for FFmpeg concat demuxer
    // This file contains paths to all chunks in the format FFmpeg expects
    const tempDir = dirname(outputPath)
    const listFile = join(tempDir, `ffmpeg_list_${Date.now()}.txt`)

    try {
      onProgress?.(10, 'Creating file list...')

      // Create file list content for FFmpeg concat demuxer
      // Format: "file '/path/to/chunk1'\nfile '/path/to/chunk2'\n..."
      const fileListContent = inputFiles
        .map(file => `file '${file.replace(/'/g, "'\\''")}'`) // Escape single quotes in filenames
        .join('\n')

      // Debug logging for troubleshooting
      console.log(`FFmpeg concat list file: ${listFile}`)
      console.log(`FFmpeg concat list content:\n${fileListContent}`)
      console.log(`Processing ${inputFiles.length} input files`)

      // Verify all input files exist and log their sizes for debugging
      // This helps identify missing or corrupted chunk files early
      for (let i = 0; i < inputFiles.length; i++) {
        try {
          const stats = await fs.stat(inputFiles[i])
          console.log(`File ${i}: ${inputFiles[i]} - Size: ${stats.size} bytes`)
        } catch (error) {
          console.error(`File ${i} does not exist: ${inputFiles[i]}`)
          throw new Error(`Input file does not exist: ${inputFiles[i]}`)
        }
      }

      // Write the file list that FFmpeg will use for concatenation
      await fs.writeFile(listFile, fileListContent)

      onProgress?.(20, 'Starting FFmpeg processing...')

      // TIER 1: Try the concat demuxer first (best for duration/seeking accuracy)
      // This method reads from a file list and provides the most accurate timestamps
      // and duration metadata, making it ideal for clean video chunks (like 1080p USB camera)
      try {
        console.log('Attempting concat demuxer method for accurate timestamps...')
        await this.runFFmpegCommand([
          '-f', 'concat',                    // Use concat demuxer (reads from file list)
          '-safe', '0',                      // Allow absolute paths in file list
          '-analyzeduration', '10M',         // Analyze up to 10MB to detect stream parameters
          '-probesize', '50M',              // Probe up to 50MB for better stream detection
          '-i', listFile,                   // Input: our temporary file list
          '-c', 'copy',                     // Copy streams without re-encoding (fastest)
          '-ignore_unknown',                // Skip unknown stream types
          '-fflags', '+genpts+igndts',      // Generate PTS timestamps, ignore DTS issues
          '-avoid_negative_ts', 'make_zero', // Fix negative timestamp issues
          '-max_muxing_queue_size', '1024', // Handle large streams without blocking
          '-err_detect', 'ignore_err',      // Ignore minor errors in stream
          '-movflags', '+faststart',        // Optimize MP4 for web playback (moov at start)
          '-y',                             // Overwrite output file without asking
          outputPath
        ], onProgress, inputFiles.length)
      } catch (error) {
        console.warn('Concat demuxer failed, trying faster concat protocol:', error)
        onProgress?.(40, 'Trying faster concat protocol method...')

        // TIER 2: Use concat protocol (faster but may have duration issues)
        // This method concatenates files directly without needing a file list
        // It's more tolerant of H.264 corruption and works well for 4K streams
        const concatInput = inputFiles.map(file => file.replace(/'/g, "'\\''")).join('|')
        console.log(`Trying concat protocol method: concat:${concatInput}`)

        try {
          await this.runFFmpegCommand([
            '-analyzeduration', '10M',         // Increased analysis for problematic streams
            '-probesize', '50M',              // Larger probe size for corrupted data
            '-i', `concat:${concatInput}`,    // Input: direct file concatenation (file1|file2|...)
            '-c', 'copy',                     // Copy streams without re-encoding
            '-ignore_unknown',                // Skip unknown stream types
            '-fflags', '+genpts+igndts',      // Generate timestamps, ignore DTS problems
            '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
            '-max_muxing_queue_size', '1024', // Handle large 4K streams
            '-err_detect', 'ignore_err',      // Ignore stream errors (important for corruption)
            '-movflags', '+faststart',        // Optimize for web playback
            '-y',                             // Overwrite output
            outputPath
          ], onProgress, inputFiles.length)
        } catch (secondError) {
          console.warn('Both concat methods failed, trying re-encoding fallback:', secondError)
          onProgress?.(70, 'Trying re-encoding fallback for corrupted H.264...')

          // TIER 3: Final fallback - Re-encode to fix corrupted H.264 streams
          // This is the slowest method but guarantees a working output by completely
          // re-encoding the video. Used when both concat methods fail due to severe corruption.
          await this.runFFmpegCommand([
            '-analyzeduration', '10M',         // Extended analysis for corrupted streams
            '-probesize', '50M',              // Large probe size to handle corruption
            '-i', `concat:${concatInput}`,    // Input: concat protocol (more robust than demuxer)
            '-c:v', 'libx264',               // Re-encode video with H.264 encoder
            '-preset', 'fast',               // Encoding speed preset (fast but good quality)
            '-crf', '18',                    // Constant Rate Factor: 18 = high quality
            '-pix_fmt', 'yuv420p',           // Standard pixel format for compatibility
            '-ignore_unknown',                // Skip unknown streams
            '-fflags', '+genpts+igndts',      // Generate proper timestamps
            '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
            '-max_muxing_queue_size', '1024', // Handle large data streams
            '-err_detect', 'ignore_err',      // Continue despite minor errors
            '-movflags', '+faststart',        // Optimize for web streaming
            '-y',                             // Overwrite output
            outputPath
          ], onProgress, inputFiles.length)
        }
      }

      onProgress?.(100, 'Processing complete')

    } finally {
      // Clean up temporary file list to avoid cluttering the filesystem
      try {
        await fs.unlink(listFile)
        console.log(`Cleaned up temporary file: ${listFile}`)
      } catch (error) {
        console.warn('Failed to clean up temporary file list:', error)
      }
    }
  }

  /**
   * Process video chunks by directly concatenating them (simplified interface)
   *
   * This is a high-level wrapper around processVideoChunks that provides a simpler
   * interface for the VideoChunkProcessor component. It automatically handles the
   * three-tier processing strategy and progress mapping.
   *
   * @param inputFiles - Array of paths to video chunk files to concatenate
   * @param outputPath - Path where the final concatenated video should be saved
   * @param outputFormat - Target format for output file (currently unused, always MP4)
   * @param onProgress - Optional callback for progress updates (0-100%)
   * @throws Error if no input files provided or if all processing methods fail
   */
  async processAndConvertVideoChunks(
    inputFiles: string[],
    outputPath: string,
    outputFormat: string = 'mp4',
    onProgress?: (progress: number, message: string) => void
  ): Promise<void> {
    if (inputFiles.length === 0) {
      throw new Error('No input files provided')
    }

    onProgress?.(10, 'Starting video concatenation...')
    console.log(`Processing ${inputFiles.length} chunks directly with FFmpeg concat`)

    // Delegate to the main processing method with progress mapping
    // Maps internal progress (0-100%) to external progress (10-100%)
    await this.processVideoChunks(inputFiles, outputPath, (progress, message) => {
      onProgress?.(10 + (progress * 0.9), message) // 10% to 100%
    })
  }

  /**
   * Run an FFmpeg command with progress tracking and quality validation
   *
   * This is the core method that executes FFmpeg commands and implements smart
   * failure detection. It monitors the FFmpeg process for both obvious failures
   * (non-zero exit codes) and subtle failures (exit code 0 but very few frames processed).
   *
   * The quality validation is crucial because FFmpeg sometimes reports success
   * even when it only processed a fraction of the input due to corruption.
   *
   * @param args - Command line arguments to pass to FFmpeg
   * @param onProgress - Optional callback for progress updates
   * @param expectedInputCount - Number of input chunks (used for quality validation)
   * @returns Promise that resolves when FFmpeg completes successfully
   * @throws Error if FFmpeg fails or produces insufficient output
   * @private
   */
  private async runFFmpegCommand(
    args: string[],
    onProgress?: (progress: number, message: string) => void,
    expectedInputCount?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Running FFmpeg command: ${this.ffmpegPath} ${args.join(' ')}`)

      // Spawn FFmpeg process with the provided arguments
      const process = spawn(this.ffmpegPath, args)
      let errorOutput = ''      // Collect stderr for error reporting
      let stdoutOutput = ''     // Collect stdout for debugging
      let processedFrames = 0   // Track number of frames processed
      let hasH264Errors = false // Flag H.264 corruption indicators

      // Monitor stdout (usually minimal output from FFmpeg)
      process.stdout.on('data', (data) => {
        const output = data.toString()
        stdoutOutput += output
        console.log(`FFmpeg stdout: ${output.trim()}`)
      })

      // Monitor stderr (where FFmpeg outputs progress and errors)
      process.stderr.on('data', (data) => {
        const output = data.toString()
        errorOutput += output
        console.log(`FFmpeg stderr: ${output.trim()}`)

        // SMART FAILURE DETECTION: Check for H.264 corruption indicators
        // These patterns indicate the input streams have problems
        if (output.includes('non-existing PPS') ||           // Missing parameter sets
            output.includes('decode_slice_header error') ||  // Corrupted H.264 headers
            output.includes('Could not find codec parameters') || // Unreadable streams
            output.includes('Impossible to open')) {         // File access/format issues
          hasH264Errors = true
        }

        // Track processed frames for quality validation
        const frameMatch = output.match(/frame=\s*(\d+)/)
        if (frameMatch) {
          processedFrames = parseInt(frameMatch[1])
        }

        // Parse progress information and notify callback
        if (onProgress) {
          this.parseFFmpegProgress(output, onProgress)
        }
      })

      // Handle process spawn errors (e.g., FFmpeg not found)
      process.on('error', (error) => {
        console.error(`FFmpeg process error: ${error.message}`)
        reject(new Error(`FFmpeg process error: ${error.message}`))
      })

      // Handle process completion with smart quality validation
      process.on('close', (code) => {
        console.log(`FFmpeg process exited with code: ${code}`)
        console.log(`Processed frames: ${processedFrames}`)
        console.log(`H.264 errors detected: ${hasH264Errors}`)

        if (code === 0) {
          // CRITICAL: Even if exit code is 0, validate output quality
          // This catches cases where FFmpeg "succeeds" but processes almost nothing

          if (hasH264Errors && processedFrames < 10) {
            // Very few frames + H.264 errors = likely failed processing
            console.warn('FFmpeg "succeeded" but likely failed due to H.264 corruption - very few frames processed')
            reject(new Error(`FFmpeg processed only ${processedFrames} frames with H.264 errors. Likely corrupted stream.`))
          } else if (expectedInputCount && processedFrames < (expectedInputCount * 0.1)) {
            // Processed less than 10% of expected frames = incomplete processing
            console.warn(`FFmpeg processed only ${processedFrames} frames from ${expectedInputCount} input chunks`)
            reject(new Error(`FFmpeg processed only ${processedFrames} frames from ${expectedInputCount} expected chunks. Likely incomplete processing.`))
          } else {
            // Validation passed - this is a genuine success
            console.log('FFmpeg completed successfully')
            resolve()
          }
        } else {
          // Standard failure case - non-zero exit code
          console.error(`FFmpeg failed. Error output: ${errorOutput}`)
          reject(new Error(`FFmpeg failed with exit code ${code}. Error output: ${errorOutput}`))
        }
      })
    })
  }

  /**
   * Parse FFmpeg progress output and extract progress information
   *
   * FFmpeg outputs progress information to stderr in various formats.
   * This method extracts useful progress indicators and converts them
   * to percentage values for the UI progress bar.
   *
   * Note: Since we don't know the total video duration beforehand,
   * progress estimation is approximate and primarily for user feedback.
   *
   * @param output - Raw stderr output line from FFmpeg
   * @param onProgress - Callback to report progress updates
   * @private
   */
  private parseFFmpegProgress(output: string, onProgress: (progress: number, message: string) => void): void {
    // FFmpeg outputs progress information in stderr with various patterns

    // Pattern 1: time=HH:MM:SS.DD - current processing time position
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
    if (timeMatch) {
      const hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[2])
      const seconds = parseInt(timeMatch[3])
      const totalSeconds = hours * 3600 + minutes * 60 + seconds

      // Since we don't know total duration, estimate progress based on time processed
      // This is a rough heuristic that works reasonably well for typical recordings
      onProgress(Math.min(95, totalSeconds * 2), `Processing: ${timeMatch[0]}`)
      return
    }

    // Pattern 2: frame=NNNN - number of frames processed
    const frameMatch = output.match(/frame=\s*(\d+)/)
    if (frameMatch) {
      const frame = parseInt(frameMatch[1])
      // Rough progress estimate assuming ~30fps and unknown total duration
      // This provides some progress feedback even when time info is unavailable
      const estimatedProgress = Math.min(90, frame / 30) // Very rough estimate
      onProgress(estimatedProgress, `Processing frame ${frame}`)
      return
    }

    // Pattern 3: Various completion indicators
    if (output.includes('Overwrite? [y/N]')) {
      onProgress(95, 'Finalizing output...')
    }
  }
}

// Global FFmpeg service instance used by IPC handlers
const ffmpegService = new FFmpegService()

/**
 * Setup FFmpeg IPC handlers for Electron main process
 *
 * This function registers IPC handlers that allow the renderer process
 * (VideoChunkProcessor component) to communicate with the FFmpeg service
 * running in the main process. This separation is necessary because:
 *
 * 1. Native processes (FFmpeg) can only be spawned from the main process
 * 2. File system operations are restricted in the renderer for security
 * 3. The main process provides a secure bridge for video processing
 *
 * Called during Electron app initialization in main.ts
 */
export const setupFFmpegService = (): void => {
  /**
   * IPC Handler: Check if FFmpeg is available on the system
   * Used by the UI to verify prerequisites before showing processing options
   */
  ipcMain.handle('ffmpeg-check-available', async () => {
    try {
      return await ffmpegService.checkFFmpegAvailable()
    } catch (error) {
      console.error('Error checking FFmpeg availability:', error)
      return false // Return false instead of throwing to gracefully handle missing FFmpeg
    }
  })

  /**
   * IPC Handler: Get FFmpeg version information
   * Used for logging and debugging purposes to identify the FFmpeg version in use
   */
  ipcMain.handle('ffmpeg-get-version', async () => {
    try {
      return await ffmpegService.getFFmpegVersion()
    } catch (error) {
      console.error('Error getting FFmpeg version:', error)
      throw error // Re-throw as this is usually called after availability check
    }
  })

    /**
   * IPC Handler: Process and concatenate video chunks
   * This is the main processing endpoint used by VideoChunkProcessor
   *
   * Handles the complete three-tier processing strategy:
   * - Tries concat demuxer for clean chunks (best timestamps)
   * - Falls back to concat protocol for corrupted chunks (faster)
   * - Falls back to re-encoding for severely corrupted chunks (guaranteed success)
   */
  ipcMain.handle('ffmpeg-process-and-convert-chunks', async (event, { inputFiles, outputPath, outputFormat }) => {
    try {
      await ffmpegService.processAndConvertVideoChunks(
        inputFiles,
        outputPath,
        outputFormat || 'mp4',
        (progress, message) => {
          // Log progress to main process console for debugging
          console.log(`FFmpeg Progress: ${progress}% - ${message}`)
          // Send progress updates back to renderer process
          event.sender.send('ffmpeg-progress', { progress, message })
        }
      )
      return { success: true }
    } catch (error) {
      console.error('Error processing and converting video chunks:', error)
      throw error // Re-throw to be handled by the renderer process
    }
  })
}
