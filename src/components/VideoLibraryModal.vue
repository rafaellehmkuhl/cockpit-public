<template>
  <v-dialog v-model="isVisible" class="dialog">
    <div class="flex">
      <div class="video-modal" :style="interfaceStore.globalGlassMenuStyles">
        <div class="modal-content">
          <!-- Left Vertical Menu -->
          <div class="flex flex-col justify-between h-full px-5 py-3 align-center">
            <div class="flex flex-col justify-between pt-2 align-center gap-y-6">
              <button
                v-for="button in menuButtons.filter((btn: any) => btn.show !== false)"
                :key="button.name"
                :disabled="button.disabled"
                class="flex flex-col justify-center align-center"
                @click="currentTab = button.name.toLowerCase()"
              >
                <v-tooltip v-if="button.tooltip !== ''" open-delay="600" activator="parent" location="top">
                  {{ button.tooltip }}
                </v-tooltip>
                <div
                  class="mb-1 text-xl rounded-full"
                  :class="[
                    button.disabled ? 'frosted-button-disabled' : 'frosted-button',
                    currentTab === button.name.toLowerCase() ? 'w-[48px] h-[48px]' : 'w-[36px] h-[36px]',
                  ]"
                >
                  <v-icon
                    :size="currentTab === button.name.toLowerCase() ? 32 : 20"
                    :class="{ 'ml-1': button.name.toLowerCase() === 'videos' }"
                  >
                    {{ button.icon }}
                  </v-icon>
                </div>
                <div class="text-xs" :class="{ 'text-white/30': !button.disabled }">
                  {{ button.name }}
                </div>
              </button>
            </div>
            <div>
              <button class="flex flex-col justify-center py-2 mt-4 align-center" @click="closeModal">
                <div
                  class="frosted-button flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-1"
                >
                  <v-icon class="text-[18px]">mdi-close</v-icon>
                </div>
                <div class="text-sm">Close</div>
              </button>
            </div>
          </div>
          <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
          <!-- Right Content -->
          <template v-if="currentTab === 'snapshots'">
            <div v-if="availablePictures.length > 0" class="flex flex-col justify-start py-6 px-4 flex-1 h-full">
              <div
                class="grid gap-4 overflow-y-auto w-full h-full px-2 content-start"
                style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))"
              >
                <div
                  v-for="picture in availablePictures"
                  :key="picture.filename"
                  class="relative"
                  @click="onPictureClick(picture.filename)"
                >
                  <div
                    :class="[
                      'w-[178px] aspect-video overflow-hidden',
                      'border-4 border-white rounded-md cursor-pointer transition duration-75 ease-in',
                      selectedPicSet.has(picture.filename) ? 'border-opacity-40' : 'border-opacity-10',
                    ]"
                  >
                    <img
                      v-if="picture.thumbnail"
                      :src="(picture as any).thumbUrl"
                      class="w-full h-full object-cover"
                      alt="Picture thumbnail"
                    />
                    <div reactive class="fullscreen-button" @click="openPicInFullScreen(picture)">
                      <v-icon size="40" class="text-white"> mdi-fullscreen </v-icon>
                    </div>
                    <div reactive class="delete-button" @click="handleDeletePictures(picture)">
                      <v-icon size="16" class="text-white"> mdi-delete </v-icon>
                    </div>
                    <div reactive class="download-button" @click="downloadPictures(picture.filename)">
                      <v-icon size="16" class="text-white"> mdi-download </v-icon>
                    </div>
                  </div>
                  <div class="flex justify-center mt-1 text-xs text-white/80 truncate">
                    <v-tooltip open-delay="300" activator="parent" location="top">
                      {{ picture.filename }}
                    </v-tooltip>
                    {{ picture.filename }}
                  </div>
                </div>
              </div>
              <div
                v-if="availablePictures.length > 1"
                class="flex flex-row align-center justify-between h-[40px] w-full mb-[-19px] border-t-[1px] border-t-[#ffffff06]"
              >
                <div>
                  <v-btn variant="text" size="small" class="mt-[5px]" @click="toggleSelectionMode">
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                    </v-tooltip>
                    {{ isMultipleSelectionMode ? 'Single selection' : 'Multi selection' }}
                  </v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="
                      selectedPicSet.size === availablePictures.length ? deselectAllPictures() : selectAllPictures()
                    "
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ selectedPicSet.size === availablePictures.length ? 'none' : 'all files' }}
                    </v-tooltip>
                    {{ selectedPicSet.size === availablePictures.length ? 'None' : 'All' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    :disabled="selectedPictures.length === 0"
                    @click="downloadPictures()"
                  >
                    Download
                  </v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px] ml-2"
                    :disabled="selectedPictures.length === 0"
                    @click="handleDeletePictures()"
                  >
                    Delete
                  </v-btn>
                </div>
              </div>
            </div>
            <div v-else class="flex justify-center items-center w-full h-full text-xl text-center">
              {{ loadingData ? 'Loading' : 'No pictures found' }}
            </div>
          </template>
          <template v-if="currentTab === 'videos'">
            <!-- Videos Tab with Sub-tabs -->
            <div class="flex flex-col h-full w-full">
              <!-- Sub-tabs Navigation -->
              <div class="px-4 pt-4 pb-2">
                <v-tabs v-model="currentVideoSubTab" color="white" fixed-tabs class="video-sub-tabs">
                  <v-tab
                    v-for="tab in videoSubTabs"
                    :key="tab.name"
                    :value="tab.name"
                    :disabled="tab.disabled"
                    class="text-white"
                  >
                    <v-tooltip v-if="tab.tooltip" open-delay="600" activator="parent" location="top">
                      {{ tab.tooltip }}
                    </v-tooltip>
                    <v-icon class="mr-2" size="18">{{ tab.icon }}</v-icon>
                    {{ tab.label }}
                  </v-tab>
                </v-tabs>
              </div>

              <!-- Sub-tab Content -->
              <div class="flex-1 overflow-hidden">
                <!-- Final Videos Tab (Electron only) -->
                <template v-if="currentVideoSubTab === 'final'">
                  <div class="flex flex-col h-full">
                    <div class="mx-5 pt-4">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Final Videos</h3>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-white/70">Processed videos with telemetry overlay</span>
                        </div>
                      </div>
                    </div>

                    <!-- Scrollable Videos List -->
                    <div v-if="availableVideos.length > 0" class="flex-1 overflow-y-auto px-4 py-2">
                      <div class="space-y-3">
                        <div
                          v-for="video in availableVideos"
                          :id="`video-library-thumbnail-${video.fileName}`"
                          :key="video.fileName"
                          class="flex items-center p-4 rounded-lg transition-colors cursor-pointer"
                          :class="getVideoCardClasses(video)"
                        >
                          <!-- Thumbnail -->
                          <div class="w-24 h-16 rounded-md overflow-hidden bg-black flex-shrink-0">
                            <img
                              v-if="videoThumbnailURLs[video.fileName]"
                              :src="videoThumbnailURLs[video.fileName] || undefined"
                              class="w-full h-full object-cover"
                            />
                            <div v-else class="w-full h-full flex justify-center items-center">
                              <v-icon size="32" class="text-white/30">mdi-video</v-icon>
                            </div>
                          </div>

                          <!-- Video Info -->
                          <div class="flex-1 ml-4">
                            <div class="font-medium text-white">
                              {{ parseDateFromTitle(video.fileName) || 'Cockpit video' }}
                            </div>
                            <div class="text-sm text-white/70 mt-1">
                              {{ video.fileName }}
                            </div>
                            <div class="flex items-center mt-1">
                              <v-icon size="10" :class="video.isProcessed ? 'text-green-500' : 'text-red-500'"
                                >mdi-circle</v-icon
                              >
                              <span class="text-xs text-white/60 ml-1">
                                {{ video.isProcessed ? 'Processed' : 'Needs processing' }}
                              </span>
                              <!-- WebM indicator -->
                              <div
                                v-if="video.fileName.endsWith('.webm')"
                                class="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full"
                              >
                                WebM
                              </div>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="flex items-center gap-2 ml-4">
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="showOnScreenProgress || isPreparingDownload"
                              @click.stop="handleDeleteVideos([video])"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Delete video
                              </v-tooltip>
                              <v-icon>mdi-delete</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Fixed Bottom Controls -->
                    <div
                      v-if="availableVideos.length > 0"
                      class="flex justify-between items-center px-4 py-3 border-t border-white/10"
                    >
                      <div class="flex items-center gap-2">
                        <v-btn variant="text" size="small" @click="toggleSelectionMode">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                          </v-tooltip>
                          {{ isMultipleSelectionMode ? 'Single' : 'Multi' }}
                        </v-btn>
                        <v-btn
                          variant="text"
                          size="small"
                          @click="
                            selectedVideos.length === availableVideos.length ? deselectAllVideos() : selectAllVideos()
                          "
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Select {{ selectedVideos.length === availableVideos.length ? 'none' : 'all files' }}
                          </v-tooltip>
                          {{ selectedVideos.length === availableVideos.length ? 'None' : 'All' }}
                        </v-btn>
                      </div>

                      <!-- Action Buttons -->
                      <div class="flex items-center gap-2">
                        <!-- Selection Count Text -->
                        <span v-if="selectedVideos.length > 1" class="text-sm text-white/70">
                          {{ selectedVideos.length }} videos selected
                        </span>

                        <!-- Delete Selected Button (only visible when multiple videos selected) -->
                        <v-btn
                          v-if="selectedVideos.length > 1"
                          icon
                          variant="outlined"
                          size="small"
                          :disabled="showOnScreenProgress || isPreparingDownload"
                          @click="handleDeleteVideos(selectedVideos)"
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Delete {{ selectedVideos.length }} selected videos
                          </v-tooltip>
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>

                        <!-- Open Folder Button (always visible) -->
                        <v-btn icon variant="outlined" size="small" @click="openVideoFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open videos folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>

                    <!-- No Videos Message with Open Folder Button -->
                    <div v-else class="flex flex-col h-full">
                      <!-- Empty State Message -->
                      <div class="flex justify-center items-center flex-1 text-xl text-center">
                        {{ loadingData ? 'Loading' : 'No videos on storage' }}
                      </div>

                      <!-- Fixed Bottom Controls (always visible) -->
                      <div class="flex justify-end items-center px-4 py-3 border-t border-white/10">
                        <v-btn icon variant="outlined" size="small" @click="openVideoFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open videos folder
                          </v-tooltip>
                          <v-icon>mdi-folder-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Temporary Tab -->
                <template v-if="currentVideoSubTab === 'temporary'">
                  <div v-if="!isElectron()" class="flex flex-col h-full">
                    <!-- Fixed Header with Expandable Instructions -->
                    <div class="px-4 pt-6 pb-3">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Raw Video Chunks</h3>
                        <div
                          class="flex items-center gap-2 cursor-pointer"
                          @click="isInstructionsExpanded = !isInstructionsExpanded"
                        >
                          <span class="text-sm text-white/70">Browser Version Instructions</span>
                          <v-icon
                            class="text-white/70 transition-transform duration-200"
                            :class="{ 'rotate-180': isInstructionsExpanded }"
                            size="20"
                          >
                            mdi-chevron-down
                          </v-icon>
                        </div>
                      </div>

                      <!-- Expandable Instructions Content -->
                      <v-expand-transition>
                        <div
                          v-show="isInstructionsExpanded"
                          class="mb-4 p-4 border border-white/20 rounded-lg bg-white/5"
                        >
                          <div class="flex items-start gap-3">
                            <v-icon class="text-white/70 mt-1">mdi-information</v-icon>
                            <div class="text-white/80 text-sm space-y-1">
                              <p>
                                These are raw video chunks that need to be processed. The processing can be done
                                exclusively in the standalone version of Cockpit. The browser version can only record
                                the video chunks.
                              </p>
                              <div>
                                <p class="font-medium mb-2">To process your videos:</p>
                                <ol class="space-y-0">
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">1.</span>
                                    <span>Download your video chunks using the download buttons</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">2.</span>
                                    <span>Open the standalone version of Cockpit (desktop app)</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">3.</span>
                                    <span>Go to the "Processing" tab in the video library</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">4.</span>
                                    <span>Select and process your downloaded ZIP files</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">5.</span>
                                    <span>Once sure the video is processed, delete the raw video chunks from here</span>
                                  </li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        </div>
                      </v-expand-transition>
                    </div>

                    <!-- Scrollable Content -->
                    <div v-if="chunkGroups.length > 0" class="flex-1 overflow-y-auto px-4">
                      <div
                        v-for="group in chunkGroups"
                        :key="group.hash"
                        class="mb-2 px-4 py-2 border border-white/20 rounded-lg bg-white/5"
                      >
                        <div class="flex justify-between items-start mb-2">
                          <div class="flex-1">
                            <div class="font-medium text-white">{{ group.fileName || group.hash }}</div>
                            <div class="text-sm text-white/70 mt-1">
                              {{ formatDate(group.firstChunkDate) }}
                            </div>
                            <div class="text-sm text-white/50 mt-1">
                              {{ group.chunkCount }} chunks • ~{{ group.estimatedDuration }}s duration •
                              {{ formatFileSize(group.totalSize) }}
                            </div>
                          </div>
                          <div class="flex gap-2 mt-5">
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isProcessingChunks"
                              @click="downloadChunkGroup(group)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Download chunk group
                              </v-tooltip>
                              <v-icon>mdi-download</v-icon>
                            </v-btn>
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isProcessingChunks"
                              @click="deleteChunkGroup(group)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Delete chunk group
                              </v-tooltip>
                              <v-icon>mdi-delete</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else class="flex flex-col justify-center items-center flex-1 text-center px-4">
                      <div class="max-w-md mx-auto">
                        <v-icon size="60" class="text-white/30 mb-4">mdi-folder-multiple-outline</v-icon>
                        <h4 class="text-lg font-medium text-white mb-2">No Video Chunks Found</h4>
                        <p class="text-white/70 text-sm">
                          {{
                            loadingData
                              ? 'Loading...'
                              : 'Start recording videos to create chunks that can be downloaded.'
                          }}
                        </p>
                      </div>
                    </div>

                    <!-- Fixed Bottom Controls (always visible) -->
                    <div class="flex justify-end items-center gap-4 px-4 py-3 border-t border-white/10">
                      <span class="text-sm text-white/70">Total: {{ formatFileSize(totalChunkSize) }}</span>
                      <v-btn
                        icon
                        variant="outlined"
                        size="small"
                        :disabled="isProcessingChunks"
                        @click="deleteAllChunks"
                      >
                        <v-tooltip open-delay="500" activator="parent" location="bottom">
                          Delete all temporary chunks
                        </v-tooltip>
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </div>
                  </div>

                  <!-- Electron Version -->
                  <div v-else class="flex flex-col h-full">
                    <div v-if="chunkGroups.length > 0" class="flex flex-col h-full">
                      <!-- Fixed Header -->
                      <div class="mx-5 pt-4">
                        <div class="flex justify-between items-center mb-4">
                          <h3 class="text-lg font-medium">Raw Video Chunks</h3>
                          <div class="flex items-center gap-4">
                            <span class="text-sm text-white/70">Backup raw data</span>
                          </div>
                        </div>
                      </div>

                      <!-- Scrollable Content -->
                      <div class="flex-1 overflow-y-auto px-4">
                        <div
                          v-for="group in chunkGroups"
                          :key="group.hash"
                          class="mb-2 px-4 pt-3 pb-1 border border-white/20 rounded-lg bg-white/5"
                        >
                          <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                              <div class="font-medium text-white">{{ group.fileName || group.hash }}</div>
                              <div class="text-sm text-white/70 mt-1">
                                {{ formatDate(group.firstChunkDate) }}
                              </div>
                              <div class="text-sm text-white/50 mt-1">
                                {{ group.chunkCount }} chunks • ~{{ group.estimatedDuration }}s duration •
                                {{ formatFileSize(group.totalSize) }}
                              </div>
                            </div>
                            <div class="flex gap-2 mt-4">
                              <v-btn
                                icon
                                variant="outlined"
                                size="small"
                                :disabled="isProcessingChunks"
                                @click="deleteChunkGroup(group)"
                              >
                                <v-tooltip open-delay="500" activator="parent" location="bottom">
                                  Delete chunk group
                                </v-tooltip>
                                <v-icon>mdi-delete</v-icon>
                              </v-btn>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Fixed Bottom Controls -->
                      <div class="flex justify-end items-center gap-4 px-4 py-3 border-t border-white/10">
                        <span class="text-sm text-white/70">Total: {{ formatFileSize(totalChunkSize) }}</span>
                        <v-btn
                          icon
                          variant="outlined"
                          size="small"
                          :disabled="isProcessingChunks"
                          @click="deleteAllChunks"
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Delete all temporary chunks
                          </v-tooltip>
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>
                        <v-btn icon variant="outlined" size="small" @click="openTempChunksFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open raw chunks folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else class="flex flex-col h-full">
                      <!-- Empty State Message -->
                      <div class="flex justify-center items-center flex-1 text-xl text-center">
                        {{ loadingData ? 'Loading' : 'No temporary chunks found' }}
                      </div>

                      <!-- Fixed Bottom Controls (always visible) -->
                      <div class="flex justify-end items-center px-4 py-3 border-t border-white/10">
                        <v-btn icon variant="outlined" size="small" @click="openTempChunksFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open temporary chunks folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Processing Tab (Electron only) -->
                <template v-if="currentVideoSubTab === 'processing'">
                  <div class="flex flex-col h-full">
                    <!-- Processing Container (Top) -->
                    <div class="flex-1 overflow-y-auto px-4 py-6">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Process ZIP Files</h3>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-white/70">Process raw chunks from Cockpit Lite (web version)</span>
                        </div>
                      </div>

                      <!-- Processing Status -->
                      <div v-if="isProcessingZip" class="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <div class="flex items-center gap-3 mb-3">
                          <v-progress-circular indeterminate color="blue" size="24" width="2" />
                          <span class="text-blue-200 font-medium">Processing ZIP file...</span>
                        </div>
                        <div class="text-blue-100 text-sm">
                          {{ zipProcessingMessage }}
                        </div>
                        <v-progress-linear
                          :model-value="zipProcessingProgress"
                          color="blue"
                          height="8"
                          rounded
                          class="mt-3"
                        />
                        <div class="text-blue-200 text-xs mt-2">{{ zipProcessingProgress }}%</div>
                      </div>

                      <!-- Processing Complete Status -->
                      <div
                        v-if="zipProcessingComplete"
                        class="bg-green-900/30 border border-green-500/30 rounded-lg p-4 mb-4"
                      >
                        <div class="flex items-center gap-3 mb-3">
                          <v-icon color="green" size="24">mdi-check-circle</v-icon>
                          <span class="text-green-200 font-medium">Processing Complete!</span>
                        </div>
                        <div class="text-green-100 text-sm">
                          The ZIP file has been successfully processed. The video is now available in the Videos tab.
                        </div>
                        <div class="mt-4 flex gap-2">
                          <v-btn variant="outlined" size="small" @click="processAnotherZip">
                            <v-icon class="mr-2">mdi-plus</v-icon>
                            Process Another ZIP File
                          </v-btn>
                          <v-btn variant="outlined" size="small" @click="goToVideosTab">
                            <v-icon class="mr-2">mdi-video</v-icon>
                            View Videos
                          </v-btn>
                        </div>
                      </div>

                      <!-- ZIP File Selection -->
                      <div
                        v-if="!isProcessingZip && !selectedZipFile && !zipProcessingComplete"
                        class="bg-slate-800/50 border border-slate-600/30 rounded-lg p-4 mb-4"
                      >
                        <div class="text-center">
                          <v-icon size="48" class="text-slate-400 mb-3">mdi-zip-box</v-icon>
                          <h4 class="text-lg font-medium text-white mb-2">Select ZIP File to Process</h4>
                          <p class="text-white/70 text-sm mb-4">
                            Choose a ZIP file containing raw video chunks downloaded from the browser version.
                          </p>
                          <v-btn variant="outlined" @click="selectZipFile">
                            <v-icon class="mr-2">mdi-folder-open</v-icon>
                            Select ZIP File
                          </v-btn>
                        </div>
                      </div>

                      <!-- Selected ZIP File Info -->
                      <div
                        v-if="selectedZipFile && !zipProcessingComplete"
                        class="bg-slate-700/50 border border-slate-500/30 rounded-lg p-4 mb-4"
                      >
                        <div class="flex justify-between items-center">
                          <div>
                            <h5 class="text-white font-medium">{{ selectedZipFile.name }}</h5>
                            <p class="text-white/70 text-sm">{{ formatFileSize(selectedZipFile.size) }}</p>
                          </div>
                          <v-btn variant="outlined" size="small" @click="clearSelectedZip">
                            <v-icon size="16" class="mr-1">mdi-close</v-icon>
                            Clear
                          </v-btn>
                        </div>
                      </div>

                      <!-- Process Button -->
                      <div v-if="!zipProcessingComplete" class="mt-4 text-center">
                        <v-btn
                          v-if="selectedZipFile && !isProcessingZip"
                          variant="outlined"
                          size="large"
                          @click="processZipFile"
                        >
                          <v-icon class="mr-2">mdi-play-circle</v-icon>
                          Process ZIP
                        </v-btn>
                      </div>
                    </div>

                    <!-- Processing Instructions (Bottom) -->
                    <div class="px-4 py-3 border-t mb-4 border-white/10">
                      <div class="flex items-start gap-3">
                        <v-icon class="mt-1 text-white/70">mdi-information</v-icon>
                        <div class="flex flex-col w-full">
                          <h4 class="text-white font-medium mb-3">Processing Instructions</h4>
                          <ol class="text-white/80 text-sm space-y-2">
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">1.</span>
                              <span>Download raw video chunks from the browser version's "Temporary" tab</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">2.</span>
                              <span>Select the ZIP file containing the chunks</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">3.</span>
                              <span>Click "Process ZIP" to convert chunks to MP4 video</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">4.</span>
                              <span>The processed video will appear in the "Videos" tab</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-dialog>
  <InteractionDialog
    :show-dialog="showProcessingInteractionDialog"
    :title="interactionDialogTitle"
    :actions="interactionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div class="flex flex-col mb-2 text-center align-end">
        Processing multiple videos may take a while, depending on the number of videos and their sizes. Cockpit will be
        usable during the process, but the performance may be affected and recording of new videos is disabled.
      </div>
    </template>
  </InteractionDialog>
  <InteractionDialog
    :show-dialog="showProgressInteractionDialog"
    :title="progressInteractionDialogTitle"
    :actions="progressInteractionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div v-if="!errorProcessingVideos" class="flex flex-col -mt-2 text-center align-center">
        <div class="flex flex-col justify-between h-[140px] w-full pb-3">
          <div v-if="currentVideoProcessingProgress.length > 0" class="flex flex-col justify-start">
            <div class="mb-3 text-sm text-center">
              File {{ currentVideoProcessingProgress.length }} of {{ numberOfFilesToProcess }}:
              {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].message }}
            </div>
            <div class="flex flex-row justify-between w-full mb-2 align-center">
              <div class="text-sm font-bold w-[450px] text-nowrap text-start text-ellipsis overflow-x-hidden">
                {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName }}
              </div>
              <div class="text-sm text-end">
                <v-progress-circular width="1" size="10" indeterminate class="mr-1 mb-[2px]"></v-progress-circular>
                {{ `${currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress}%` }}
              </div>
            </div>
            <v-progress-linear
              :model-value="currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress"
              color="white"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
          <div>
            <div class="flex flex-row justify-between w-full mb-2">
              <div class="text-sm font-bold text-start">Overall Progress</div>
              <div class="text-sm font-bold text-end">{{ `${Math.ceil(overallProcessingProgress)}%` }}</div>
            </div>
            <v-progress-linear
              :model-value="Math.ceil(overallProcessingProgress)"
              color="blue"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
        </div>
      </div>
      <div v-if="errorProcessingVideos">
        <div class="flex flex-col justify-center w-full pb-3 text-center text-md">
          {{
            `Error processing video file: ${
              currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName
            }`
          }}
        </div>
      </div>
    </template>
  </InteractionDialog>
  <v-dialog
    v-if="showFullScreenPictureModal"
    :model-value="showFullScreenPictureModal"
    :persistent="false"
    @update:model-value="showFullScreenPictureModal = $event"
    @keydown.left.prevent="previousPicture"
    @keydown.right.prevent="nextPicture"
  >
    <div class="flex flex-col justify-center items-center w-full h-full">
      <div class="relative inline-block">
        <img
          v-if="fullScreenPicture"
          :src="fullScreenPicture.blob ? createObjectURL(fullScreenPicture.blob) : ''"
          class="block object-contain max-w-full h-[90vh]"
          alt="Full Screen Picture"
        />
        <v-btn
          class="absolute top-2 right-2 p-1 bg-[#00000055] text-white"
          size="sm"
          icon
          @click="showFullScreenPictureModal = false"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-btn
          class="absolute top-1/2 left-2 transform -translate-y-1/2 bg-[#00000055] text-white p-2 rounded-full"
          size="sm"
          icon
          @click="previousPicture"
        >
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
        <v-btn
          class="absolute top-1/2 right-2 transform -translate-y-1/2 bg-[#00000055] text-white p-2 rounded-full"
          size="sm"
          icon
          @click="nextPicture"
        >
          <v-icon>mdi-chevron-right</v-icon>
        </v-btn>
        <div class="absolute bottom-2 right-2 flex gap-2 z-[1000]">
          <v-btn icon class="bg-[#00000055] text-white" @click="downloadPictures(fullScreenPicture?.filename)">
            <v-icon>mdi-download</v-icon>
          </v-btn>
          <v-btn icon class="bg-[#00000055] text-white" @click="deletePictures(fullScreenPicture?.filename)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </div>
        <div class="absolute top-2 left-2 px-2 py-1 bg-[#00000055] rounded z-[1000]">
          <p class="text-2xl text-white">
            {{ parseDateFromTitle(fullScreenPicture?.filename as string) }}
          </p>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { format } from 'date-fns'
