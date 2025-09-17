<template>
  <div class="flex flex-col h-full p-6">
    <div class="text-xl font-semibold mb-6">Video Chunk Processor</div>

    <!-- Step 1: Select Input Folder -->
    <div v-if="currentStep === 'selectInput'" class="flex flex-col items-center justify-center h-full">
      <div class="text-center mb-8">
        <div class="text-lg mb-4">Select folder containing video chunks</div>
        <div class="text-sm text-white/70 mb-6">
          Choose a folder that contains video chunks with naming pattern: {hash}_{chunkNumber}
        </div>

        <div class="flex flex-col gap-4">
          <v-btn variant="outlined" size="large" color="blue" :disabled="isProcessing" @click="useDefaultFolder">
            <v-icon left>mdi-folder-cog</v-icon>
            Use Default Chunks Folder
          </v-btn>

          <div class="text-sm text-white/50">or</div>

          <v-btn variant="outlined" size="large" color="white" :disabled="isProcessing" @click="selectInputFolder">
            <v-icon left>mdi-folder-open</v-icon>
            Select Custom Folder
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Step 2: Select Hash to Process -->
    <div v-if="currentStep === 'selectHash'" class="flex flex-col h-full">
      <div class="mb-4">
        <div class="text-lg mb-2">Found video hashes in: {{ selectedInputFolder }}</div>
        <div class="text-sm text-white/70 mb-4">Select a video hash to process:</div>
      </div>

      <div class="flex-1 overflow-y-auto mb-4">
        <div v-if="availableHashes.length === 0" class="text-center py-8 text-white/70">
          No video chunks found in the selected folder.
          <br />
          Make sure the folder contains files with pattern: {hash}_{chunkNumber}
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="hashInfo in availableHashes"
            :key="hashInfo.hash"
            class="border border-white/20 rounded-lg p-4 cursor-pointer hover:border-white/40 transition-colors"
            :class="{ 'border-blue-400 bg-blue-400/10': selectedHash === hashInfo.hash }"
            @click="selectedHash = hashInfo.hash"
          >
            <div class="font-mono text-sm">{{ hashInfo.hash }}</div>
            <div class="text-xs text-white/70 mt-1">
              {{ hashInfo.chunkCount }} chunks found
              <span v-if="hashInfo.totalSize"> • {{ formatFileSize(hashInfo.totalSize) }} total </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between">
        <v-btn variant="text" @click="goBack">
          <v-icon left>mdi-arrow-left</v-icon>
          Back
        </v-btn>

        <div class="flex gap-2">
          <v-btn variant="outlined" color="blue" :disabled="!selectedHash" @click="useDefaultOutputFolder">
            <v-icon left>mdi-folder-cog</v-icon>
            Use Default Output
          </v-btn>
          <v-btn variant="outlined" color="white" :disabled="!selectedHash" @click="selectOutputFolder">
            <v-icon left>mdi-folder-open</v-icon>
            Select Custom Output
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Step 3: Processing -->
    <div v-if="currentStep === 'processing'" class="flex h-full">
      <!-- Left side: Progress and status -->
      <div class="flex-1 flex flex-col items-center justify-center pr-4">
        <div class="text-center mb-8">
          <div class="text-lg mb-4">Processing Video</div>
          <div class="text-sm text-white/70 mb-6">
            Hash: {{ selectedHash }}
            <br />
            Output: {{ selectedOutputFolder }}
          </div>

          <div class="w-80 mb-4">
            <v-progress-linear
              :model-value="processingProgress"
              color="blue"
              height="12"
              rounded
              striped
              :buffer-value="processingBuffer"
            />
            <div class="text-xs text-white/50 mt-1">
              {{ processingProgress.toFixed(1) }}% complete
              <span v-if="estimatedTimeRemaining"> • {{ estimatedTimeRemaining }} remaining</span>
            </div>
          </div>

          <div class="text-sm text-white/70 mb-4">
            {{ processingMessage }}
          </div>

          <!-- Processing phase indicator -->
          <div class="flex justify-center space-x-2 mb-4">
            <div
              v-for="(phase, index) in processingPhases"
              :key="index"
              class="flex items-center space-x-1"
              :class="{ 'text-blue-400': currentPhase === index, 'text-white/40': currentPhase !== index }"
            >
              <v-icon size="16" :color="currentPhase === index ? 'blue' : 'grey'">
                {{
                  currentPhase > index
                    ? 'mdi-check-circle'
                    : currentPhase === index
                    ? 'mdi-loading mdi-spin'
                    : 'mdi-circle-outline'
                }}
              </v-icon>
              <span class="text-xs">{{ phase }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Processing logs -->
      <div class="w-96 border-l border-white/20 pl-4 flex flex-col">
        <div class="text-sm font-semibold mb-2 flex items-center">
          <v-icon size="16" class="mr-1">mdi-text-box-outline</v-icon>
          Processing Logs
          <v-spacer />
          <v-btn
            size="x-small"
            variant="text"
            icon="mdi-content-copy"
            title="Copy logs to clipboard"
            @click="copyLogsToClipboard"
          />
          <v-btn size="x-small" variant="text" icon="mdi-delete" title="Clear logs" @click="clearLogs" />
        </div>

        <div
          ref="logsContainer"
          class="flex-1 bg-black/30 rounded border border-white/10 p-3 overflow-y-auto font-mono text-xs leading-relaxed"
        >
          <div
            v-for="(log, index) in processingLogs"
            :key="index"
            class="mb-1"
            :class="{
              'text-red-400': log.type === 'error',
              'text-yellow-400': log.type === 'warning',
              'text-blue-400': log.type === 'ffmpeg',
              'text-green-400': log.type === 'success',
              'text-white/70': log.type === 'info',
            }"
          >
            <span class="text-white/40">[{{ log.timestamp }}]</span>
            <span class="ml-1">{{ log.message }}</span>
          </div>

          <div v-if="processingLogs.length === 0" class="text-white/40 text-center mt-8">
            Logs will appear here during processing...
          </div>
        </div>
      </div>
    </div>

    <!-- Step 4: Completion -->
    <div v-if="currentStep === 'complete'" class="flex flex-col items-center justify-center h-full">
      <div class="text-center mb-8">
        <v-icon size="64" color="green" class="mb-4">mdi-check-circle</v-icon>
        <div class="text-lg mb-4">Video Processing Complete!</div>
        <div class="text-sm text-white/70 mb-6">Processed video saved to: {{ outputVideoPath }}</div>

        <div class="flex flex-col gap-4">
          <v-btn variant="outlined" color="white" @click="openOutputFolder">
            <v-icon left>mdi-folder-open</v-icon>
            Open Output Folder
          </v-btn>

          <v-btn variant="outlined" color="orange" @click="showDeleteChunksDialog">
            <v-icon left>mdi-delete</v-icon>
            Delete Source Chunks ({{ processedChunkCount }} files)
          </v-btn>

          <v-btn variant="text" @click="resetProcessor"> Process Another Video </v-btn>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="currentStep === 'error'" class="flex flex-col items-center justify-center h-full">
      <div class="text-center mb-8">
        <v-icon size="64" color="red" class="mb-4">mdi-alert-circle</v-icon>
        <div class="text-lg mb-4">Processing Failed</div>
        <div class="text-sm text-white/70 mb-6 max-w-md">
          {{ errorMessage }}
        </div>

        <v-btn variant="outlined" @click="resetProcessor">
          <v-icon left>mdi-refresh</v-icon>
          Try Again
        </v-btn>
      </div>
    </div>

    <!-- Delete Chunks Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>Delete Source Chunks?</v-card-title>
        <v-card-text>
          <div class="text-sm mb-4">This will permanently delete {{ processedChunkCount }} chunk files from:</div>
          <div class="font-mono text-xs bg-gray-100 p-2 rounded mb-4">
            {{ selectedInputFolder }}
          </div>
          <div class="text-red-600 text-sm">
            ⚠️ Only delete these files after verifying your processed video plays correctly!
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red" @click="deleteSourceChunks">Delete Chunks</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'

