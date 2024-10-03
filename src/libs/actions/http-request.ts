import {
  CockpitAction,
  CockpitActionsFunction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { getCockpitActionParameterData } from './data-lake'

/**
 * The types of HTTP methods that can be used.
 */
export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}
export const availableHttpRequestMethods: HttpRequestMethod[] = Object.values(HttpRequestMethod)

export type HttpRequestActionConfig = {
  /**
   * The name of the action.
   */
  name: string
  /**
   * The URL to send the request to.
   */
  url: string
  /**
   * The HTTP method to use.
   */
  method: HttpRequestMethod
  /**
   * The headers to send with the request.
   */
  headers: Record<string, string>
  /**
   * The URL parameters to send with the request.
   */
  urlParams: Record<string, string>
  /**
   * The body of the request.
   */
  body: string
}

let registeredHttpRequestActionConfigs: Record<string, HttpRequestActionConfig> = {}

export const registerHttpRequestActionConfig = (action: HttpRequestActionConfig): void => {
  const id = `http-request-action (${action.name})`
  registeredHttpRequestActionConfigs[id] = action
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const getHttpRequestActionConfig = (id: string): HttpRequestActionConfig | undefined => {
  return registeredHttpRequestActionConfigs[id]
}

export const getAllHttpRequestActionConfigs = (): Record<string, HttpRequestActionConfig> => {
  return registeredHttpRequestActionConfigs
}

export const deleteHttpRequestActionConfig = (id: string): void => {
  delete registeredHttpRequestActionConfigs[id]
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateHttpRequestActionConfig = (id: string, updatedAction: HttpRequestActionConfig): void => {
  registeredHttpRequestActionConfigs[id] = updatedAction
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateCockpitActions = (): void => {
  const httpResquestActions = getAllHttpRequestActionConfigs()
  console.log('httpResquestActions?')
  console.log(httpResquestActions)
  for (const [id, action] of Object.entries(httpResquestActions)) {
    console.log('action?')
    console.log(action)
    const cockpitAction = new CockpitAction(id as CockpitActionsFunction, action.name)
    registerNewAction(cockpitAction)
    registerActionCallback(cockpitAction, getHttpRequestActionCallback(id))
    console.log('cockpitAction?')
    console.log(cockpitAction)
  }
}

export const loadHttpRequestActionConfigs = (): void => {
  const savedActions = localStorage.getItem('cockpit-http-request-actions')
  if (savedActions) {
    registeredHttpRequestActionConfigs = JSON.parse(savedActions)
    console.log('registeredHttpRequestActionConfigs?')
    console.log(registeredHttpRequestActionConfigs)
  }
}

export const saveHttpRequestActionConfigs = (): void => {
  localStorage.setItem('cockpit-http-request-actions', JSON.stringify(registeredHttpRequestActionConfigs))
}

export type HttpRequestActionCallback = () => void

export const getHttpRequestActionCallback = (id: string): HttpRequestActionCallback => {
  const action = getHttpRequestActionConfig(id)
  if (!action) {
    throw new Error(`Action with id ${id} not found.`)
  }

  let parsedBody = action.body
  const parsedUrlParams = action.urlParams

  const cockpitInputsInBody = action.body.match(/{{\s*([^{}\s]+)\s*}}/g)
  if (cockpitInputsInBody) {
    for (const input of cockpitInputsInBody) {
      const inputData = getCockpitActionParameterData(input)
      if (inputData) {
        parsedBody = parsedBody.replace(input, inputData.toString())
      }
    }
  }

  const cockpitInputsInUrlParams = Object.values(action.urlParams).filter(
    (param) => typeof param === 'string' && param.startsWith('{{') && param.endsWith('}}')
  )
  if (cockpitInputsInUrlParams) {
    for (const input of cockpitInputsInUrlParams) {
      const inputData = getCockpitActionParameterData(input)
      if (inputData) {
        parsedUrlParams[input] = inputData.toString()
      }
    }
  }

  const url = new URL(action.url)

  url.search = new URLSearchParams(parsedUrlParams).toString()

  return () => {
    fetch(url, {
      method: action.method,
      headers: action.headers,
      body: parsedBody,
    })
  }
}

loadHttpRequestActionConfigs()
updateCockpitActions()
