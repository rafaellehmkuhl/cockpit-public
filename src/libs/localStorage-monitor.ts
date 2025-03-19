import { diff } from 'jest-diff'
import { ref } from 'vue'

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

// Interval ID for cleanup
let checkIntervalId: ReturnType<typeof setInterval> | null = null

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
      }
    }
  } catch (error) {
    console.error('Failed to load versions from localStorage:', error)
  }
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

  versions.value.push(newVersion)
  saveVersionsToStorage()
}

/**
 * Clear all versions but keep the current value as first version
 */
export const clearVersions = (): void => {
  versions.value = []

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
 * @returns Array of diff strings
 */
export const generateConsecutiveDiffs = (): (string | null)[] => {
  const result = []
  // For each version (starting from version 1), compare with the previous version
  for (let i = 1; i < versions.value.length; i++) {
    const diffResult = diff(versions.value[i-1].value, versions.value[i].value, {
      expand: false,
      contextLines: 3,
    })
    result.push(diffResult)
  }
  return result
}

/**
 * Count changes in a diff result
 * @param diffString - The diff string to analyze
 * @returns Number of additions and removals
 */
export const countChangesInDiff = (diffString: string | null): { additions: number; removals: number } => {
  if (!diffString) return { additions: 0, removals: 0 }

  // Count lines starting with + (but not ++, +-, or +@)
  const additions = (diffString.match(/^\+(?![\+\-@])/gm) || []).length
  // Count lines starting with - (but not -+, --, or -@)
  const removals = (diffString.match(/^\-(?![\+\-@])/gm) || []).length

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

  // Clear the interval
  if (checkIntervalId !== null) {
    clearInterval(checkIntervalId)
    checkIntervalId = null
  }
}

// Automatically initialize
initLocalStorageMonitor()