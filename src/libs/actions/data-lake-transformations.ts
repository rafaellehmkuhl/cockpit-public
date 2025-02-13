import {
  findDataLakeVariablesIdsInString,
  getDataLakeVariableIdFromInput,
  replaceDataLakeInputsInString,
} from '../utils-data-lake'
import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  updateDataLakeVariableInfo,
} from './data-lake'

const transformingFunctionsKey = 'cockpit-transforming-functions'

let globalTransformingFunctions: TransformingFunction[] = []

const loadTransformingFunctions = (): void => {
  const transformingFunctions = localStorage.getItem(transformingFunctionsKey)
  if (!transformingFunctions) {
    globalTransformingFunctions = []
    return
  }
  globalTransformingFunctions = JSON.parse(transformingFunctions)
  updateTransformingFunctionListeners()
}

const saveTransformingFunctions = (): void => {
  localStorage.setItem(transformingFunctionsKey, JSON.stringify(globalTransformingFunctions))
  updateTransformingFunctionListeners()
}

const getExpressionValue = (func: TransformingFunction): string | number | boolean => {
  const expressionWithValues = replaceDataLakeInputsInString(func.expression)
  return eval(expressionWithValues)
}

const variablesListeners: Record<string, string[]> = {}

const nextDelayToEvaluateFaillingTransformingFunction: Record<string, number> = {}
const lastTimeTriedToEvaluateFaillingTransformingFunction: Record<string, number> = {}

const setupTransformingFunctionsListeners = (): void => {
  globalTransformingFunctions.forEach((func) => {
    const dataLakeVariablesInExpression = getDataLakeVariableIdFromInput(func.expression)
    if (dataLakeVariablesInExpression) {
      const variableIds = findDataLakeVariablesIdsInString(func.expression)
      variableIds.forEach((variableId) => {
        const listener = listenDataLakeVariable(variableId, () => {
          try {
            // If the function is failing, we don't want to evaluate it too often
            const currentDelay = nextDelayToEvaluateFaillingTransformingFunction[func.id] || 10
            const lastTimeTried = lastTimeTriedToEvaluateFaillingTransformingFunction[func.id] || 0
            if (currentDelay > 0 && lastTimeTried + currentDelay > Date.now()) {
              return
            } else {
              const expressionValue = getExpressionValue(func)
              setDataLakeVariableData(func.id, expressionValue)
            }
          } catch (error) {
            lastTimeTriedToEvaluateFaillingTransformingFunction[func.id] = Date.now()
            const currentDelay = nextDelayToEvaluateFaillingTransformingFunction[func.id] || 10
            const nextDelay = Math.min(2 * currentDelay, 10000)
            nextDelayToEvaluateFaillingTransformingFunction[func.id] = nextDelay
            const msg = `Error evaluating expression for transforming function '${func.id}'. Next evaluation in ${nextDelay} ms. Error: ${error}`
            console.error(msg)
          }
        })
        if (variablesListeners[func.id]) {
          variablesListeners[func.id].push(listener)
        } else {
          variablesListeners[func.id] = [variableId]
        }
      })
    }
  })
}

const deleteAllTransformingFunctionsListeners = (): void => {
  Object.keys(nextDelayToEvaluateFaillingTransformingFunction).forEach((funcId) => {
    delete nextDelayToEvaluateFaillingTransformingFunction[funcId]
    delete lastTimeTriedToEvaluateFaillingTransformingFunction[funcId]
  })
  Object.keys(lastTimeTriedToEvaluateFaillingTransformingFunction).forEach((funcId) => {
    delete lastTimeTriedToEvaluateFaillingTransformingFunction[funcId]
  })
  Object.keys(variablesListeners).forEach((funcId) => {
    variablesListeners[funcId].forEach((listenerId) => {
      unlistenDataLakeVariable(funcId, listenerId)
    })
  })
}

const setupAllTransformingFunctionsVariables = (): void => {
  globalTransformingFunctions.forEach((func) => {
    try {
      createDataLakeVariable(new DataLakeVariable(func.id, func.name, func.type, func.description))
    } catch (createError) {
      try {
        updateDataLakeVariableInfo(new DataLakeVariable(func.id, func.name, func.type, func.description))
      } catch (updateError) {
        const msg = `Could not create or update data lake variable info for transforming function ${func.id}. Error: ${updateError}`
        console.error(msg)
      }
    }
  })
}

const updateTransformingFunctionListeners = (): void => {
  deleteAllTransformingFunctionsListeners()
  setupAllTransformingFunctionsVariables()
  setupTransformingFunctionsListeners()
}

/**
 * Interface for a transforming function that creates a new data lake variable
 * based on an expression using other variables
 */
export interface TransformingFunction {
  /** Name of the new variable */
  name: string
  /** ID of the new variable */
  id: string
  /** Type of the new variable */
  type: 'string' | 'number' | 'boolean'
  /** Description of the new variable */
  description?: string
  /** JavaScript expression that defines how to calculate the new variable */
  expression: string
}

/**
 * Creates a new transforming function that listens to its dependencies
 * and updates its value when they change
 * @param {string} id - ID of the new variable
 * @param {string} name - Name of the new variable
 * @param {'string' | 'number' | 'boolean'} type - Type of the new variable
 * @param {string} expression - Expression to calculate the variable's value
 * @param {string?} description - Description of the new variable
 */
export const createTransformingFunction = (
  id: string,
  name: string,
  type: 'string' | 'number' | 'boolean',
  expression: string,
  description?: string
): void => {
  const transformingFunction: TransformingFunction = { name, id, type, expression, description }
  globalTransformingFunctions.push(transformingFunction)
  createDataLakeVariable(new DataLakeVariable(id, name, type, description))
  saveTransformingFunctions()
}

/**
 * Returns all transforming functions
 * @returns {TransformingFunction[]} All transforming functions
 */
export const getAllTransformingFunctions = (): TransformingFunction[] => {
  return globalTransformingFunctions
}

/**
 * Updates a transforming function
 * @param {TransformingFunction} func - The function to update
 */
export const updateTransformingFunction = (func: TransformingFunction): void => {
  const index = globalTransformingFunctions.findIndex((f) => f.id === func.id)
  if (index !== -1) {
    globalTransformingFunctions[index] = func
    saveTransformingFunctions()
  }
}

/**
 * Deletes a transforming function and cleans up its subscriptions
 * @param {TransformingFunction} func - The function to delete
 */
export const deleteTransformingFunction = (func: TransformingFunction): void => {
  // Remove the variable from the data lake
  globalTransformingFunctions = globalTransformingFunctions.filter((f) => f.id !== func.id)
  deleteDataLakeVariable(func.id)
  saveTransformingFunctions()
}

loadTransformingFunctions()
