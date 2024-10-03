<template>
  <BaseConfigurationView>
    <template #title>Cockpit Actions Configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[680px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>HTTP Request Actions</template>
          <template #info>
            <p>View, manage, and create HTTP request actions.</p>
          </template>
          <template #content>
            <div class="flex justify-center flex-col ml-2 mb-8 mt-2 w-[96%]">
              <v-data-table
                :items="allSavedActionConfigs"
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
                      <p class="text-[16px] font-bold">URL</p>
                    </th>
                    <th class="text-right">
                      <p class="text-[16px] font-bold">Actions</p>
                    </th>
                  </tr>
                </template>
                <template #item="{ item }">
                  <tr>
                    <td class="w-[30%]">
                      <div :id="item.id" class="flex items-center justify-left rounded-xl mx-1">
                        <p class="whitespace-nowrap overflow-hidden text-overflow-ellipsis w-[160px]">{{ item.name }}</p>
                      </div>
                    </td>
                    <td class="w-[240px]">{{ item.url }}</td>
                    <td class="w-[150px] text-center">
                      <div class="d-flex align-center justify-center">
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          icon="mdi-pencil"
                          size="x-small"
                          @click="openActionDialog(); editActionConfig(item.id)"
                        />
                        <v-btn
                          variant="outlined"
                          class="rounded-full mx-1"
                          color="error"
                          icon="mdi-delete"
                          size="x-small"
                          @click="deleteActionConfig(item.id)"
                        >
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>
                      </div>
                    </td>
                  </tr>
                </template>
                <template #bottom>
                  <tr>
                    <td colspan="3" class="text-center flex items-center justify-center h-[50px] mb-3">
                          <v-btn
                            variant="outlined"
                            class="rounded-lg"
                            @click="openActionDialog(); resetNewAction()"
                          >
                            <v-icon start>mdi-plus</v-icon>
                            New HTTP action
                          </v-btn>
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

  <v-dialog v-model="actionDialog.show" max-width="500px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2">{{ editMode ? 'Edit Action' : 'Create New Action' }}</v-card-title>
      <v-card-text class="pa-2">
        <v-form @submit.prevent="createActionConfig" class="d-flex flex-column gap-2">
          <v-text-field v-model="newActionConfig.name" label="Action Name" required variant="outlined" density="compact"></v-text-field>
          <v-select
            v-model="newActionConfig.method"
            :items="availableHttpRequestMethods"
            label="Request Type"
            required
            variant="outlined"
            density="compact"
          ></v-select>
          <v-text-field v-model="newActionConfig.url" label="URL" required variant="outlined" density="compact"></v-text-field>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">URL Parameters</h3>
            <v-btn variant="text" @click="openUrlParamDialog" class="px-2 py-1" density="compact">
              <v-icon size="small">mdi-plus</v-icon>
              Add
            </v-btn>
          </div>
          <div v-if="Object.keys(newActionConfig.urlParams).length > 0" class="mb-2">
            <v-chip-group>
              <v-chip
                v-for="(param, index) in Object.entries(newActionConfig.urlParams)"
                :key="`param-${index}`"
                closable
                @click:close="removeUrlParam(param[0])"
                size="x-small"
                class="ma-1"
              >
                {{ param[0] }}: {{ param[1] }}
              </v-chip>
            </v-chip-group>
          </div>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">Headers</h3>
            <v-btn variant="text" @click="openHeaderDialog" class="px-2 py-1" density="compact">
              <v-icon size="small">mdi-plus</v-icon>
              Add
            </v-btn>
          </div>
          <div v-if="Object.keys(newActionConfig.headers).length > 0" class="mb-2">
            <v-chip-group>
              <v-chip
                v-for="(header, index) in Object.entries(newActionConfig.headers)"
                :key="`header-${index}`"
                closable
                @click:close="removeHeader(header[0])"
                size="x-small"
                class="ma-1"
              >
                {{ header[0] }}: {{ header[1] }}
              </v-chip>
            </v-chip-group>
          </div>

          <div class="d-flex align-center justify-space-between">
            <h3 class="text-subtitle-2 font-weight-bold">JSON Body</h3>
            <v-btn variant="text" @click="openJsonDialog" class="px-2 py-1" density="compact">
              <v-icon size="small">mdi-code-json</v-icon>
              Edit
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-2">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="closeActionDialog" size="small">Cancel</v-btn>
        <v-btn
          color="primary"
          :disabled="!isFormValid"
          @click="createActionConfig(); closeActionDialog()"
          size="small"
        >
          {{ editMode ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- URL Parameter Dialog -->
  <v-dialog v-model="urlParamDialog.show" max-width="400px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2">Add URL Parameter</v-card-title>
      <v-card-text class="pa-2">
        <v-form @submit.prevent="addUrlParameter" class="d-flex flex-column gap-2">
          <v-text-field v-model="urlParamDialog.key" label="Parameter Key" required variant="outlined" density="compact"></v-text-field>
          <v-select
            v-model="urlParamDialog.valueType"
            :items="paramValueOptions"
            label="Parameter Value"
            required
            variant="outlined"
            density="compact"
          ></v-select>
          <v-text-field
            v-if="urlParamDialog.valueType === 'hardcoded'"
            v-model="urlParamDialog.hardcodedValue"
            label="Hardcoded Value"
            required
            variant="outlined"
            density="compact"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-2">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="closeUrlParamDialog" size="small">Cancel</v-btn>
        <v-btn
          color="primary"
          @click="addUrlParameter(); closeUrlParamDialog()"
          size="small"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Header Dialog -->
  <v-dialog v-model="headerDialog.show" max-width="400px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2">Add Header</v-card-title>
      <v-card-text class="pa-2">
        <v-form @submit.prevent="addHeader" class="d-flex flex-column gap-2">
          <v-text-field
            v-model="headerDialog.key"
            label="Header Key"
            required
            variant="outlined"
            :error-messages="headerDialog.error"
            density="compact"
          ></v-text-field>
          <v-text-field v-model="headerDialog.value" label="Header Value" variant="outlined" density="compact"></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-2">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="closeHeaderDialog" size="small">Cancel</v-btn>
        <v-btn color="primary" @click="addHeader" size="small">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- JSON Body Dialog -->
  <v-dialog v-model="bodyDialog.show" max-width="400px">
    <v-card class="rounded-lg p-3" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-h6 font-weight-bold pa-2">Edit JSON Body Template</v-card-title>
      <v-card-text class="pa-2">
        <v-form @submit.prevent="saveJsonBody" class="d-flex flex-column gap-2">
          <v-textarea
            v-model="bodyDialog.bodyText"
            label="JSON Body Template"
            hint="Use {{ anyInputName }} for dynamic values"
            persistent-hint
            :error-messages="bodyDialog.error"
            rows="10"
            @update:model-value="validateJsonTemplateForDialog"
            variant="outlined"
            density="compact"
          ></v-textarea>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-2">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="closeJsonDialog" size="small">Cancel</v-btn>
        <v-btn color="primary" :disabled="!bodyDialog.isValid" @click="saveJsonBody" size="small">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import { getAllCockpitActionParametersInfo } from '@/libs/actions/data-lake'
import {
  availableHttpRequestMethods,
  deleteHttpRequestActionConfig,
  getAllHttpRequestActionConfigs,
  HttpRequestActionConfig,
  HttpRequestMethod,
  registerHttpRequestActionConfig,
} from '@/libs/actions/http-request'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'
import { watch } from 'vue'

const interfaceStore = useAppInterfaceStore()

const actionsConfigs = reactive<Record<string, HttpRequestActionConfig>>({})
const newActionConfig = ref<HttpRequestActionConfig>({
  name: '',
  method: HttpRequestMethod.GET,
  url: '',
  headers: {},
  urlParams: {},
  body: '',
})

const bodyInputError = ref('')

const urlParamDialog = ref({
  show: false,
  key: '',
  valueType: 'hardcoded',
  hardcodedValue: '',
})

const bodyDialog = ref({
  show: false,
  bodyText: '',
  error: '',
  isValid: false,
})

const headerDialog = ref({
  show: false,
  key: '',
  value: '',
  error: '',
})

const paramValueOptions = computed(() => {
  const options = [{ title: 'Hardcoded value', value: 'hardcoded' }]
  const availableInputParameters = getAllCockpitActionParametersInfo()
  Object.values(availableInputParameters).forEach((parameter) => {
    options.push({ title: parameter.id, value: parameter.id })
  })
  return options
})

const isFormValid = computed(() => {
  return (
    newActionConfig.value.name &&
    newActionConfig.value.method &&
    newActionConfig.value.url &&
    isValidUrlParams(newActionConfig.value.urlParams) &&
    isValidHeaders(newActionConfig.value.headers) &&
    isValidJsonTemplate(newActionConfig.value.body)
  )
})

// eslint-disable-next-line jsdoc/require-jsdoc
const validateJsonTemplate = (template: string): { isValid: boolean; error: string } => {
  if (!template.trim()) {
    return { isValid: true, error: '' }
  }

  // Check if all placeholders are properly formatted
  const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g
  const placeholders = template.match(placeholderRegex)
  if (placeholders) {
    const availableInputs = paramValueOptions.value
      .map((option) => option.value)
      .filter((option) => option !== 'hardcoded')
    for (const placeholder of placeholders) {
      const inputName = placeholder.match(/\{\{\s*([^}]+)\s*\}\}/)?.[1]?.trim()
      console.log('inputName', inputName)
      if (!inputName) {
        return { isValid: false, error: `Invalid placeholder format: ${placeholder}` }
      }
      if (!availableInputs.includes(inputName)) {
        return {
          isValid: false,
          error: `Invalid input name in placeholder: ${inputName}. Available inputs are: ${availableInputs.join(', ')}`,
        }
      }
    }
  }

  // Replace placeholders with a valid JSON value temporarily
  const tempTemplate = template.replace(placeholderRegex, 'PLACEHOLDER')

  try {
    const parsed = JSON.parse(tempTemplate)
    if (typeof parsed !== 'object' || parsed === null) {
      return { isValid: false, error: 'Invalid JSON structure' }
    }

    return { isValid: true, error: '' }
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON: ' + (error as Error).message }
  }
}

const isValidJsonTemplate = (template: string): boolean => {
  const { isValid } = validateJsonTemplate(template)
  return isValid
}

const validateJsonTemplateForDialog = (template: string): void => {
  const { isValid, error } = validateJsonTemplate(template)
  bodyDialog.value.error = error
  bodyDialog.value.isValid = isValid
}

const isValidUrlParams = (params: Record<string, string>): boolean => {
  return Object.entries(params).every(([key, value]) => {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      const parsedValue = value.replace('{{', '').replace('}}', '').trim()
      return key !== '' && value !== '' && paramValueOptions.value.map((option) => option.value).includes(parsedValue)
    }
    return key !== '' && value !== ''
  })
}