import * as Hammer from 'hammerjs'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { DialogActions } from '@/types/general'
import { SnapshotLibraryFile } from '@/types/snapshot'
import { VideoLibraryFile, VideoLibraryLogFile } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const snapshotStore = useSnapshotStore()
const { openSnackbar } = useSnackbar()

const { showDialog, closeDialog } = useInteractionDialog()
const { width: windowWidth } = useWindowSize()

/* eslint-disable jsdoc/require-jsdoc  */
interface CustomHammerInstance {
  destroy(): void
}

interface HammerInstances {
  [key: string]: CustomHammerInstance
}

interface ChunkGroup {
  hash: string
  fileName?: string
  chunkCount: number
  totalSize: number
  estimatedDuration: number
  firstChunkDate: Date
  chunks: Array<{ key: string; size: number; timestamp: Date }>
}

/* eslint-enable jsdoc/require-jsdoc  */
const availableVideos = ref<VideoLibraryFile[]>([])
const availableLogFiles = ref<VideoLibraryLogFile[]>([])
const isVisible = ref(true)
const selectedVideos = ref<VideoLibraryFile[]>([])
const currentTab = ref(interfaceStore.videoLibraryMode || 'videos')
const currentVideoSubTab = ref(isElectron() ? 'final' : 'temporary')
const webmErrorMessage = ref('')
const currentWebmFile = ref('')

