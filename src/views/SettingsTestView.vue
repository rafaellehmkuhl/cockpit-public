<template>
  <div class="settings-test-view">
    <SettingsSyncTester />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { createTestVehicle, installMocks } from '../tests/libs/install-mocks'
import SettingsSyncTester from '../tests/SettingsSyncTester.vue'

export default defineComponent({
  name: 'SettingsTestView',
  components: {
    SettingsSyncTester
  },
  setup() {
    // Install mocks when component is mounted
    installMocks()

    // Create a test vehicle
    createTestVehicle()

    return {}
  }
})
</script>

<style scoped>
.settings-test-view {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  background-color: #f9f9f9;
}
</style>