const { openSnackbar } = useSnackbar()

// State management
type ProcessingStep = 'selectInput' | 'selectHash' | 'processing' | 'complete' | 'error'
type LogType = 'info' | 'error' | 'warning' | 'ffmpeg' | 'success'

/**
 *
 */
interface ProcessingLog {
  /**
   *
   */
  timestamp: string
  /**
   *
   */
  message: string
  /**
   *
   */
  type: LogType
}

const currentStep = ref<ProcessingStep>('selectInput')
const selectedInputFolder = ref('')
const selectedOutputFolder = ref('')
const selectedHash = ref('')
const availableHashes = ref<
  Array<{
    /**
     *
     */
    hash: string
    /**
     *
     */
    chunkCount: number
    /**
     *
     */
    totalSize?: number
  }>
>([])

// Processing state
const isProcessing = ref(false)
const processingProgress = ref(0)
const processingBuffer = ref(0)
const processingMessage = ref('')
const errorMessage = ref('')
const outputVideoPath = ref('')
const processedChunkCount = ref(0)
const showDeleteDialog = ref(false)
const processedChunkFiles = ref<string[]>([])

// Enhanced progress tracking
const processingPhases = ref(['Setup', 'Analysis', 'Processing', 'Finalizing'])
const currentPhase = ref(0)
const estimatedTimeRemaining = ref('')
const processingStartTime = ref(0)
const lastProgressUpdate = ref(0)

