import { diff } from 'jest-diff'
import { reactive, ref } from 'vue'

/**
 * Interface representing a version of the localStorage settings
 */
export interface VersionData {
  /**
   * The value of the settings at this version
   */
  value: any
  /**
   * Timestamp when this version was recorded
   */
  timestamp: number
}

// Constants
const LOCAL_STORAGE_KEY = 'cockpit-synced-settings'
const VERSIONS_STORAGE_KEY = 'cockpit-synced-settings-versions'

// Reactive state that stores all versions
export const versions = ref<VersionData[]>([])

// Cache for diffs to avoid recalculation
export const diffCache = reactive<Record<number, string>>({})

// Cache for change counts
export const changeCountCache = reactive<Record<number, { additions: number; removals: number }>>({})

// Interval ID for cleanup
let checkIntervalId: ReturnType<typeof setInterval> | null = null
let diffCalculationTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * Loads versions from localStorage
 */
const loadVersionsFromStorage = (): void => {
  try {
    const storedVersions = localStorage.getItem(VERSIONS_STORAGE_KEY)
    if (storedVersions) {
      const parsedVersions = JSON.parse(storedVersions) as VersionData[]
      // Only set if we have valid versions
      if (Array.isArray(parsedVersions) && parsedVersions.length > 0) {
        versions.value = parsedVersions
        console.log(`Loaded ${parsedVersions.length} versions from localStorage`)
        // Schedule diff calculations to be done in the background
        scheduleBackgroundDiffCalculations()
      }
    }
  } catch (error) {
    console.error('Failed to load versions from localStorage:', error)
  }
}

/**
 * Schedule background calculation of diffs to be done asynchronously
 * without blocking the main thread during app initialization
 */
const scheduleBackgroundDiffCalculations = (): void => {
  // Cancel any existing timeout
  if (diffCalculationTimeoutId !== null) {
    clearTimeout(diffCalculationTimeoutId)
  }

  // Schedule the calculation to happen after a short delay
  // This gives the app time to finish initializing before we
  // perform potentially expensive calculations
  diffCalculationTimeoutId = setTimeout(() => {
    precalculateAllDiffs()
  }, 500)
}

/**
 * Pre-calculate all diffs in the background
 * This is done in small batches to avoid blocking the main thread
 */
const precalculateAllDiffs = (): void => {
  if (versions.value.length <= 1) return

  const batchSize = 5 // Process 5 diffs at a time
  const totalVersions = versions.value.length - 1

  // Function to process a batch of diffs
  const processBatch = (startIndex: number) => {
    const endIndex = Math.min(startIndex + batchSize, totalVersions)

    for (let i = startIndex; i < endIndex; i++) {
      if (!diffCache[i]) {
        try {
          // Calculate consecutive diffs
          const diffResult = diff(
            versions.value[i].value,
            versions.value[i + 1].value,
            { expand: false, contextLines: 3 }
          )
          diffCache[i] = diffResult || ''

          // Also calculate change counts
          changeCountCache[i] = countChangesInDiff(diffCache[i])
        } catch (error) {
          console.error(`Error precalculating diff for version ${i}:`, error)
        }
      }
    }

    // If there are more batches to process, schedule the next batch
    if (endIndex < totalVersions) {
      setTimeout(() => processBatch(endIndex), 0)
    }
  }

  // Start processing from the first version
  processBatch(0)
}

/**
 * Saves versions to localStorage
 */
const saveVersionsToStorage = (): void => {
  try {
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions.value))
  } catch (error) {
    console.error('Failed to save versions to localStorage:', error)
  }
}

/**
 * Add a new version to the versions array
 * @param value - The value to add as a new version
 */
