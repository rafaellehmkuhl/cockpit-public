<template>
  <BaseConfigurationView>
    <template #title>Data Lake Configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[700px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Transforming Functions</template>
          <template #info>
            <li>Create new data lake variables by combining existing ones using expressions.</li>
            <li>The expressions will be evaluated in real-time as the input variables change.</li>
            <li>Use JavaScript expressions to define the transformations.</li>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[660px]">
              <v-data-table
                :items="transformingFunctions"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg mb-8"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #headers>
                  <tr>
                    <th class="text-left">
                      <p class="text-[16px] font-bold">Name</p>
                    </th>
                    <th class="text-left">
                      <p class="text-[16px] font-bold">Type</p>
                    </th>
                    <th class="text-right">
                      <p class="text-[16px] font-bold">Actions</p>
                    </th>
                  </tr>
                </template>
                <template #item="{ item }">
                  <tr>
                    <td>
                      <div class="flex items-center justify-left rounded-xl mx-1 w-[140px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.name }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-left rounded-xl mx-1 w-[80px]">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.type }}</p>
                      </div>
                    </td>
                    <td class="w-[120px] text-right">
                      <div class="flex items-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="editTransformingFunction(item)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          color="error"
                          icon="mdi-delete"
                          size="x-small"
                          @click="handleDeleteFunction(item)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr class="w-full">
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                      <v-btn variant="outlined" class="rounded-lg" @click="showNewFunctionDialog = true">
                        <v-icon start>mdi-plus</v-icon>
                        New Function
                      </v-btn>
                    </td>
                  </tr>
                </template>
                <template #no-data>
                  <tr>
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] w-full">
                      <p class="text-[16px] ml-[170px] w-full">No transforming functions found</p>
                    </td>
                  </tr>
                </template>
              </v-data-table>
            </div>
          </template>
        </ExpansiblePanel>

        <!-- New/Edit Function Dialog -->
        <v-dialog v-model="showNewFunctionDialog" max-width="600px">
          <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
            <v-card-title class="text-h6 font-weight-bold py-4 text-center">
              {{ editingFunction ? 'Edit Function' : 'New Function' }}
            </v-card-title>
            <v-card-text class="px-8">
              <div class="flex flex-col gap-4">
                <v-text-field
                  v-model="newFunction.name"
                  label="Variable Name"
                  variant="outlined"
                  :rules="[(v) => !!v || 'Name is required']"
                />
                <v-select
                  v-model="newFunction.type"
                  label="Variable Type"
                  variant="outlined"
                  :items="['string', 'number', 'boolean']"
                  :rules="[(v) => !!v || 'Type is required']"
                />
                <v-textarea
                  v-model="newFunction.expression"
                  label="Expression"
                  variant="outlined"
                  :rules="[(v) => !!v || 'Expression is required']"
                />
                <v-textarea
                  v-model="newFunction.description"
                  label="Description"
                  variant="outlined"
                  placeholder="Optional description of what this transformation does"
                  rows="2"
                />
                <div class="relative">
                  <v-text-field
                    v-model="searchQuery"
                    label="Search Variables"
                    variant="outlined"
                    append-icon="mdi-magnify"
                    @click:append="showVariablesMenu = !showVariablesMenu"
                    @focus="showVariablesMenu = true"
                  />
                  <v-menu v-model="showVariablesMenu" :close-on-content-click="false" location="bottom" offset="10">
                    <v-card width="400" :style="interfaceStore.globalGlassMenuStyles">
                      <v-list bg-color="transparent">
                        <v-list-item
                          v-for="[id, variable] in filteredVariables"
                          :key="id"
                          :title="variable.name"
                          :subtitle="id"
                          class="cursor-pointer hover:bg-[#FFFFFF22]"
                          @click="copyVariableId(id, variable.name)"
                        >
                          <template #append>
                            <v-icon size="small" class="opacity-50">mdi-content-copy</v-icon>
                          </template>
                        </v-list-item>
                        <v-list-item v-if="filteredVariables.length === 0" title="No variables found" disabled />
                      </v-list>
                    </v-card>
                  </v-menu>
                </div>
              </div>
            </v-card-text>
            <v-divider class="mt-2 mx-10" />
            <v-card-actions>
              <div class="flex justify-between items-center pa-2 w-full h-full">
                <v-btn color="white" variant="text" @click="closeNewFunctionDialog">Cancel</v-btn>
                <v-btn color="primary" @click="saveTransformingFunction">Save</v-btn>
              </div>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { useSnackbar } from '@/composables/snackbar'
