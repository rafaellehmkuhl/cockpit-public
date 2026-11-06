<template>
  <v-menu
    v-if="secondaryVehicleTargets.length > 0"
    v-model="isOpen"
    theme="dark"
    location="top end"
    @update:model-value="onToggle"
  >
    <template #activator="{ props: menuProps }">
      <v-tooltip location="top" text="Upload to another vehicle" :disabled="isOpen">
        <template #activator="{ props: tooltipProps }">
          <button
            v-bind="{ ...menuProps, ...tooltipProps }"
            aria-label="Upload to another vehicle"
            :disabled="disabled"
            :class="disabled ? 'text-[#FFFFFF22]' : 'hover:bg-[#FFFFFF22]'"
            class="flex items-center justify-center h-[40px] py-2 px-1 rounded-md elevation-1 bg-[#FFFFFF11] transition-colors duration-200"
          >
            <v-icon>mdi-upload-multiple</v-icon>
          </button>
        </template>
      </v-tooltip>
    </template>
    <v-list density="compact" :style="interfaceStore.globalGlassMenuStyles">
      <v-list-subheader>Upload the mission to</v-list-subheader>
      <v-list-item
        v-for="target in secondaryVehicleTargets"
        :key="target.systemId"
        :title="target.name"
        @click="emit('upload', target)"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'

import {
  type SecondaryVehicleTarget,
  refreshSecondaryVehicleStates,
  secondaryVehicleTargets,
} from '@/composables/secondaryVehicles'
import { useAppInterfaceStore } from '@/stores/appInterface'

defineProps<{
  /**
   * Whether there is no mission to upload yet
   */
  disabled: boolean
}>()

const emit = defineEmits<{
  (e: 'upload', target: SecondaryVehicleTarget): void
}>()

const interfaceStore = useAppInterfaceStore()
const isOpen = ref(false)

// The connections keep no reactive state of their own, so which vehicles can be acted on is polled while the
// planner is open.
useIntervalFn(refreshSecondaryVehicleStates, 2000, { immediateCallback: true })

const onToggle = (opened: boolean): void => {
  if (opened) logUserAction('Opened the menu to upload the mission to another vehicle')
}
</script>
