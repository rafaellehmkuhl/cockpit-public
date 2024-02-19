<template>
  <BaseConfigurationView>
    <template #title>Video configuration</template>
    <template #content>
      <div
        class="flex flex-col items-center px-5 py-3 m-5 font-medium text-center border rounded-md text-grey-darken-1 bg-grey-lighten-5 w-[40%]"
      >
        <p class="font-bold">
          This is the video configuration page. Here you can configure the behavior of your video streams and download
          or discard saved videos and subtitle logs.
        </p>
        <br />
        <p>
          First of all, it's important that you select the IP (or IPs) that should be allowed to route video streams.
          Those will usually be the ones for your wired connections. This configuration allows Cockpit to block other
          available IPs, like those from WiFi and Hotspot connections, preventing lag and stuttering in your video
          streams.
        </p>
      </div>

      <div class="flex w-[30rem] flex-wrap">
        <v-combobox
          v-model="allowedIceIps"
          multiple
          :items="availableIceIps"
          label="Allowed WebRTC remote IP Addresses"
          class="w-full my-3 uri-input"
          variant="outlined"
          chips
          clearable
          hint="IP Addresses of the Vehicle allowed to be used for the WebRTC ICE Routing. Usually, the IP of the tether/cabled interface. Blank means any route. E.g: 192.168.2.2"
        />
      </div>

      <div v-if="namesAvailableVideosAndLogs.isEmpty()" class="max-w-[50%] bg-slate-100 rounded-md p-6 border">
        <p class="mb-4 text-2xl font-semibold text-center text-slate-500">No videos available.</p>
        <p class="text-center text-slate-400">
          Use the MiniVideoRecorder widget to record some videos and them come back here to download or discard those.
        </p>
      </div>
      <fwb-table v-else hoverable>
        <fwb-table-head>
          <fwb-table-head-cell />
          <fwb-table-head-cell>Filename</fwb-table-head-cell>
          <fwb-table-head-cell>
            <span
              v-if="!selectedFilesNames.isEmpty()"
              class="text-base rounded-md cursor-pointer hover:text-slate-500/50 mdi mdi-trash-can"
              @click="discardAndUpdateDB(selectedFilesNames)"
            />
          </fwb-table-head-cell>
          <fwb-table-head-cell>
            <span
              v-if="!selectedFilesNames.isEmpty()"
              class="text-base rounded-md cursor-pointer hover:text-slate-500/50 mdi mdi-download"
              @click="downloadAndUpdateDB(selectedFilesNames)"
            />
          </fwb-table-head-cell>
        </fwb-table-head>
        <fwb-table-body>
          <fwb-table-row v-for="filename in namesAvailableVideosAndLogs" :key="filename">
            <fwb-table-cell>
              <input
                v-model="selectedFilesNames"
                :value="filename"
                type="checkbox"
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </fwb-table-cell>
            <fwb-table-cell>{{ filename }}</fwb-table-cell>
            <fwb-table-cell>
              <span
                v-if="selectedFilesNames.isEmpty()"
                class="rounded-md cursor-pointer hover:text-slate-500/50 mdi mdi-trash-can"
                @click="discardAndUpdateDB([filename])"
              />
            </fwb-table-cell>
            <fwb-table-cell>
              <span
                v-if="selectedFilesNames.isEmpty()"
                class="rounded-md cursor-pointer hover:text-slate-500/50 mdi mdi-download"
                @click="downloadAndUpdateDB([filename])"
              />
            </fwb-table-cell>
          </fwb-table-row>
        </fwb-table-body>
      </fwb-table>
      <span
        v-if="temporaryDbSize > 0"
        v-tooltip.bottom="'Remove video files used during the recording. This will not affect already saved videos.'"
        class="p-4 m-4 transition-all rounded-md cursor-pointer bg-slate-600 text-slate-50 hover:bg-slate-500/80"
        @click="clearTemporaryVideoFiles()"
      >
        Clear temporary video storage
      </span>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { FwbTable, FwbTableBody, FwbTableCell, FwbTableHead, FwbTableHeadCell, FwbTableRow } from 'flowbite-vue'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { onMounted } from 'vue'

import { useVideoStore } from '@/stores/video'

import BaseConfigurationView from './BaseConfigurationView.vue'

const videoStore = useVideoStore()
const { allowedIceIps, availableIceIps } = storeToRefs(videoStore)

// List available videos and telemetry logs to be downloaded
const namesAvailableVideosAndLogs = ref<string[]>([])
const temporaryDbSize = ref(0)
const selectedFilesNames = ref<string[]>([])

onMounted(async () => {
  await fetchVideoAndLogsData()
  await fetchTemporaryDbSize()
})

// Fetch available videos and telemetry logs from the storage
const fetchVideoAndLogsData = async (): Promise<void> => {
  const availableData: string[] = []
  await videoStore.videoStoringDB.iterate((_, fileName) => {
    availableData.push(fileName)
  })
  namesAvailableVideosAndLogs.value = availableData
}

// Fetch temporary video data from the storage
const fetchTemporaryDbSize = async (): Promise<void> => {
  const size = await videoStore.tempVideoChunksDB.length()
  temporaryDbSize.value = size
}

const discardAndUpdateDB = async (filenames: string[]): Promise<void> => {
  await videoStore.discardFilesFromVideoDB(filenames)
  await fetchVideoAndLogsData()
  selectedFilesNames.value = []
}

const downloadAndUpdateDB = async (filenames: string[]): Promise<void> => {
  await videoStore.downloadFilesFromVideoDB(filenames)
  await fetchVideoAndLogsData()
  selectedFilesNames.value = []
}

const clearTemporaryVideoFiles = async (): Promise<void> => {
  videoStore.clearTemporaryVideoDB()
  await fetchTemporaryDbSize()
}
</script>