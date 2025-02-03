import { getDataLakeVariableData, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { DataLakeVariable } from '@/libs/actions/data-lake'
import { createDataLakeVariable } from '@/libs/actions/data-lake'

import { availableCockpitActions, registerActionCallback } from './cockpit-actions'

export const setupCameraControlDataLakeAndActions = (): void => {
  // Initialize camera control variables
  createDataLakeVariable(new DataLakeVariable('camera-zoom', 'Camera Zoom', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-zoom-decrease', 'Camera Zoom Decrease', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-zoom-increase', 'Camera Zoom Increase', 'number'), 0)

  createDataLakeVariable(new DataLakeVariable('camera-focus', 'Camera Focus', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-focus-decrease', 'Camera Focus Decrease', 'number'), 0)
  createDataLakeVariable(new DataLakeVariable('camera-focus-increase', 'Camera Focus Increase', 'number'), 0)

  // Create actions that combine the values of the variables
  registerActionCallback(availableCockpitActions.set_camera_zoom, () => {
    const zoomIncrease = getDataLakeVariableData('camera-zoom-increase')
    const zoomDecrease = getDataLakeVariableData('camera-zoom-decrease')
    const finalZoom = (Number(zoomIncrease) ?? 0) - (Number(zoomDecrease) ?? 0)
    console.log(`Setting camera zoom to ${finalZoom}`)
    setDataLakeVariableData('camera-zoom', finalZoom)
  })

  registerActionCallback(availableCockpitActions.set_camera_focus, () => {
    const focusIncrease = getDataLakeVariableData('camera-focus-increase')
    const focusDecrease = getDataLakeVariableData('camera-focus-decrease')
    const finalFocus = (Number(focusIncrease) ?? 0) - (Number(focusDecrease) ?? 0)
    console.log(`Setting camera focus to ${finalFocus}`)
    setDataLakeVariableData('camera-focus', finalFocus)
  })
}