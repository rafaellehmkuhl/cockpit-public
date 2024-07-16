<template>
  <InteractionDialog
    :show-dialog="showDialog"
    title="Settings conflicts with BlueOS"
    :actions="actionsToKeepAll"
    :max-width="600"
  >
    <template #content>
      <div class="flex flex-col mb-2 text-center align-end">
        For each settings that conflicted, click on the option that you want to keep on the table below.
      </div>
      <span v-for="setting in conflictedSettings" :key="setting.key"></span>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { ref, toRefs } from 'vue'

import { DialogActions } from '@/types/general'

import InteractionDialog from './InteractionDialog.vue'

const actionsToKeepAll = ref<DialogActions[]>([])
actionsToKeepAll.value = [
  {
    text: 'Keep all from BlueOS',
    size: 'small',
    class: 'font-light',
    action: () => {
      console.log('Keep all from BlueOS')
    },
  },
  {
    text: 'Keep all from Cockpit',
    size: 'small',
    class: 'font-bold',
    action: async () => {
      console.log('Keep all from Cockpit')
    },
  },
]

/**
 *
 */
interface ConflictedSetting {
  /**
   *
   */
  key: string
  /**
   *
   */
  blueosValue: string
  /**
   *
   */
  cockpitValue: string
}

const props = defineProps<{
  /**
   *
   */
  conflictedSettings: ConflictedSetting[]
}>()

const conflictedSettings = toRefs(props).conflictedSettings
</script>
