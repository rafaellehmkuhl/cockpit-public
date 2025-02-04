/**
 * Custom action types
 */
export enum customActionTypes {
  httpRequest = 'http-request',
  mavlinkMessage = 'mavlink-message',
  javascript = 'javascript',
}

/**
 * Represents the configuration of a custom action
 */
export interface ActionConfig {
  /**
   * Action ID
   */
  id: string
  /**
   * Action name
   */
  name: string
  /**
   * Action type
   */
  type: customActionTypes
  /**
   * Action configuration
   * Specific to the action type
   */
  config: any
}
