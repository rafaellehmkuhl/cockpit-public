import { v4 as uuid } from 'uuid'

export type GenericVariableTag =
  | 'altitude'
  | 'depth'
  | 'position'
  | 'temperature'
  | 'pressure'
  | 'speed'
  | 'distance'
  | 'orientation'
  | 'pitch'
  | 'roll'
  | 'yaw'
  | 'angular-velocity'
  | 'acceleration'
  | 'heading'
  | 'angle'
  | 'time'
  | 'power'
  | 'voltage'
  | 'current'
  | 'charge'

export type GenericVariable = {
  /**
   * Tags associated with the variable.
   * Those tags can be used to filter the variables.
   */
  tags: GenericVariableTag[]
  /**
   * Object with those listening for changes on the variable.
   * Those listeners will be called when the variable is updated.
   * So we don't call listeners that do not need to listen anymore, we identify each one to allow it's remotion.
   */
  listeners: {
    /**
     * Unique identifier for the listener.
     */
    id: string
    /**
     * Callback function to be called when the variable is updated.
     */
    callback: (value: unknown) => void
  }[]
}

export type GenericVariables = {
  [key in string]: GenericVariable
}

export const genericVariables: GenericVariables = {}
// export const genericVariablesListUpdateListeners: GenericVariables = {}

export const listenGenericVariable = (path: string, callback: (value: unknown) => void): string => {
  if (!path) throw new Error('Path is required')

  if (!genericVariables[path]) {
    genericVariables[path] = { tags: [], listeners: [] }
  }

  const id = uuid()
  genericVariables[path].listeners.push({ id, callback })

  return id
}

export const unlistenGenericVariable = (id: string): void => {
  const variablePath = Object.keys(genericVariables).find((path) =>
    genericVariables[path].listeners.some((l) => l.id === id)
  )
  if (!variablePath) return

  genericVariables[variablePath].listeners = genericVariables[variablePath].listeners.filter((l) => l.id !== id)
}

export const setGenericVariable = (path: string, value: unknown, tags?: GenericVariableTag[]): void => {
  if (!path) throw new Error('Path is required')

  if (!genericVariables[path]) {
    genericVariables[path] = { tags: tags ?? [], listeners: [] }
  } else if (tags) {
    genericVariables[path].tags = [...genericVariables[path].tags, ...tags]
  }

  genericVariables[path].listeners.forEach((listener) => listener.callback(value))
}

export const filterForTags = (variables: GenericVariables, tags: GenericVariableTag[]): string[] => {
  return Object.keys(variables).filter((path) => tags.every((tag) => variables[path].tags.includes(tag)))
}

export const availableGenericVariables = (tags: GenericVariableTag[]): string[] => {
  return Object.keys(genericVariables).filter((path) => tags.every((tag) => genericVariables[path].tags.includes(tag)))
}