// ZIP Processing variables
const selectedZipFile = ref<File | null>(null)
const isProcessingZip = ref(false)
const zipProcessingComplete = ref(false)
const zipProcessingProgress = ref(0)
const zipProcessingMessage = ref('')

const snackbarMessage = ref('')
const isMultipleSelectionMode = ref(false)
const longPressSelected = ref(false)
const recentlyLongPressed = ref(false)
const hammerInstances = ref<HammerInstances>({})
const loadingData = ref(true)
const showProcessingInteractionDialog = ref(false)
const interactionDialogTitle = ref('')
const interactionDialogActions = ref<DialogActions[]>([])
const showProgressInteractionDialog = ref(false)
const progressInteractionDialogTitle = ref('')
const progressInteractionDialogActions = ref<DialogActions[]>([])
const isProcessingVideos = ref(false)
const isPreparingDownload = ref(false)
const overallProcessingProgress = ref(0)
const currentVideoProcessingProgress = ref([{ fileName: '', progress: 0, message: '' }])
const numberOfFilesToProcess = ref(0)
const showOnScreenProgress = ref(false)
const lastSelectedVideo = ref<VideoLibraryFile | null>(null)
const errorProcessingVideos = ref(false)
const deleteButtonLoading = ref(false)
const videoBlobURL = ref<string | null>(null)
const loadingVideoBlob = ref(false)
const videoLoadError = ref(false)
const videoThumbnailURLs = reactive<Record<string, string | null>>({})
const availablePictures = ref<SnapshotLibraryFile[]>([])
const thumbUrlCache = new Map<string, string>()
const showFullScreenPictureModal = ref(false)
const fullScreenPicture = ref<SnapshotLibraryFile | null>(null)
const selectedPicSet = shallowRef<Set<string>>(new Set())

