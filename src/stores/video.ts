import { useThrottleFn } from '@vueuse/core'
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import { differenceInSeconds, format } from 'date-fns'
import { saveAs } from 'file-saver'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, ref, watch } from 'vue'
import adapter from 'webrtc-adapter'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { WebRTCManager } from '@/composables/webRTC'
import { getIpsInformationFromVehicle } from '@/libs/blueos'
import eventTracker from '@/libs/external-telemetry/event-tracking'
import { availableCockpitActions, registerActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { createLiveVideoProcessor, LiveVideoProcessor } from '@/libs/live-video-processor'
import { CockpitStandardLog, datalogger } from '@/libs/sensors-logging'
import { isEqual, isElectron, sleep } from '@/libs/utils'
import { tempVideoStorage, videoStorage } from '@/libs/videoStorage'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { Alert, AlertLevel } from '@/types/alert'
import { StorageDB } from '@/types/general'
import {
  type DownloadProgressCallback,
  type FileDescriptor,
  type StreamData,
  type VideoProcessingDetails,
  VideoExtensionContainer,
  VideoStreamCorrespondency,
} from '@/types/video'

import { useAlertStore } from './alert'
const { openSnackbar } = useSnackbar()

export const useVideoStore = defineStore('video', () => {
  const missionStore = useMissionStore()
  const alertStore = useAlertStore()
  const { showDialog } = useInteractionDialog()

  const { globalAddress, rtcConfiguration, webRTCSignallingURI } = useMainVehicleStore()
  console.debug('[WebRTC] Using webrtc-adapter for', adapter.browserDetails)

  const streamsCorrespondency = useBlueOsStorage<VideoStreamCorrespondency[]>('cockpit-streams-correspondency', [])
  const ignoredStreamExternalIds = useBlueOsStorage<string[]>('cockpit-ignored-stream-external-ids', [])
  const allowedIceIps = useBlueOsStorage<string[]>('cockpit-allowed-stream-ips', [])
  const enableAutoIceIpFetch = useBlueOsStorage('cockpit-enable-auto-ice-ip-fetch', true)
  const allowedIceProtocols = useBlueOsStorage<string[]>('cockpit-allowed-stream-protocols', [])
  const jitterBufferTarget = useBlueOsStorage<number | null>('cockpit-jitter-buffer-target', 0)
  const zipMultipleFiles = useBlueOsStorage('cockpit-zip-multiple-video-files', false)
  const activeStreams = ref<{ [key in string]: StreamData | undefined }>({})
  const mainWebRTCManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
  const availableIceIps = ref<string[]>([])
  const enableLiveProcessing = useBlueOsStorage('cockpit-enable-live-processing', true)
  const saveBackupRawChunks = useBlueOsStorage('cockpit-save-backup-raw-chunks', true)
  const lastRenamedStreamName = ref('')
  const isRecordingAllStreams = ref(false)
  const liveProcessors = ref<{ [key: string]: LiveVideoProcessor }>({})
  const recordingStates = ref<{ [key: string]: boolean }>({})
  const telemetryMetadata = ref<{ [key: string]: { fileName: string; dateStart: Date; vWidth: number; vHeight: number } }>({})

  const namesAvailableStreams = computed(() => mainWebRTCManager.availableStreams.value.map((stream) => stream.name))

  const namessAvailableAbstractedStreams = computed(() => {
    return streamsCorrespondency.value.map((stream) => stream.name)
  })

  const externalStreamId = (internalName: string): string | undefined => {
    const corr = streamsCorrespondency.value.find((stream) => stream.name === internalName)
    return corr ? corr.externalId : undefined
  }

  const initializeStreamsCorrespondency = (): void => {
    // Get list of external streams that are already mapped
    const alreadyMappedExternalIds = streamsCorrespondency.value.map((corr) => corr.externalId)

    // Find external streams that don't have a mapping yet and are not ignored
    const unmappedExternalStreams = namesAvailableStreams.value.filter((streamName) => {
      return !alreadyMappedExternalIds.includes(streamName) && !ignoredStreamExternalIds.value.includes(streamName)
    })

    // If there are no unmapped streams, no need to add any new correspondences
    if (unmappedExternalStreams.length === 0) return

    // Generate internal names for new streams, making sure they don't conflict with existing ones
    const existingInternalNames = streamsCorrespondency.value.map((corr) => corr.name)
    const newCorrespondencies: VideoStreamCorrespondency[] = []

    let i = 1
    unmappedExternalStreams.forEach((streamName) => {
      // Find the next available internal name (Stream 1, Stream 2, etc.)
      let internalName = `Stream ${i}`
      while (existingInternalNames.includes(internalName)) {
        i++
        internalName = `Stream ${i}`
      }

      newCorrespondencies.push({
        name: internalName,
        externalId: streamName,
      })
      existingInternalNames.push(internalName) // Track this name to avoid duplicates
      i++
    })

    // Add new correspondences to the existing ones instead of replacing them
    streamsCorrespondency.value = [...streamsCorrespondency.value, ...newCorrespondencies]
  }

  watch(namesAvailableStreams, () => {
    initializeStreamsCorrespondency()
  })

  // If the allowed ICE IPs are updated, all the streams should be reconnected
  watch([allowedIceIps, allowedIceProtocols], () => {
    Object.keys(activeStreams.value).forEach((streamName) => (activeStreams.value[streamName] = undefined))
  })

  // Streams update routine. Responsible for starting and updating the streams.
  setInterval(() => {
    Object.keys(activeStreams.value).forEach((streamName) => {
      if (activeStreams.value[streamName] === undefined) return
      // Update the list of available remote ICE Ips with those available for each stream
      // @ts-ignore: availableICEIPs is not reactive here, for some yet to know reason
      const newIps = activeStreams.value[streamName].webRtcManager.availableICEIPs.filter(
        (ip: string) => !availableIceIps.value.includes(ip)
      )
      availableIceIps.value = [...availableIceIps.value, ...newIps]

      const updatedStream = mainWebRTCManager.availableStreams.value.find((s) => s.name === streamName)

      // Checks if the stream has changed, and if so, it will close the old connections
      if (isEqual(updatedStream, activeStreams.value[streamName]!.stream)) return
      const oldStreamData = activeStreams.value[streamName]
      if (oldStreamData && oldStreamData.webRtcManager) {
        console.log(`[FIX] Stream '${streamName}' has changed. Closing the old connection.`)
        oldStreamData.webRtcManager.endAllSessions()
      }

      if (isEqual(updatedStream, activeStreams.value[streamName]!.stream)) return

      // Whenever the stream is to be updated we first reset it's variables (activateStream method), so
      // consumers can be updated as well.
      console.log(`New stream for '${streamName}':`)
      console.log(JSON.stringify(updatedStream, null, 2))
      activateStream(streamName)
      activeStreams.value[streamName]!.stream = updatedStream
    })
  }, 300)

  /**
   * Activates a stream by starting it and storing it's variables inside a common object.
   * This way multiple consumers will always access the same resource, so we don't consume unnecessary
   * bandwith or stress the stream provider more than we need to.
   * @param {string} streamName - Unique name for the stream, common between the multiple consumers
   */
  const activateStream = (streamName: string): void => {
    const stream = ref()
    const webRtcManager = new WebRTCManager(webRTCSignallingURI, rtcConfiguration)
    const { mediaStream, connected } = webRtcManager.startStream(
      stream,
      allowedIceIps,
      allowedIceProtocols,
      jitterBufferTarget
    )
    activeStreams.value[streamName] = {
      // @ts-ignore: This is actually not reactive
      stream: stream,
      webRtcManager: webRtcManager,
      // @ts-ignore: This is actually not reactive
      mediaStream: mediaStream,
      // @ts-ignore: This is actually not reactive
      connected: connected,
      mediaRecorder: undefined,
      timeRecordingStart: undefined,
    }
    console.debug(`Activated stream '${streamName}'.`)
  }

  /**
   * Get all data related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {StreamData | undefined} The StreamData object, if available
   */
  const getStreamData = (streamName: string): StreamData | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]
  }

  /**
   * Get the MediaStream object related to a given stream, if available
   * @param {string} streamName - Name of the stream
   * @returns {MediaStream | undefined} MediaStream that is running, if available
   */
  const getMediaStream = (streamName: string): MediaStream | undefined => {
    if (activeStreams.value[streamName] === undefined) {
      activateStream(streamName)
    }
    return activeStreams.value[streamName]!.mediaStream
  }

  /**
   * Wether or not the stream is currently being recorded
   * @param {string} streamName - Name of the stream
   * @returns {boolean}
   */
  const isRecording = (streamName: string): boolean => {
    console.log(`VideoStore.isRecording("${streamName}")`)
    console.log(`  recordingStates:`, recordingStates.value)
    console.log(`  activeStreams keys:`, Object.keys(activeStreams.value))

    // First check our reliable recording state
    if (recordingStates.value[streamName]) {
      console.log(`  Recording state: true (from recordingStates)`)
      return true
    }

    if (activeStreams.value[streamName] === undefined) {
      console.log(`  Stream "${streamName}" not found, activating...`)
      activateStream(streamName)
    }

    const streamData = activeStreams.value[streamName]
    const hasMediaRecorder = streamData?.mediaRecorder !== undefined
    const recorderState = streamData?.mediaRecorder?.state
    const isCurrentlyRecording = hasMediaRecorder && recorderState === 'recording'

    console.log(`  streamData exists: ${!!streamData}`)
    console.log(`  hasMediaRecorder: ${hasMediaRecorder}`)
    console.log(`  recorderState: ${recorderState}`)
    console.log(`  isCurrentlyRecording: ${isCurrentlyRecording}`)

    return isCurrentlyRecording
  }

  /**
   * Stop recording the stream
   * @param {string} streamName - Name of the stream
   */
  const stopRecording = (streamName: string): void => {
    console.log(`VideoStore.stopRecording("${streamName}")`)

    // Clear recording state immediately
    recordingStates.value[streamName] = false
    console.log(`  Set recordingStates["${streamName}"] = false`)

    if (activeStreams.value[streamName] === undefined) activateStream(streamName)

    const timeRecordingStart = activeStreams.value[streamName]?.timeRecordingStart
    const durationInSeconds = timeRecordingStart ? differenceInSeconds(new Date(), timeRecordingStart) : undefined
    eventTracker.capture('Video recording stop', { streamName, durationInSeconds })

    activeStreams.value[streamName]!.timeRecordingStart = undefined

    activeStreams.value[streamName]!.mediaRecorder!.stop()

    datalogger.stopLogging(streamName)
    alertStore.pushAlert(new Alert(AlertLevel.Success, `Stopped recording stream ${streamName}.`))
  }

  const videoThumbnailFilename = (videoFileName: string): string => {
    return `thumbnail_${videoFileName}.jpeg`
  }

  const getVideoThumbnail = async (videoFileNameOrHash: string, isProcessed: boolean): Promise<Blob | null> => {
    const db = isProcessed ? videoStorage : tempVideoStorage
    const thumbnail = await db.getItem(videoThumbnailFilename(videoFileNameOrHash))
    return thumbnail || null
  }

  /**
   * Get recording metadata from localStorage (web version only)
   * @param {string} hash - Recording hash
   * @returns {object|null} Recording metadata or null if not found
   */
  const getRecordingMetadata = (hash: string): { epoch_start: number; epoch_end: number | null } | null => {
    if (isElectron()) return null

    try {
      const recordingMetadata = JSON.parse(localStorage.getItem('cockpit_recording_metadata') || '{}')
      return recordingMetadata[hash] || null
    } catch (error) {
      console.warn(`Failed to get recording metadata for hash ${hash}:`, error)
      return null
    }
  }

  /**
   * Start recording the stream
   * @param {string} streamName - Name of the stream
   */
  const startRecording = async (streamName: string): Promise<void> => {
    console.log(`VideoStore.startRecording("${streamName}")`)
    console.log(`  activeStreams keys before:`, Object.keys(activeStreams.value))

    // Set recording state immediately to prevent race conditions
    recordingStates.value[streamName] = true
    console.log(`  Set recordingStates["${streamName}"] = true`)

    eventTracker.capture('Video recording start', { streamName: streamName })
    if (activeStreams.value[streamName] === undefined) {
      console.log(`  Stream "${streamName}" not found, activating...`)
      activateStream(streamName)
    }

    if (namesAvailableStreams.value.isEmpty()) {
      recordingStates.value[streamName] = false
      showDialog({ message: 'No streams available.', variant: 'error' })
      return
    }

    if (activeStreams.value[streamName]!.mediaStream === undefined) {
      recordingStates.value[streamName] = false
      showDialog({ message: 'Media stream not defined.', variant: 'error' })
      return
    }
    if (!activeStreams.value[streamName]!.mediaStream!.active) {
      recordingStates.value[streamName] = false
      showDialog({ message: 'Media stream not yet active. Wait a second and try again.', variant: 'error' })
      return
    }

    datalogger.startLogging(streamName)
    await sleep(100)

    const recordingStartTime = new Date()
    activeStreams.value[streamName]!.timeRecordingStart = recordingStartTime
    const streamData = activeStreams.value[streamName] as StreamData

    let recordingHash = ''
    let refreshHash = true
    const namesCurrentChunksOnDB = await tempVideoStorage.keys()
    while (refreshHash) {
      recordingHash = uuid().slice(0, 8)
      refreshHash = namesCurrentChunksOnDB.some((chunkName) => chunkName.includes(recordingHash))
    }

    // Store recording metadata in localStorage for web version
    if (!isElectron()) {
      const recordingMetadata = JSON.parse(localStorage.getItem('cockpit_recording_metadata') || '{}')
      recordingMetadata[recordingHash] = {
        epoch_start: recordingStartTime.getTime(),
        epoch_end: null // Will be set when recording stops
      }
      localStorage.setItem('cockpit_recording_metadata', JSON.stringify(recordingMetadata))
      console.log(`Stored recording metadata for hash ${recordingHash}:`, recordingMetadata[recordingHash])
    }

    const timeRecordingStartString = format(streamData.timeRecordingStart!, 'LLL dd, yyyy - HH꞉mm꞉ss O')
    const fileName = `${missionStore.missionName || 'Cockpit'} (${timeRecordingStartString}) #${recordingHash}`
    activeStreams.value[streamName]!.mediaRecorder = new MediaRecorder(streamData.mediaStream!)

    // Start recording immediately to ensure MediaRecorder state is correct for UI checks
    activeStreams.value[streamName]!.mediaRecorder!.start(1000)

    console.log(`  MediaRecorder started for "${streamName}"`)
    console.log(`  activeStreams keys after:`, Object.keys(activeStreams.value))
    console.log(`  MediaRecorder state: ${activeStreams.value[streamName]!.mediaRecorder!.state}`)

    // Initialize live processor if enabled and on Electron
    let liveProcessor: LiveVideoProcessor | undefined
    if (enableLiveProcessing.value && window.electronAPI) {
      try {
        const outputPath = await window.electronAPI.getDefaultOutputFolder()
        if (outputPath) {
          // Start with .webm for binary concatenation, will be converted to .mp4 during finalization
          const liveOutputPath = `${outputPath}/${fileName}.webm`
          liveProcessor = createLiveVideoProcessor(recordingHash, liveOutputPath, (progress, message) => {
            console.log(`Live processing ${recordingHash}: ${progress}% - ${message}`)
            // Could emit progress events here for UI updates
          })
          await liveProcessor.startProcessing()
          liveProcessors.value[recordingHash] = liveProcessor

          // Store telemetry metadata for later generation
          const videoTrack = streamData.mediaStream!.getVideoTracks()[0]
          const vWidth = videoTrack.getSettings().width || 1920
          const vHeight = videoTrack.getSettings().height || 1080
          telemetryMetadata.value[recordingHash] = {
            fileName,
            dateStart: recordingStartTime,
            vWidth,
            vHeight
          }

          console.log(`Live processing started for ${recordingHash}`)
        }
      } catch (error) {
        console.warn('Failed to start live processing:', error)
        // Continue with normal recording even if live processing fails
      }
    } else if (!window.electronAPI) {
      console.log(`Browser environment detected - video processing disabled. Raw chunks will be saved for manual processing.`)
    }

    let losingChunksWarningIssued = false
    const unsavedChunkAlerts: { [key in string]: ReturnType<typeof setTimeout> } = {}

    const warnAboutChunkLoss = (): void => {
      const chunkLossWarningMsg = `A part of your video recording could not be saved.
        This usually happens when the device's storage is full or the performance is low.
        We recommend stopping the recording and trying again, as the video may be incomplete or corrupted
        on several parts.`
      const sequentialChunksLossMessage = `Warning: Several video chunks could not be saved. The video recording may be impacted.`
      const fivePercentChunksLossMessage = `Warning: More than 5% of the video chunks could not be saved. The video recording may be impacted.`

      console.error(chunkLossWarningMsg)

      openSnackbar({
        message: 'Oops, looks like a video chunk could not be saved. Retrying...',
        duration: 2000,
        variant: 'info',
        closeButton: false,
      })

      sequentialLostChunks++
      totalLostChunks++

      // Check for 5 or more sequential lost chunks
      if (sequentialLostChunks >= 5 && losingChunksWarningIssued === false) {
        showDialog({
          message: sequentialChunksLossMessage,
          variant: 'error',
        })
        sequentialLostChunks = 0
        losingChunksWarningIssued = true
      }

      // Check if more than 5% of total video chunks are lost
      const lostChunkPercentage = (totalLostChunks / totalChunks) * 100
      if (totalChunks > 10 && lostChunkPercentage > 5 && losingChunksWarningIssued === false) {
        showDialog({
          message: fivePercentChunksLossMessage,
          variant: 'error',
        })
        losingChunksWarningIssued = true
      }
    }

    Object.keys(unsavedChunkAlerts).forEach((key) => {
      clearTimeout(unsavedChunkAlerts[key])
      delete unsavedChunkAlerts[key]
    })

    let sequentialLostChunks = 0
    let totalChunks = 0
    let totalLostChunks = 0

    let chunksCount = -1
    activeStreams.value[streamName]!.mediaRecorder!.ondataavailable = async (e) => {
      chunksCount++
      totalChunks++
      const chunkName = `${recordingHash}_${chunksCount}`

      try {
        // For web version, set proper timestamp based on recording start time
        if (!isElectron()) {
          const chunkData = e.data
          // Calculate timestamp: recording start + elapsed time (chunk number in seconds)
          const chunkTimestamp = recordingStartTime.getTime() + (chunksCount * 1000)
          Object.defineProperty(chunkData, 'lastModified', {
            value: chunkTimestamp,
            writable: false
          })
          await tempVideoStorage.setItem(chunkName, chunkData)
        } else {
          await tempVideoStorage.setItem(chunkName, e.data)
        }

        sequentialLostChunks = 0

        // Send chunk to live processor if active
        const processor = liveProcessors.value[recordingHash]
        if (processor && e.data.size > 0) {
          try {
            await processor.addChunk(e.data, chunksCount)
          } catch (error) {
            console.warn(`Failed to add chunk ${chunksCount} to live processor:`, error)
          }
        }
      } catch {
        sequentialLostChunks++
        totalLostChunks++

        warnAboutChunkLoss()
        return
      }

      // If the chunk was saved, remove it from the unsaved list
      clearTimeout(unsavedChunkAlerts[chunkName])
      delete unsavedChunkAlerts[chunkName]
    }

    activeStreams.value[streamName]!.mediaRecorder!.onstop = async () => {
      // Update recording metadata with end time (web version only)
      if (!isElectron()) {
        const recordingMetadata = JSON.parse(localStorage.getItem('cockpit_recording_metadata') || '{}')
        if (recordingMetadata[recordingHash]) {
          recordingMetadata[recordingHash].epoch_end = new Date().getTime()
          localStorage.setItem('cockpit_recording_metadata', JSON.stringify(recordingMetadata))
          console.log(`Updated recording metadata for hash ${recordingHash}:`, recordingMetadata[recordingHash])
        }
      }

      // Finalize live processing if active (Electron only)
      const processor = liveProcessors.value[recordingHash]
      if (processor) {
        try {
          await processor.stopProcessing()
          delete liveProcessors.value[recordingHash]

          // Generate telemetry overlay after video processing is complete
          const metadata = telemetryMetadata.value[recordingHash]
          if (metadata) {
            try {
              const dateFinish = new Date()
              await generateTelemetryOverlay(
                recordingHash,
                metadata.fileName,
                metadata.dateStart,
                dateFinish,
                metadata.vWidth,
                metadata.vHeight
              )
              delete telemetryMetadata.value[recordingHash]
            } catch (telemetryError) {
              console.warn('Failed to generate telemetry overlay:', telemetryError)
            }
          }

          openSnackbar({
            message: 'Live video processing completed! Video and telemetry ready for use.',
            duration: 3000,
            variant: 'success',
            closeButton: false,
          })

          // For live processing, we skip the traditional processing since video is already done
          // Conditionally keep or clean up temp chunks based on user setting
          if (saveBackupRawChunks.value) {
            console.log(`Live processing completed. Temp chunks preserved as backup for hash: ${recordingHash}`)
          } else {
            console.log(`Live processing completed. Cleaning up temp chunks for hash: ${recordingHash}`)
            await cleanupProcessedData(recordingHash)
          }
        } catch (error) {
          console.error('Failed to finalize live processing:', error)
          delete liveProcessors.value[recordingHash]
          delete telemetryMetadata.value[recordingHash]

          // For now, we don't fall back to traditional processing
          // Live processing is the only method available
          console.warn('Live processing failed, no fallback processing available')
        }
      } else if (!window.electronAPI) {
        // Browser environment - show message about raw chunks
        openSnackbar({
          message: 'Recording completed! Raw video chunks saved. Check the Temporary tab to download them.',
          duration: 5000,
          variant: 'info',
          closeButton: true,
        })
        console.log(`Browser recording completed. Raw chunks saved for hash: ${recordingHash}`)
      }

      activeStreams.value[streamName]!.mediaRecorder = undefined

      // Clear recording state when MediaRecorder stops
      recordingStates.value[streamName] = false
      console.log(`  Cleared recordingStates["${streamName}"] on MediaRecorder stop`)
    }

    alertStore.pushAlert(new Alert(AlertLevel.Success, `Started recording stream ${streamName}.`))
  }

  // Used to discard a file from the video recovery database
  const discardProcessedFilesFromVideoDB = async (fileNames: string[]): Promise<void> => {
    console.debug(`Discarding files from the video recovery database: ${fileNames.join(', ')}`)
    for (const filename of fileNames) {
      await videoStorage.removeItem(filename)
    }
  }

  const discardUnprocessedFilesFromVideoDB = async (hashes: string[]): Promise<void> => {
    const allKeys = await tempVideoStorage.keys()
    for (const hash of hashes) {
      const keysToRemove = allKeys.filter((key) => key.includes(hash))
      for (const key of keysToRemove) {
        await tempVideoStorage.removeItem(key)
      }
    }
  }

  const createZipAndDownload = async (
    files: FileDescriptor[],
    zipFilename: string,
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { level: 0 })
    const zipAddingPromises = files.map(({ filename, blob }) => {
      zipWriter.add(filename, new BlobReader(blob), { onprogress: progressCallback })
    })
    Promise.all(zipAddingPromises)
    const blob = await zipWriter.close()
    saveAs(blob, zipFilename)
  }

  const downloadFiles = async (
    db: StorageDB | LocalForage,
    keys: string[],
    shouldZip = false,
    zipFilenamePrefix = 'Cockpit-Video-Files',
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    const maybeFiles = await Promise.all(
      keys.map(async (key) => ({
        blob: await db.getItem(key),
        filename: key,
      }))
    )
    /* eslint-disable jsdoc/require-jsdoc  */
    const files = maybeFiles.filter((file): file is { blob: Blob; filename: string } => file.blob !== undefined)

    if (files.length === 0) {
      showDialog({ message: 'No files found.', variant: 'error' })
      return
    }

    if (shouldZip) {
      await createZipAndDownload(files, `${zipFilenamePrefix}.zip`, progressCallback)
    } else {
      files.forEach(({ blob, filename }) => saveAs(blob, filename))
    }
  }

  const downloadFilesFromVideoDB = async (
    fileNames: string[],
    progressCallback?: DownloadProgressCallback
  ): Promise<void> => {
    console.debug(`Downloading files from the video recovery database: ${fileNames.join(', ')}`)
    if (zipMultipleFiles.value) {
      const ZipFilename = fileNames.length > 1 ? 'Cockpit-Video-Recordings' : 'Cockpit-Video-Recording'
      await downloadFiles(videoStorage, fileNames, true, ZipFilename, progressCallback)
    } else {
      await downloadFiles(videoStorage, fileNames)
    }
  }

  const downloadTempVideo = async (hashes: string[], progressCallback?: DownloadProgressCallback): Promise<void> => {
    console.debug(`Downloading ${hashes.length} video chunks from the temporary database.`)

    for (const hash of hashes) {
      const fileNames = (await tempVideoStorage.keys()).filter((filename) => filename.includes(hash))
      const zipFilenamePrefix = `Cockpit-Unprocessed-Video-Chunks-${hash}`
      await downloadFiles(tempVideoStorage, fileNames, true, zipFilenamePrefix, progressCallback)
    }
  }

  // Used to clear the temporary video database
  const clearTemporaryVideoDB = async (): Promise<void> => {
    await tempVideoStorage.clear()
  }

  const temporaryVideoDBSize = async (): Promise<number> => {
    let totalSizeBytes = 0
    const keys = await tempVideoStorage.keys()
    for (const key of keys) {
      const blob = await tempVideoStorage.getItem(key)
      if (blob) {
        totalSizeBytes += blob.size
      }
    }
    return totalSizeBytes
  }

  const videoStorageFileSize = async (filename: string): Promise<number | undefined> => {
    const file = await videoStorage.getItem(filename)
    return file ? (file as Blob).size : undefined
  }

  // Progress tracking for video processing
  const videoProcessingDetails = ref<VideoProcessingDetails>({})
  const totalFilesToProcess = ref(0)

  const currentFileProgress = computed(() => {
    return Object.values(videoProcessingDetails.value).map((detail) => ({
      fileName: detail.filename,
      progress: detail.progress,
      message: detail.message,
    }))
  })

  const overallProgress = computed(() => {
    const entries = Object.values(videoProcessingDetails.value)
    const totalProgress = entries.reduce((acc, curr) => acc + curr.progress, 0)
    return (totalProgress / (totalFilesToProcess.value * 100)) * 100
  })

  // Remove temp chunks from the database
  const cleanupProcessedData = async (recordingHash: string): Promise<void> => {
    const keys = await tempVideoStorage.keys()
    const filteredKeys = keys.filter((key) => key.includes(recordingHash) && key.includes('_'))
    for (const key of filteredKeys) {
      await tempVideoStorage.removeItem(key)
    }
  }

  /**
   * Generate .ass telemetry overlay file for a video recording
   * @param {string} recordingHash - The hash of the recording
   * @param {string} fileName - The base filename for the video
   * @param {Date} dateStart - When the recording started
   * @param {Date} dateFinish - When the recording finished
   * @param {number} vWidth - Video width
   * @param {number} vHeight - Video height
   */
  const generateTelemetryOverlay = async (
    recordingHash: string,
    fileName: string,
    dateStart: Date,
    dateFinish: Date,
    vWidth: number,
    vHeight: number
  ): Promise<void> => {
    try {
      console.log(`Generating telemetry overlay for ${fileName}`)

      // Generate telemetry log
      const telemetryLog = await datalogger.generateLog(dateStart, dateFinish)

      if (telemetryLog !== undefined) {
        // Convert to ASS overlay format
        const assLog = datalogger.toAssOverlay(telemetryLog, vWidth, vHeight, dateStart.getTime())
        const logBlob = new Blob([assLog], { type: 'text/plain' })

        // Save the .ass file
        await videoStorage.setItem(`${fileName}.ass`, logBlob)
        console.log(`Telemetry overlay saved: ${fileName}.ass`)

        openSnackbar({
          message: `Telemetry overlay generated: ${fileName}.ass`,
          duration: 3000,
          variant: 'success',
          closeButton: false,
        })
      }
    } catch (error) {
      console.error('Failed to generate telemetry overlay:', error)
      openSnackbar({
        message: `Failed to generate telemetry file: ${error}`,
        variant: 'error',
        duration: 5000,
      })
    }
  }

  const isVideoFilename = (filename: string): boolean => {
    for (const ext of Object.values(VideoExtensionContainer)) {
      if (filename.endsWith(ext)) return true
    }
    return false
  }

  const issueSelectedIpNotAvailableWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'All available video stream IPs are being blocked',
      message: [
        `Cockpit detected that none of the IPs that are streaming video from your server are in the allowed list. This
        will lead to no video being streamed.`,
        'This can happen if you changed your network or the IP of your vehicle.',
        `To solve this problem, please open the video configuration page (Main-menu > Settings > Video) and clear
        the selected IPs. Then, select an available IP from the list.`,
      ],
      variant: 'warning',
    })
  }

  const issueNoIpSelectedWarning = (): void => {
    showDialog({
      maxWidth: 600,
      title: 'Video being routed from multiple IPs',
      message: [
        `Cockpit detected that the video streams are being routed from multiple IPs. This often leads to video
        stuttering, especially if one of the IPs is from a non-wired connection.`,
        `To prevent issues and achieve an optimal streaming experience, please open the video configuration page
        (Main-menu > Settings > Video) and select the IP address that should be used for the video streaming.`,
      ],
      variant: 'warning',
    })
  }

  if (enableAutoIceIpFetch.value) {
    // Routine to make sure the user has chosen the allowed ICE candidate IPs, so the stream works as expected
    let noIpSelectedWarningIssued = false
    let selectedIpNotAvailableWarningIssued = false
    const iceIpCheckInterval = setInterval(async (): Promise<void> => {
      // Pass if there are no available IPs yet
      if (availableIceIps.value.isEmpty()) return

      if (!allowedIceIps.value.isEmpty()) {
        // If the user has selected IPs, but none of them are available, warn about it, since no video will be streamed.
        // Otherwise, if IPs are selected and available, clear the check routine.
        const availableSelectedIps = availableIceIps.value.filter((ip) => allowedIceIps.value.includes(ip))
        if (availableSelectedIps.isEmpty() && !selectedIpNotAvailableWarningIssued) {
          console.warn('Selected ICE IPs are not available. Warning user.')
          issueSelectedIpNotAvailableWarning()
          selectedIpNotAvailableWarningIssued = true
        }
        clearInterval(iceIpCheckInterval)
      }

      // If the user has not selected any IPs and there's more than one IP candidate available, try getting information
      // about them from BlueOS. If that fails, send a warning an clear the check routine.
      if (allowedIceIps.value.isEmpty() && availableIceIps.value.length >= 1) {
        // Try to select the IP automatically if it's a wired connection (based on BlueOS data).
        let currentlyOnWirelessConnection = false
        try {
          const ipsInfo = await getIpsInformationFromVehicle(globalAddress)
          const newAllowedIps: string[] = []
          ipsInfo.forEach((ipInfo) => {
            const isIceIp = availableIceIps.value.includes(ipInfo.ipv4Address)
            const alreadyAllowedIp = [...allowedIceIps.value, ...newAllowedIps].includes(ipInfo.ipv4Address)
            const theteredInterfaceTypes = ['WIRED', 'USB']
            if (globalAddress === ipInfo.ipv4Address && !theteredInterfaceTypes.includes(ipInfo.interfaceType)) {
              currentlyOnWirelessConnection = true
            }
            if (!theteredInterfaceTypes.includes(ipInfo.interfaceType) || alreadyAllowedIp || !isIceIp) return
            console.info(`Adding the wired address '${ipInfo.ipv4Address}' to the list of allowed ICE IPs.`)
            newAllowedIps.push(ipInfo.ipv4Address)
          })
          allowedIceIps.value = newAllowedIps
          if (!allowedIceIps.value.isEmpty()) {
            showDialog({
              message: 'Preferred video stream routes fetched from BlueOS.',
              variant: 'success',
              timer: 5000,
            })
          }
        } catch (error) {
          console.error('Failed to get IP information from the vehicle:', error)
        }

        // If the system was still not able to populate the allowed IPs list yet, warn the user.
        // Otherwise, clear the check routine.
        if (allowedIceIps.value.isEmpty() && !noIpSelectedWarningIssued && !currentlyOnWirelessConnection) {
          console.info('No ICE IPs selected for the allowed list. Warning user.')
          issueNoIpSelectedWarning()
          noIpSelectedWarningIssued = true
        }
        clearInterval(iceIpCheckInterval)
      }
    }, 5000)
  }

  // Video recording actions
  const startRecordingAllStreams = (): void => {
    const streamsThatStarted: string[] = []
    isRecordingAllStreams.value = true

    namesAvailableStreams.value.forEach((streamName) => {
      if (!isRecording(streamName)) {
        startRecording(streamName)
        streamsThatStarted.push(streamName)
      }
    })

    if (streamsThatStarted.isEmpty()) {
      alertStore.pushAlert(new Alert(AlertLevel.Error, 'No streams available to be recorded.'))
      return
    }
    const msg = `Started recording all ${streamsThatStarted.length} streams: ${streamsThatStarted.join(', ')}.`
    alertStore.pushAlert(new Alert(AlertLevel.Success, msg))
  }

  const stopRecordingAllStreams = (): void => {
    const streamsThatStopped: string[] = []
    isRecordingAllStreams.value = false

    namesAvailableStreams.value.forEach((streamName) => {
      if (isRecording(streamName)) {
        stopRecording(streamName)
        streamsThatStopped.push(streamName)
      }
    })

    if (streamsThatStopped.isEmpty()) {
      alertStore.pushAlert(new Alert(AlertLevel.Error, 'No streams were being recorded.'))
      return
    }
    const msg = `Stopped recording all ${streamsThatStopped.length} streams: ${streamsThatStopped.join(', ')}.`
    alertStore.pushAlert(new Alert(AlertLevel.Success, msg))
  }

  const toggleRecordingAllStreams = (): void => {
    if (isRecordingAllStreams.value) {
      stopRecordingAllStreams()
    } else {
      startRecordingAllStreams()
    }
  }

  const renameStreamInternalNameById = (streamID: string, newInternalName: string): void => {
    // Check if the new internal name is already taken
    const isNameTaken = streamsCorrespondency.value.some((stream) => stream.name === newInternalName)
    if (isNameTaken) {
      throw new Error(`The internal name '${newInternalName}' is already taken.`)
    }

    const streamCorr = streamsCorrespondency.value.find((stream) => stream.externalId === streamID)

    if (streamCorr) {
      const oldInternalName = streamCorr.name
      streamCorr.name = newInternalName

      const streamData = activeStreams.value[oldInternalName]
      if (streamData) {
        activeStreams.value = {
          ...activeStreams.value,
          [newInternalName]: streamData,
        }
        delete activeStreams.value[oldInternalName]
      }
      lastRenamedStreamName.value = newInternalName
    } else {
      throw new Error(`Stream with ID '${streamID}' not found.`)
    }
  }

  const deleteStreamCorrespondency = (externalId: string): void => {
    const streamIndex = streamsCorrespondency.value.findIndex((stream) => stream.externalId === externalId)

    if (streamIndex !== -1) {
      const stream = streamsCorrespondency.value[streamIndex]

      // Add to ignored list
      if (!ignoredStreamExternalIds.value.includes(externalId)) {
        ignoredStreamExternalIds.value = [...ignoredStreamExternalIds.value, externalId]
      }

      // Remove from correspondency list
      streamsCorrespondency.value.splice(streamIndex, 1)

      // Clean up all resources for the stream
      if (activeStreams.value[externalId]) {
        const externalStreamData = activeStreams.value[externalId]

        // Stop recording if it's active
        if (externalStreamData?.mediaRecorder && externalStreamData.mediaRecorder.state === 'recording') {
          externalStreamData.mediaRecorder.stop()
        }

        // Stop all tracks in the media stream
        if (externalStreamData?.mediaStream) {
          externalStreamData.mediaStream.getTracks().forEach((track) => {
            track.stop()
            console.log(`Stopped track: ${track.kind} for external stream '${externalId}'`)
          })
        }

        // Close WebRTC connection
        if (externalStreamData?.webRtcManager) {
          try {
            externalStreamData.webRtcManager.close(`External stream '${externalId}' was ignored by user`)
            console.log(`Stopped WebRTC manager for external stream '${externalId}'`)
          } catch (error) {
            console.warn(`Error stopping WebRTC manager for external stream '${externalId}':`, error)
          }
        }

        delete activeStreams.value[externalId]
        console.log(`Cleaned up all resources for external stream '${externalId}'`)
      }

      openSnackbar({ variant: 'success', message: `Stream '${stream.name}' deleted and added to ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not found.` })
    }
  }

  const restoreIgnoredStream = (externalId: string): void => {
    const ignoredIndex = ignoredStreamExternalIds.value.indexOf(externalId)

    if (ignoredIndex !== -1) {
      // Remove from ignored list
      ignoredStreamExternalIds.value.splice(ignoredIndex, 1)

      if (namesAvailableStreams.value.includes(externalId)) {
        // Trigger re-initialization to add it back to correspondency if it's still available
        initializeStreamsCorrespondency()
      } else {
        openSnackbar({ variant: 'warning', message: `Stream '${externalId}' not available anymore.` })
      }

      openSnackbar({ variant: 'success', message: `Stream '${externalId}' restored from ignored list.` })
    } else {
      openSnackbar({ variant: 'warning', message: `Stream with external ID '${externalId}' not on ignored list.` })
    }
  }

  registerActionCallback(
    availableCockpitActions.start_recording_all_streams,
    useThrottleFn(startRecordingAllStreams, 3000)
  )
  registerActionCallback(
    availableCockpitActions.stop_recording_all_streams,
    useThrottleFn(stopRecordingAllStreams, 3000)
  )
  registerActionCallback(
    availableCockpitActions.toggle_recording_all_streams,
    useThrottleFn(toggleRecordingAllStreams, 3000)
  )

  return {
    enableLiveProcessing,
    saveBackupRawChunks,
    availableIceIps,
    allowedIceIps,
    enableAutoIceIpFetch,
    allowedIceProtocols,
    jitterBufferTarget,
    zipMultipleFiles,
    namesAvailableStreams,
    videoStorage,
    tempVideoStorage,
    streamsCorrespondency,
    ignoredStreamExternalIds,
    namessAvailableAbstractedStreams,
    externalStreamId,
    discardProcessedFilesFromVideoDB,
    discardUnprocessedFilesFromVideoDB,
    downloadFilesFromVideoDB,
    clearTemporaryVideoDB,
    temporaryVideoDBSize,
    videoStorageFileSize,
    getMediaStream,
    getStreamData,
    isRecording,
    stopRecording,
    startRecording,
    downloadTempVideo,
    currentFileProgress,
    overallProgress,
    isVideoFilename,
    getVideoThumbnail,
    videoThumbnailFilename,
    getRecordingMetadata,
    generateTelemetryOverlay,
    activeStreams,
    renameStreamInternalNameById,
    lastRenamedStreamName,
    deleteStreamCorrespondency,
    restoreIgnoredStream,
  }
})
