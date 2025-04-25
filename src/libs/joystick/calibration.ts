import { type JoystickCalibration } from '@/types/joystick'

/**
 * Apply deadband correction to a value
 * @param {number} value The raw input value (-1 to 1 or 0 to 1)
 * @param {number} threshold The deadband threshold (0 to 1)
 * @param {boolean} isZeroToOne Whether the value is in 0 to 1 range (true) or -1 to 1 range (false)
 * @returns {number} The corrected value (same range as input)
 */
export function applyDeadband(value: number, threshold: number, isZeroToOne = false): number {
  if (isZeroToOne) {
    if (value < threshold) {
      return 0
    }
    // Map the remaining range (threshold to 1) to (0 to 1)
    return (value - threshold) / (1 - threshold)
  } else {
    if (Math.abs(value) < threshold) {
      return 0
    }
    // Map the remaining range (threshold to 1) to (0 to 1)
    const sign = Math.sign(value)
    const absValue = Math.abs(value)
    return sign * ((absValue - threshold) / (1 - threshold))
  }
}

/**
 * Apply exponential scaling to a value
 * @param {number} value The raw input value (-1 to 1 or 0 to 1)
 * @param {number} factor The exponential factor (1.0 to 5.0)
 * @param {boolean} isZeroToOne Whether the value is in 0 to 1 range (true) or -1 to 1 range (false)
 * @returns {number} The corrected value (same range as input)
 */
export function applyExponential(value: number, factor: number, isZeroToOne = false): number {
  if (isZeroToOne) {
    return Math.pow(value, factor)
  } else {
    const sign = Math.sign(value)
    const absValue = Math.abs(value)
    return sign * Math.pow(absValue, factor)
  }
}

/**
 * Get the threshold for a specific input
 * @param {JoystickCalibration} calibration The calibration settings
 * @param {number} index The input index
 * @param {boolean} isButton Whether the input is a button (true) or axis (false)
 * @returns {number} The threshold value
 */
function getThreshold(calibration: JoystickCalibration, index: number, isButton: boolean): number {
  if (isButton) {
    const buttonConfig = calibration.deadband.thresholds.buttons.find(b => b.index === index)
    return buttonConfig?.threshold ?? 0.1
  } else {
    return calibration.deadband.thresholds.axes[index] ?? 0.1
  }
}

/**
 * Get the exponential factor for a specific input
 * @param {JoystickCalibration} calibration The calibration settings
 * @param {number} index The input index
 * @param {boolean} isButton Whether the input is a button (true) or axis (false)
 * @returns {number} The exponential factor
 */
function getFactor(calibration: JoystickCalibration, index: number, isButton: boolean): number {
  if (isButton) {
    const buttonConfig = calibration.exponential.factors.buttons.find(b => b.index === index)
    return buttonConfig?.factor ?? 1.0
  } else {
    return calibration.exponential.factors.axes[index] ?? 1.0
  }
}

/**
 * Apply all calibration corrections to a value
 * @param {number} value The raw input value (-1 to 1 or 0 to 1)
 * @param {JoystickCalibration} calibration The calibration settings
 * @param {boolean} isButton Whether the value is from a button (true) or axis (false)
 * @param {number} index The input index
 * @returns {number} The corrected value (same range as input)
 */
export function applyCalibration(
  value: number,
  calibration: JoystickCalibration,
  isButton: boolean,
  index: number
): number {
  let correctedValue = value

  if (calibration.deadband.enabled) {
    const threshold = getThreshold(calibration, index, isButton)
    correctedValue = applyDeadband(correctedValue, threshold, isButton)
  }

  if (calibration.exponential.enabled) {
    const factor = getFactor(calibration, index, isButton)
    correctedValue = applyExponential(correctedValue, factor, isButton)
  }

  return correctedValue
}
