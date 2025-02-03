import {
  DataLakeVariable,
  getDataLakeVariableData,
  listenDataLakeVariable,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { createDataLakeVariable } from '@/libs/actions/data-lake'

export const setupCameraControlDataLakeAndActions = (): void => {
  // Initialize camera zoom variables
  createDataLakeVariable(new DataLakeVariable('camera-zoom', 'Camera Zoom', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-zoom-decrease', 'Camera Zoom Decrease', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-zoom-increase', 'Camera Zoom Increase', 'number'), 0)

  // Initialize camera focus variables
  createDataLakeVariable(new DataLakeVariable('camera-focus', 'Camera Focus', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-focus-decrease', 'Camera Focus Decrease', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-focus-increase', 'Camera Focus Increase', 'number'), 0)

  listenDataLakeVariable('camera-zoom-increase', (value) => {
    const cameraZoomDecrease = getDataLakeVariableData('camera-zoom-decrease')
    setDataLakeVariableData('camera-zoom', Number(value) - Number(cameraZoomDecrease))
  })
  listenDataLakeVariable('camera-zoom-decrease', (value) => {
    const cameraZoomIncrease = getDataLakeVariableData('camera-zoom-increase')
    setDataLakeVariableData('camera-zoom', Number(cameraZoomIncrease) - Number(value))
  })
  listenDataLakeVariable('camera-focus-increase', (value) => {
    const cameraFocusDecrease = getDataLakeVariableData('camera-focus-decrease')
    setDataLakeVariableData('camera-focus', Number(value) - Number(cameraFocusDecrease))
  })
  listenDataLakeVariable('camera-focus-decrease', (value) => {
    const cameraFocusIncrease = getDataLakeVariableData('camera-focus-increase')
    setDataLakeVariableData('camera-focus', Number(cameraFocusIncrease) - Number(value))
  })
}

export const setupDataLakeActions = (): void => {
  setupCameraControlDataLakeAndActions()
}
