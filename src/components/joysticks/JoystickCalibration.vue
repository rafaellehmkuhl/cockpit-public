<template>
  <div class="flex flex-col items-start px-5 font-medium">
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <v-checkbox v-model="calibrationOptions.deadband" density="compact" hide-details class="mt-0" />
          <span>Deadband/Deadzone</span>
        </div>
        <v-btn
          v-if="calibrationOptions.deadband"
          variant="text"
          class="text-blue-400"
          @click="openCalibrationModal('deadband')"
        >
          Calibrate Deadband
        </v-btn>
      </div>

      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <v-checkbox v-model="calibrationOptions.circleCorrection" density="compact" hide-details class="mt-0" />
          <span>Circle Correction</span>
        </div>
        <v-btn
          v-if="calibrationOptions.circleCorrection"
          variant="text"
          class="text-blue-400"
          @click="openCalibrationModal('circle')"
        >
          Calibrate Circle
        </v-btn>
      </div>

      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <v-checkbox v-model="calibrationOptions.exponential" density="compact" hide-details class="mt-0" />
          <span>Exponential Scaling</span>
        </div>
        <v-btn
          v-if="calibrationOptions.exponential"
          variant="text"
          class="text-blue-400"
          @click="openCalibrationModal('exponential')"
        >
          Calibrate Exponential
        </v-btn>
      </div>
    </div>
  </div>

  <teleport to="body">
    <InteractionDialog v-model="showCalibrationModal" max-width="500px" variant="text-only" persistent>
      <template #title>
        <div class="flex justify-center w-full font-bold mt-1">
          {{ calibrationModalTitle }}
        </div>
      </template>
      <template #content>
        <div class="flex flex-col items-center gap-4 p-4">
          <p class="text-center">{{ calibrationModalInstructions }}</p>
          <div v-if="currentCalibrationType === 'deadband'" class="w-full">
            <p class="text-sm text-gray-400 mb-2">
              Move the joystick to its center position and hold it there for 3 seconds
            </p>
            <v-progress-linear v-model="calibrationProgress" color="blue" height="4" striped class="w-full" />
          </div>
          <div v-if="currentCalibrationType === 'circle'" class="w-full">
            <p class="text-sm text-gray-400 mb-2">Move the joystick in a full circle pattern</p>
            <div class="w-full h-40 flex items-center justify-center">
              <div class="w-32 h-32 border-2 border-blue-400 rounded-full relative">
                <div
                  class="w-4 h-4 bg-blue-400 rounded-full absolute"
                  :style="{
                    left: `${50 + joystickPosition.x * 50}%`,
                    top: `${50 + joystickPosition.y * 50}%`,
                    transform: 'translate(-50%, -50%)',
                  }"
                />
              </div>
            </div>
          </div>
          <div v-if="currentCalibrationType === 'exponential'" class="w-full">
            <p class="text-sm text-gray-400 mb-2">Move the joystick to its maximum range in each direction</p>
            <div class="flex justify-between w-full">
              <div class="w-1/2 pr-2">
                <p class="text-xs text-gray-400 mb-1">Left/Right</p>
                <v-progress-linear v-model="exponentialProgress.x" color="blue" height="4" striped class="w-full" />
              </div>
              <div class="w-1/2 pl-2">
                <p class="text-xs text-gray-400 mb-1">Up/Down</p>
                <v-progress-linear v-model="exponentialProgress.y" color="blue" height="4" striped class="w-full" />
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end w-full gap-2">
          <v-btn variant="text" @click="cancelCalibration">Cancel</v-btn>
          <v-btn variant="text" color="primary" :disabled="!isCalibrationComplete" @click="finishCalibration">
            Finish
          </v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useControllerStore } from '@/stores/controller'
import { type Joystick, JoystickAxis } from '@/types/joystick'

const controllerStore = useControllerStore()
const currentJoystick = computed<Joystick | undefined>(() => {
  if (!controllerStore.joysticks || controllerStore.joysticks.size <= 0) return undefined
  const entry = controllerStore.joysticks.entries().next()
  return entry.done ? undefined : entry.value[1]
})

const showCalibrationModal = ref(false)
const currentCalibrationType = ref<'deadband' | 'circle' | 'exponential'>('deadband')
const calibrationProgress = ref(0)
const exponentialProgress = ref({ x: 0, y: 0 })
const joystickPosition = ref({ x: 0, y: 0 })
const isCalibrationComplete = ref(false)

const calibrationOptions = ref({
  deadband: false,
  circleCorrection: false,
  exponential: false,
})

const calibrationModalTitle = computed(() => {
  switch (currentCalibrationType.value) {
    case 'deadband':
      return 'Deadband Calibration'
    case 'circle':
      return 'Circle Correction Calibration'
    case 'exponential':
      return 'Exponential Scaling Calibration'
    default:
      return 'Calibration'
  }
})

const calibrationModalInstructions = computed(() => {
  switch (currentCalibrationType.value) {
    case 'deadband':
      return 'This will help eliminate small unwanted movements around the center position. Follow the instructions below to calibrate the deadband.'
    case 'circle':
      return 'This will help ensure your joystick movements form a perfect circle. Follow the instructions below to calibrate the circle correction.'
    case 'exponential':
      return 'This will help adjust the sensitivity curve of your joystick. Follow the instructions below to calibrate the exponential scaling.'
    default:
      return ''
  }
})

const openCalibrationModal = (type: 'deadband' | 'circle' | 'exponential'): void => {
  currentCalibrationType.value = type
  showCalibrationModal.value = true
  calibrationProgress.value = 0
  exponentialProgress.value = { x: 0, y: 0 }
  isCalibrationComplete.value = false
}

const cancelCalibration = (): void => {
  showCalibrationModal.value = false
}

const finishCalibration = (): void => {
  // TODO: Implement calibration saving logic
  showCalibrationModal.value = false
}

// Watch for joystick movements during calibration
watch(
  () => currentJoystick.value?.state.axes,
  (axes) => {
    if (!axes || !showCalibrationModal.value) return

    const x = axes[0] ?? 0
    const y = axes[1] ?? 0
    joystickPosition.value = { x, y }

    if (currentCalibrationType.value === 'deadband') {
      // Update deadband calibration progress
      const distanceFromCenter = Math.sqrt(x * x + y * y)
      if (distanceFromCenter < 0.1) {
        calibrationProgress.value = Math.min(100, calibrationProgress.value + 1)
      } else {
        calibrationProgress.value = Math.max(0, calibrationProgress.value - 1)
      }
      isCalibrationComplete.value = calibrationProgress.value >= 100
    } else if (currentCalibrationType.value === 'exponential') {
      // Update exponential calibration progress
      exponentialProgress.value = {
        x: Math.max(exponentialProgress.value.x, Math.abs(x) * 100),
        y: Math.max(exponentialProgress.value.y, Math.abs(y) * 100),
      }
      isCalibrationComplete.value = exponentialProgress.value.x >= 100 && exponentialProgress.value.y >= 100
    }
  },
  { deep: true }
)
</script>
