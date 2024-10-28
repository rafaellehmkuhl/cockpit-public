<template>
  <div class="main">
    <span>Do it yourself!</span>
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title>Do It Yourself widget configuration</v-card-title>
      <v-card-text></v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeMount, toRefs } from 'vue'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'
const interfaceStore = useAppInterfaceStore()

const widgetStore = useWidgetManagerStore()

const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

const defaultOptions = {}

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  widget.value.options = Object.assign({}, defaultOptions, widget.value.options)
})
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 150px;
  min-height: 200px;
}
</style>
