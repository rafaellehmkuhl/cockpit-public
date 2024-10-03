/**
 * A parameter for a Cockpit action
 * @param { string } name - The name of the parameter
 * @param { 'string' | 'number' | 'boolean' } type - The type of the parameter (string, number or boolean)
 * @param { string } description - What the parameter does or means
 * @param { string | number | boolean } defaultValue - The default value of the parameter
 * @param { boolean } required - Whether the parameter is required or not
 * @param { (string | number)[]? } options - The options for the parameter (only if type is string or number).
 * @param { number? } min - The minimum value for the parameter (only if type is number).
 * @param { number? } max - The maximum value for the parameter (only if type is number).
 */
class CockpitActionParameter {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  description?: string
  defaultValue?: string | number | boolean
  options?: (string | number)[]
  min?: number
  max?: number
  // eslint-disable-next-line jsdoc/require-jsdoc
  constructor(
    id: string,
    name: string,
    type: 'string' | 'number' | 'boolean',
    required: boolean,
    description?: string,
    defaultValue?: string | number | boolean,
    options?: (string | number)[],
    min?: number,
    max?: number
  ) {
    this.id = id
    this.name = name
    this.type = type
    this.description = description
    this.defaultValue = defaultValue
    this.required = required
    this.options = options
    this.min = min
    this.max = max
  }
}

const cockpitActionParametersInfo: Record<string, CockpitActionParameter> = {}
export const cockpitActionParametersData: Record<string, Record<string, string | number | boolean>> = {}

export const getCockpitActionParametersInfo = (id: string): CockpitActionParameter | undefined => {
  return cockpitActionParametersInfo[id]
}

export const getAllCockpitActionParametersInfo = (): Record<string, CockpitActionParameter> => {
  return cockpitActionParametersInfo
}

export const getCockpitActionParameterInfo = (id: string): CockpitActionParameter | undefined => {
  return cockpitActionParametersInfo[id]
}

export const setCockpitActionParameterInfo = (id: string, parameter: CockpitActionParameter): void => {
  cockpitActionParametersInfo[id] = parameter
}

export const getCockpitActionParameterData = (id: string): Record<string, string | number | boolean> | undefined => {
  return cockpitActionParametersData[id]
}

export const setCockpitActionParameterData = (id: string, data: Record<string, string | number | boolean>): void => {
  cockpitActionParametersData[id] = data
}

const placeholderParameterOneInfo = new CockpitActionParameter(
  'placeholderParameterOneInfo',
  'Placeholder Parameter One',
  'string',
  true,
  'This is a placeholder parameter for the first parameter'
)

const placeholderParameterTwoInfo = new CockpitActionParameter(
  'placeholderParameterTwoInfo',
  'Placeholder Parameter Two',
  'number',
  true,
  'This is a placeholder parameter for the second parameter',
  undefined,
  undefined,
  undefined,
  0,
  100
)

const placeholderParameterThreeInfo = new CockpitActionParameter(
  'placeholderParameterThreeInfo',
  'Placeholder Parameter Three',
  'boolean',
  true,
  'This is a placeholder parameter for the third parameter'
)

setCockpitActionParameterInfo(placeholderParameterOneInfo.id, placeholderParameterOneInfo)
setCockpitActionParameterInfo(placeholderParameterTwoInfo.id, placeholderParameterTwoInfo)
setCockpitActionParameterInfo(placeholderParameterThreeInfo.id, placeholderParameterThreeInfo)
