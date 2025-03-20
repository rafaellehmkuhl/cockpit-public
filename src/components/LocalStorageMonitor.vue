<template>
  <div v-if="isOpen" class="local-storage-monitor">
    <div class="header">
      <h2>LocalStorage Monitor: cockpit-synced-settings</h2>
      <div class="version-info">
        <span>Total versions: {{ versions.length }}</span>
        <span class="monitor-note">(Persisted between app boots)</span>
        <v-btn density="compact" @click="clearVersions">Clear Versions</v-btn>
        <v-btn density="compact" color="warning" @click="clearAllHistory">Clear History</v-btn>
        <v-btn density="compact" color="error" @click="isOpen = false">Close</v-btn>
      </div>
    </div>

    <div v-if="versions.length > 1" class="versions-container">
      <div v-for="(version, displayIndex) in reversedVersions" :key="displayIndex" class="version-card">
        <div class="version-header" @click="toggleCollapse(displayIndex)">
          <div class="version-title">
            <h3>Version {{ versions.length - displayIndex - 1 }}</h3>
            <span
              class="change-count"
              v-if="getVersionChangeCount(displayIndex)"
              :title="`${getVersionChangeCount(displayIndex)?.additions} additions, ${getVersionChangeCount(displayIndex)?.removals} removals`"
            >
              <span class="additions">+{{ getVersionChangeCount(displayIndex)?.additions }}</span> /
              <span class="removals">-{{ getVersionChangeCount(displayIndex)?.removals }}</span>
            </span>
          </div>
          <div class="version-controls">
            <span class="timestamp">{{ formatTimestamp(version.timestamp) }}</span>
            <v-icon :icon="isVersionCollapsed(displayIndex) ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="small" />
          </div>
        </div>
        <transition name="collapse-expand">
          <div class="diff-content" v-show="!isVersionCollapsed(displayIndex)">
            <pre v-html="formatDiff(getVersionDiff(displayIndex))"></pre>
          </div>
        </transition>
      </div>
    </div>

    <div v-else class="no-changes">
      <p>No changes detected yet. Waiting for localStorage updates...</p>
    </div>
  </div>

  <!-- Open button that's always visible at the top right -->
  <div v-if="!isOpen" class="open-button-container">
    <v-btn
      color="primary"
      size="small"
      icon="mdi-database-search"
      @click="isOpen = true"
      class="open-button"
      :badge="versions.length > 1 ? versions.length - 1 : undefined"
      :badge-color="versions.length > 5 ? 'warning' : 'primary'"
    >
      <v-tooltip activator="parent" location="left">
        Open LocalStorage Monitor ({{ versions.length - 1 }} changes)
      </v-tooltip>
    </v-btn>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, reactive, ref, watch } from 'vue'
import { format } from 'date-fns'

import {
  clearAllVersionsHistory,
  clearVersions,
  getChangeCount,
  getConsecutiveDiff,
  versions
} from '@/libs/localStorage-monitor'

