import { CockpitActionVariable, createCockpitActionVariable } from '@/libs/actions/data-lake'
import { JoystickProtocol } from '@/types/joystick'

/**
 * Interface representing a data lake action for joystick mapping
 */
export interface DataLakeAction {
  /** Protocol identifier */
  protocol: JoystickProtocol.DataLake
  /** Unique identifier for the variable */
  id: string
  /** Human readable name for the variable */
  name: string
  /** Type of the variable */
  variableType: 'string' | 'number' | 'boolean'
}

/**
 * Creates a new data lake action
 * @param {string} id - Unique identifier for the variable
 * @param {string} name - Human readable name for the variable
 * @param {'string' | 'number' | 'boolean'} type - Type of the variable
 * @returns {DataLakeAction} The created data lake action
 */
export const createDataLakeAction = (
  id: string,
  name: string,
  type: 'string' | 'number' | 'boolean'
): DataLakeAction => ({
  protocol: JoystickProtocol.DataLake,
  id,
  name,
  variableType: type,
})

/**
 * Creates a data lake variable if it doesn't exist
 * @param {DataLakeAction} action - The data lake action to create a variable for
 */
export const ensureDataLakeVariable = (action: DataLakeAction): void => {
  try {
    createCockpitActionVariable(
      new CockpitActionVariable(
        action.id,
        action.name,
        action.variableType,
        'Variable created for joystick input mapping'
      )
    )
  } catch (error) {
    // Variable already exists, ignore
  }
}

/**
 * Available data lake actions for joystick mapping
 */
export const dataLakeActions = {
  createBooleanVariable: (id: string, name: string): DataLakeAction => createDataLakeAction(id, name, 'boolean'),
  createNumberVariable: (id: string, name: string): DataLakeAction => createDataLakeAction(id, name, 'number'),
}