// Logging system
const processingLogs = ref<ProcessingLog[]>([])
const logsContainer = ref<HTMLElement>()

/**
 * Helper functions
 */

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string
 */
const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Add a log entry to the processing logs
 * @param {string} message - Log message
 * @param {LogType} type - Log type (info, error, warning, ffmpeg, success)
 */
const addLog = (message: string, type: LogType = 'info'): void => {
  const now = new Date()
  const timestamp = now.toLocaleTimeString()

  processingLogs.value.push({
    timestamp,
    message,
    type,
  })

  // Auto-scroll to bottom after adding log
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })

  // Keep only last 500 logs to prevent memory issues
  if (processingLogs.value.length > 500) {
    processingLogs.value.splice(0, processingLogs.value.length - 500)
  }
}

/**
 * Clear all processing logs
 */
const clearLogs = (): void => {
  processingLogs.value = []
}

/**
 * Copy logs to clipboard
 */
const copyLogsToClipboard = async (): Promise<void> => {
  const logsText = processingLogs.value
    .map((log) => `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`)
    .join('\n')

  try {
    await navigator.clipboard.writeText(logsText)
    openSnackbar({
      message: 'Logs copied to clipboard',
      variant: 'success',
      duration: 2000,
    })
  } catch (error) {
    console.error('Failed to copy logs:', error)
    openSnackbar({
      message: 'Failed to copy logs to clipboard',
      variant: 'error',
      duration: 3000,
    })
  }
}

/**
 * Update progress with enhanced tracking
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 * @param {number} phase - Optional phase index
 */
const updateProgress = (progress: number, message: string, phase?: number): void => {
  const now = Date.now()

  // Update basic progress
  processingProgress.value = Math.max(0, Math.min(100, progress))
  processingMessage.value = message

  // Update buffer value for smoother animation
  processingBuffer.value = Math.min(100, progress + 5)

  // Update phase if provided
  if (phase !== undefined && phase !== currentPhase.value) {
    currentPhase.value = phase
    addLog(`Entering phase: ${processingPhases.value[phase] || 'Unknown'}`, 'info')
  }

  // Extract time remaining from the message if present (calculated from file growth rate)
  const timeMatch = message.match(/~(\d+(?:m \d+s|\d+s)) remaining/)
  if (timeMatch) {
    estimatedTimeRemaining.value = timeMatch[1]
  } else if (progress > 99) {
    estimatedTimeRemaining.value = '' // Clear when nearly complete
  }

  lastProgressUpdate.value = now
}

