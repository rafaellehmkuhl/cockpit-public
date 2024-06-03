<template>
  <div class="w-[8.5rem] h-12 p-1 text-white relative">
    <img src="@/assets/depth-icon.svg" class="h-[80%] left-[0.5rem] top-[13%] absolute" :draggable="false" />
    <div class="absolute left-[3rem] flex flex-col items-start justify-center select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ depth.toFixed(precision) }}</span>
        <span class="text-xl font-semibold leading-6 w-fit"> m</span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Depth</span>
    </div>
  </div>
  <Dialog v-model:show="miniWidget.managerVars.configMenuOpen" class="w-72">
    <div class="w-full h-full">
      <div class="flex flex-col items-center justify-around">
        <div class="flex items-center justify-between w-full my-1">
          <span class="mr-1 text-slate-100">Data source</span>
          <div class="w-40">
            <Dropdown v-model="miniWidget.options.dataSource" :options="sourceOptions" />
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, Ref, ref, toRefs, watch } from 'vue'

import Dialog from '@/components/Dialog.vue'
import Dropdown from '@/components/Dropdown.vue'
import {
  availableGenericVariables,
  GenericVariableTag,
  listenGenericVariable,
  unlistenGenericVariable,
} from '@/libs/cockpit-basics'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { MiniWidget } from '@/types/miniWidgets'

// TODO: Move to generic variable datalogging
datalogger.registerUsage(DatalogVariable.depth)

const depth = ref(0)
const precision = computed(() => {
  const fDepth = depth.value
  if (fDepth < 10) return 2
  if (fDepth >= 10 && fDepth < 1000) return 1
  return 0
})

// New system
const sourceTags: GenericVariableTag[] = ['depth', 'altitude']
const sourceOptions: Ref<string[]> = ref([])
let listenerId = ''

setInterval(() => (sourceOptions.value = availableGenericVariables(sourceTags)), 1000)

const updateListener = (source: string): void => {
  if (listenerId) unlistenGenericVariable(listenerId)
  listenerId = listenGenericVariable(source, (value) => (depth.value = -(value as number)))

  // Reset depth and history
  depth.value = 0
}

// eslint-disable-next-line jsdoc/require-jsdoc
const props = defineProps<{ miniWidget: MiniWidget }>()
const miniWidget = toRefs(props).miniWidget

watch(
  miniWidget.value.options,
  () => {
    updateListener(miniWidget.value.options.dataSource)
  },
  { deep: true }
)

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  miniWidget.value.options = miniWidget.value.options ?? {}
  miniWidget.value.options.dataSource = miniWidget.value.options.dataSource ?? ''

  // Set initial listener
  if (miniWidget.value.options.dataSource) {
    updateListener(miniWidget.value.options.dataSource)
  }
})

onBeforeUnmount(() => {
  if (listenerId) {
    unlistenGenericVariable(listenerId)
  }
})
</script>
