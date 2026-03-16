import { v4 as uuid } from 'uuid'

import { perfBegin, perfEnd } from '@/libs/performance-instrumentation'

import { settingsManager } from '../settings-management'

/**
 * The type of a variable in the data lake
 */
export type DataLakeVariableType = 'string' | 'number' | 'boolean'

/**
 * A configuration for a Data Lake variable
 */
export interface DataLakeVariable {
  /**
   * The id of the variable
   */
  id: string
  /**
   * The name of the variable
   */
  name: string
  /**
   * The type of the variable
   */
  type: DataLakeVariableType
  /**
   * What the variable does or means
   */
  description?: string
  /**
   * Whether the variable existance should be persisted between boots
   */
  persistent?: boolean
  /**
   * Whether the variable's value should be persisted between boots
   */
  persistValue?: boolean
  /**
   * Whether the variable's value should be allowed to be changed by the user
   */
  allowUserToChangeValue?: boolean
}

/**
 * Internal structure for storing listener information
 */
interface DataLakeVariableListener {
  /**
   * The callback to be called when the variable changes
   */
  callback: (value: string | number | boolean) => void
  /**
   * Whether to notify the listener when the timestamp changes
   */
  notifyOnTimestampChange: boolean
}

/**
 * Options for listening to data lake variable changes
 */
export interface ListenDataLakeVariableOptions {
  /**
   * If true, notify when timestamp changes even if value stays the same.
   * By default, listeners are only notified when the value changes.
   */
  notifyOnTimestampChange?: boolean
}

const persistentVariablesKey = 'cockpit-persistent-data-lake-variables'
const persistentValuesKey = 'cockpit-persistent-data-lake-values'

const dataLakeVariableInfo: Record<string, DataLakeVariable> = {}
const dataLakeVariableTimestamps: Record<string, number> = {}
export const dataLakeVariableData: Record<string, string | number | boolean | undefined> = {}
const dataLakeVariableListeners: Record<string, Record<string, DataLakeVariableListener>> = {}
const dataLakeVariableInfoListeners: Record<string, (variables: Record<string, DataLakeVariable>) => void> = {}

// Load persistent variables from localStorage on initialization
const loadPersistentVariables = (): void => {
  const savedVariables = settingsManager.getKeyValue(persistentVariablesKey)

  if (savedVariables && Array.isArray(savedVariables)) {
    savedVariables.forEach((variable) => {
      dataLakeVariableInfo[variable.id] = variable
    })
  }

  // Load persistent values
  const savedValues = settingsManager.getKeyValue(persistentValuesKey)
  if (savedValues && typeof savedValues === 'object') {
    Object.entries(savedValues).forEach(([id, value]) => {
      // Only load values for variables that exist and have persistValue set to true
      if (dataLakeVariableInfo[id] && dataLakeVariableInfo[id].persistValue) {
        dataLakeVariableData[id] = value as string | number | boolean | undefined
      }
    })
  }
}

// Save persistent variables to localStorage
const savePersistentVariables = (): void => {
  const persistentVariables = Object.values(dataLakeVariableInfo).filter((variable) => variable.persistent)

  settingsManager.setKeyValue(persistentVariablesKey, JSON.stringify(persistentVariables))
}

// Save persistent values to localStorage
const savePersistentValues = (): void => {
  const persistentValuesObj: Record<string, string | number | boolean> = {}

  Object.entries(dataLakeVariableInfo)
    .filter(([, variable]) => variable.persistValue)
    .forEach(([id]) => {
      if (dataLakeVariableData[id] !== undefined) {
        persistentValuesObj[id] = dataLakeVariableData[id] as string | number | boolean
      }
    })

  settingsManager.setKeyValue(persistentValuesKey, JSON.stringify(persistentValuesObj))
}

export const getAllDataLakeVariablesInfo = (): Record<string, DataLakeVariable> => {
  return dataLakeVariableInfo
}

export const getDataLakeVariableInfo = (id: string): DataLakeVariable | undefined => {
  return dataLakeVariableInfo[id]
}

