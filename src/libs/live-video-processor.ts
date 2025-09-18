import { isElectron } from '@/libs/utils'

/**
 * Live video processor for real-time concatenation during recording
 *
 * This service handles live concatenation of video chunks as they are recorded,
 * eliminating the need for post-processing. When recording stops, the video
 * is already processed and ready for use.
 */
export class LiveVideoProcessor {
  private recordingHash: string
  private outputPath: string
  private isProcessing: boolean = false
  private chunkQueue: Array<{ blob: Blob; chunkNumber: number }> = []
  private lastProcessedChunk: number = -1
  private ffmpegProcess: any = null
  private tempChunkDir: string = ''
  private onProgressCallback?: (progress: number, message: string) => void

  /**
   * Initialize the live video processor
   * @param recordingHash - Unique identifier for this recording session
   * @param outputPath - Path where the final video will be saved
   * @param onProgress - Optional callback for progress updates
   */
  constructor(
    recordingHash: string,
    outputPath: string,
    onProgress?: (progress: number, message: string) => void
  ) {
    this.recordingHash = recordingHash
    this.outputPath = outputPath
    this.onProgressCallback = onProgress
  }

  /**
   * Start the live processing session
   * @returns Promise that resolves when processing is initialized
   */
  async startProcessing(): Promise<void> {
    if (!isElectron()) {
      throw new Error('Live video processing is only available in Electron')
    }

    this.isProcessing = true
    this.onProgressCallback?.(0, 'Initializing live video processing...')

    try {
      // Create temporary directory for chunk processing
      this.tempChunkDir = await window.electronAPI?.createTempDirectory(`live_video_${this.recordingHash}`)
      if (!this.tempChunkDir) {
        throw new Error('Failed to create temporary directory for live processing')
      }

      // Initialize FFmpeg for live concatenation
      await this.initializeFFmpegProcess()

      this.onProgressCallback?.(10, 'Live processing ready')
      console.log(`Live video processor started for ${this.recordingHash}`)

    } catch (error) {
      this.isProcessing = false
      throw new Error(`Failed to start live processing: ${error}`)
    }
  }

  /**
   * Initialize FFmpeg process for live concatenation
   */
  private async initializeFFmpegProcess(): Promise<void> {
    // Check FFmpeg availability
    const ffmpegAvailable = await window.electronAPI?.ffmpegCheckAvailable()
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg is not available for live processing')
    }