export const addNewVersion = (value: any): void => {
  const newVersion: VersionData = {
    value,
    timestamp: Date.now(),
  }

  // If it's the first time, add the initial version too
  if (versions.value.length === 0) {
    versions.value.push({...newVersion})
  }

  // Check if this version is different from the last one
  const lastVersion = versions.value[versions.value.length - 1]
  if (lastVersion && JSON.stringify(lastVersion.value) === JSON.stringify(value)) {
    // Skip duplicates
    return
  }

  const previousIndex = versions.value.length - 1
  versions.value.push(newVersion)
  saveVersionsToStorage()

  // Calculate diff for the new version immediately
  try {
    const diffResult = diff(
      versions.value[previousIndex].value,
      newVersion.value,
      { expand: false, contextLines: 3 }
    )
    diffCache[previousIndex] = diffResult || ''
    changeCountCache[previousIndex] = countChangesInDiff(diffCache[previousIndex])
  } catch (error) {
    console.error('Error calculating diff for new version:', error)
  }
}

/**
 * Clear all versions but keep the current value as first version
 */
export const clearVersions = (): void => {
  versions.value = []

  // Clear diff cache
  Object.keys(diffCache).forEach(key => delete diffCache[Number(key)])
  Object.keys(changeCountCache).forEach(key => delete changeCountCache[Number(key)])

  // Get the current value and add it as the first version
  const currentValue = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (currentValue) {
    try {
      addNewVersion(JSON.parse(currentValue))
    } catch (error) {
      console.error('Failed to parse localStorage value:', error)
    }
  }
}

/**
 * Clear all versions including persistent storage
 */
export const clearAllVersionsHistory = (): void => {
  versions.value = []
  localStorage.removeItem(VERSIONS_STORAGE_KEY)

  // Clear diff cache
  Object.keys(diffCache).forEach(key => delete diffCache[Number(key)])
  Object.keys(changeCountCache).forEach(key => delete changeCountCache[Number(key)])

  // Re-initialize with current value
  const currentValue = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (currentValue) {
    try {
      addNewVersion(JSON.parse(currentValue))
    } catch (error) {
      console.error('Failed to parse localStorage value:', error)
    }
  }
}

/**
 * Handler for localStorage changes
 * @param event - The storage event containing the changed data
 */
export const handleStorageChange = (event: StorageEvent): void => {
  if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
    try {
      const newValue = JSON.parse(event.newValue)
      addNewVersion(newValue)
    } catch (error) {
      console.error('Failed to parse localStorage value:', error)
    }
  }
}

/**
 * Generate diffs between the original version and all other versions
 * @returns Array of diff strings
 */
export const generateDiffs = (): (string | null)[] => {
  const result = []
  // Skip first version (index 0) and calculate diffs starting from version 1
  for (let i = 1; i < versions.value.length; i++) {
    const diffResult = diff(versions.value[0].value, versions.value[i].value, {
      expand: false,
      contextLines: 3,
    })
    result.push(diffResult)
  }
  return result
}

/**
 * Generate diffs between consecutive versions (each version compared to the previous one)
 * This will use the cache if available
 * @returns Array of diff strings
 */
export const generateConsecutiveDiffs = (): (string | null)[] => {
  const result = []
  // For each version (starting from version 1), compare with the previous version
  for (let i = 1; i < versions.value.length; i++) {
    const cacheIndex = i - 1

    // Use cached value if available
    if (diffCache[cacheIndex]) {
      result.push(diffCache[cacheIndex])
    } else {
      // Calculate and cache if not available
      const diffResult = diff(versions.value[i-1].value, versions.value[i].value, {
        expand: false,
        contextLines: 3,
      })
      diffCache[cacheIndex] = diffResult || ''
      result.push(diffResult)

      // Also calculate and cache the change count
      changeCountCache[cacheIndex] = countChangesInDiff(diffCache[cacheIndex])
    }
  }
  return result
}

/**
 * Get a specific diff from the cache, or calculate it if not available
 * @param index - The index of the version to get diff for
 * @returns The diff string
 */