/**
 * Monitor output file size and update progress based on file growth
 * @param {string} outputPath - Path to the output video file
 * @param {number} initialExpectedSize - Initial expected total file size in bytes
 * @param {(progress: number, message: string) => void} onProgress - Progress callback
 * @returns {Promise<() => void>} Promise that resolves to a stop function
 */
const monitorFileSize = async (
  outputPath: string,
  initialExpectedSize: number,
  onProgress: (progress: number, message: string) => void
): Promise<() => void> => {
  return new Promise((resolve) => {
    let lastSize = 0
    let startTime = Date.now()
    let dynamicExpectedSize = initialExpectedSize
    let hasExceededInitialEstimate = false
    /** @type {Array<{size: number, time: number}>} */
    let sizeHistory: Array<{
      /**
       *
       */
      size: number
      /**
       *
       */
      time: number
    }> = []

    const interval = setInterval(async () => {
      try {
        // Check if file exists and get its size
        const fileStats = await window.electronAPI?.getFileStats(outputPath)
        if (fileStats && fileStats.exists && fileStats.size !== undefined) {
          const currentSize = fileStats.size
          const currentTime = Date.now()

          // Adaptive sizing: continuously update expected size if file grows beyond initial estimate
          if (currentSize > dynamicExpectedSize) {
            // Update expected size to be slightly ahead of current size (110% of current)
            const newExpectedSize = Math.floor(currentSize * 1.1)
            if (newExpectedSize > dynamicExpectedSize) {
              const previousSize = dynamicExpectedSize
              dynamicExpectedSize = newExpectedSize
              if (!hasExceededInitialEstimate) {
                hasExceededInitialEstimate = true
                addLog(`File growing beyond initial estimate, dynamically adjusting...`, 'info')
              }
              // Only log significant updates to avoid spam
              if (newExpectedSize > previousSize * 1.05) {
                addLog(`Updated size estimate: ${formatFileSize(dynamicExpectedSize)}`, 'info')
              }
            }
          }

          // Track size history for better rate calculation (keep last 30 measurements = 30 seconds)
          sizeHistory.push({ size: currentSize, time: currentTime })
          if (sizeHistory.length > 30) {
            sizeHistory.shift() // Remove oldest entry
          }

          // Calculate progress based on file size (1% to 99% range)
          let sizeProgress
          if (currentSize <= dynamicExpectedSize) {
            sizeProgress = (currentSize / dynamicExpectedSize) * 100
          } else {
            // For files larger than expected, use asymptotic approach to 100%
            const excess = currentSize - dynamicExpectedSize
            const excessRatio = excess / dynamicExpectedSize
            sizeProgress = 100 - 10 / (1 + excessRatio * 2) // Approaches 100% asymptotically
          }

          const mappedProgress = Math.min(99, 1 + sizeProgress * 0.98) // Map to 1-99% range, cap at 99%

          // Calculate time remaining based on actual file growth rate
          let timeRemainingText = ''
          if (sizeHistory.length >= 5 && currentSize > 0) {
            // Use all available history (up to 30 seconds) for more stable rate estimation
            const timeSpan = sizeHistory[sizeHistory.length - 1].time - sizeHistory[0].time
            const sizeGrowth = sizeHistory[sizeHistory.length - 1].size - sizeHistory[0].size

            if (timeSpan > 0 && sizeGrowth > 0) {
              const bytesPerMs = sizeGrowth / timeSpan
              const remainingBytes = Math.max(0, dynamicExpectedSize - currentSize)
              const estimatedRemainingMs = remainingBytes / bytesPerMs

              // Only show estimate if it's reasonable (less than 24 hours)
              if (estimatedRemainingMs > 0 && estimatedRemainingMs < 86400000) {
                const remainingMinutes = Math.ceil(estimatedRemainingMs / 60000)
                const remainingSeconds = Math.ceil((estimatedRemainingMs % 60000) / 1000)

                if (remainingMinutes > 0) {
                  timeRemainingText = ` • ~${remainingMinutes}m ${remainingSeconds}s remaining`
                } else if (remainingSeconds > 0) {
                  timeRemainingText = ` • ~${remainingSeconds}s remaining`
                }

                // Also calculate and log the current writing speed
                const speedMBps = (bytesPerMs * 1000) / (1024 * 1024) // MB/s
                if (speedMBps > 0.1) {
                  // Only show if speed is meaningful
                  timeRemainingText += ` (${speedMBps.toFixed(1)} MB/s)`
                }
              }
            }
          }

          // Update progress with size information and time estimate
          const sizeInfo = `${formatFileSize(currentSize)} / ~${formatFileSize(dynamicExpectedSize)}`
          const progressMessage = `Writing video file: ${sizeInfo}${timeRemainingText}`
          onProgress(mappedProgress, progressMessage)

          // Log size updates periodically (but keep monitoring regardless)
          if (currentSize !== lastSize) {
            const progressPercent = ((currentSize / dynamicExpectedSize) * 100).toFixed(1)
            const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
            addLog(
              `Output file size: ${formatFileSize(
                currentSize
              )} (${progressPercent}% of estimate) after ${elapsedSeconds}s`,
              'info'
            )
            lastSize = currentSize
          }

          // Continue monitoring until explicitly stopped - no auto-stop on stable size
        }
      } catch (error) {
        // File might not exist yet, continue monitoring
        console.log('File not accessible yet, continuing to monitor...')
      }
    }, 1000) // Check every second

    // Return the stop function immediately
    const stopMonitoring = (): void => {
      clearInterval(interval)
    }

    resolve(stopMonitoring)

    // Safety timeout to prevent infinite monitoring (much longer for large files)
    setTimeout(() => {
      addLog('File size monitoring timed out after 30 minutes', 'warning')
      clearInterval(interval)
    }, 1800000) // 30 minutes maximum
  })
}