// Temporary chunks management
const chunkGroups = ref<ChunkGroup[]>([])
const totalChunkSize = ref(0)
const isProcessingChunks = ref(false)
const isInstructionsExpanded = ref(false)

const selectedPictures = computed({
  get: () => [...selectedPicSet.value],
  set: (arr: string[]) => {
    selectedPicSet.value.clear()
    arr.forEach((f) => selectedPicSet.value.add(f))
  },
})

const setSelectedPics = (files: string[]): void => {
  selectedPicSet.value = new Set(files) // ← one reactive hit
}

const createObjectURL = (blob: Blob): string => URL.createObjectURL(blob)

const getVideoCardClasses = (video: VideoLibraryFile): string => {
  const isSelected = selectedVideos.value.find((v) => v.fileName === video.fileName)

  if (isSelected) {
    return 'border border-white/40 bg-white/15 hover:bg-white/20'
  } else {
    return 'border border-white/20 bg-white/5 hover:bg-white/10'
  }
}

const menuButtons = [
  { name: 'Videos', icon: 'mdi-video-outline', selected: true, disabled: false, tooltip: '' },
  { name: 'Snapshots', icon: 'mdi-image-outline', selected: false, disabled: false, tooltip: '' },
]

const videoSubTabs = [
  {
    name: 'final',
    label: 'Final',
    icon: 'mdi-video',
    disabled: !isElectron(),
    tooltip: isElectron() ? '' : 'Only available in standalone version',
  },
  {
    name: 'temporary',
    label: 'Temporary',
    icon: 'mdi-folder-multiple-outline',
    disabled: false,
    tooltip: 'Manage raw video chunks',
  },
  {
    name: 'processing',
    label: 'Processing',
    icon: 'mdi-cog-outline',
    disabled: !isElectron(),
    tooltip: isElectron() ? 'Process ZIP files with raw video chunks' : 'Only available in standalone version',
  },
]