import {
  DataLakeVariable,
  getAllDataLakeVariablesInfo,
  listenToDataLakeVariablesInfoChanges,
  unlistenToDataLakeVariablesInfoChanges,
} from '@/libs/actions/data-lake'
import {
  createTransformingFunction,
  deleteTransformingFunction,
  getAllTransformingFunctions,
  TransformingFunction,
  updateTransformingFunction,
} from '@/libs/actions/data-lake-transformations'
import { copyToClipboard } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const transformingFunctions = ref<TransformingFunction[]>([])
const showNewFunctionDialog = ref(false)
const editingFunction = ref(false)

const defaultValues = {
  name: '',
  type: 'string' as 'string' | 'number' | 'boolean',
  expression: '',
  description: '',
}
const newFunction = ref(defaultValues)

const variablesMap = ref<Record<string, DataLakeVariable>>({})
const { openSnackbar } = useSnackbar()
const searchQuery = ref('')
const showVariablesMenu = ref(false)

const availableVariables = computed(() => Object.entries(variablesMap.value))

const filteredVariables = computed(() => {
  if (!searchQuery.value) return availableVariables.value
  const query = searchQuery.value.toLowerCase()
  return availableVariables.value.filter(
    ([id, variable]) => id.toLowerCase().includes(query) || variable.name.toLowerCase().includes(query)
  )
})

const copyVariableId = (id: string, name: string): void => {
  copyToClipboard(id)
  openSnackbar({ message: `Variable ID for "${name}" copied to clipboard`, variant: 'success', duration: 2000 })
  showVariablesMenu.value = false
}

/**
 * Closes the new/edit function dialog and resets the form
 */
const closeNewFunctionDialog = (): void => {
  showNewFunctionDialog.value = false
  editingFunction.value = false
  newFunction.value = {
    name: '',
    type: 'string' as 'string' | 'number' | 'boolean',
    expression: '',
    description: '',
  }
}

/**
 * Opens the edit dialog for a transforming function
 * @param {TransformingFunction} func - The function to edit
 */
const editTransformingFunction = (func: TransformingFunction): void => {
  editingFunction.value = true
  newFunction.value = {
    name: func.name,
    type: func.type,
    expression: func.expression,
    description: func.description || '',
  }
  showNewFunctionDialog.value = true
}

/**
 * Handles deleting a transforming function
 * @param {TransformingFunction} func - The function to delete
 */
const handleDeleteFunction = (func: TransformingFunction): void => {
  deleteTransformingFunction(func)
  updateTransformingFunctionsList()
}

const updateTransformingFunctionsList = (): void => {
  transformingFunctions.value = getAllTransformingFunctions()
}

/**
 * Saves the current transforming function being edited or creates a new one
 */
const saveTransformingFunction = (): void => {
  if (!newFunction.value.name || !newFunction.value.expression || !newFunction.value.type) return

  if (editingFunction.value) {
    updateTransformingFunction({
      id: newFunction.value.name,
      ...newFunction.value,
    })
  } else {
    createTransformingFunction(
      newFunction.value.name,
      newFunction.value.name,
      newFunction.value.type,
      newFunction.value.expression,
      newFunction.value.description
    )
  }

  updateTransformingFunctionsList()
  closeNewFunctionDialog()
}

// Load available variables when mounted
let variablesInfoListener: string | undefined = undefined
onMounted((): void => {
  // Listen for changes in available variables
  variablesInfoListener = listenToDataLakeVariablesInfoChanges((variables) => {
    variablesMap.value = variables
  })

  // Initial load
  variablesMap.value = getAllDataLakeVariablesInfo()
  updateTransformingFunctionsList()
})

onUnmounted(() => {
  if (variablesInfoListener) {
    unlistenToDataLakeVariablesInfoChanges(variablesInfoListener)
  }
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
