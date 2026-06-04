import { type ComputedRef, type Ref, computed, reactive, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { poiLatitudeVariableId, poiLongitudeVariableId, syncPoiCoordinateVariables } from '@/libs/poi/poi-data-lake'
import type {
  PointOfInterest,
  PointOfInterestColor,
  PointOfInterestCoordinates,
  PointOfInterestIcon,
  ResolvedPointOfInterest,
} from '@/types/mission'

const pointsOfInterestKey = 'cockpit-points-of-interest'

/**
 * Legacy POI shapes that may exist in persisted storage and need migrating to the current model.
 */
interface LegacyPointOfInterest {
  /** Unique id */
  id: string
  /** Name */
  name: string
  /** Description */
  description: string
  /** Legacy fixed coordinates */
  coordinates?: PointOfInterestCoordinates
  /** Current-model latitude source */
  latitude?: number | string
  /** Current-model longitude source */
  longitude?: number | string
  /** Current-model fallback coordinates */
  fallbackCoordinates?: PointOfInterestCoordinates
  /** Experimental latitude expression from an older iteration */
  latitudeExpression?: number | string
  /** Experimental longitude expression from an older iteration */
  longitudeExpression?: number | string
  /** Experimental last known coordinates from an older iteration */
  lastKnownCoordinates?: PointOfInterestCoordinates
  /** Icon */
  icon: PointOfInterestIcon
  /** Color */
  color: PointOfInterestColor
  /** Timestamp */
  timestamp?: number
}

const migratePointOfInterest = (poi: LegacyPointOfInterest): PointOfInterest => {
  const legacyCoordinates = poi.coordinates ?? poi.lastKnownCoordinates ?? [0, 0]
  const latitude = poi.latitude ?? poi.latitudeExpression ?? legacyCoordinates[0]
  const longitude = poi.longitude ?? poi.longitudeExpression ?? legacyCoordinates[1]
  const fallbackCoordinates = poi.fallbackCoordinates ?? poi.lastKnownCoordinates ?? legacyCoordinates

  return {
    id: poi.id,
    name: poi.name,
    description: poi.description,
    latitude,
    longitude,
    fallbackCoordinates,
    icon: poi.icon,
    color: poi.color,
    timestamp: poi.timestamp ?? Date.now(),
  }
}

/**
 * Shared reactive state and actions for managing points of interest.
 */
interface PointsOfInterestState {
  /** Persisted POI definitions */
  pointsOfInterest: Ref<PointOfInterest[]>
  /** POIs with coordinates resolved from the data lake (consumed by the UI) */
  resolvedPointsOfInterest: ComputedRef<ResolvedPointOfInterest[]>
  /** Adds a new POI */
  addPointOfInterest: (poi: PointOfInterest) => void
  /** Updates an existing POI */
  updatePointOfInterest: (id: string, update: Partial<PointOfInterest>) => void
  /** Removes a POI */
  removePointOfInterest: (id: string) => void
  /** Moves a POI to a static position (used for drag interactions) */
  movePointOfInterest: (id: string, newCoordinates: PointOfInterestCoordinates) => void
}

let state: PointsOfInterestState | undefined

const createState = (): PointsOfInterestState => {
  const pointsOfInterest = useBlueOsStorage<PointOfInterest[]>(pointsOfInterestKey, [])

  // Migrate any legacy POIs to the current model (coordinates split into data-lake-backed sources).
  const migrated = (pointsOfInterest.value as unknown as LegacyPointOfInterest[]).map(migratePointOfInterest)
  if (JSON.stringify(migrated) !== JSON.stringify(pointsOfInterest.value)) {
    pointsOfInterest.value = migrated
  }

  // Live coordinate values mirrored from the data lake, keyed by variable id.
  const liveCoordinateValues = reactive<Record<string, number | undefined>>({})

  // Listeners this composable holds on each POI's own coordinate variables.
  const outputListeners: Record<
    string,
    {
      /** Id of the POI coordinate variable being listened to */
      variableId: string
      /** Listener handle returned by `listenDataLakeVariable` */
      listenerId: string
    }[]
  > = {}

  const mirrorLiveValue = (variableId: string): void => {
    const value = getDataLakeVariableData(variableId)
    liveCoordinateValues[variableId] = typeof value === 'number' ? value : undefined
  }

  const syncOutputListeners = (pois: PointOfInterest[]): void => {
    const presentIds = new Set(pois.map((poi) => poi.id))

    Object.keys(outputListeners).forEach((poiId) => {
      if (presentIds.has(poiId)) return
      outputListeners[poiId].forEach(({ variableId, listenerId }) => unlistenDataLakeVariable(variableId, listenerId))
      delete outputListeners[poiId]
      delete liveCoordinateValues[poiLatitudeVariableId(poiId)]
      delete liveCoordinateValues[poiLongitudeVariableId(poiId)]
    })

    pois.forEach((poi) => {
      if (outputListeners[poi.id]) return
      const latitudeVariableId = poiLatitudeVariableId(poi.id)
      const longitudeVariableId = poiLongitudeVariableId(poi.id)
      mirrorLiveValue(latitudeVariableId)
      mirrorLiveValue(longitudeVariableId)
      outputListeners[poi.id] = [
        {
          variableId: latitudeVariableId,
          listenerId: listenDataLakeVariable(latitudeVariableId, () => mirrorLiveValue(latitudeVariableId)),
        },
        {
          variableId: longitudeVariableId,
          listenerId: listenDataLakeVariable(longitudeVariableId, () => mirrorLiveValue(longitudeVariableId)),
        },
      ]
    })
  }

  watch(
    pointsOfInterest,
    (pois) => {
      syncPoiCoordinateVariables(pois)
      syncOutputListeners(pois)
    },
    { deep: true, immediate: true }
  )

  const resolvedPointsOfInterest = computed<ResolvedPointOfInterest[]>(() =>
    pointsOfInterest.value.map((poi) => {
      const latitudeVariableId = poiLatitudeVariableId(poi.id)
      const longitudeVariableId = poiLongitudeVariableId(poi.id)
      const isLiveTracked = typeof poi.latitude === 'string' || typeof poi.longitude === 'string'

      // Static POIs are positioned by their persisted definition directly, so drag edits apply
      // immediately without waiting on the data-lake round trip, and they are always valid.
      if (!isLiveTracked) {
        const coordinates: PointOfInterestCoordinates = [poi.latitude as number, poi.longitude as number]
        return { ...poi, coordinates, isLiveTracked, hasValidPosition: true, latitudeVariableId, longitudeVariableId }
      }

      const latitude = liveCoordinateValues[latitudeVariableId]
      const longitude = liveCoordinateValues[longitudeVariableId]
      const hasValidPosition = typeof latitude === 'number' && typeof longitude === 'number'
      const coordinates: PointOfInterestCoordinates = hasValidPosition
        ? [latitude as number, longitude as number]
        : poi.fallbackCoordinates

      return { ...poi, coordinates, isLiveTracked, hasValidPosition, latitudeVariableId, longitudeVariableId }
    })
  )

  const addPointOfInterest = (poi: PointOfInterest): void => {
    pointsOfInterest.value.push(poi)
  }

  const updatePointOfInterest = (id: string, update: Partial<PointOfInterest>): void => {
    const index = pointsOfInterest.value.findIndex((poi) => poi.id === id)
    if (index === -1) return
    pointsOfInterest.value[index] = { ...pointsOfInterest.value[index], ...update, timestamp: Date.now() }
  }

  const removePointOfInterest = (id: string): void => {
    const index = pointsOfInterest.value.findIndex((poi) => poi.id === id)
    if (index !== -1) pointsOfInterest.value.splice(index, 1)
  }

  const movePointOfInterest = (id: string, newCoordinates: PointOfInterestCoordinates): void => {
    updatePointOfInterest(id, {
      latitude: newCoordinates[0],
      longitude: newCoordinates[1],
      fallbackCoordinates: newCoordinates,
    })
  }

  return {
    pointsOfInterest,
    resolvedPointsOfInterest,
    addPointOfInterest,
    updatePointOfInterest,
    removePointOfInterest,
    movePointOfInterest,
  }
}

/**
 * Reactive access to the points of interest, with coordinates backed by the data lake.
 * State is created once and shared across all callers.
 * @returns {PointsOfInterestState} The shared points-of-interest state and actions
 */
export const usePointsOfInterest = (): PointsOfInterestState => {
  if (!state) state = createState()
  return state
}