export const createDataLakeVariable = (variable: DataLakeVariable, initialValue?: string | number | boolean): void => {
  if (dataLakeVariableInfo[variable.id]) {
    console.warn(`Cockpit action variable with id '${variable.id}' already exists. Updating it.`)
  }
  dataLakeVariableInfo[variable.id] = variable
  dataLakeVariableData[variable.id] = initialValue

  // Initialize timestamp if initial value is provided
  if (initialValue !== undefined) {
    dataLakeVariableTimestamps[variable.id] = performance.now()
  }

  if (variable.persistent) {
    savePersistentVariables()
  }

  if (variable.persistValue && initialValue !== undefined) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const updateDataLakeVariableInfo = (variable: DataLakeVariable): void => {
  if (!dataLakeVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' does not exist. Create it first.`)
  }

  dataLakeVariableInfo[variable.id] = variable

  if (variable.persistent) {
    savePersistentVariables()
  }

  if (variable.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const getDataLakeVariableData = (id: string): string | number | boolean | undefined => {
  return dataLakeVariableData[id]
}

const dirtyValueIds = new Set<string>()
const dirtyTimestampIds = new Set<string>()
let flushScheduled = false

/**
 * Schedule a single RAF callback to flush all pending notifications.
 * Multiple calls before the next frame are no-ops.
 */
function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true
  requestAnimationFrame(flushNotifications)
}

/**
 * Flush all pending listener notifications in a single batch.
 * Called once per animation frame, notifying each dirty variable's listeners
 * with the latest value. Deduplicates: a variable updated N times per frame
 * results in a single notification with the final value.
 */
function flushNotifications(): void {
  flushScheduled = false

  perfBegin('dataLake:notifyListeners')
  for (const id of dirtyValueIds) {
    notifyDataLakeVariableListeners(id)
  }
  for (const id of dirtyTimestampIds) {
    if (!dirtyValueIds.has(id)) {
      notifyDataLakeVariableTimestampListeners(id)
    }
  }
  dirtyValueIds.clear()
  dirtyTimestampIds.clear()
  perfEnd('dataLake:notifyListeners')
}

export const setDataLakeVariableData = (id: string, data: string | number | boolean): void => {
  perfBegin('dataLake:setVariable')
  dataLakeVariableTimestamps[id] = performance.now()

  if (dataLakeVariableData[id] === data) {
    dirtyTimestampIds.add(id)
    scheduleFlush()
    perfEnd('dataLake:setVariable')
    return
  }

  dataLakeVariableData[id] = data

  if (dataLakeVariableInfo[id]?.persistValue) {
    savePersistentValues()
  }

  dirtyValueIds.add(id)
  scheduleFlush()
  perfEnd('dataLake:setVariable')
}

export const deleteDataLakeVariable = (id: string): void => {
  const variable = dataLakeVariableInfo[id]

  delete dataLakeVariableInfo[id]
  delete dataLakeVariableData[id]
  delete dataLakeVariableTimestamps[id]

  // If variable was persistent, remove it from the storage
  if (variable && variable.persistent) {
    savePersistentVariables()
  }

  // If variable had persistValue, update the persisted values
  if (variable && variable.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const listenDataLakeVariable = (
  variableId: string,
  listener: (value: string | number | boolean) => void,
  options?: ListenDataLakeVariableOptions
): string => {
  if (!dataLakeVariableListeners[variableId]) {
    dataLakeVariableListeners[variableId] = {}
  }
  const listenerId = uuid()
  dataLakeVariableListeners[variableId][listenerId] = {
    callback: listener,
    notifyOnTimestampChange: options?.notifyOnTimestampChange ?? false,
  }

  return listenerId
}

export const unlistenDataLakeVariable = (variableId: string, listenerId: string): void => {
  if (!dataLakeVariableListeners[variableId]) {
    console.warn(`No listeners found for variable with id '${variableId}'.`)
    return
  }
  if (!dataLakeVariableListeners[variableId][listenerId]) {
    console.warn(`No listener found with id '${listenerId}' for variable with id '${variableId}'.`)
    return
  }
  delete dataLakeVariableListeners[variableId][listenerId]
}

const notifyDataLakeVariableListeners = (id: string): void => {
  if (dataLakeVariableListeners[id]) {
    const value = dataLakeVariableData[id]
    if (value === undefined) return
    for (const [listenerId, listener] of Object.entries(dataLakeVariableListeners[id])) {
      try {
        listener.callback(value)
      } catch (error) {
        console.error(`[DataLake] Error in listener "${listenerId}" for variable "${id}":`, error)
      }
    }
  }
}

const notifyDataLakeVariableTimestampListeners = (id: string): void => {
  if (dataLakeVariableListeners[id]) {
    const value = dataLakeVariableData[id]
    if (value === undefined) return
    for (const [listenerId, listener] of Object.entries(dataLakeVariableListeners[id])) {
      if (!listener.notifyOnTimestampChange) continue
      try {
        listener.callback(value)
      } catch (error) {
        console.error(`[DataLake] Error in timestamp listener "${listenerId}" for variable "${id}":`, error)
      }
    }
  }
}

/**
 * Get the timestamp of the last update for a data lake variable
 * @param {string} id - The id of the variable
 * @returns {number | undefined} The timestamp (from performance.now()) or undefined if the variable has never been set
 */
export const getDataLakeVariableLastUpdateTimestamp = (id: string): number | undefined => {
  return dataLakeVariableTimestamps[id]
}

export const listenToDataLakeVariablesInfoChanges = (
  listener: (variables: Record<string, DataLakeVariable>) => void
): string => {
  const listenerId = uuid()
  dataLakeVariableInfoListeners[listenerId] = listener
  return listenerId
}

export const unlistenToDataLakeVariablesInfoChanges = (listenerId: string): void => {
  delete dataLakeVariableInfoListeners[listenerId]
}

// Debounce timer for variable info change notifications
let notifyInfoListenersTimeout: ReturnType<typeof setTimeout> | null = null
const notifyInfoDebounceMs = 1000

const notifyDataLakeVariableInfoListeners = (): void => {
  // Clear any pending notification
  if (notifyInfoListenersTimeout) {
    clearTimeout(notifyInfoListenersTimeout)
  }

  // Schedule a new notification after the debounce period
  notifyInfoListenersTimeout = setTimeout(() => {
    const updatedVariables = getAllDataLakeVariablesInfo()
    Object.entries(dataLakeVariableInfoListeners).forEach(([listenerId, listener]) => {
      try {
        listener(updatedVariables)
      } catch (error) {
        console.error(`[DataLake] Error in variable info listener "${listenerId}":`, error)
      }
    })
    notifyInfoListenersTimeout = null
  }, notifyInfoDebounceMs)
}

// Initialize by loading persistent variables
loadPersistentVariables()
