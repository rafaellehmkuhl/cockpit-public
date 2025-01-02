<template>
  <BaseConfigurationView>
    <template #title>Data Lake</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[680px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Variables monitor</template>
          <template #info>
            <p>View, manage, and create data lake variables.</p>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[640px]">
              <div class="mb-4 flex items-center gap-2">
                <div class="relative flex-1">
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search variables..."
                    class="w-full px-3 py-2 bg-[#FFFFFF22] rounded-md text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span
                    v-if="searchQuery"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer mdi mdi-close-circle"
                    @click="searchQuery = ''"
                  />
                </div>
              </div>
              <v-data-table
                :items="filteredVariables"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg data-table-container"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
                :headers="[
                  { title: 'Name', align: 'start', key: 'name' },
                  { title: 'Type', align: 'center', key: 'type' },
                  { title: 'Current Value', align: 'end', key: 'value' },
                ]"
              >
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center justify-left rounded-xl mx-1 w-[180px]">
                        <p class="w-full whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.name }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center rounded-xl mx-1">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.type }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-end rounded-xl mx-1">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">
                          {{ parsedCurrentValue(item.id) }}
                        </p>
                      </div>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="4" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] ml-[170px] w-full">No data lake variables found</p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  listenDataLakeVariable,
  listenToDataLakeVariablesInfoChanges,
  unlistenDataLakeVariable,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

const availableDataLakeVariables = ref<DataLakeVariable[]>([])
const currentValues = ref<Record<string, string | number | boolean | undefined>>({})

const listeners = ref<Record<string, string>>({})
let dataLakeVariableInfoListenerId: string | undefined

const setupVariableListeners = (): void => {
  cleanupVariableListeners()

  availableDataLakeVariables.value.forEach((variable) => {
    currentValues.value[variable.id] = getDataLakeVariableData(variable.id)

    const listenerId = listenDataLakeVariable(variable.id, (value) => {
      currentValues.value[variable.id] = value
    })

    listeners.value[variable.id] = listenerId
  })
}

const cleanupVariableListeners = (): void => {
  Object.entries(listeners.value).forEach(([id, listenerId]) => {
    console.log(`Unlistening to ${id}.`)
    unlistenDataLakeVariable(id, listenerId)
  })
}

onMounted(() => {
  availableDataLakeVariables.value = Object.values(getAllDataLakeVariablesInfo())
  dataLakeVariableInfoListenerId = listenToDataLakeVariablesInfoChanges((variables) => {
    availableDataLakeVariables.value = Object.values(variables)
  })

  setupVariableListeners()
})

onUnmounted(() => {
  cleanupVariableListeners()

  if (dataLakeVariableInfoListenerId) {
    unlistenToDataLakeVariablesInfoChanges(dataLakeVariableInfoListenerId)
  }
})

watch(availableDataLakeVariables, () => setupVariableListeners())

const parsedCurrentValue = (id: string): string => {
  if (currentValues.value[id] === undefined) return ''

  if (availableDataLakeVariables.value.find((variable) => variable.id === id)?.type === 'number') {
    return Number(currentValues.value[id]).toFixed(7)
  }

  return currentValues.value[id].toString()
}

/**
 * Search query for filtering variables
 */
const searchQuery = ref('')

/**
 * Computed property that returns filtered variables based on the search query
 * Uses Fuse.js for fuzzy search on variable names and descriptions
 */
const filteredVariables = computed(() => {
  if (!searchQuery.value) return availableDataLakeVariables.value

  const fuse = new Fuse<DataLakeVariable>(availableDataLakeVariables.value, {
    keys: ['name', 'description'],
    threshold: 0.3,
  })
  return fuse.search(searchQuery.value).map((result) => result.item)
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}

:deep(.v-data-table) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.v-data-table__wrapper) {
  flex-grow: 1;
}
</style>
