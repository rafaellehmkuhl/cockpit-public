<template>
  <v-container class="configuration-actions-view">
    <v-row>
      <v-col cols="12">
        <h2 class="text-h4 mb-6">HTTP Request Actions Configuration</h2>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="action-form pa-4">
          <h3 class="text-h5 mb-4">{{ editMode ? 'Edit Action' : 'Create New Action' }}</h3>
          <v-form @submit.prevent="createActionConfig">
            <v-text-field v-model="newActionConfig.name" label="Action Name" required></v-text-field>
            <v-select
              v-model="newActionConfig.method"
              :items="availableHttpRequestMethods"
              label="Request Type"
              required
            ></v-select>
            <v-text-field v-model="newActionConfig.url" label="URL" required></v-text-field>

            <h4 class="text-h6 mt-4 mb-2">URL Parameters:</h4>
            <v-chip-group column>
              <v-chip
                v-for="(param, index) in Object.entries(newActionConfig.urlParams)"
                :key="index"
                closable
                @click:close="removeUrlParam(param[0])"
              >
                {{ param[0] }}: {{ param[1] }}
              </v-chip>
            </v-chip-group>
            <v-btn color="primary" @click="openUrlParamDialog">
              <v-icon left>mdi-plus</v-icon>
              Add URL Parameter
            </v-btn>

            <h4 class="text-h6 mt-4 mb-2">JSON Body Template:</h4>
            <v-btn color="primary" @click="openJsonDialog">
              <v-icon left>mdi-code-json</v-icon>
              Edit JSON Body
            </v-btn>

            <v-btn color="primary" type="submit" class="mt-4" :disabled="!isFormValid">
              {{ editMode ? 'Save Action' : 'Create Action' }}
            </v-btn>
            <v-btn color="secondary" class="mt-4 ml-2" @click="discardChanges">Discard Changes</v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="action-list pa-4">
          <h3 class="text-h5 mb-4">Existing Actions</h3>
          <v-list>
            <v-list-item v-for="action in Object.values(actionsConfigs)" :key="action.name">
              <v-list-item-content>
                <v-list-item-title>{{ action.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ action.method }} {{ action.url }}</v-list-item-subtitle>
                <v-list-item-subtitle>
                  URL Parameters: {{ Object.keys(action.urlParams).length }}
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-btn color="primary" icon @click="editActionConfig(action)">
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
                <v-btn color="error" icon @click="deleteActionConfig(action.name)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <!-- URL Parameter Dialog -->
    <v-dialog v-model="urlParamDialog.show" max-width="500px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Add URL Parameter</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-text-field v-model="urlParamDialog.key" label="Parameter Key" required></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="urlParamDialog.valueType"
                  :items="paramValueOptions"
                  label="Parameter Value"
                  required
                ></v-select>
              </v-col>
              <v-col v-if="urlParamDialog.valueType === 'hardcoded'" cols="12">
                <v-text-field v-model="urlParamDialog.hardcodedValue" label="Hardcoded Value" required></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" @click="closeUrlParamDialog">Cancel</v-btn>
          <v-btn color="blue darken-1" @click="addUrlParameter">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="bodyDialog.show" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">Edit JSON Body Template</span>
        </v-card-title>
        <v-card-text>
          <v-textarea
            v-model="bodyDialog.bodyText"
            label="JSON Body Template"
            hint="Use {{ anyInputName }} for dynamic values"
            persistent-hint
            :error-messages="bodyDialog.error"
            rows="10"
            @update:model-value="validateJsonTemplateForDialog"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" @click="closeJsonDialog">Cancel</v-btn>
          <v-btn color="blue darken-1" :disabled="!bodyDialog.isValid" @click="saveJsonBody">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { getAllCockpitActionParametersInfo } from '@/libs/actions/data-lake'
import { availableHttpRequestMethods, HttpRequestActionConfig, HttpRequestMethod } from '@/libs/actions/http-request'

