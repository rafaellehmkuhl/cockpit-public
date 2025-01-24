/**
 * Available joystick protocols.
 * Each protocol is expected to have it's own way of doing thing, including mapping, limiting, communicating, etc.
 */
export enum JoystickProtocol {
  CockpitModifierKey = 'cockpit-modifier-key',
  MAVLinkManualControl = 'mavlink-manual-control',
  CockpitAction = 'cockpit-action',
  Other = 'other',
}

/**
 * Modifier keys
 */
export enum CockpitModifierKeyOption {
  regular = 'regular',
  shift = 'shift',
}

/**
 * Current state of joystick inputs
 */
export interface JoystickState {
  /**
   * Joystick buttons state
   */
  buttons: (number | undefined)[]
  /**
   * Joystick axes state
   */
  axes: (number | undefined)[]
}


/**
 *
 */
export interface ProtocolAction {
  /**
   * Protocol that holds the action
   */
  protocol: JoystickProtocol
  /**
   * Action identification
   */
  id: string
  /**
   * Human-readable name for the action
   */
  name: string
}

/**
 * Correspondency between the hardware axis input and the protocol action that should be triggered by it
 */
export type JoystickAxisActionCorrespondency = {
  /**
   * The ID of the axis that holds the correspondent action
   */
  [key in number]: {
    /**
     * The protocol action that should be triggered
     */
    action: ProtocolAction
    /**
     * The
     */
    min: number
    /**
     * Maximum axis value
     */
    max: number
  }
}

/**
 * Correspondency between the hardware button input and the protocol action that should be triggered by it
 */
export type JoystickButtonActionCorrespondency = {
  /**
   * The ID of the button that holds the correspondent action
   */
  [key in number]: {
    /**
     * The protocol action that should be triggered
     */
    action: ProtocolAction
    /**
     * User's custom label for the button
     */
    label?: string
  }
}

/**
 * Interface that represents the necessary information for mapping a Gamepad API controller to a specific protocol.
 */
export interface JoystickProtocolActionsMapping {
  /**
   *  Name to help identification of a mapping profile
   */
  name: string
  /**
   * Unique identifier for the mapping
   */
  hash: string
  /**
   * Correspondency from Gamepad API to protocol axis.
   * Corresponds to which Axis in the protocol should the Nth axis be mapped to.
   */
  axesCorrespondencies: JoystickAxisActionCorrespondency
  /**
   * Correspondency from Gamepad API to protocol button.
   * Corresponds to which button in the protocol should the Nth button be mapped to.
   */
  buttonsCorrespondencies: {
    /**
     * Defines the buttons correspondencies for each modifier key
     */
    [key in CockpitModifierKeyOption]: JoystickButtonActionCorrespondency
  }
}

export type GamepadToCockpitButtonCorrespondency = {
  /**
   * The index of the button in the Gamepad API input array
   */
  indexInGamepadAPI: number | null
  /**
   * The id of the button in the Cockpit standard
   */
  idInCockpitStd: JoystickButton
}

export type GamepadToCockpitAxisCorrespondency = {
  /**
   * The index of the axis in the Gamepad API input array
   */
  indexInGamepadAPI: number | null
  /**
   * The id of the axis in the Cockpit standard
   */
  idInCockpitStd: JoystickAxis
}

/**
 * This interface defines the mapping for a specific controller from the Gamepad API to Cockpit's standard.
 */
export interface GamepadToCockpitStdMapping {
  /**
   * Correspondency from Gamepad API to Cockpit standard axes.
   */
  axes: GamepadToCockpitAxisCorrespondency[]
  /**
   * Correspondency from Gamepad API to Cockpit standard buttons.
   */
  buttons: GamepadToCockpitButtonCorrespondency[]
}

/**
 * Buttons for PS4 controller
 */
