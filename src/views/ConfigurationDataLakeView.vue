<template>
  <BaseConfigurationView>
    <template #title>Cockpit data-lake configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px] -mb-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[680px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Data Lake Variables</template>
          <template #info>
            <p>View, manage, and create data lake variables.</p>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[640px]">
              <v-data-table
                :items="allVariables"
                items-per-page="10"
                class="elevation-1 bg-transparent rounded-lg"
                theme="dark"
                :style="interfaceStore.globalGlassMenuStyles"
              >
                <template #headers>
                  <tr>
                    <th class="text-left">
                      <p class="text-[16px] font-bold">Name</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Type</p>
                    </th>
                    <th class="text-center">
                      <p class="text-[16px] font-bold">Current Value</p>
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
                      <div class="flex items-center justify-center rounded-xl mx-1">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.type }}</p>
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center rounded-xl mx-1">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis">{{ item.value }}</p>
                      </div>
                    </td>
                    <td class="w-[200px] text-right">
                      <div class="flex items-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="openEditDialog(item.id)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          color="error"
                          icon="mdi-delete"
                          size="x-small"
                          @click="deleteVariable(item.id)"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr class="w-full">
                    <td colspan="4" class="text-center flex items-center justify-center h-[50px] mb-3 w-full gap-2">
                      <v-btn variant="outlined" class="rounded-lg" @click="openNewVariableDialog()">
                        <v-icon start>mdi-plus</v-icon>
                        New Variable
                      </v-btn>
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

  <!-- Variable Dialog -->
  <v-dialog v-model="variableDialog.show" max-width="500px">
    <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold py-4 text-center">
        {{ editMode ? 'Edit variable' : 'Create new variable' }}
      </v-card-title>
      <v-card-text class="px-8">
        <v-form class="d-flex flex-column gap-2" @submit.prevent="saveVariable">
          <v-text-field
            v-model="newVariable.name"
            label="Variable Name"
            required
            variant="outlined"
            density="compact"
          />
          <v-select
            v-model="newVariable.type"
            :items="availableTypes"
            label="Variable Type"
            required
            variant="outlined"
            density="compact"
          />
          <v-text-field v-model="newVariable.description" label="Description" variant="outlined" density="compact" />
          <v-text-field
            v-if="newVariable.type === 'string'"
            v-model="newVariable.value"
            :label="editMode ? 'Current Value' : 'Initial Value'"
            variant="outlined"
            density="compact"
          />
          <v-text-field
            v-else-if="newVariable.type === 'number'"
            v-model.number="newVariable.value"
            :label="editMode ? 'Current Value' : 'Initial Value'"
            variant="outlined"
            density="compact"
            type="number"
          />
          <v-checkbox
            v-else-if="newVariable.type === 'boolean'"
            v-model="newVariable.value"
            :label="editMode ? 'Current Value' : 'Initial Value'"
            density="compact"
          />
        </v-form>
      </v-card-text>
      <v-divider class="mt-2 mx-10" />
      <v-card-actions>
        <div class="flex justify-between items-center pa-2 w-full h-full">
          <v-btn color="white" variant="text" @click="closeVariableDialog">Cancel</v-btn>
          <div class="flex gap-x-10">
            <v-btn variant="text" @click="resetNewVariable">Reset</v-btn>
            <v-btn color="primary" :disabled="!isFormValid" variant="text" @click="saveVariable">
              {{ editMode ? 'Save' : 'Create' }}
            </v-btn>
          </div>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()

const availableTypes = ['string', 'number', 'boolean']

const editMode = ref(false)
const variableDialog = ref({
  show: false,
})
const listeners = ref<Record<string, string>>({})

const newVariable = ref({
  id: '',
  name: '',
  type: 'string',
  description: '',
  value: undefined as string | number | boolean | undefined,
})

const isFormValid = computed(() => {
  return newVariable.value.name && newVariable.value.type
})

const currentValues = ref<Record<string, string | number | boolean | undefined>>({})

const allVariables = computed(() => {
  const variables = getAllDataLakeVariablesInfo()
  return Object.entries(variables).map(([id, variable]) => ({
    id,
    name: variable.name,
    type: variable.type,
    description: variable.description,
    value: currentValues.value[id],
  }))
})

const setupVariableListeners = (): void => {
  const variables = getAllDataLakeVariablesInfo()
  Object.keys(variables).forEach((id) => {
    currentValues.value[id] = getDataLakeVariableData(id)

    const listenerId = listenDataLakeVariable(id, (value) => {
      currentValues.value[id] = value
    })
    listeners.value[id] = listenerId
  })
}

const cleanupVariableListeners = (): void => {
  const variables = getAllDataLakeVariablesInfo()
  Object.keys(variables).forEach((id) => {
    unlistenDataLakeVariable(id, listeners.value[id])
  })
}

const openNewVariableDialog = (): void => {
  editMode.value = false
  resetNewVariable()
  variableDialog.value.show = true
}

const openEditDialog = (id: string): void => {
  const variable = getDataLakeVariableInfo(id)
  if (!variable) return

  editMode.value = true
  newVariable.value = {
    id,
    name: variable.name,
    type: variable.type,
    description: variable.description || '',
    value: getDataLakeVariableData(id),
  }
  variableDialog.value.show = true
}

const closeVariableDialog = (): void => {
  variableDialog.value.show = false
  resetNewVariable()
}

const resetNewVariable = (): void => {
  newVariable.value = {
    id: '',
    name: '',
    type: 'string',
    description: '',
    value: undefined,
  }
}

const saveVariable = (): void => {
  const variable = new DataLakeVariable(
    editMode.value ? newVariable.value.id : newVariable.value.name,
    newVariable.value.name,
    newVariable.value.type as 'string' | 'number' | 'boolean',
    newVariable.value.description
  )

  if (editMode.value) {
    updateDataLakeVariableInfo(variable)
    if (newVariable.value.value !== undefined) {
      setDataLakeVariableData(variable.id, newVariable.value.value)
    }
  } else {
    createDataLakeVariable(variable, newVariable.value.value)
    listenDataLakeVariable(variable.id, (value) => {
      currentValues.value[variable.id] = value
    })
    if (newVariable.value.value !== undefined) {
      currentValues.value[variable.id] = newVariable.value.value
    }
  }

  closeVariableDialog()
}

const deleteVariable = (id: string): void => {
  unlistenDataLakeVariable(id)
  delete currentValues.value[id]
  deleteDataLakeVariable(id)
}

onMounted(() => {
  setupVariableListeners()
})

onUnmounted(() => {
  cleanupVariableListeners()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
