import {
  createDataLakeVariable,
  deleteDataLakeVariable,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { evaluateDataLakeExpression } from '@/libs/actions/data-lake-transformations'
import { findDataLakeVariablesIdsInString } from '@/libs/utils-data-lake'
import type { PoiCoordinateSource } from '@/types/mission'

/**
 * Builds the data-lake variable id holding a POI's latitude.
 * @param {string} poiId - The POI id
 * @returns {string} The latitude variable id
 */
export const poiLatitudeVariableId = (poiId: string): string => `cockpit/pois/${poiId}/latitude`

/**
 * Builds the data-lake variable id holding a POI's longitude.
 * @param {string} poiId - The POI id
 * @returns {string} The longitude variable id
 */
export const poiLongitudeVariableId = (poiId: string): string => `cockpit/pois/${poiId}/longitude`

/**
 * A POI coordinate definition, used to keep the backing data-lake variables in sync.
 */
export interface PoiCoordinateDefinition {
  /** The POI id */
  id: string
  /** Latitude source: a static number or a data-lake expression */
  latitude: PoiCoordinateSource
  /** Longitude source: a static number or a data-lake expression */
  longitude: PoiCoordinateSource
}

/**
 * Tracks how a single POI coordinate is bound to its backing data-lake variable.
 */
interface CoordinateBinding {
  /** Id of the backing data-lake variable */
  variableId: string
  /** Active dependency listeners (only used for expression-based coordinates) */
  dependencyListeners: {
    /** Id of the dependency variable being listened to */
    variableId: string
    /** Listener handle returned by `listenDataLakeVariable` */
    listenerId: string
  }[]
  /** Signature of the bound source, used to skip redundant rebinds */
  signature: string
}

const coordinateBindings: Record<string, CoordinateBinding[]> = {}

const sourceSignature = (source: PoiCoordinateSource): string => `${typeof source}:${source}`

const evaluateExpression = (expression: string): number | undefined => {
  try {
    const value = evaluateDataLakeExpression(expression)
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value))
    return Number.isNaN(numericValue) ? undefined : numericValue
  } catch {
    // Expression can't be evaluated yet (e.g. a referenced variable has no value) - treat as unknown.
    return undefined
  }
}

const bindCoordinate = (variableId: string, name: string, source: PoiCoordinateSource): CoordinateBinding => {
  if (!getDataLakeVariableInfo(variableId)) {
    createDataLakeVariable({ id: variableId, name, type: 'number' })
  }

  // Static coordinate: write the fixed value once.
  if (typeof source === 'number') {
    setDataLakeVariableData(variableId, source)
    return { variableId, dependencyListeners: [], signature: sourceSignature(source) }
  }

  // Expression coordinate: re-evaluate whenever any referenced variable changes.
  const apply = (): void => {
    const value = evaluateExpression(source)
    if (value !== undefined) setDataLakeVariableData(variableId, value)
  }
  apply()

  const dependencyIds = [...new Set(findDataLakeVariablesIdsInString(source))]
  const dependencyListeners = dependencyIds.map((dependencyId) => ({
    variableId: dependencyId,
    listenerId: listenDataLakeVariable(dependencyId, apply),
  }))

  return { variableId, dependencyListeners, signature: sourceSignature(source) }
}

const releaseBinding = (binding: CoordinateBinding): void => {
  binding.dependencyListeners.forEach(({ variableId, listenerId }) => unlistenDataLakeVariable(variableId, listenerId))
}

/**
 * Removes the backing data-lake variables and listeners for a POI.
 * @param {string} poiId - The POI id
 */
export const unregisterPoiCoordinateVariables = (poiId: string): void => {
  const bindings = coordinateBindings[poiId]
  if (!bindings) return
  bindings.forEach(releaseBinding)
  delete coordinateBindings[poiId]
  deleteDataLakeVariable(poiLatitudeVariableId(poiId))
  deleteDataLakeVariable(poiLongitudeVariableId(poiId))
}

/**
 * Keeps the data-lake variables backing every POI's coordinates in sync with the given definitions.
 * Creates/updates variables and expression resolvers for current POIs, and removes the ones that no
 * longer exist. Safe to call repeatedly; bindings whose source is unchanged are left untouched.
 * @param {PoiCoordinateDefinition[]} pois - The current POI coordinate definitions
 */
export const syncPoiCoordinateVariables = (pois: PoiCoordinateDefinition[]): void => {
  const presentIds = new Set(pois.map((poi) => poi.id))

  Object.keys(coordinateBindings).forEach((poiId) => {
    if (!presentIds.has(poiId)) unregisterPoiCoordinateVariables(poiId)
  })

  pois.forEach((poi) => {
    const existing = coordinateBindings[poi.id]
    const latSignature = sourceSignature(poi.latitude)
    const lngSignature = sourceSignature(poi.longitude)

    if (existing && existing[0].signature === latSignature && existing[1].signature === lngSignature) {
      return
    }

    if (existing) existing.forEach(releaseBinding)

    coordinateBindings[poi.id] = [
      bindCoordinate(poiLatitudeVariableId(poi.id), `POI ${poi.id} latitude`, poi.latitude),
      bindCoordinate(poiLongitudeVariableId(poi.id), `POI ${poi.id} longitude`, poi.longitude),
    ]
  })
}
