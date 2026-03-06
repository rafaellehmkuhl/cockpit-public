<template>
  <div>
    <v-tooltip :text="isFullScreen ? 'Exit full screen' : 'Go full screen'" location="bottom">
      <template #activator="{ props: tooltipProps }">
        <div v-bind="tooltipProps" class="relative cursor-pointer" @click="toggleFullScreen">
          <v-icon class="text-white">{{ fullScreenToggleIcon }}</v-icon>
        </div>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import { computed } from 'vue'

const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const fullScreenToggleIcon = computed(() => (isFullscreen.value ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'))
const isFullScreen = computed(() => isFullscreen.value)

const toggleFullScreen = (): void => {
  toggleFullscreen()
}
</script>