export default defineComponent({
  name: 'LocalStorageMonitor',
  setup() {
    const isOpen = ref(false) // Initially closed
    const isCollapsed = reactive<Record<number, boolean>>({}) // Track collapsed state of each diff

    /**
     * Reversed list of versions for display (excluding the initial version)
     * Latest versions will appear at the top of the list
     */
    const reversedVersions = computed(() => {
      return [...versions.value.slice(1)].reverse()
    })

    /**
     * Map to convert display index to actual version index
     * @param displayIndex - The index in the reversed display list
     * @returns The actual version index in the original list
     */
    const getVersionIndex = (displayIndex: number): number => {
      // Calculate the corresponding index in the original array
      // versions.length - 2 is the last index of versions.slice(1)
      // Then we subtract displayIndex to get the reverse mapping
      return versions.value.length - 2 - displayIndex
    }

    /**
     * Watch for new versions and initialize their collapsed state
     * This ensures that new versions are initially displayed expanded
     */
    watch(versions, (newVersions) => {
      if (newVersions.length > 1) {
        // Make sure the newest version is always expanded
        const latestVersionIndex = newVersions.length - 2
        isCollapsed[latestVersionIndex] = false
      }
    }, { immediate: true })

    // Compute change counts for each version using the pre-calculated values
    const changeCount = computed(() => {
      const counts: Record<number, { additions: number; removals: number }> = {}

      for (let i = 0; i < versions.value.length - 1; i++) {
        counts[i] = getChangeCount(i)
      }

      return counts
    })

    /**
     * Toggle the collapsed state of a diff section
     * @param displayIndex - The display index of the diff to toggle
     */
    const toggleCollapse = (displayIndex: number): void => {
      const versionIndex = getVersionIndex(displayIndex)
      isCollapsed[versionIndex] = !isCollapsed[versionIndex]
    }

    /**
     * Get the collapsed state for a version by its display index
     * @param displayIndex - The display index of the version
     * @returns Whether the version is collapsed
     */
    const isVersionCollapsed = (displayIndex: number): boolean => {
      const versionIndex = getVersionIndex(displayIndex)
      return !!isCollapsed[versionIndex]
    }

    /**
     * Get the diff for a version by its display index
     * @param displayIndex - The display index of the version
     * @returns The diff string
     */
    const getVersionDiff = (displayIndex: number): string | null => {
      const versionIndex = getVersionIndex(displayIndex)
      return getConsecutiveDiff(versionIndex)
    }

    /**
     * Get the change count for a version by its display index
     * @param displayIndex - The display index of the version
     * @returns The additions and removals count
     */
    const getVersionChangeCount = (displayIndex: number): { additions: number; removals: number } | undefined => {
      const versionIndex = getVersionIndex(displayIndex)
      return changeCount.value[versionIndex]
    }

    /**
     * Clear all version history including from persistent storage
     */
    const clearAllHistory = (): void => {
      if (confirm('Are you sure you want to clear all version history? This cannot be undone.')) {
        clearAllVersionsHistory()
      }
    }

    /**
     * Format timestamp to readable string
     * @param timestamp - The timestamp to format
     * @returns Formatted date string
     */
    const formatTimestamp = (timestamp: number): string => {
      return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')
    }

    /**
     * Format diff output with appropriate styling
     * @param diffString - The diff string to format
     * @returns HTML formatted diff string
     */
    const formatDiff = (diffString: string | null): string => {
      if (!diffString) return ''

      return diffString
        .replace(/^-/gm, '<span class="diff-removed">-</span>')
        .replace(/^[+]/gm, '<span class="diff-added">+</span>')
        .replace(/^@@/gm, '<span class="diff-info">@@</span>')
    }

    return {
      versions,
      reversedVersions,
      isVersionCollapsed,
      getVersionDiff,
      getVersionChangeCount,
      toggleCollapse,
      clearVersions,
      clearAllHistory,
      formatTimestamp,
      formatDiff,
      isOpen
    }
  }
})
</script>

<style scoped>
.local-storage-monitor {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 9999;
  font-family: monospace;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #444;
  margin-bottom: 20px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.versions-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.version-card {
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 16px;
  border-left: 3px solid #2196f3;
}

.version-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  padding: 5px;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.version-header:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.version-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.version-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-count {
  background-color: rgba(33, 150, 243, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  color: #d0d0d0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: help;
}

.additions {
  color: #4caf50;
  font-weight: bold;
}

.removals {
  color: #f44336;
  font-weight: bold;
}

.timestamp {
  color: #aaa;
  font-size: 0.8em;
}

.diff-content {
  background-color: #111;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  margin-top: 10px;
  transition: all 0.3s ease;
}

/* Transition styles for collapse/expand */
.collapse-expand-enter-active,
.collapse-expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 2000px;
  overflow: hidden;
}

.collapse-expand-enter-from,
.collapse-expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}

.no-changes {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  background-color: #1e1e1e;
  border-radius: 4px;
}

.open-button-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
}

.open-button {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

:deep(.diff-added) {
  color: #4caf50;
  font-weight: bold;
}

:deep(.diff-removed) {
  color: #f44336;
  font-weight: bold;
}

:deep(.diff-info) {
  color: #2196f3;
  font-weight: bold;
}

.monitor-note {
  font-size: 0.8em;
  color: #999;
  font-style: italic;
}
</style>