import { isElectron } from '@/libs/utils'

/**
 * Live video processor for real-time binary concatenation during recording
 *
 * This service handles live binary concatenation of video chunks as they are recorded,
 * eliminating the need for post-processing. Video chunks are appended directly to the
 * output file. When recording stops, FFmpeg converts the binary-concatenated stream
 * to a proper MP4 file.
 */
export class LiveVideoProcessor {
  private recordingHash: string
  private isProcessing = false
  private keepRawVideoChunksAsBackup = true
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
  private concatProcess: any = null

  /**
   * Initialize the live video processor
   * @param {string} recordingHash - Unique identifier for this recording session
   * @param {boolean} keepRawVideoChunksAsBackup - Whether to keep raw video chunks as backup
   */
  constructor(recordingHash: string, keepRawVideoChunksAsBackup?: boolean) {
    this.keepRawVideoChunksAsBackup = keepRawVideoChunksAsBackup ?? this.keepRawVideoChunksAsBackup
    this.recordingHash = recordingHash
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
        if (!this.keepRawVideoChunksAsBackup) {
          await this.deleteChunk(nextChunk.chunkNumber)
        }
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
   * Delete a video chunk
   * @param {number} chunkNumber - The number of the video chunk to delete
   */
  private async deleteChunk(chunkNumber: number): Promise<void> {
    await window.electronAPI?.deleteChunk(this.recordingHash, chunkNumber)
  }

  /**
   * Initialize the output file with the first chunk
   * @param {Blob} firstChunk - The first video chunk
   */
  private async initializeOutputFile(firstChunk: Blob): Promise<void> {
    // Start binary concatenation process with the first chunk
    // The main process handles everything: temp directory, output path, file management
    this.concatProcess = await window.electronAPI?.startLiveVideoConcat(firstChunk, this.recordingHash)

    console.log('Output file initialized with first chunk for binary concatenation')
  }

  /**
   * Append a chunk to the existing output file
   * @param {Blob} chunkBlob - The video chunk to append
   * @param {number} chunkNumber - Sequential number of this chunk
   */
  private async appendChunkToOutput(chunkBlob: Blob, chunkNumber: number): Promise<void> {
    // Send chunk directly to main process for processing
    // The main process handles file management and binary concatenation
    if (this.concatProcess) {
      await window.electronAPI?.appendChunkToLiveVideoConcat(this.concatProcess.id, chunkBlob, chunkNumber)
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

      // Finalize binary concatenation process (this will trigger FFmpeg conversion to MP4)
      if (this.concatProcess) {
        await window.electronAPI?.finalizeLiveVideoConcat(this.concatProcess.id)
        this.concatProcess = null
      }
    } catch (error) {
      console.error('Error during live processing finalization:', error)
      throw error
    } finally {
      this.isProcessing = false
    }
  }
}
