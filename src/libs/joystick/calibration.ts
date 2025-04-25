import { type JoystickCalibration } from '@/types/joystick'

/**
 * Apply deadband correction to a value
 * @param {number} value The raw input value (-1 to 1)
 * @param {number} threshold The deadband threshold (0 to 1)
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyDeadband(value: number, threshold: number): number {
  if (Math.abs(value) < threshold) {
    return 0
  }
  // Map the remaining range (threshold to 1) to (0 to 1)
  const sign = Math.sign(value)
  const absValue = Math.abs(value)
  return sign * ((absValue - threshold) / (1 - threshold))
}

/**
 * Apply exponential scaling to a value
 * @param {number} value The raw input value (-1 to 1)
 * @param {number} factor The exponential factor (1.0 to 5.0)
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyExponential(value: number, factor: number): number {
  const sign = Math.sign(value)
  const absValue = Math.abs(value)
  return sign * Math.pow(absValue, factor)
}

/**
 * Apply all calibration corrections to a value
 * @param {number} value The raw input value (-1 to 1)
 * @param {JoystickCalibration} calibration The calibration settings
 * @returns {number} The corrected value (-1 to 1)
 */
export function applyCalibration(value: number, calibration: JoystickCalibration): number {
  let correctedValue = value

  if (calibration.deadband.enabled) {
    correctedValue = applyDeadband(correctedValue, calibration.deadband.thresholds[0])
  }

  if (calibration.exponential.enabled) {
    correctedValue = applyExponential(correctedValue, calibration.exponential.factors[0])
  }

  return correctedValue
}