/**
 * Use the default temporary video chunks folder
 */
const useDefaultFolder = async (): Promise<void> => {
  if (!isElectron()) {
    openSnackbar({
      message: 'Default folder is only available in the desktop version',
      variant: 'error',
      duration: 3000,
    })
    return
  }

  try {
    // Get the default folder path from Electron
    const defaultPath = await window.electronAPI?.getDefaultChunksFolder()
    if (defaultPath) {
      selectedInputFolder.value = defaultPath
      await scanForVideoHashes()
      currentStep.value = 'selectHash'
    } else {
      // Fallback to manual selection if default path not available
      await selectInputFolder()
    }
  } catch (error) {
    console.error('Error using default folder:', error)
    // Fallback to manual selection
    await selectInputFolder()
  }
}

/**
 * Select input folder containing video chunks
 */
const selectInputFolder = async (): Promise<void> => {
  if (!isElectron()) {
    openSnackbar({
      message: 'Folder selection is only available in the desktop version',
      variant: 'error',
      duration: 3000,
    })
    return
  }

  try {
    const result = await window.electronAPI?.selectFolder()
    if (result && !result.canceled && result.filePaths?.[0]) {
      selectedInputFolder.value = result.filePaths[0]
      await scanForVideoHashes()
      currentStep.value = 'selectHash'
    }
  } catch (error) {
    console.error('Error selecting folder:', error)
    errorMessage.value = 'Failed to select folder'
    currentStep.value = 'error'
  }
}