const openVideoFolder = (): void => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI?.openVideoFolder()
  } else {
    openSnackbar({
      message: 'This feature is only available in the desktop version of Cockpit.',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

const openPicInFullScreen = async (picture: SnapshotLibraryFile): Promise<void> => {
  await loadAndSetFullScreenPicture(picture)
  showFullScreenPictureModal.value = true
}

const deletePictures = async (pictureFileName?: string): Promise<void> => {
  try {
    deleteButtonLoading.value = true
    await snapshotStore.deleteSnapshotFiles(pictureFileName ? [pictureFileName] : selectedPictures.value)
    openSnackbar({
      message: 'Snapshots deleted successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
    showFullScreenPictureModal.value = false
    deselectAllPictures()
    await fetchPictures()
  } catch (error) {
    const errorMsg = `Error deleting picture: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  } finally {
    deleteButtonLoading.value = false
  }
}

const handleDeletePictures = (picture?: SnapshotLibraryFile): void => {
  showDialog({
    variant: 'warning',
    message: `Delete ${picture ? picture.filename : selectedPictures.value.length} picture(s)?`,
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: closeDialog,
      },
      {
        text: 'Delete',
        size: 'small',
        action: () => {
          deletePictures(picture ? picture.filename : undefined)
          closeDialog()
        },
      },
    ],
  })
}

const handleDeleteVideos = (videos: VideoLibraryFile[]): void => {
  const videoCount = videos.length
  const videoText = videoCount === 1 ? 'video' : 'videos'

  showDialog({
    variant: 'warning',
    title: `Delete ${videoCount} ${videoText}?`,
    message: 'Are you sure you want to delete the selected videos?',
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: closeDialog,
      },
      {
        text: 'Delete',
        size: 'small',
        action: () => {
          deleteVideosAndUpdateDB(videos)
          closeDialog()
        },
      },
    ],
  })
}

const downloadPictures = async (pictureFileName?: string): Promise<void> => {
  try {
    await snapshotStore.downloadFilesFromSnapshotDB(pictureFileName ? [pictureFileName] : selectedPictures.value)
    openSnackbar({
      message: 'Pictures downloaded successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
  } catch (error) {
    const errorMsg = `Error downloading picture: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

const closeModal = (): void => {
  isVisible.value = false
  currentTab.value = 'videos'
  deselectAllVideos()
  lastSelectedVideo.value = null
  isMultipleSelectionMode.value = false
  interfaceStore.videoLibraryVisibility = false
}

// Extracts a date or any string enclosed within parentheses from a given title string
const parseDateFromTitle = (title: string): string => {
  const dateRegex = /\(([^)]+)\)/
  const dateMatch = title.match(dateRegex)
  return dateMatch ? dateMatch[1] : ''
}

// Switches between single and multiple file selection modes
const toggleSelectionMode = (): void => {
  isMultipleSelectionMode.value = !isMultipleSelectionMode.value
  if (!isMultipleSelectionMode.value) {
    deselectAllVideos()
  }
}

const toggleVideoIntoSelectionArray = (video: VideoLibraryFile): void => {
  const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
  if (index !== -1) {
    if (selectedVideos.value.length > 1) {
      selectedVideos.value.splice(index, 1)
    }
  } else {
    selectedVideos.value.push(video)
    isMultipleSelectionMode.value = true
  }
}

const togglePictureIntoSelectionArray = (filename: string): void => {
  const next = new Set(selectedPicSet.value)
  if (next.has(filename)) {
    if (next.size > 1) next.delete(filename)
  } else {
    next.add(filename)
  }
  selectedPicSet.value = next
}

const onPictureClick = (filename: string): void => {
  if (isMultipleSelectionMode.value) {
    togglePictureIntoSelectionArray(filename)
  } else {
    setSelectedPics([filename])
  }
}

const resetProgressBars = (): void => {
  errorProcessingVideos.value = false
  overallProcessingProgress.value = 0
  currentVideoProcessingProgress.value = [{ fileName: '', progress: 0, message: '' }]
  showOnScreenProgress.value = false
}

const selectAllVideos = (): void => {
  selectedVideos.value = [...availableVideos.value]
  isMultipleSelectionMode.value = true
}

const deselectAllVideos = (): void => {
  isMultipleSelectionMode.value = false
  longPressSelected.value = false
  recentlyLongPressed.value = false

  if (selectedVideos.value.length > 1) {
    selectedVideos.value = [selectedVideos.value[0]]
  }
}

// Add the log files to the list of files to be downloaded/discarded
const addLogDataToFileList = (fileNames: string[]): string[] => {
  console.log('addLogDataToFileList called with:', fileNames)
  console.log(
    'availableLogFiles:',
    availableLogFiles.value.map((f) => f.fileName)
  )

  const filesWithLogData = fileNames.flatMap((fileName) => {
    const filenameWithoutExtension = fileName.split('.').slice(0, -1).join('.')
    const subtitlefileName = `${filenameWithoutExtension}.ass`
    const subtitleExists = availableLogFiles.value.some((video) => video.fileName === subtitlefileName)

    console.log(`Checking ${fileName}: looking for ${subtitlefileName}, exists: ${subtitleExists}`)

    return subtitleExists ? [fileName, subtitlefileName] : [fileName]
  })

  console.log('Final files list:', filesWithLogData)
  return filesWithLogData
}

const deleteVideosAndUpdateDB = async (videos: VideoLibraryFile[]): Promise<void> => {
  deleteButtonLoading.value = true
  let selectedVideoArraySize = videos.length
  let processedVideosToDiscard: string[] = []

  videos.forEach((video: VideoLibraryFile) => {
    processedVideosToDiscard.push(video.fileName)
    processedVideosToDiscard.push(videoStore.videoThumbnailFilename(video.fileName))
  })

  const dataLogFilesAdded = addLogDataToFileList(processedVideosToDiscard)
  await videoStore.discardProcessedFilesFromVideoDB(dataLogFilesAdded)

  snackbarMessage.value = `${selectedVideoArraySize} video(s) discarded.`
  openSnackbar({
    message: snackbarMessage.value,
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })
  await fetchVideosAndLogData()
  selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
  if (availableVideos.value.length === 1) isMultipleSelectionMode.value = false
  deleteButtonLoading.value = false
}

/**
 * Check if a WebM file is currently recording or needs processing
 * @param {string} fileName - The name of the WebM file to check
 * @returns {Promise<{isRecording: boolean; message: string}>} Promise with recording status and appropriate message
 */
const checkWebmFileStatus = async (
  fileName: string
): Promise<{
  /**
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
   */
  isRecording: boolean
  /**
iiiiiiiiiiiiiiiiiiiiii *
iiiiiiiiiiiiiiiiiiiiii
   */
  message: string
}> => {
  // Check if there are any active recordings with this hash
  const hashFromFileName = fileName.split(' #')[1]?.split('.')[0] // Extract hash from filename like "Cockpit (date) #hash.webm"

  if (hashFromFileName) {
    // Check if any streams are currently recording (this is a simpler approach)
    // Since we can't access liveProcessors directly, we'll assume WebM files are either
    // currently recording or were not properly finished
    const hasActiveRecordings = Object.values(videoStore.activeStreams).some(
      (stream) => stream?.mediaRecorder?.state === 'recording'
    )

    if (hasActiveRecordings) {
      return {
        isRecording: true,
        message: 'This video is still recording. Please wait for the recording to finish.',
      }
    }
  }

  return {
    isRecording: false,
    message: `This video does not appear to be properly processed from the streaming WebM to the final MP4 file. Click
    the button below to try processing it again. If the processing still doesn't work, please reach out to our team.`,
  }
}

const handleWebmFileClick = async (fileName: string): Promise<void> => {
  const status = await checkWebmFileStatus(fileName)
  webmErrorMessage.value = status.message
  currentWebmFile.value = fileName
}

const fetchVideosAndLogData = async (): Promise<void> => {
  loadingData.value = true
  availableVideos.value = []
  const videoFilesOperations: Promise<VideoLibraryFile>[] = []
  const logFileOperations: Promise<VideoLibraryLogFile>[] = []

  // Fetch processed videos and logs only
  const keys = await videoStore.videoStorage.keys()
  console.log('All keys in videoStorage:', keys)

  for (const key of keys) {
    if (videoStore.isVideoFilename(key)) {
      let thumb: Blob | undefined = undefined
      if (!isElectron()) {
        thumb = (await videoStore.videoStorage.getItem(key)) as Blob | undefined
      } else {
        thumb = new Blob([])
      }

      // In Electron, mark WebM files as unprocessed so they get special handling
      const isProcessed = !isElectron() || !key.endsWith('.webm')

      videoFilesOperations.push(
        Promise.resolve({
          fileName: key,
          isProcessed: isProcessed,
          thumbnail: thumb,
        })
      )
      const thumbnail = await videoStore.getVideoThumbnail(key, true)
      videoThumbnailURLs[key] = thumbnail ? createObjectURL(thumbnail) : null
    }
    if (key.endsWith('.ass')) {
      console.log('Found .ass file:', key)
      logFileOperations.push(Promise.resolve({ fileName: key }))
    }
  }

  const videos = await Promise.all(videoFilesOperations)
  const logFiles = await Promise.all(logFileOperations)

  // Sort videos by filename in descending order (most recent first)
  // Video filenames typically contain timestamps, so sorting by filename will give chronological order
  availableVideos.value = videos.sort((a, b) => b.fileName.localeCompare(a.fileName))
  availableLogFiles.value = logFiles

  loadingData.value = false
}

const fetchPictures = async (): Promise<void> => {
  loadingData.value = true
  // Fetches only thumb keys for now
  const thumbKeys = (await snapshotStore.snapshotThumbStorage.keys()).filter((k) => /-thumb$/i.test(k))
  const entries: SnapshotLibraryFile[] = []
  const chunkSize = 16

  for (let i = 0; i < thumbKeys.length; i += chunkSize) {
    const batch = thumbKeys.slice(i, i + chunkSize)
    const batchEntries = await Promise.all(
      batch.map(async (thumbKey) => {
        const filename = thumbKey.replace(/-thumb$/i, '')
        const thumbBlob = (await snapshotStore.snapshotThumbStorage.getItem(thumbKey)) as Blob | null
        const entry: SnapshotLibraryFile = {
          filename,
          streamName: '',
          date: new Date(),
          url: '',
          blob: new Blob(),
          thumbnail: new Blob(),
        }
        if (thumbBlob) {
          entry.thumbnail = markRaw(thumbBlob)
          let tUrl = thumbUrlCache.get(filename)
          if (!tUrl) {
            tUrl = URL.createObjectURL(thumbBlob)
            thumbUrlCache.set(filename, tUrl)
          }
          ;(entry as any).thumbUrl = tUrl
        }
        return entry
      })
    )
    entries.push(...batchEntries)
    await nextTick()
  }
  // Sorts entries by date (on the filename) in descending order
  availablePictures.value = entries.sort((a, b) => b.filename.localeCompare(a.filename))
  loadingData.value = false
}

const loadAndSetFullScreenPicture = async (picture: SnapshotLibraryFile): Promise<void> => {
  try {
    if (picture.blob.size === 0) {
      const fullBlob = (await snapshotStore.snapshotStorage.getItem(picture.filename)) as Blob | null
      if (fullBlob) {
        picture.blob = markRaw(fullBlob)
      }
    }
    fullScreenPicture.value = picture
  } catch (e) {
    console.error('Failed to load full-size snapshot', e)
    fullScreenPicture.value = picture
  }
}

const nextPicture = async (): Promise<void> => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const nextIndex = (currentIndex + 1) % availablePictures.value.length
  const nextPic = availablePictures.value[nextIndex]
  await loadAndSetFullScreenPicture(nextPic)
}

const previousPicture = async (): Promise<void> => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const previousIndex = (currentIndex - 1 + availablePictures.value.length) % availablePictures.value.length
  const prevPic = availablePictures.value[previousIndex]
  await loadAndSetFullScreenPicture(prevPic)
}

const selectAllPictures = (): void => {
  setSelectedPics(availablePictures.value.map((p) => p.filename))
  isMultipleSelectionMode.value = true
}

const deselectAllPictures = (): void => {
  setSelectedPics([])
  isMultipleSelectionMode.value = false
}

// Chunk management functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  // Check if this is our special "unknown" timestamp (Unix epoch = 0)
  if (date.getTime() === 0) {
    return 'Unknown creation datetime'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const fetchChunkGroups = async (): Promise<void> => {
  try {
    loadingData.value = true
    const allKeys = await videoStore.tempVideoStorage.keys()

    // Group chunks by hash
    const groups: { [hash: string]: ChunkGroup } = {}
    let totalSize = 0

    for (const key of allKeys) {
      // Skip thumbnail files
      if (key.includes('thumbnail_')) continue

      // Extract hash from key (format: hash_chunkNumber)
      const parts = key.split('_')
      if (parts.length < 2) continue

      const hash = parts[0]
      const chunkNumberStr = parts[parts.length - 1]
      const chunkNumber = parseInt(chunkNumberStr, 10)

      if (isNaN(chunkNumber)) continue

      try {
        const blob = (await videoStore.tempVideoStorage.getItem(key)) as Blob
        if (!blob || blob.size === 0) continue

        const chunkSize = blob.size
        totalSize += chunkSize

        if (!groups[hash]) {
          groups[hash] = {
            hash,
            chunkCount: 0,
            totalSize: 0,
            estimatedDuration: 0,
            firstChunkDate: new Date(0), // Unix epoch = 0 for unknown dates
            chunks: [],
          }
        }

        // Get recording metadata for proper timestamp
        let chunkTimestamp: Date

        if (isElectron()) {
          // For Electron: Try to get file modification time from file system
          try {
            if ((window.electronAPI as any)?.getChunkFileStats) {
              // Get file stats using the proper subfolder structure
              const subFolders = ['videos', 'temporary-video-chunks']
              const fileStats = await (window.electronAPI as any).getChunkFileStats(key, subFolders)

              if (fileStats?.exists && fileStats.mtime) {
                chunkTimestamp = new Date(fileStats.mtime)
                console.log(`[ChunkTimestamp] Using file mtime for ${key}: ${chunkTimestamp.toISOString()}`)
              } else {
                chunkTimestamp = new Date(0) // Unix epoch = 0 for unknown dates
                console.warn(`[ChunkTimestamp] File stats not available for ${key}, using unknown timestamp`)
              }
            } else {
              chunkTimestamp = new Date(0) // Unix epoch = 0 for unknown dates
              console.warn(`[ChunkTimestamp] getChunkFileStats API not available, using unknown timestamp`)
            }
          } catch (error) {
            console.warn(`[ChunkTimestamp] Error getting file stats for ${key}:`, error)
            chunkTimestamp = new Date(0) // Unix epoch = 0 for unknown dates
          }
        } else {
          // For web: Use recording metadata from localStorage
          const recordingMetadata = videoStore.getRecordingMetadata(hash)
          if (recordingMetadata) {
            // Use recording start time + chunk offset for accurate timestamp
            const chunkOffset = chunkNumber * 1000 // 1 second per chunk in milliseconds
            chunkTimestamp = new Date(recordingMetadata.epoch_start + chunkOffset)
          } else {
            // Use special "unknown" timestamp instead of current time
            chunkTimestamp = new Date(0) // Unix epoch = 0 for unknown dates
          }
        }

        groups[hash].chunks.push({
          key,
          size: chunkSize,
          timestamp: chunkTimestamp,
        })

        groups[hash].chunkCount++
        groups[hash].totalSize += chunkSize
        groups[hash].estimatedDuration = groups[hash].chunkCount // 1 second per chunk

        // Set first chunk date (earliest chunk number or first valid timestamp)
        if (chunkNumber === 0) {
          groups[hash].firstChunkDate = chunkTimestamp
        } else if (groups[hash].chunks.length === 1) {
          // If this is the first chunk we've seen, use its timestamp
          groups[hash].firstChunkDate = chunkTimestamp
        } else if (chunkTimestamp.getTime() !== 0 && groups[hash].firstChunkDate.getTime() === 0) {
          // If we have a valid timestamp and current is unknown, use the valid one
          groups[hash].firstChunkDate = chunkTimestamp
        } else if (chunkTimestamp.getTime() !== 0 && chunkTimestamp.getTime() < groups[hash].firstChunkDate.getTime()) {
          // If we have a valid timestamp that's earlier than current, use it
          groups[hash].firstChunkDate = chunkTimestamp
        }
      } catch (error) {
        console.warn(`Failed to load chunk ${key}:`, error)
      }
    }

    // Sort chunks within each group by chunk number
    Object.values(groups).forEach((group) => {
      group.chunks.sort((a, b) => {
        const aNum = parseInt(a.key.split('_').pop() || '0', 10)
        const bNum = parseInt(b.key.split('_').pop() || '0', 10)
        return aNum - bNum
      })
    })

    chunkGroups.value = Object.values(groups).sort((a, b) => b.firstChunkDate.getTime() - a.firstChunkDate.getTime())
    totalChunkSize.value = totalSize
  } catch (error) {
    console.error('Failed to fetch chunk groups:', error)
    openSnackbar({
      message: 'Failed to load temporary chunks',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  } finally {
    loadingData.value = false
  }
}

const deleteChunkGroup = async (group: ChunkGroup): Promise<void> => {
  showDialog({
    title: 'Delete Chunk Group',
    message: `Delete ${group.chunkCount} chunks for ${group.hash}? This will free up ${formatFileSize(
      group.totalSize
    )} of storage space.`,
    variant: 'warning',
    actions: [
      { text: 'Cancel', action: () => closeDialog() },
      {
        text: 'Delete',
        action: async () => {
          closeDialog()
          try {
            isProcessingChunks.value = true

            for (const chunk of group.chunks) {
              await videoStore.tempVideoStorage.removeItem(chunk.key)
            }

            openSnackbar({
              message: `Deleted ${group.chunkCount} chunks for ${group.hash}`,
              duration: 3000,
              variant: 'success',
              closeButton: true,
            })

            await fetchChunkGroups()
          } catch (error) {
            console.error('Failed to delete chunk group:', error)
            openSnackbar({
              message: 'Failed to delete chunks',
              duration: 3000,
              variant: 'error',
              closeButton: true,
            })
          } finally {
            isProcessingChunks.value = false
          }
        },
      },
    ],
  })
}

const deleteAllChunks = async (): Promise<void> => {
  if (chunkGroups.value.length === 0) return

  showDialog({
    title: 'Delete All Temporary Chunks',
    message: `Are you sure you want to delete all ${
      chunkGroups.value.length
    } chunk groups? This will free up ${formatFileSize(totalChunkSize.value)} of storage space.`,
    variant: 'warning',
    actions: [
      { text: 'Cancel', action: () => closeDialog() },
      {
        text: 'Delete All',
        action: async () => {
          closeDialog()
          try {
            isProcessingChunks.value = true

            for (const group of chunkGroups.value) {
              for (const chunk of group.chunks) {
                await videoStore.tempVideoStorage.removeItem(chunk.key)
              }
            }

            openSnackbar({
              message: `Deleted all temporary chunks (${formatFileSize(totalChunkSize.value)} freed)`,
              duration: 3000,
              variant: 'success',
              closeButton: true,
            })

            await fetchChunkGroups()
          } catch (error) {
            console.error('Failed to delete all chunks:', error)
            openSnackbar({
              message: 'Failed to delete all chunks',
              duration: 3000,
              variant: 'error',
              closeButton: true,
            })
          } finally {
            isProcessingChunks.value = false
          }
        },
      },
    ],
  })
}

/**
 * Opens the temporary chunks folder in the file manager
 */
const openTempChunksFolder = async (): Promise<void> => {
  try {
    if (window.electronAPI?.openTempChunksFolder) {
      await window.electronAPI.openTempChunksFolder()
    } else {
      console.warn('openTempChunksFolder is not available')
    }
  } catch (error) {
    console.error('Error opening temporary chunks folder:', error)
    openSnackbar({
      message: 'Failed to open temporary chunks folder',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

/**
 * Select a ZIP file for processing
 */
const selectZipFile = (): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.zip'
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      selectedZipFile.value = file
    }
  }
  input.click()
}

/**
 * Clear the selected ZIP file
 */
const clearSelectedZip = (): void => {
  selectedZipFile.value = null
}

/**
 * Process another ZIP file - reset the UI to initial state
 */
const processAnotherZip = (): void => {
  selectedZipFile.value = null
  zipProcessingComplete.value = false
  zipProcessingProgress.value = 0
  zipProcessingMessage.value = ''
}

/**
 * Go to Videos tab to view the processed video
 */
const goToVideosTab = (): void => {
  // Close the video library
  closeModal()

  // Reopen after 1 second to ensure proper state refresh
  setTimeout(() => {
    interfaceStore.videoLibraryVisibility = true
    currentTab.value = 'videos'
  }, 1000)
}

/**
 * Process the selected ZIP file
 */
const processZipFile = async (): Promise<void> => {
  if (!selectedZipFile.value || isProcessingZip.value || !isElectron()) return

  try {
    isProcessingZip.value = true
    zipProcessingComplete.value = false
    zipProcessingProgress.value = 0
    zipProcessingMessage.value = 'Starting ZIP processing...'

    // Create a temporary directory for extraction
    const tempDir = await window.electronAPI?.createTempDirectory('zip-processing')
    if (!tempDir) {
      throw new Error('Failed to create temporary directory')
    }

    // Save the ZIP file to the temporary directory first
    const zipFilePath = `${tempDir}/${selectedZipFile.value.name}`
    console.log('ZIP file path:', zipFilePath)
    console.log('Selected ZIP file:', selectedZipFile.value.name, 'Size:', selectedZipFile.value.size)

    // Use the Electron API to write the file
    if (window.electronAPI?.writeBlobToFile) {
      console.log('Writing ZIP file to:', zipFilePath)
      await window.electronAPI.writeBlobToFile(selectedZipFile.value, zipFilePath)
      console.log('ZIP file written successfully')
    } else {
      throw new Error('File writing not available')
    }

    // Set up progress listener
    if (window.electronAPI?.onZipProcessingProgress) {
      window.electronAPI.onZipProcessingProgress((progress: number, message: string) => {
        zipProcessingProgress.value = progress
        zipProcessingMessage.value = message
      })
    }

    // Process the ZIP file
    await window.electronAPI?.processZipFile(zipFilePath, tempDir)

    // Clean up progress listener
    if (window.electronAPI?.offZipProcessingProgress) {
      window.electronAPI.offZipProcessingProgress()
    }

    openSnackbar({
      message: 'ZIP file processed successfully! Video is now available in the Videos tab.',
      duration: 5000,
      variant: 'success',
      closeButton: true,
    })

    // Clean up
    await window.electronAPI?.removeTempDirectory?.(tempDir)

    // Refresh video list
    await fetchVideosAndLogData()

    // Mark processing as complete
    zipProcessingComplete.value = true
  } catch (error) {
    console.error('Failed to process ZIP file:', error)

    // Clean up progress listener on error
    if (window.electronAPI?.offZipProcessingProgress) {
      window.electronAPI.offZipProcessingProgress()
    }

    openSnackbar({
      message: `Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: 5000,
      variant: 'error',
      closeButton: true,
    })
  } finally {
    isProcessingZip.value = false
    zipProcessingProgress.value = 0
    zipProcessingMessage.value = ''
  }
}

const downloadChunkGroup = async (group: ChunkGroup): Promise<void> => {
  if (isElectron()) return // Not available in electron

  try {
    isProcessingChunks.value = true

    // Calculate batch sizes (1GB each)
    const MAX_BATCH_SIZE = 1024 * 1024 * 1024 // 1GB
    const batches: Array<{
      /**
       *
       */
      chunks: typeof group.chunks
      /**
       *
       */
      size: number
    }> = []
    let currentBatch: typeof group.chunks = []
    let currentBatchSize = 0

    for (const chunk of group.chunks) {
      if (currentBatchSize + chunk.size > MAX_BATCH_SIZE && currentBatch.length > 0) {
        batches.push({ chunks: [...currentBatch], size: currentBatchSize })
        currentBatch = []
        currentBatchSize = 0
      }
      currentBatch.push(chunk)
      currentBatchSize += chunk.size
    }

    if (currentBatch.length > 0) {
      batches.push({ chunks: currentBatch, size: currentBatchSize })
    }

    // Download each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const zipFilename = batches.length === 1 ? `chunks_${group.hash}.zip` : `chunks_${group.hash}_part${i + 1}.zip`

      const { BlobWriter, ZipWriter, BlobReader } = await import('@zip.js/zip.js')
      const zipWriter = new ZipWriter(new BlobWriter())

      for (const chunk of batch.chunks) {
        try {
          const blob = (await videoStore.tempVideoStorage.getItem(chunk.key)) as Blob
          if (blob) {
            // Get recording metadata to set proper timestamp
            const recordingMetadata = videoStore.getRecordingMetadata(group.hash)
            let chunkDate: Date

            if (recordingMetadata) {
              // Calculate timestamp: recording start + chunk offset
              const chunkNumber = parseInt(chunk.key.split('_')[1], 10)
              const chunkOffset = chunkNumber * 1000 // 1 second per chunk in milliseconds
              chunkDate = new Date(recordingMetadata.epoch_start + chunkOffset)
            } else {
              // Fallback to blob's lastModified or current time
              chunkDate = (blob as any).lastModified ? new Date((blob as any).lastModified) : new Date()
            }

            // Add chunk to ZIP with proper timestamp
            await zipWriter.add(chunk.key, new BlobReader(blob), {
              lastModDate: chunkDate,
            })
          }
        } catch (error) {
          console.warn(`Failed to add chunk ${chunk.key} to zip:`, error)
        }
      }

      // Add .ass telemetry file if it exists (only for the first batch to avoid duplicates)
      if (i === 0) {
        try {
          console.log(`[DEBUG] Checking for .ass file for group hash: ${group.hash}`)

          // Check all keys in videoStorage to see what .ass files exist
          const allKeys = await videoStore.videoStorage.keys()
          console.log(`[DEBUG] All keys in videoStorage:`, allKeys)

          const assFiles = allKeys.filter((key) => key.endsWith('.ass'))
          console.log(`[DEBUG] Found .ass files:`, assFiles)

          // Try different possible .ass file names
          const possibleAssNames = [`${group.hash}.ass`, `recording_${group.hash}.ass`, `video_${group.hash}.ass`]

          let assBlob: Blob | null = null
          let foundAssFileName = ''

          for (const assFileName of possibleAssNames) {
            console.log(`[DEBUG] Trying .ass file name: ${assFileName}`)
            assBlob = (await videoStore.videoStorage.getItem(assFileName)) as Blob
            if (assBlob) {
              foundAssFileName = assFileName
              console.log(`[DEBUG] Found .ass file: ${assFileName}`)
              break
            }
          }

          // If no .ass file exists, try to find and rename existing one or generate new one
          if (!assBlob) {
            console.log(`[DEBUG] No .ass file found with proper name, checking for existing .ass file...`)
            const recordingMetadata = videoStore.getRecordingMetadata(group.hash)

            if (recordingMetadata) {
              console.log(`[DEBUG] Found recording metadata, checking for existing .ass file...`)
              try {
                // Generate proper video filename using the same pattern as video store
                const dateStart = new Date(recordingMetadata.epoch_start)
                const timeRecordingStartString = format(dateStart, 'LLL dd, yyyy - HH꞉mm꞉ss O')

                const videoFileName = `Cockpit (${timeRecordingStartString}) #${group.hash}`
                const properAssFileName = `${videoFileName}.ass`
                const hashAssFileName = `${group.hash}.ass`

                console.log(`[DEBUG] Generated video filename: ${videoFileName}`)
                console.log(`[DEBUG] Proper .ass filename: ${properAssFileName}`)
                console.log(`[DEBUG] Hash .ass filename: ${hashAssFileName}`)

                // First, check if there's an existing .ass file with the hash name
                let existingAssBlob = (await videoStore.videoStorage.getItem(hashAssFileName)) as Blob

                if (existingAssBlob) {
                  console.log(`[DEBUG] Found existing .ass file with hash name, renaming it...`)

                  // Copy the existing .ass file with the proper name
                  await videoStore.videoStorage.setItem(properAssFileName, existingAssBlob)

                  // Remove the old hash-named file
                  await videoStore.videoStorage.removeItem(hashAssFileName)

                  console.log(`[DEBUG] Successfully renamed ${hashAssFileName} to ${properAssFileName}`)

                  // Use the renamed file
                  assBlob = existingAssBlob
                  foundAssFileName = properAssFileName
                } else {
                  console.log(`[DEBUG] No existing .ass file found, generating new one...`)

                  const dateFinish = recordingMetadata.epoch_end ? new Date(recordingMetadata.epoch_end) : new Date() // Use current time if no end time

                  await videoStore.generateTelemetryOverlay(
                    group.hash,
                    videoFileName, // Use proper video filename
                    dateStart,
                    dateFinish,
                    1920, // Default width
                    1080 // Default height
                  )

                  // Try to get the generated .ass file
                  assBlob = (await videoStore.videoStorage.getItem(properAssFileName)) as Blob
                  if (assBlob) {
                    foundAssFileName = properAssFileName
                    console.log(`[DEBUG] Successfully generated and found .ass file: ${properAssFileName}`)
                  } else {
                    console.log(`[DEBUG] Generated .ass file but couldn't retrieve it`)
                  }
                }
              } catch (error) {
                console.error(`[DEBUG] Failed to handle .ass file:`, error)
              }
            } else {
              console.log(`[DEBUG] No recording metadata found for ${group.hash}`)
            }
          }

          if (assBlob) {
            console.log(`[DEBUG] Adding .ass file to ZIP: ${foundAssFileName}`)
            await zipWriter.add(foundAssFileName, new BlobReader(assBlob))
            console.log(`[DEBUG] Successfully added .ass file to ZIP`)
          } else {
            console.log(`[DEBUG] No .ass file available for ${group.hash}`)
          }
        } catch (error) {
          console.error(`[DEBUG] Failed to add .ass file to zip:`, error)
        }
      }

      const zipBlob = await zipWriter.close()

      // Download the zip
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = zipFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      if (batches.length > 1) {
        // Small delay between batches to prevent memory issues
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    openSnackbar({
      message: `Downloaded ${group.chunkCount} chunks in ${batches.length} archive(s)`,
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
  } catch (error) {
    console.error('Failed to download chunk group:', error)
    openSnackbar({
      message: 'Failed to download chunks',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  } finally {
    isProcessingChunks.value = false
  }
}

watch(
  () => videoStore.currentFileProgress,
  (newCurrentProgress) => {
    currentVideoProcessingProgress.value = newCurrentProgress
  },
  { deep: true }
)

watch(
  () => videoStore.overallProgress,
  (newOverallProgress) => {
    overallProcessingProgress.value = newOverallProgress
    if (newOverallProgress > 0 && newOverallProgress < 100) {
      isProcessingVideos.value = true
      showOnScreenProgress.value = true
    }
    if (newOverallProgress === 100) {
      isProcessingVideos.value = false
      showOnScreenProgress.value = false
      setTimeout(() => {
        showProgressInteractionDialog.value = false
      }, 1000)
    }
  }
)

watch(isVisible, (newValue) => {
  if (!newValue) {
    resetProgressBars()
    isMultipleSelectionMode.value = false
    lastSelectedVideo.value = null
    showOnScreenProgress.value = false
    interfaceStore.videoLibraryVisibility = false
  }
})

const loadVideoBlobIntoPlayer = async (videoFileName: string): Promise<void> => {
  if (isElectron()) return

  loadingVideoBlob.value = true
  videoLoadError.value = false

  try {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    const videoBlob = await videoStore.videoStorage.getItem(videoFileName)

    if (videoBlob instanceof Blob && videoPlayer) {
      videoBlobURL.value = createObjectURL(videoBlob)
      videoPlayer.src = videoBlobURL.value

      // Set up load error detection
      let loadTimeout: ReturnType<typeof setTimeout>
      let hasLoaded = false

      const onCanPlay = (): void => {
        hasLoaded = true
        clearTimeout(loadTimeout)
        videoPlayer.removeEventListener('canplay', onCanPlay)
        videoPlayer.removeEventListener('error', onError)
      }

      const onError = (): void => {
        if (!hasLoaded) {
          videoLoadError.value = true
          clearTimeout(loadTimeout)
          videoPlayer.removeEventListener('canplay', onCanPlay)
          videoPlayer.removeEventListener('error', onError)
        }
      }

      videoPlayer.addEventListener('canplay', onCanPlay)
      videoPlayer.addEventListener('error', onError)

      // 3-second timeout
      loadTimeout = setTimeout(() => {
        if (!hasLoaded) {
          videoLoadError.value = true
          videoPlayer.removeEventListener('canplay', onCanPlay)
          videoPlayer.removeEventListener('error', onError)
        }
      }, 3000)

      videoPlayer.load()
    }
  } catch (error) {
    const msg = 'Error loading video blob into player'
    openSnackbar({ message: msg, duration: 3000, variant: 'error', closeButton: true })
    videoLoadError.value = true
  } finally {
    loadingVideoBlob.value = false
  }
}

const unloadVideoBlob = (): void => {
  if (!videoBlobURL.value) return
  URL.revokeObjectURL(videoBlobURL.value)
  videoBlobURL.value = null
  videoLoadError.value = false
}

watch(
  selectedVideos,
  async (newVal) => {
    if (newVal.length === 1) {
      lastSelectedVideo.value = newVal[0]
      await loadVideoBlobIntoPlayer(newVal[0].fileName)
      if (errorProcessingVideos.value) {
        resetProgressBars()
      }

      // Handle WebM file selection - set error message when selected
      if (isElectron() && newVal[0].fileName.endsWith('.webm')) {
        await handleWebmFileClick(newVal[0].fileName)
      }
    } else {
      unloadVideoBlob()
      // Clear WebM error message if no WebM file is selected
      webmErrorMessage.value = ''
      currentWebmFile.value = ''
    }
  },
  { deep: true }
)

// Keep last processed video selected after refresh
watch(
  availableVideos,
  () => {
    if (lastSelectedVideo.value) {
      const matchedVideo = availableVideos.value.find(
        (v) => parseDateFromTitle(v.fileName) === parseDateFromTitle(lastSelectedVideo.value!.fileName)
      )
      if (matchedVideo) {
        selectedVideos.value = [matchedVideo]
      }
    } else {
      selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
    }
  },
  { deep: true }
)

watch(isVisible, () => {
  if (isVisible.value) return
  lastSelectedVideo.value = null
})

watch(currentTab, async (newTab) => {
  if (newTab === 'temporary') {
    await fetchChunkGroups()
  }
})

// Gestures library (hammer.js) for video selection
watch(
  availableVideos,
  async () => {
    await nextTick()
    availableVideos.value.forEach((video) => {
      const videoThumbnailElement = document.getElementById(`video-library-thumbnail-${video.fileName}`)
      if (videoThumbnailElement) {
        hammerInstances.value[video.fileName]?.destroy()

        const hammerManager = new Hammer.Manager(videoThumbnailElement)
        hammerManager.add(new Hammer.Tap())
        hammerManager.add(new Hammer.Press({ time: 500 }))

        hammerManager.on('tap', async (ev) => {
          const isAlreadySelected = selectedVideos.value.some((v) => v.fileName === video.fileName)
          const shouldToggleSelection = isMultipleSelectionMode.value || ev.srcEvent.ctrlKey || ev.srcEvent.metaKey

          if (shouldToggleSelection) {
            isMultipleSelectionMode.value = true

            const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
            if (index > -1) {
              if (selectedVideos.value.length > 1) {
                selectedVideos.value.splice(index, 1)
              }
            } else {
              selectedVideos.value.push(video)
            }
          } else {
            // Always update selection for single selection mode to ensure visual feedback
            selectedVideos.value = [video]
          }

          // Handle WebM file selection - set error message when selected
          if (
            isElectron() &&
            video.fileName.endsWith('.webm') &&
            selectedVideos.value.length === 1 &&
            selectedVideos.value[0].fileName === video.fileName
          ) {
            await handleWebmFileClick(video.fileName)
          }

          if (selectedVideos.value.length === 1 && isAlreadySelected) {
            const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
            if (videoPlayer) {
              videoPlayer.load()
              videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
            }
          }
        })

        hammerManager.on('press', async () => {
          isMultipleSelectionMode.value = true
          if (!selectedVideos.value.some((v) => v.fileName === video.fileName)) {
            selectedVideos.value.push(video)
          }

          // Handle WebM file selection - set error message when selected
          if (isElectron() && video.fileName.endsWith('.webm')) {
            await handleWebmFileClick(video.fileName)
          }
        })

        hammerInstances.value[video.fileName] = hammerManager
      }
    })
  },
  { immediate: true, deep: true }
)

onMounted(async () => {
  await fetchVideosAndLogData()
  await fetchPictures()
  await fetchChunkGroups()
  if (availableVideos.value.length > 0) {
    await loadVideoBlobIntoPlayer(availableVideos.value[0].fileName)
  }
  showOnScreenProgress.value = false
})

onBeforeUnmount(() => {
  currentTab.value = 'videos'
  // Properly destroy Hammer instances
  Object.values(hammerInstances.value).forEach((instance) => {
    instance.destroy()
  })
  interfaceStore.videoLibraryVisibility = false
  availablePictures.value.forEach((pic) => pic.url && URL.revokeObjectURL(pic.url))
  unloadVideoBlob()
  for (const url of thumbUrlCache.values()) URL.revokeObjectURL(url)
  thumbUrlCache.clear()
})
</script>

<style scoped>
.dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  --v-overlay-opacity: 0.1;
  z-index: 100;
}

.video-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 860px;
  max-width: 90%;
  min-width: 600px;
  height: 650px;
  border: 1px solid #cbcbcb33;
  border-radius: 12px;
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
  z-index: 100;
}

.modal-content {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  height: 100%;
  color: #ffffff;
  z-index: 200;
}

.frosted-button {
  display: flex;
  justify-content: center;
  align-items: center;
  /* background-color: #4f4f4f88; */
  background: rgba(203, 203, 203, 0.3);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s ease;
}

.frosted-button-disabled {
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(203, 203, 203, 0.1);
  color: rgba(203, 203, 203, 0.5);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.frosted-button:hover {
  background: rgba(203, 203, 203, 0.5);
}

.frosted-button-disabled:hover {
  background: rgba(203, 203, 203, 0.1);
}

.fullscreen-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 32px;
  right: 65px;
  border-radius: 6px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.fullscreen-button:hover {
  background: #00000055;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}

.download-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 75px;
  right: 3%;
  padding: 3px;
  border-radius: 8px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.download-button:hover {
  background: #00000055;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}

.delete-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 5%;
  right: 3%;
  padding: 3px;
  padding-bottom: 4px;
  border-radius: 8px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.delete-button:hover {
  background: #00000055;
  color: red;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}
</style>
