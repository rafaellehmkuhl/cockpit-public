import { createDataLakeVariable, DataLakeVariable, deleteDataLakeVariable, listenToDataLakeVariablesInfoChanges } from './data-lake'

const transformingFunctionsKey = 'cockpit-transforming-functions'

let globalTransformingFunctions: TransformingFunction[] = []

const loadTransformingFunctions = (): void => {
  const transformingFunctions = localStorage.getItem(transformingFunctionsKey)
  if (!transformingFunctions) {
    globalTransformingFunctions = []
    return
  }
  globalTransformingFunctions = JSON.parse(transformingFunctions)
}

const saveTransformingFunctions = (): void => {
  localStorage.setItem(transformingFunctionsKey, JSON.stringify(globalTransformingFunctions))
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
 * @param {string} name - Name of the new variable
 * @param {string} id - ID of the new variable
 * @param {string} type - Type of the new variable
 * @param {string} expression - Expression to calculate the variable's value
 * @param {string} description - Description of the new variable
 */
export const createTransformingFunction = (
  name: string,
  id: string,
  type: 'string' | 'number' | 'boolean',
  expression: string,
  description?: string
): void => {
  const transformingFunction: TransformingFunction = { name, id, type, expression, description }
  globalTransformingFunctions.push(transformingFunction)
  const dataLakeVariable = new DataLakeVariable(id, name, type, expression, description)
  createDataLakeVariable(dataLakeVariable)
  saveTransformingFunctions()
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