/**
 * Scan selected folder for video chunk hashes
 */
const scanForVideoHashes = async (): Promise<void> => {
  if (!isElectron() || !selectedInputFolder.value) return

  try {
    const files = await window.electronAPI?.readDirectory(selectedInputFolder.value)
    if (!files) return

    const hashMap = new Map<
      string,
      {
        /**
         *
         */
        count: number
        /**
         *
         */
        totalSize: number
      }
    >()

    for (const file of files) {
      // Match pattern: {hash}_{chunkNumber}
      const match = file.name.match(/^([a-f0-9-]+)_(\d+)$/)
      if (match) {
        const hash = match[1]
        const existing = hashMap.get(hash) || { count: 0, totalSize: 0 }
        hashMap.set(hash, {
          count: existing.count + 1,
          totalSize: existing.totalSize + (file.size || 0),
        })
      }
    }

    availableHashes.value = Array.from(hashMap.entries())
      .map(([hash, info]) => ({
        hash,
        chunkCount: info.count,
        totalSize: info.totalSize,
      }))
      .sort((a, b) => b.chunkCount - a.chunkCount) // Sort by chunk count descending
  } catch (error) {
    console.error('Error scanning for hashes:', error)
    errorMessage.value = 'Failed to scan folder for video chunks'
    currentStep.value = 'error'
  }
}

const useDefaultOutputFolder = async (): Promise<void> => {
  if (!isElectron()) {
    openSnackbar({
      message: 'Default output folder is only available in the desktop version',
      variant: 'error',
      duration: 3000,
    })
    return
  }

  try {
    // Get the default output folder path from Electron
    const defaultPath = await window.electronAPI?.getDefaultOutputFolder()
    if (defaultPath) {
      selectedOutputFolder.value = defaultPath
      await processVideo()
    } else {
      // Fallback to manual selection if default path not available
      await selectOutputFolder()
    }
  } catch (error) {
    console.error('Error using default output folder:', error)
    // Fallback to manual selection
    await selectOutputFolder()
  }
}

const selectOutputFolder = async (): Promise<void> => {
  if (!isElectron()) {
    openSnackbar({
      message: 'Folder selection is only available in the desktop version',
      variant: 'error',
      duration: 3000,
    })
    return
  }

  try {
    const result = await window.electronAPI?.selectFolder()
    if (result && !result.canceled && result.filePaths?.[0]) {
      selectedOutputFolder.value = result.filePaths[0]
      await processVideo()
    }
  } catch (error) {
    console.error('Error selecting output folder:', error)
    errorMessage.value = 'Failed to select output folder'
    currentStep.value = 'error'
  }
}