export const getConsecutiveDiff = (index: number): string | null => {
  if (diffCache[index] !== undefined) {
    return diffCache[index]
  }

  if (index < 0 || index >= versions.value.length - 1) {
    return null
  }

  // Calculate and cache
  const diffResult = diff(versions.value[index].value, versions.value[index + 1].value, {
    expand: false,
    contextLines: 3,
  })

  diffCache[index] = diffResult || ''
  changeCountCache[index] = countChangesInDiff(diffCache[index])

  return diffResult
}

/**
 * Get the change count for a specific version
 * @param index - The index of the version to get change count for
 * @returns The additions and removals count
 */
export const getChangeCount = (index: number): { additions: number; removals: number } => {
  // Use cached value if available
  if (changeCountCache[index] !== undefined) {
    return changeCountCache[index]
  }

  // If diff is cached but count isn't, calculate count from cached diff
  if (diffCache[index] !== undefined) {
    const count = countChangesInDiff(diffCache[index])
    changeCountCache[index] = count
    return count
  }

  // If nothing is cached, get the diff first (which will also cache the count)
  getConsecutiveDiff(index)
  return changeCountCache[index] || { additions: 0, removals: 0 }
}

/**
 * Count changes in a diff result
 * @param diffString - The diff string to analyze
 * @returns Number of additions and removals
 */
export const countChangesInDiff = (diffString: string | null): { additions: number; removals: number } => {
  if (!diffString) return { additions: 0, removals: 0 }

  // Split the diff into lines
  const lines = diffString.split('\n')
  let additions = 0
  let removals = 0

  // Process each line
  for (const line of lines) {
    // Check if the line is a real content change, not a diff header or context
    if (line.startsWith('+') && !line.startsWith('+++') && !line.startsWith('++') && !line.startsWith('+@@')) {
      // Skip the header lines that are part of the diff format
      if (!line.startsWith('+---') && !line.match(/^\+\s*@@ /)) {
        additions++
      }
    } else if (line.startsWith('-') && !line.startsWith('---') && !line.startsWith('--') && !line.startsWith('-@@')) {
      // Skip the header lines that are part of the diff format
      if (!line.startsWith('-+++') && !line.match(/^-\s*@@ /)) {
        removals++
      }
    }
  }

  return { additions: additions - 1, removals: removals - 1 }
}

/**
 * Initialize the localStorage monitor
 */
export const initLocalStorageMonitor = (): void => {
  // Load previously saved versions
  loadVersionsFromStorage()

  // Register the storage event listener
  window.addEventListener('storage', handleStorageChange)

  // If we don't have any versions yet, get the initial value from localStorage
  if (versions.value.length === 0) {
    const initialValue = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (initialValue) {
      try {
        addNewVersion(JSON.parse(initialValue))
      } catch (error) {
        console.error('Failed to parse initial localStorage value:', error)
      }
    }
  }

  // Also check every second for changes that happen within the same tab
  // as the 'storage' event only fires for changes from other tabs
  checkIntervalId = setInterval(() => {
    const currentValue = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (currentValue && versions.value.length > 0) {
      try {
        const parsedValue = JSON.parse(currentValue)
        const lastVersion = versions.value[versions.value.length - 1].value

        // Simple deep comparison - good enough for this use case
        if (JSON.stringify(parsedValue) !== JSON.stringify(lastVersion)) {
          addNewVersion(parsedValue)
        }
      } catch (error) {
        console.error('Error checking for localStorage changes:', error)
      }
    }
  }, 1000)
}

/**
 * Cleanup the localStorage monitor
 */
export const cleanupLocalStorageMonitor = (): void => {
  // Remove the storage event listener
  window.removeEventListener('storage', handleStorageChange)

  // Clear the intervals
  if (checkIntervalId !== null) {
    clearInterval(checkIntervalId)
    checkIntervalId = null
  }

  if (diffCalculationTimeoutId !== null) {
    clearTimeout(diffCalculationTimeoutId)
    diffCalculationTimeoutId = null
  }
}

// Automatically initialize
initLocalStorageMonitor()