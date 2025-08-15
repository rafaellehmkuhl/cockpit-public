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
    <div v-if="currentStep === 'processing'" class="flex flex-col items-center justify-center h-full">
      <div class="text-center mb-8">
        <div class="text-lg mb-4">Processing Video</div>
        <div class="text-sm text-white/70 mb-6">
          Hash: {{ selectedHash }}
          <br />
          Output: {{ selectedOutputFolder }}
        </div>

        <div class="w-80 mb-4">
          <v-progress-linear :model-value="processingProgress" color="blue" height="8" rounded striped />
        </div>

        <div class="text-sm text-white/70">
          {{ processingMessage }}
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
import { ref } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'

const { openSnackbar } = useSnackbar()

// State management
type ProcessingStep = 'selectInput' | 'selectHash' | 'processing' | 'complete' | 'error'

const currentStep = ref<ProcessingStep>('selectInput')
const selectedInputFolder = ref('')
const selectedOutputFolder = ref('')
const selectedHash = ref('')
const availableHashes = ref<
  Array<{
    /**
cccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccc
     */
    hash: string
    /**
hhhhhhhhhhhhhh *
hhhhhhhhhhhhhh
     */
    chunkCount: number
    /**
cccccccccccccccccccc *
cccccccccccccccccccc
     */
    totalSize?: number
  }>
>([])
const isProcessing = ref(false)
const processingProgress = ref(0)
const processingMessage = ref('')
const errorMessage = ref('')
const outputVideoPath = ref('')
const processedChunkCount = ref(0)
const showDeleteDialog = ref(false)
const processedChunkFiles = ref<string[]>([])

/**
 * Helper functions
 * Format file size in human readable format
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
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
  processingProgress.value = 0
  processingMessage.value = 'Initializing...'

  try {
    // PHASE 1: Setup (0-5% progress)
    processingProgress.value = 1
    processingMessage.value = 'Checking FFmpeg availability...'

    const ffmpegAvailable = await window.electronAPI?.ffmpegCheckAvailable()
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg is not installed or not available in PATH. Please install FFmpeg first.')
    }

    processingProgress.value = 2
    // Get FFmpeg version for info
    try {
      const version = await window.electronAPI?.ffmpegGetVersion()
      console.log(`Using FFmpeg version: ${version}`)
      processingMessage.value = `Using FFmpeg ${version}`
    } catch (error) {
      console.warn('Could not get FFmpeg version:', error)
    }

    processingProgress.value = 3
    processingMessage.value = 'Reading chunk files...'

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

    processingProgress.value = 4
    processingMessage.value = `Preparing ${chunkFiles.length} chunks for processing...`

    // Prepare file paths for FFmpeg
    const inputFiles = chunkFiles.map((f: any) => f.path)
    const outputFilename = `processed_${selectedHash.value}.mp4`
    const outputPath = `${selectedOutputFolder.value}/${outputFilename}`
    outputVideoPath.value = outputPath

    processingProgress.value = 5
    processingMessage.value = 'Starting FFmpeg processing...'

    // PHASE 2: FFmpeg Processing (5-95% progress)
    // Set up progress listener to receive updates from FFmpeg service
    if (window.electronAPI?.onFFmpegProgress) {
      window.electronAPI.onFFmpegProgress(({ progress, message }) => {
        // Map FFmpeg progress (0-100%) to our range (5-95%)
        const mappedProgress = 5 + (progress * 0.9) // 5% + (progress * 90%)
        processingProgress.value = Math.min(95, mappedProgress)
        processingMessage.value = message
      })
    }

    // Start FFmpeg processing
    await window.electronAPI?.ffmpegProcessAndConvertChunks(inputFiles, outputPath, 'mp4')

    // PHASE 3: Cleanup and finalization (95-100% progress)
    processingProgress.value = 96
    processingMessage.value = 'Finalizing output...'

    // Clean up progress listener
    if (window.electronAPI?.offFFmpegProgress) {
      window.electronAPI.offFFmpegProgress()
    }

    processingProgress.value = 98
    processingMessage.value = 'Verifying output file...'

    // Small delay to show finalization steps
    await new Promise(resolve => setTimeout(resolve, 500))

    processingProgress.value = 100
    processingMessage.value = 'Complete!'

    currentStep.value = 'complete'
  } catch (error) {
    console.error('Processing error:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Unknown processing error'
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
  processingMessage.value = ''
  errorMessage.value = ''
  outputVideoPath.value = ''
  processedChunkCount.value = 0
  processedChunkFiles.value = []
  showDeleteDialog.value = false
}
</script>

<style scoped>
/* Component specific styles can go here */
</style>