const processVideo = async (): Promise<void> => {
  currentStep.value = 'processing'
  isProcessing.value = true

  // Reset processing state
  processingProgress.value = 0
  processingBuffer.value = 0
  processingMessage.value = 'Initializing...'
  currentPhase.value = 0
  estimatedTimeRemaining.value = ''
  processingStartTime.value = Date.now()
  processingLogs.value = []

  addLog('=== Video Processing Started ===', 'info')
  addLog(`Processing hash: ${selectedHash.value}`, 'info')
  addLog(`Output folder: ${selectedOutputFolder.value}`, 'info')

  try {
    // PHASE 1: Setup (0-10% progress)
    updateProgress(1, 'Checking FFmpeg availability...', 0)
    addLog('Checking FFmpeg availability...', 'info')

    const ffmpegAvailable = await window.electronAPI?.ffmpegCheckAvailable()
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg is not installed or not available in PATH. Please install FFmpeg first.')
    }
    addLog('FFmpeg is available', 'success')

    updateProgress(3, 'Getting FFmpeg version...')
    // Get FFmpeg version for info
    try {
      const version = await window.electronAPI?.ffmpegGetVersion()
      console.log(`Using FFmpeg version: ${version}`)
      addLog(`Using FFmpeg version: ${version}`, 'success')
      updateProgress(5, `Using FFmpeg ${version}`)
    } catch (error) {
      console.warn('Could not get FFmpeg version:', error)
      addLog('Could not get FFmpeg version, proceeding anyway', 'warning')
    }

    updateProgress(7, 'Reading chunk files...')
    addLog('Scanning input directory for chunk files...', 'info')

    // Get all chunk files for the selected hash
    const files = await window.electronAPI?.readDirectory(selectedInputFolder.value)
    if (!files) throw new Error('Could not read input directory')

    const chunkFiles = files
      .filter((file: any) => file.name.startsWith(`${selectedHash.value}_`))
      .sort((a: any, b: any) => {
        const aNum = parseInt(a.name.split('_')[1]) || 0
        const bNum = parseInt(b.name.split('_')[1]) || 0
        return aNum - bNum
      })

    if (chunkFiles.length === 0) {
      throw new Error('No chunk files found for selected hash')
    }

    processedChunkCount.value = chunkFiles.length
    processedChunkFiles.value = chunkFiles.map((f: any) => f.path)
    addLog(`Found ${chunkFiles.length} chunk files to process`, 'success')

    // Log chunk file details and calculate expected output size
    const totalInputSize = chunkFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0)
    addLog(`Total input size: ${formatFileSize(totalInputSize)}`, 'info')

    // For video chunk concatenation, output size is usually close to input size
    // We'll use 115% as the baseline estimate to account for format overhead
    const expectedOutputSize = Math.floor(totalInputSize * 1.15)
    addLog(`Expected output size: ~${formatFileSize(expectedOutputSize)} (115% of input, will adapt if needed)`, 'info')

    updateProgress(9, `Preparing ${chunkFiles.length} chunks for processing...`)

    // Prepare file paths for FFmpeg
    const inputFiles = chunkFiles.map((f: any) => f.path)
    const outputFilename = `processed_${selectedHash.value}.mp4`
    const outputPath = `${selectedOutputFolder.value}/${outputFilename}`
    outputVideoPath.value = outputPath

    addLog(`Output file: ${outputFilename}`, 'info')
    addLog(`Expected size: ${formatFileSize(expectedOutputSize)}`, 'info')
    updateProgress(1, 'Starting FFmpeg processing...', 1)

    // PHASE 2: FFmpeg Processing (1-99% progress based on file size)
    addLog('=== Starting FFmpeg Processing ===', 'info')

    // Set up progress listener for FFmpeg logs only (not progress tracking)
    if (window.electronAPI?.onFFmpegProgress) {
      window.electronAPI.onFFmpegProgress(({ message }) => {
        // Only log messages, don't use for progress tracking
        const logType: LogType = message.toLowerCase().includes('error')
          ? 'error'
          : message.toLowerCase().includes('warning')
          ? 'warning'
          : 'ffmpeg'
        addLog(message, logType)
      })
    }

    // Start file size monitoring in parallel with FFmpeg processing
    addLog('Starting file size monitoring...', 'info')
    const stopFileMonitoring = await monitorFileSize(outputPath, expectedOutputSize, (progress, message) => {
      // Phase 2 is always "Processing" during file size monitoring
      // The file is actually being written during this entire phase
      updateProgress(progress, message, 2)
    })

    // Start FFmpeg processing
    addLog('Invoking FFmpeg processing...', 'info')
    const ffmpegPromise = window.electronAPI?.ffmpegProcessAndConvertChunks(inputFiles, outputPath, 'mp4')

    // Wait for FFmpeg to complete, then stop file monitoring
    await ffmpegPromise
    addLog('FFmpeg processing completed, stopping file monitoring...', 'info')

    // Stop file monitoring since FFmpeg is done
    stopFileMonitoring()

    // Wait a bit more for any final file operations
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // PHASE 3: Cleanup and finalization (99-100% progress)
    addLog('FFmpeg processing completed successfully', 'success')

    // Clean up progress listener
    if (window.electronAPI?.offFFmpegProgress) {
      window.electronAPI.offFFmpegProgress()
    }

    updateProgress(99, 'Verifying output file...', 3)
    addLog('Verifying output file exists and is complete...', 'info')

    // Verify final file size
    try {
      const finalStats = await window.electronAPI?.getFileStats(outputPath)
      if (finalStats && finalStats.exists && finalStats.size !== undefined) {
        const finalSize = finalStats.size
        const compressionRatio = (((totalInputSize - finalSize) / totalInputSize) * 100).toFixed(1)
        addLog(`Final output size: ${formatFileSize(finalSize)}`, 'success')
        addLog(`Compression ratio: ${compressionRatio}% reduction`, 'info')
      }
    } catch (error) {
      addLog('Could not verify final file size', 'warning')
    }

    updateProgress(99.5, 'Processing complete!')
    addLog(`Video saved to: ${outputPath}`, 'success')

    // Small delay to show completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    updateProgress(100, 'Complete!')
    addLog('=== Video Processing Completed Successfully ===', 'success')

    currentStep.value = 'complete'
  } catch (error) {
    console.error('Processing error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown processing error'
    errorMessage.value = errorMsg
    addLog(`ERROR: ${errorMsg}`, 'error')
    addLog('=== Video Processing Failed ===', 'error')
    currentStep.value = 'error'

    // Clean up progress listener on error
    if (window.electronAPI?.offFFmpegProgress) {
      window.electronAPI.offFFmpegProgress()
    }
  } finally {
    isProcessing.value = false
  }
}