const actionsConfigs = ref<Record<string, HttpRequestActionConfig>>({})
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

const paramValueOptions = computed(() => {
  const options = [{ title: 'Hardcoded value', value: 'hardcoded' }]
  const availableInputParameters = getAllCockpitActionParametersInfo()
  Object.values(availableInputParameters).forEach((parameter) => {
    options.push({ title: parameter.id, value: parameter.id })
  })
  return options
})

const isFormValid = computed(() => {
  console.log('isformvalid?')
  console.log(newActionConfig.value.name)
  console.log(newActionConfig.value.method)
  console.log(newActionConfig.value.url)
  console.log(isValidUrlParams(newActionConfig.value.urlParams))
  console.log(isValidJsonTemplate(newActionConfig.value.body))
  return (
    newActionConfig.value.name &&
    newActionConfig.value.method &&
    newActionConfig.value.url &&
    isValidUrlParams(newActionConfig.value.urlParams) &&
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
  console.log('placeholders?')
  console.log(placeholders)
  if (placeholders) {
    const availableInputs = paramValueOptions.value
      .map((option) => option.value)
      .filter((option) => option !== 'hardcoded')
    console.log('availableInputs?')
    console.log(availableInputs)
    for (const placeholder of placeholders) {
      const inputName = placeholder.match(/\{\{\s*([^}]+)\s*\}\}/)?.[1]?.trim()
      console.log('inputName?')
      console.log(inputName)
      if (!inputName) {
        console.log('invalid placeholder format')
        return { isValid: false, error: `Invalid placeholder format: ${placeholder}` }
      }
      if (!availableInputs.includes(inputName)) {
        console.log('invalid input name')
        return {
          isValid: false,
          error: `Invalid input name in placeholder: ${inputName}. Available inputs are: ${availableInputs.join(', ')}`,
        }
      }
    }
  }
  console.log('all good here')

  // Replace placeholders with a valid JSON value temporarily
  const tempTemplate = template.replace(placeholderRegex, 'PLACEHOLDER')
  console.log('tempTemplate?')
  console.log(tempTemplate)

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
  console.log('isValidUrlParams?')
  console.log(params)
  return Object.entries(params).every(([key, value]) => {
    if (value.startsWith('"{{') && value.endsWith('}}"')) {
      const parsedValue = value.replace('"{{', '').replace('}}"', '').trim()
      return key !== '' && value !== '' && paramValueOptions.value.map((option) => option.value).includes(parsedValue)
    }
    return key !== '' && value !== ''
  })
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
  const parsedValue = `"{{ ${urlParamDialog.value.valueType} }}"`
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
  console.log('removeUrlParam?')
  console.log(key)
  delete newActionConfig.value.urlParams[key]
}

const editMode = ref(false)

const editActionConfig = (actionConfig: HttpRequestActionConfig): void => {
  editMode.value = true
  newActionConfig.value = JSON.parse(JSON.stringify(actionConfig)) // Deep copy
}

const createActionConfig = (): void => {
  if (editMode.value) {
    actionsConfigs.value[newActionConfig.value.name] = { ...newActionConfig.value }
    editMode.value = false
  } else {
    actionsConfigs.value[newActionConfig.value.name] = { ...newActionConfig.value }
  }
  saveActions()
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

const discardChanges = (): void => {
  resetNewAction()
}

const deleteActionConfig = (id: string): void => {
  delete actionsConfigs.value[id]
  saveActions()
}

const saveActions = (): void => {
  localStorage.setItem('httpRequestActions', JSON.stringify(actionsConfigs.value))
}

const loadActions = (): void => {
  const savedActions = localStorage.getItem('httpRequestActions')
  if (savedActions) {
    actionsConfigs.value = JSON.parse(savedActions)
  }
}

onMounted(() => {
  console.log('Component mounted')
  loadActions()
})
</script>

<style scoped>
.configuration-actions-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
