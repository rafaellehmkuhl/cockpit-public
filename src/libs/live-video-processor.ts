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
  private isProcessing = false
  private chunkQueue: Array<{
    /**
     * The blob of the video chunk
     */
    blob: Blob
    /**
     * The number of the video chunk
     */
    chunkNumber: number
  }> = []
  private lastProcessedChunk = -1
  private ffmpegProcess: any = null
  private tempChunkDir = ''

  /**
   * Initialize the live video processor
   * @param {string} recordingHash - Unique identifier for this recording session
   * @param {string} outputPath - Path where the final video will be saved
   * @param {function(number, string): void} onProgress - Optional callback for progress updates
   */
  constructor(recordingHash: string, outputPath: string) {
    this.recordingHash = recordingHash
    this.outputPath = outputPath
  }

  /**
   * Start the live processing session
   * @returns {Promise<void>} Promise that resolves when processing is initialized
   */
  async startProcessing(): Promise<void> {
    if (!isElectron()) {
      throw new Error('Live video processing is only available in Electron')
    }

    this.isProcessing = true

    try {
      // Create temporary directory for chunk processing
      const tempDir = await window.electronAPI?.createTempDirectory(`live_video_${this.recordingHash}`)
      if (!tempDir) {
        throw new Error('Failed to create temporary directory for live processing')
      }
      this.tempChunkDir = tempDir
    } catch (error) {
      this.isProcessing = false
      throw new Error(`Failed to start live processing: ${error}`)
    }
  }

  /**
   * Add a new video chunk for live processing
   * @param {Blob} chunkBlob - The video chunk blob
   * @param {number} chunkNumber - Sequential number of this chunk
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
   * @param {Blob} chunkBlob - The video chunk to process
   * @param {number} chunkNumber - Sequential number of this chunk
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
    } catch (error) {
      console.error(`Failed to process chunk ${chunkNumber}:`, error)
      // Continue processing other chunks even if one fails
    }
  }

  /**
   * Initialize the output file with the first chunk
   * @param {Blob} firstChunk - The first video chunk
   */
  private async initializeOutputFile(firstChunk: Blob): Promise<void> {
    // Save first chunk to temporary file
    const firstChunkPath = `${this.tempChunkDir}/chunk_0000.webm`
    await window.electronAPI?.writeBlobToFile(firstChunk, firstChunkPath)

    // Start FFmpeg process for live concatenation
    this.ffmpegProcess = await window.electronAPI?.startLiveVideoConcat(firstChunkPath, this.outputPath)

    console.log('Output file initialized with first chunk')
  }

  /**
   * Append a chunk to the existing output file
   * @param {Blob} chunkBlob - The video chunk to append
   * @param {number} chunkNumber - Sequential number of this chunk
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
   * @returns {Promise<void>} Promise that resolves when processing is complete
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      return
    }

    try {
      // Process any remaining chunks in queue
      await this.processQueuedChunks()

      // Finalize FFmpeg process
      if (this.ffmpegProcess) {
        await window.electronAPI?.finalizeLiveVideoConcat(this.ffmpegProcess.id)
        this.ffmpegProcess = null
      }
    } catch (error) {
      console.error('Error during live processing finalization:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }
}
