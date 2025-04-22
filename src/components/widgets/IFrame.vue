<template>
  <div class="w-full h-full">
    <iframe v-show="iframe_loaded" ref="iframe" :src="widget.options.source" frameborder="0" @load="loadFinished" />
    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Settings</v-card-title>
        <v-card-text>
          <p>Iframe Source</p>
          <div class="flex items-center justify-between">
            <v-text-field
              v-model="inputURL"
              variant="filled"
              outlined
              :rules="[validateURL]"
              @keydown.enter="updateURL"
            />
            <v-btn
              v-tooltip.bottom="'Set'"
              icon="mdi-check"
              class="mx-1 mb-5 bg-[#FFFFFF22]"
              rounded="lg"
              flat
              @click="updateURL"
            />
          </div>
        </v-card-text>
        <v-card-text>
          <v-slider v-model="transparency" label="Transparency" color="white" :min="0" :max="90" />
        </v-card-text>
        <v-card-actions class="flex justify-end">
          <v-btn color="white" @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
  <Snackbar
    :open-snackbar="openSnackbar"
    :message="snackbarMessage"
    :duration="3000"
    :close-button="false"
    @update:open-snackbar="openSnackbar = $event"
  />
</template>

<script setup lang="ts">
import { computed, defineProps, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'

import { defaultBlueOsAddress } from '@/assets/defaults'
import Snackbar from '@/components/Snackbar.vue'
import { listenDataLakeVariable } from '@/libs/actions/data-lake'
import { isValidURL } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()
const iframe = ref()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const iframe_loaded = ref(false)
const transparency = ref(0)
const inputURL = ref(widget.value.options.source)
const openSnackbar = ref(false)
const snackbarMessage = ref('')

const validateURL = (url: string): true | string => {
  return isValidURL(url) ? true : 'URL is not valid.'
}

const updateURL = (): void => {
  const urlValidationResult = validateURL(inputURL.value)
  if (urlValidationResult !== true) {
    snackbarMessage.value = `${urlValidationResult} Please enter a valid URL.`
    openSnackbar.value = true
    return
  }
  widget.value.options.source = inputURL.value
  snackbarMessage.value = `IFrame URL sucessfully updated to '${inputURL.value}'.`
  openSnackbar.value = true
}

const apiEventCallback = (event: MessageEvent): void => {
  if (event.data.type !== 'cockpit:listenToDatalakeVariables') {
    return
  }
  const { variable } = event.data
  listenDataLakeVariable(variable, (value) => {
    iframe.value.contentWindow.postMessage({ type: 'cockpit:datalakeVariable', variable, value }, '*')
  })
}

onBeforeMount((): void => {
  console.log(`IFrame '${widget.value.hash}' with source '${widget.value.options.source}' will mount.`)
  window.addEventListener('message', apiEventCallback, true)

  if (Object.keys(widget.value.options).length !== 0) {
    return
  }
  widget.value.options = {
    source: 'http://' + defaultBlueOsAddress,
  }
  inputURL.value = defaultBlueOsAddress
})

onBeforeUnmount((): void => {
  window.removeEventListener('message', apiEventCallback, true)
})

onMounted(() => {
  console.log(`IFrame '${widget.value.hash}' with source '${widget.value.options.source}' mounted.`)
})

const iframeOpacity = computed<number>(() => {
  return (100 - transparency.value) / 100
})

const pointerEvents = computed<string>(() => {
  return widgetStore.editingMode ? 'none' : 'auto'
})

/**
 * Called when iframe finishes loading
 */
function loadFinished(): void {
  console.log('Finished loading')
  iframe_loaded.value = true
}

watch(
  widget,
  () => {
    if (widgetStore.widgetManagerVars(widget.value.hash).configMenuOpen === false) {
      if (validateURL(inputURL.value) !== true) {
        inputURL.value = widget.value.options.source
      }
    }
  },
  { deep: true }
)
</script>

<style scoped>
iframe {
  width: 100%;
  height: 100%;
  border: none;
  flex-grow: 1;
  margin: 0;
  padding: 0;
  opacity: calc(v-bind('iframeOpacity'));
  pointer-events: calc(v-bind('pointerEvents'));
}
</style>