// eslint-disable-next-line jsdoc/require-jsdoc
const isValidHeaders = (headers: Record<string, string>): { isValid: boolean; error: string } => {
  for (const [key, value] of Object.entries(headers)) {
    // Header keys should be non-empty and contain valid characters
    const validKeyRegex = /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/
    if (!key || !validKeyRegex.test(key)) {
      const error = 'Invalid header key. Use only letters, numbers, and common punctuation. No spaces allowed.'
      return { isValid: false, error }
    }

    // Header values can be empty, but if not, they should not contain newlines
    if (value && /[\r\n]/.test(value)) {
      return { isValid: false, error: 'Header value cannot contain newlines.' }
    }
  }
  return { isValid: true, error: '' }
}

const openUrlParamDialog = (): void => {
  urlParamDialog.value = {
    show: true,
    key: '',
    valueType: 'hardcoded',
    hardcodedValue: '',
  }
}

const closeUrlParamDialog = (): void => {
  urlParamDialog.value.show = false
}

const addUrlParameter = (): void => {
  const parsedValue = `{{ ${urlParamDialog.value.valueType} }}`
  const value = urlParamDialog.value.valueType === 'hardcoded' ? urlParamDialog.value.hardcodedValue : parsedValue
  newActionConfig.value.urlParams[urlParamDialog.value.key] = value
  closeUrlParamDialog()
}

