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
      <div v-for="(version, index) in versions.slice(1)" :key="index" class="version-card">
        <div class="version-header" @click="toggleCollapse(index)">
          <div class="version-title">
            <h3>Version {{ index + 1 }}</h3>
            <span class="change-count" v-if="changeCount[index]">
              +{{ changeCount[index].additions }} / -{{ changeCount[index].removals }}
            </span>
          </div>
          <div class="version-controls">
            <span class="timestamp">{{ formatTimestamp(version.timestamp) }}</span>
            <v-icon :icon="isCollapsed[index] ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="small" />
          </div>
        </div>
        <transition name="collapse-expand">
          <div class="diff-content" v-show="!isCollapsed[index]">
            <pre v-html="formatDiff(consecutiveDiffs[index])"></pre>
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
  countChangesInDiff,
  generateConsecutiveDiffs,
  versions
} from '@/libs/localStorage-monitor'

export default defineComponent({
  name: 'LocalStorageMonitor',
  setup() {
    const isOpen = ref(false) // Initially closed
    const isCollapsed = reactive<Record<number, boolean>>({}) // Track collapsed state of each diff

    // Get consecutive diffs from the localStorage monitor
    const consecutiveDiffs = computed(() => generateConsecutiveDiffs())

    /**
     * Watch for new versions and initialize their collapsed state
     * This ensures that new versions are initially displayed expanded
     */
    watch(versions, (newVersions) => {
      for (let i = 1; i < newVersions.length; i++) {
        if (isCollapsed[i-1] === undefined) {
          isCollapsed[i-1] = false // Initialize as expanded
        }
      }
    }, { immediate: true })

    // Compute change counts for each version
    const changeCount = computed(() => {
      const counts: Record<number, { additions: number; removals: number }> = {}

      consecutiveDiffs.value.forEach((diff, index) => {
        counts[index] = countChangesInDiff(diff)
      })

      return counts
    })

    /**
     * Toggle the collapsed state of a diff section
     * @param index - The index of the diff to toggle
     */
    const toggleCollapse = (index: number): void => {
      isCollapsed[index] = !isCollapsed[index]
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
      consecutiveDiffs,
      changeCount,
      isCollapsed,
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
  background-color: rgba(33, 150, 243, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  color: #2196f3;
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