export enum JoystickButton {
  B0 = 0, // Bottom button in right cluster
  B1 = 1, // Right button in right cluster
  B2 = 2, // Left button in right cluster
  B3 = 3, // Top button in right cluster
  B4 = 4, // Top left front button
  B5 = 5, // Top right front button
  B6 = 6, // Bottom left front button
  B7 = 7, // Bottom right front button
  B8 = 8, // Left button in center cluster
  B9 = 9, // Right button in center cluster
  B10 = 10, // Left stick pressed button
  B11 = 11, // Right stick pressed button
  B12 = 12, // Top button in left cluster
  B13 = 13, // Bottom button in left cluster
  B14 = 14, // Left button in left cluster
  B15 = 15, // Right button in left cluster
  B16 = 16, // Center button in center cluster
  B17 = 17, // 	Extra non-standard buttons
  B18 = 18, // 	Extra non-standard buttons
  B19 = 19, // 	Extra non-standard buttons
  B20 = 20, // 	Extra non-standard buttons
  B21 = 21, // 	Extra non-standard buttons
  B22 = 22, // 	Extra non-standard buttons
  B23 = 23, // 	Extra non-standard buttons
  B24 = 24, // 	Extra non-standard buttons
  B25 = 25, // 	Extra non-standard buttons
  B26 = 26, // 	Extra non-standard buttons
  B27 = 27, // 	Extra non-standard buttons
  B28 = 28, // 	Extra non-standard buttons
  B29 = 29, // 	Extra non-standard buttons
  B30 = 30, // 	Extra non-standard buttons
  B31 = 31, // 	Extra non-standard buttons
}

/**
 * Joystick axis
 */
export enum JoystickAxis {
  A0 = 0, // Horizontal axis for left stick (negative left/positive right)
  A1 = 1, // Vertical axis for left stick (negative up/positive down)
  A2 = 2, // Horizontal axis for right stick (negative left/positive right)
  A3 = 3, // Vertical axis for right stick (negative up/positive down)
  A4 = 4, // Left trigger (positive pressed)
  A5 = 5, // Right trigger (positive pressed)
  A6 = 6, // Horizontal axis for D-pad (negative left/positive right)
  A7 = 7, // Vertical axis for D-pad (negative up/positive down)
  A8 = 8, // Extra non-standard axes
  A9 = 9, // Extra non-standard axes
  A10 = 10, // Extra non-standard axes
  A11 = 11, // Extra non-standard axes
  A12 = 12, // Extra non-standard axes
  A13 = 13, // Extra non-standard axes
  A14 = 14, // Extra non-standard axes
  A15 = 15, // Extra non-standard axes
  A16 = 16, // Extra non-standard axes
  A17 = 17, // Extra non-standard axes
  A18 = 18, // Extra non-standard axes
  A19 = 19, // Extra non-standard axes
  A20 = 20, // Extra non-standard axes
  A21 = 21, // Extra non-standard axes
  A22 = 22, // Extra non-standard axes
  A23 = 23, // Extra non-standard axes
  A24 = 24, // Extra non-standard axes
  A25 = 25, // Extra non-standard axes
  A26 = 26, // Extra non-standard axes
  A27 = 27, // Extra non-standard axes
  A28 = 28, // Extra non-standard axes
  A29 = 29, // Extra non-standard axes
  A30 = 30, // Extra non-standard axes
  A31 = 31, // Extra non-standard axes
}

/**
 * Possible inputs types coming from a joystick
 */
export enum InputType {
  Unknown = 'unknown',
  Axis = 'axis',
  Button = 'button',
}

/**
 * Possible joystick input
 */
export interface JoystickInput {
  /**
   * Input type (Axis or Button)
   */
  type: InputType.Axis | InputType.Button
  /**
   * Input identification
   */
  id: JoystickAxis | JoystickButton
}

/**
 * Joystick actions
 */
export interface JoystickAction {
  /**
   * Action identification
   */
  name: string
  /**
   * Action's protocol
   */
  protocol: string
  /**
   * Action's id
   */
  id: string
  [key: string]: string
}

/**
 * Joystick button input
 */
export class JoystickButtonInput implements JoystickInput {
  readonly type = InputType.Button
  /**
   * Create an axis input
   * @param {JoystickAxis} id Axis identification
   */
  constructor(public id: JoystickButton) {}
}

/**
 * Joystick axis input
 */
export class JoystickAxisInput implements JoystickInput {
  readonly type = InputType.Axis
  /**
   * Create an axis input
   * @param {JoystickAxis} id Axis identification
   */
  constructor(public id: JoystickAxis) {}
}