    // FFmpeg will be started on first chunk to get proper format info
    console.log('FFmpeg ready for live concatenation')
  }

  /**
   * Add a new video chunk for live processing
   * @param chunkBlob - The video chunk blob
   * @param chunkNumber - Sequential number of this chunk
   */
  async addChunk(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    if (!this.isProcessing) {
      console.warn('Attempted to add chunk to inactive live processor')
      return
    }

    // Add chunk to processing queue
    this.chunkQueue.push({ blob: chunkBlob, chunkNumber })

    // Process chunks in order
    await this.processQueuedChunks()
  }

  /**
   * Process queued chunks in sequential order
   */
  private async processQueuedChunks(): Promise<void> {
    // Sort queue by chunk number to ensure correct order
    this.chunkQueue.sort((a, b) => a.chunkNumber - b.chunkNumber)

    // Process chunks that are next in sequence
    while (this.chunkQueue.length > 0) {
      const nextChunk = this.chunkQueue[0]

      // Only process if this is the next expected chunk
      if (nextChunk.chunkNumber === this.lastProcessedChunk + 1) {
        this.chunkQueue.shift() // Remove from queue
        await this.processChunk(nextChunk.blob, nextChunk.chunkNumber)
        this.lastProcessedChunk = nextChunk.chunkNumber
      } else {
        // Wait for missing chunks
        break
      }
    }
  }

  /**
   * Process a single video chunk
   * @param chunkBlob - The video chunk to process
   * @param chunkNumber - Sequential number of this chunk
   */
  private async processChunk(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    try {
      if (chunkNumber === 0) {
        // First chunk - initialize the output file
        await this.initializeOutputFile(chunkBlob)
      } else {
        // Subsequent chunks - append to existing file
        await this.appendChunkToOutput(chunkBlob, chunkNumber)
      }

      // Update progress
      const progressMessage = `Processing chunk ${chunkNumber + 1}`
      this.onProgressCallback?.(20 + (chunkNumber * 2), progressMessage) // Rough progress estimate

    } catch (error) {
      console.error(`Failed to process chunk ${chunkNumber}:`, error)
      // Continue processing other chunks even if one fails
    }
  }

  /**
   * Initialize the output file with the first chunk
   * @param firstChunk - The first video chunk
   */
  private async initializeOutputFile(firstChunk: Blob): Promise<void> {
    // Save first chunk to temporary file
    const firstChunkPath = `${this.tempChunkDir}/chunk_0000.webm`
    await window.electronAPI?.writeBlobToFile(firstChunk, firstChunkPath)

    // Start FFmpeg process for live concatenation
    this.ffmpegProcess = await window.electronAPI?.startLiveVideoConcat(
      firstChunkPath,
      this.outputPath,
      (progress: number, message: string) => {
        this.onProgressCallback?.(progress, message)
      }
    )

    console.log('Output file initialized with first chunk')
  }

  /**
   * Append a chunk to the existing output file
   * @param chunkBlob - The video chunk to append
   * @param chunkNumber - Sequential number of this chunk
   */
  private async appendChunkToOutput(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    // Save chunk to temporary file
    const chunkPath = `${this.tempChunkDir}/chunk_${chunkNumber.toString().padStart(4, '0')}.webm`
    await window.electronAPI?.writeBlobToFile(chunkBlob, chunkPath)

    // Add chunk to live FFmpeg process
    if (this.ffmpegProcess) {
      await window.electronAPI?.appendChunkToLiveConcat(this.ffmpegProcess.id, chunkPath)
    }
  }

  /**
   * Stop live processing and finalize the output video
   * @returns Promise that resolves when processing is complete
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    this.onProgressCallback?.(90, 'Finalizing live-processed video...')

    try {
      // Process any remaining chunks in queue
      await this.processQueuedChunks()

      // Finalize FFmpeg process
      if (this.ffmpegProcess) {
        await window.electronAPI?.finalizeLiveVideoConcat(this.ffmpegProcess.id)
        this.ffmpegProcess = null
      }

      // Clean up temporary files
      await this.cleanup()

      this.onProgressCallback?.(100, 'Live processing complete!')
      console.log(`Live video processing completed for ${this.recordingHash}`)

    } catch (error) {
      console.error('Error during live processing finalization:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Clean up temporary files and resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.tempChunkDir) {
        await window.electronAPI?.removeTempDirectory(this.tempChunkDir)
        this.tempChunkDir = ''
      }
    } catch (error) {
      console.warn('Failed to clean up temporary files:', error)
    }
  }

  /**
   * Get the current processing status
   */
  getStatus(): { isProcessing: boolean; lastProcessedChunk: number; queuedChunks: number } {
    return {
      isProcessing: this.isProcessing,
      lastProcessedChunk: this.lastProcessedChunk,
      queuedChunks: this.chunkQueue.length
    }
  }

  /**
   * Force stop processing (emergency cleanup)
   */
  async forceStop(): Promise<void> {
    this.isProcessing = false

    if (this.ffmpegProcess) {
      try {
        await window.electronAPI?.killLiveVideoConcat(this.ffmpegProcess.id)
      } catch (error) {
        console.warn('Error killing FFmpeg process:', error)
      }
      this.ffmpegProcess = null
    }

    await this.cleanup()
    console.log(`Live video processing force stopped for ${this.recordingHash}`)
  }
}

/**
 * Factory function to create a live video processor
 * @param recordingHash - Unique identifier for the recording
 * @param outputPath - Path where the final video will be saved
 * @param onProgress - Optional progress callback
 * @returns LiveVideoProcessor instance
 */
export const createLiveVideoProcessor = (
  recordingHash: string,
  outputPath: string,
  onProgress?: (progress: number, message: string) => void
): LiveVideoProcessor => {
  return new LiveVideoProcessor(recordingHash, outputPath, onProgress)
}