const openOutputFolder = async (): Promise<void> => {
  if (!isElectron() || !selectedOutputFolder.value) return

  try {
    await window.electronAPI?.openPath(selectedOutputFolder.value)
  } catch (error) {
    console.error('Error opening output folder:', error)
    openSnackbar({
      message: 'Failed to open output folder',
      variant: 'error',
      duration: 3000,
    })
  }
}

const showDeleteChunksDialog = (): void => {
  showDeleteDialog.value = true
}

const deleteSourceChunks = async (): Promise<void> => {
  if (!isElectron() || processedChunkFiles.value.length === 0) return

  try {
    for (const filePath of processedChunkFiles.value) {
      await window.electronAPI?.deleteFile(filePath)
    }

    openSnackbar({
      message: `Deleted ${processedChunkFiles.value.length} chunk files`,
      variant: 'success',
      duration: 3000,
    })

    showDeleteDialog.value = false
  } catch (error) {
    console.error('Error deleting chunks:', error)
    openSnackbar({
      message: 'Failed to delete some chunk files',
      variant: 'error',
      duration: 3000,
    })
  }
}

const goBack = (): void => {
  if (currentStep.value === 'selectHash') {
    currentStep.value = 'selectInput'
    selectedInputFolder.value = ''
    availableHashes.value = []
    selectedHash.value = ''
  }
}

const resetProcessor = (): void => {
  currentStep.value = 'selectInput'
  selectedInputFolder.value = ''
  selectedOutputFolder.value = ''
  selectedHash.value = ''
  availableHashes.value = []
  isProcessing.value = false
  processingProgress.value = 0
  processingBuffer.value = 0
  processingMessage.value = ''
  errorMessage.value = ''
  outputVideoPath.value = ''
  processedChunkCount.value = 0
  processedChunkFiles.value = []
  showDeleteDialog.value = false

  // Reset enhanced progress tracking
  currentPhase.value = 0
  estimatedTimeRemaining.value = ''
  processingStartTime.value = 0
  lastProgressUpdate.value = 0

  // Clear logs
  processingLogs.value = []
}
</script>

<style scoped>
/* Component specific styles can go here */
</style>