const openJsonDialog = (): void => {
  bodyDialog.value = {
    show: true,
    bodyText: newActionConfig.value.body,
    error: '',
    isValid: isValidJsonTemplate(newActionConfig.value.body),
  }
}

const closeJsonDialog = (): void => {
  bodyDialog.value.show = false
}

const saveJsonBody = (): void => {
  if (bodyDialog.value.isValid) {
    newActionConfig.value.body = bodyDialog.value.bodyText
    closeJsonDialog()
  }
}

const removeUrlParam = (key: string): void => {
  delete newActionConfig.value.urlParams[key]
}

const openHeaderDialog = (): void => {
  headerDialog.value = {
    show: true,
    key: '',
    value: '',
    error: '',
  }
}

const closeHeaderDialog = (): void => {
  headerDialog.value.show = false
  headerDialog.value.error = ''
}

const addHeader = (): void => {
  const { isValid, error } = isValidHeaders({ [headerDialog.value.key]: headerDialog.value.value })
  if (isValid) {
    newActionConfig.value.headers[headerDialog.value.key] = headerDialog.value.value
    closeHeaderDialog()
  } else {
    headerDialog.value.error = error
  }
}

const removeHeader = (key: string): void => {
  delete newActionConfig.value.headers[key]
}

const editMode = ref(false)

const editActionConfig = (id: string): void => {
  editMode.value = true
  newActionConfig.value = JSON.parse(JSON.stringify(actionsConfigs[id])) // Deep copy
}

const createActionConfig = (): void => {
  editMode.value = false
  registerHttpRequestActionConfig(newActionConfig.value)
  loadSavedActions()
  resetNewAction()
}

const resetNewAction = (): void => {
  newActionConfig.value = {
    name: '',
    method: HttpRequestMethod.GET,
    url: '',
    headers: {},
    urlParams: {},
    body: '',
  }
  bodyInputError.value = ''
  editMode.value = false
}

const allSavedActionConfigs = computed(() => {
  return Object.entries(actionsConfigs).map(([id, action]) => ({ id, ...action }))
})

watch(actionsConfigs, () => {
  console.log('actionsConfigs', actionsConfigs)
  console.log('allSavedActionConfigs', allSavedActionConfigs.value)
})

const discardChanges = (): void => {
  resetNewAction()
}

const deleteActionConfig = (id: string): void => {
  console.log('deleteActionConfig', id)
  delete actionsConfigs[id]
  deleteHttpRequestActionConfig(id)
  loadSavedActions()
}

const loadSavedActions = (): void => {
  Object.assign(actionsConfigs, getAllHttpRequestActionConfigs())
}

const actionDialog = ref({
  show: false,
})

const openActionDialog = (): void => {
  actionDialog.value.show = true
}

const closeActionDialog = (): void => {
  actionDialog.value.show = false
  resetNewAction()
}

onMounted(() => {
  loadSavedActions()
})
</script>

<style scoped>
.v-data-table ::v-deep tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.1) !important;
}
</style>
