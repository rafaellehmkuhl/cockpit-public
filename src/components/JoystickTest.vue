<template>
  <div v-if="isElectron()" class="joystick-test">
    <div class="joystick-container">
      <div class="joystick-name">{{ currentDevice || 'No joystick connected' }}</div>
      <div class="joystick-visualization">
        <div class="joystick-stick" :style="stickStyle"></div>
      </div>
      <div class="joystick-buttons">
        <div v-for="(pressed, index) in currentState?.buttons" :key="index"
             :class="['button', { pressed }]">
          {{ index }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { isElectron } from '@/libs/utils'
import type { JoystickState } from '@/types/joystick'

const currentDevice = ref<string>('')
const currentState = ref<JoystickState | null>(null)

/**
 * Computed style for the joystick stick based on current state
 */
const stickStyle = computed(() => {
  if (!currentState.value) return {}

  const x = (currentState.value.axes[0] || 0) * 50
  const y = (currentState.value.axes[1] || 0) * 50

  return {
    transform: `translate(${x}px, ${y}px)`
  }
})

/**
 * Set up joystick state listener when component is mounted
 */
onMounted(() => {
  if (!isElectron() || !window.electronAPI) return

  window.electronAPI.onJoystickState((data: { deviceName: string, state: JoystickState }) => {
    currentDevice.value = data.deviceName
    currentState.value = data.state
  })
})

/**
 * Clean up event listeners when component is unmounted
 */
onUnmounted(() => {
  if (!isElectron() || !window.electronAPI) return
  // Clean up event listeners if needed
})
</script>

<style scoped>
.joystick-test {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 10px;
  color: white;
  font-family: monospace;
}

.joystick-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.joystick-name {
  font-size: 14px;
  margin-bottom: 10px;
}

.joystick-visualization {
  width: 100px;
  height: 100px;
  background: #333;
  border-radius: 50%;
  position: relative;
  margin: 10px 0;
}

.joystick-stick {
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: transform 0.1s ease-out;
}

.joystick-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-top: 10px;
}

.button {
  width: 30px;
  height: 30px;
  background: #444;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background-color 0.1s;
}

.button.pressed {
  background: #0f0;
}
</style>