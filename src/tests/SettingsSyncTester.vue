<template>
  <div class="settings-sync-tester">
    <h1 class="text-2xl font-bold mb-4">Settings Sync Tester</h1>

    <div class="controls mb-4">
      <button
        @click="executeAllTests"
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
        :disabled="isRunning"
      >
        {{ isRunning ? 'Running Tests...' : 'Run All Tests' }}
      </button>

      <button
        @click="resetResults"
        class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        :disabled="isRunning"
      >
        Clear Results
      </button>
    </div>

    <div v-if="isRunning" class="running-indicator mb-4">
      <div class="animate-pulse bg-blue-100 p-4 rounded">
        Testing in progress, please wait...
      </div>
    </div>

    <div v-if="results.length > 0" class="results">
      <h2 class="text-xl font-bold mb-2">Test Results</h2>

      <div v-for="(result, index) in results" :key="index" class="test-result mb-4 border rounded p-4" :class="{ 'border-green-500 bg-green-50': result.success, 'border-red-500 bg-red-50': !result.success }">
        <div class="flex justify-between">
          <h3 class="text-lg font-bold">{{ result.name }}</h3>
          <span class="status-badge px-2 py-1 rounded text-sm" :class="{ 'bg-green-500 text-white': result.success, 'bg-red-500 text-white': !result.success }">
            {{ result.success ? 'PASSED' : 'FAILED' }}
          </span>
        </div>

        <p class="description text-gray-700 mb-2">{{ result.description }}</p>
        <p class="message" :class="{ 'text-green-600': result.success, 'text-red-600': !result.success }">{{ result.message }}</p>

        <!-- State comparison -->
        <div class="state-comparison mt-4">
          <h4 class="font-bold mb-2">State Comparison</h4>

          <div class="grid grid-cols-2 gap-4">
            <div class="initial-state">
              <h5 class="font-bold text-sm text-gray-500 mb-1">Initial State</h5>

              <div class="mb-2">
                <h6 class="font-bold text-xs">Local Settings:</h6>
                <pre class="bg-gray-800 text-green-400 p-2 rounded overflow-auto max-h-60 text-xs">{{ formatJSON(result.initialState.localSettings) }}</pre>
              </div>

              <div>
                <h6 class="font-bold text-xs">Vehicle Settings:</h6>
                <pre class="bg-gray-800 text-green-400 p-2 rounded overflow-auto max-h-60 text-xs">{{ formatJSON(result.initialState.vehicleSettings) }}</pre>
              </div>
            </div>

            <div class="final-state">
              <h5 class="font-bold text-sm text-gray-500 mb-1">Final State</h5>

              <div class="mb-2">
                <h6 class="font-bold text-xs">Local Settings:</h6>
                <pre class="bg-gray-800 text-green-400 p-2 rounded overflow-auto max-h-60 text-xs">{{ formatJSON(result.finalState.localSettings) }}</pre>
              </div>

              <div>
                <h6 class="font-bold text-xs">Vehicle Settings:</h6>
                <pre class="bg-gray-800 text-green-400 p-2 rounded overflow-auto max-h-60 text-xs">{{ formatJSON(result.finalState.vehicleSettings) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!isRunning" class="no-results p-4 bg-gray-100 rounded">
      <p>No tests have been run yet. Click "Run All Tests" to start testing.</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import { type SettingsSyncTestResult, runAllTests } from './libs/settings-sync-tester'

export default defineComponent({
  name: 'SettingsSyncTester',
  setup() {
    const results = ref<SettingsSyncTestResult[]>([])
    const isRunning = ref(false)

    const executeAllTests = async (): Promise<void> => {
      isRunning.value = true
      try {
        results.value = await runAllTests()
      } catch (error) {
        console.error('Error running tests:', error)
      } finally {
        isRunning.value = false
      }
    }

    const resetResults = (): void => {
      results.value = []
    }

    const formatJSON = (value: any): string => {
      return JSON.stringify(value, null, 2)
    }

    return {
      results,
      isRunning,
      executeAllTests,
      resetResults,
      formatJSON
    }
  }
})
</script>

<style scoped>
.settings-sync-tester {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

pre {
  font-family: 'Courier New', Courier, monospace;
}
</style>