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
            <div class="w-full h-40 flex items-center justify-center gap-8">
              <div class="flex flex-col items-center">
                <p class="text-xs text-gray-400 mb-2">Left Stick</p>
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
              <div class="flex flex-col items-center">
                <p class="text-xs text-gray-400 mb-2">Right Stick</p>
                <div class="w-32 h-32 border-2 border-red-400 rounded-full relative">
                  <div
                    class="w-4 h-4 bg-red-400 rounded-full absolute"
                    :style="{
                      left: `${50 + joystickPosition2.x * 50}%`,
                      top: `${50 + joystickPosition2.y * 50}%`,
                      transform: 'translate(-50%, -50%)',
                    }"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-if="currentCalibrationType === 'exponential'" class="w-full">
            <p class="text-sm text-gray-400 mb-2">Move the joystick to its maximum range in each direction</p>
            <div class="flex flex-col gap-4 w-full">
              <div v-for="(axis, index) in currentJoystick?.state.axes ?? []" :key="index" class="w-full">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs text-gray-400">Axis {{ index }}</p>
                  <div class="flex items-center gap-2">
                    <v-btn
                      size="x-small"
                      variant="text"
                      class="text-gray-400"
                      @click="exponentialFactors[index] = 1.0"
                    >
                      Reset
                    </v-btn>
                    <span class="text-xs text-gray-400">Factor:</span>
                    <v-slider
                      v-model="exponentialFactors[index]"
                      min="1.0"
                      max="5.0"
                      step="0.1"
                      hide-details
                      class="w-32"
                      density="compact"
                    />
                    <span class="text-xs text-gray-400">{{ exponentialFactors[index].toFixed(1) }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-16">Raw:</span>
                    <v-progress-linear
                      :model-value="(rawAxisValues[index] + 1) * 50"
                      color="gray"
                      height="4"
                      class="flex-1"
                    />
                    <span class="text-xs text-gray-400 w-12">{{ rawAxisValues[index].toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 w-16">Processed:</span>
                    <v-progress-linear
                      :model-value="(processedAxisValues[index] + 1) * 50"
                      color="blue"
                      height="4"
                      class="flex-1"
                    />
                    <span class="text-xs text-gray-400 w-12">{{ processedAxisValues[index].toFixed(2) }}</span>
                  </div>
                  <div class="w-full h-32 relative">
                    <svg class="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                      <!-- Grid lines -->
                      <line x1="0" y1="50" x2="200" y2="50" stroke="#e5e7eb" stroke-width="1" />
                      <line x1="100" y1="0" x2="100" y2="100" stroke="#e5e7eb" stroke-width="1" />

                      <!-- Linear curve (y = x) -->
                      <path
                        d="M 0 50 L 200 50"
                        stroke="#9ca3af"
                        stroke-width="2"
                        fill="none"
                      />

                      <!-- Exponential curve -->
                      <path
                        :d="getExponentialCurvePath(index)"
                        stroke="#3b82f6"
                        stroke-width="2"
                        fill="none"
                      />

                      <!-- Current value indicator -->
                      <circle
                        :cx="100 + (rawAxisValues[index] * 100)"
                        :cy="50 - (processedAxisValues[index] * 50)"
                        r="3"
                        fill="#3b82f6"
                      />

                      <!-- Vertical line -->
                      <line
                        :x1="100 + (rawAxisValues[index] * 100)"
                        y1="0"
                        :x2="100 + (rawAxisValues[index] * 100)"
                        y2="100"
                        stroke="#3b82f6"
                        stroke-width="1"
                        stroke-dasharray="2,2"
                      />

                      <!-- Horizontal line -->
                      <line
                        x1="0"
                        :y1="50 - (processedAxisValues[index] * 50)"
                        x2="200"
                        :y2="50 - (processedAxisValues[index] * 50)"
                        stroke="#3b82f6"
                        stroke-width="1"
                        stroke-dasharray="2,2"
                      />
                    </svg>
                  </div>
                </div>
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
import { computed, onMounted, ref, watch } from 'vue'

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
const exponentialFactors = ref<number[]>([])
const rawAxisValues = ref<number[]>([])
const processedAxisValues = ref<number[]>([])
const joystickPosition = ref({ x: 0, y: 0 })
const joystickPosition2 = ref({ x: 0, y: 0 })
const isCalibrationComplete = ref(false)

const calibrationOptions = ref({
  deadband: false,
  circleCorrection: false,
  exponential: true,
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

  if (type === 'exponential') {
    // Initialize exponential factors for all axes
    const numAxes = currentJoystick.value?.state.axes.length ?? 0
    exponentialFactors.value = Array(numAxes).fill(1.0)
    rawAxisValues.value = Array(numAxes).fill(0)
    processedAxisValues.value = Array(numAxes).fill(0)
  }
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
    joystickPosition2.value = { x: -x, y: -y }

    if (currentCalibrationType.value === 'deadband') {
      // Update deadband calibration progress
      const distanceFromCenter = Math.sqrt(x * x + y * y)
      if (distanceFromCenter < 0.1) {
        calibrationProgress.value = Math.min(100, calibrationProgress.value + 1)
      } else {
        calibrationProgress.value = Math.max(0, calibrationProgress.value - 1)
      }
      isCalibrationComplete.value = calibrationProgress.value >= 100
    } else if (currentCalibrationType.value === 'circle') {
      // Update both joystick positions for circle calibration
      joystickPosition.value = { x: axes[0] ?? 0, y: axes[1] ?? 0 }
      joystickPosition2.value = { x: axes[2] ?? 0, y: axes[3] ?? 0 }
    } else if (currentCalibrationType.value === 'exponential') {
      // Update exponential calibration progress and values
      const currentAxes = currentJoystick.value?.state.axes ?? []
      rawAxisValues.value = currentAxes.map(axis => axis ?? 0)

      // Calculate processed values with exponential scaling
      processedAxisValues.value = currentAxes.map((value, index) => {
        const factor = exponentialFactors.value[index] ?? 1.0
        const axisValue = value ?? 0
        const sign = Math.sign(axisValue)
        const absValue = Math.abs(axisValue)
        return sign * Math.pow(absValue, factor)
      })

      // Update progress based on maximum values seen
      exponentialProgress.value = {
        x: Math.max(exponentialProgress.value.x, Math.abs(currentAxes[0] ?? 0) * 100),
        y: Math.max(exponentialProgress.value.y, Math.abs(currentAxes[1] ?? 0) * 100),
      }
      isCalibrationComplete.value = exponentialProgress.value.x >= 100 && exponentialProgress.value.y >= 100
    }
  },
  { deep: true }
)

const getExponentialCurvePath = (axisIndex: number): string => {
  const factor = exponentialFactors.value[axisIndex] ?? 1.0
  const points: string[] = []

  for (let x = -1; x <= 1; x += 0.1) {
    const y = Math.sign(x) * Math.pow(Math.abs(x), factor)
    const svgX = 100 + (x * 100)
    const svgY = 50 - (y * 50)
    points.push(`${svgX},${svgY}`)
  }

  return `M ${points.join(' L ')}`
}

onMounted(() => {
  openCalibrationModal('exponential')
})
</script>
