<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="transform translate-y-full opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-full opacity-0"
    >
      <div
        v-if="isVisible"
        class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-6xl w-[90vw] h-[380px]"
        :style="interfaceStore.globalGlassMenuStyles"
      >
        <!-- Progress Bar Border -->
        <div class="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
          <div
            class="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-200"
            :style="{ width: `${timeoutProgress}%` }"
          />
          <div
            class="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-200"
            :style="{ width: `${timeoutProgress}%` }"
          />
          <div
            class="absolute left-0 top-0 w-1 bg-blue-500 transition-all duration-200"
            :style="{ height: `${timeoutProgress}%` }"
          />
          <div
            class="absolute right-0 top-0 w-1 bg-blue-500 transition-all duration-200"
            :style="{ height: `${timeoutProgress}%` }"
          />
        </div>

        <!-- Success Overlay -->
        <Transition
          enter-active-class="transition-all duration-500 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
        >
          <div
            v-if="allInputsWorking"
            class="absolute inset-0 bg-green-600/85 backdrop-blur-sm rounded-lg flex items-center justify-center z-10"
          >
            <div class="text-center text-white">
              <FontAwesomeIcon icon="fa-solid fa-check-circle" size="3x" class="mb-4 text-green-200" />
              <h3 class="text-2xl font-bold mb-2">Joystick Check Complete!</h3>
              <p class="text-lg">All buttons and axes are working properly.</p>
              <v-btn class="mt-4 bg-green-darken-2" variant="outlined" @click="close"> Close </v-btn>
            </div>
          </div>
        </Transition>

        <!-- Failure Overlay -->
        <Transition
          enter-active-class="transition-all duration-500 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
        >
          <div
            v-if="showFailureMessage"
            class="absolute inset-0 bg-red-600/85 backdrop-blur-sm rounded-lg flex items-center justify-center z-10"
          >
            <div class="text-center text-white">
              <FontAwesomeIcon icon="fa-solid fa-exclamation-triangle" size="3x" class="mb-4 text-red-200" />
              <h3 class="text-2xl font-bold mb-2">Joystick Issues Detected</h3>
              <p class="text-sm mb-4">We did not detect interaction with the following inputs:</p>

              <div class="text-left bg-black/30 rounded p-4 mb-4 overflow-y-auto w-fit mx-auto m-4">
                <div v-if="nonWorkingButtons.length > 0" class="mb-2">
                  <strong>Buttons:</strong> {{ nonWorkingButtons.join(', ') }}
                </div>
                <div v-if="nonWorkingAxes.length > 0"><strong>Axes:</strong> {{ nonWorkingAxes.join(', ') }}</div>
              </div>

              <p class="text-xs mb-4 text-gray-200 max-w-[500px] mx-auto">
                Check your joystick hardware or try again. We recommend trying the joystick against a gamepad tester
                website like
                <a href="https://hardwaretester.com/gamepad" target="_blank" class="text-blue-400">this one</a> to check
                if all joystick inputs are working properly.
              </p>

              <div class="flex gap-2 justify-center ml-8">
                <v-btn variant="outlined" class="bg-red-darken-4 text-white" @click="close"> Close </v-btn>
                <v-btn variant="outlined" class="bg-slate-700 text-white" @click="restart"> Test Again </v-btn>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Main Content -->
        <div class="p-4 h-full flex">
          <!-- Header -->
          <div class="w-full h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 h-fit">
              <div>
                <h2 class="text-xl font-bold text-white">Joystick Diagnostic</h2>
                <p class="text-sm text-gray-300">
                  {{ currentJoystick?.model || 'Unknown' }} - Press all buttons and move all axes
                </p>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right text-sm text-gray-300">
                  <div>Timeout: {{ Math.ceil(timeRemaining / 1000) }}s</div>
                  <div class="text-xs">{{ testedInputsCount }}/{{ totalInputsCount }} inputs tested</div>
                </div>
                <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
              </div>
            </div>

            <!-- Content Area -->
            <div class="flex h-full w-full overflow-y-auto justify-center items-center px-8">
              <!-- Joystick Visual -->
              <JoystickButtonIndicator
                v-if="currentJoystick && showJoystickLayout"
                :button-numbers="testedButtons"
                :show-modifier="false"
                class="h-[90%] -ml-[8%] -mt-12"
              />

              <!-- Checklist -->
              <div class="flex-1 h-full w-full">
                <div class="flex justify-center mt-12 gap-x-12 items-center mb-4 mr-8">
                  <!-- Axes Checklist -->
                  <div v-if="availableAxes.length > 0">
                    <h3 class="text-base font-semibold text-white mb-2">Axes (move 30%+)</h3>
                    <div class="space-y-1">
                      <div v-for="axis in availableAxes" :key="`axis-${axis}`" class="flex items-center gap-3 text-sm">
                        <FontAwesomeIcon
                          :icon="axisWorkingStatus[axis] ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'"
                          :class="axisWorkingStatus[axis] ? 'text-green-400' : 'text-gray-400'"
                          class="text-lg"
                        />
                        <span :class="axisWorkingStatus[axis] ? 'text-green-300' : 'text-gray-300'" class="flex-1">
                          Axis {{ axis }}
                          {{ getAxisDirection(axis) }}
                        </span>
                        <span class="text-xs text-gray-400 font-mono min-w-[3rem] text-right">
                          {{ Math.round((currentJoystick?.state.axes[axis] || 0) * 100) }}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Buttons Checklist -->
                  <div v-if="availableButtons.length > 0">
                    <h3 class="text-base font-semibold text-white mb-1">Buttons</h3>
                    <div class="grid grid-cols-3 gap-x-2">
                      <div
                        v-for="button in availableButtons"
                        :key="`button-${button}`"
                        class="flex items-center gap-2 text-sm py-0.5"
                      >
                        <FontAwesomeIcon
                          :icon="buttonWorkingStatus[button] ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'"
                          :class="buttonWorkingStatus[button] ? 'text-green-400' : 'text-gray-400'"
                          class="text-lg"
                        />
                        <span :class="buttonWorkingStatus[button] ? 'text-green-300' : 'text-gray-300'" class="flex-1">
                          Button {{ button }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import JoystickButtonIndicator from '@/components/JoystickButtonIndicator.vue'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import type { Joystick } from '@/types/joystick'
import { JoystickAxis } from '@/types/joystick'

/**
 * Props for the JoystickDiagnostic component
 */
const props = defineProps<{
  /**
   * Whether the diagnostic should be visible
   */
  visible?: boolean
  /**
   * Specific joystick to test (if not provided, will use the first available)
   */
  targetJoystick?: Joystick
}>()

/**
 * Emits for the JoystickDiagnostic component
 */
const emit = defineEmits<{
  /**
   * Emitted when the diagnostic should be closed
   */
  close: []
  /**
   * Emitted when all inputs are working
   */
  success: [
    workingInputs: {
      /**
       * Buttons that are working
       */
      buttons: number[]
      /**
       * Axes that are working
       */
      axes: number[]
    }
  ]
  /**
   * Emitted when some inputs are not working
   */
  failure: [
    nonWorkingInputs: {
      /**
       * Buttons that are not working
       */
      buttons: number[]
      /**
       * Axes that are not working
       */
      axes: number[]
    }
  ]
}>()

const controllerStore = useControllerStore()
const interfaceStore = useAppInterfaceStore()

// Component state
const isVisible = ref(false)
const currentJoystick = ref<Joystick>()
const showJoystickLayout = ref(true)

// Store the previous forwarding state to restore when closing
const previousEnableForwarding = ref<boolean>(false)

// Test state
const buttonWorkingStatus = ref<Record<number, boolean>>({})
const axisWorkingStatus = ref<Record<number, boolean>>({})
const axisInitialValues = ref<Record<number, number>>({})
const testStartTime = ref<number>(0)
const timeoutDuration = 10000 // 10 seconds
const timeRemaining = ref(timeoutDuration)
const timeoutInterval = ref<number | undefined>()
const allInputsWorking = ref(false)
const showFailureMessage = ref(false)

// Axis movement threshold (30%)
const AXIS_MOVEMENT_THRESHOLD = 0.3

// Available inputs based on current joystick
const availableButtons = computed(() => {
  if (!currentJoystick.value) return []
  return Array.from({ length: currentJoystick.value.state.buttons.length }, (_, i) => i)
})

const availableAxes = computed(() => {
  if (!currentJoystick.value) return []
  return Array.from({ length: Math.min(4, currentJoystick.value.state.axes.length) }, (_, i) => i)
})

const totalInputsCount = computed(() => {
  return availableButtons.value.length + availableAxes.value.length
})

const testedInputsCount = computed(() => {
  const testedButtons = availableButtons.value.filter((b) => buttonWorkingStatus.value[b]).length
  const testedAxes = availableAxes.value.filter((a) => axisWorkingStatus.value[a]).length
  return testedButtons + testedAxes
})

const timeoutProgress = computed(() => {
  if (timeoutDuration <= 0) return 0
  return ((timeoutDuration - timeRemaining.value) / timeoutDuration) * 100
})

const nonWorkingButtons = computed(() => {
  return availableButtons.value.filter((b) => !buttonWorkingStatus.value[b])
})

const nonWorkingAxes = computed(() => {
  return availableAxes.value.filter((a) => !axisWorkingStatus.value[a])
})

/**
 * Check if a button is currently pressed
 * @param {number} button
 * @returns {boolean}
 */
const isButtonPressed = (button: number): boolean => {
  return (currentJoystick.value?.state.buttons[button] || 0) > 0.5
}

/**
 * Get all tested button numbers (for JoystickButtonIndicator)
 * @returns {number[]}
 */
const testedButtons = computed((): number[] => {
  if (!currentJoystick.value) return []

  // Return all buttons that have been tested (working status is true)
  return availableButtons.value.filter((button) => buttonWorkingStatus.value[button])
})

/**
 * Initialize the diagnostic test
 */
const initializeTest = (): void => {
  if (!currentJoystick.value) return

  // Reset test state
  buttonWorkingStatus.value = {}
  axisWorkingStatus.value = {}
  axisInitialValues.value = {}
  allInputsWorking.value = false
  showFailureMessage.value = false

  // Store initial axis values
  availableAxes.value.forEach((axis) => {
    axisInitialValues.value[axis] = currentJoystick.value?.state.axes[axis] || 0
  })

  // Start timeout
  startTimeout()
}

/**
 * Start the timeout countdown
 */
const startTimeout = (): void => {
  testStartTime.value = Date.now()
  timeRemaining.value = timeoutDuration

  if (timeoutInterval.value) {
    clearInterval(timeoutInterval.value)
  }

  timeoutInterval.value = setInterval(() => {
    timeRemaining.value = Math.max(0, timeoutDuration - (Date.now() - testStartTime.value))

    if (timeRemaining.value <= 0) {
      handleTimeout()
    }
  }, 50) as unknown as number
}

/**
 * Reset the timeout (when user interacts with a new input)
 */
const resetTimeout = (): void => {
  startTimeout()
}

/**
 * Handle timeout expiration
 */
const handleTimeout = (): void => {
  if (timeoutInterval.value) {
    clearInterval(timeoutInterval.value)
  }

  if (testedInputsCount.value === totalInputsCount.value) {
    // All inputs were tested successfully
    allInputsWorking.value = true
    setTimeout(() => {
      emit('success' as const, {
        buttons: availableButtons.value.filter((b) => buttonWorkingStatus.value[b]),
        axes: availableAxes.value.filter((a) => axisWorkingStatus.value[a]),
      })
    }, 2000)
  } else {
    // Some inputs were not tested
    showFailureMessage.value = true
    emit('failure' as const, {
      buttons: nonWorkingButtons.value,
      axes: nonWorkingAxes.value,
    })
  }
}

/**
 * Show the diagnostic
 */
const show = (): void => {
  // Store current forwarding state before disabling
  previousEnableForwarding.value = controllerStore.enableForwarding

  // Disable joystick forwarding during diagnostic
  controllerStore.enableForwarding = false

  console.info('Joystick diagnostic started - forwarding disabled')

  // Get current joystick if not provided
  if (!currentJoystick.value) {
    if (controllerStore.joysticks.size > 0) {
      currentJoystick.value = controllerStore.joysticks.values().next().value
    }
  }

  if (currentJoystick.value) {
    isVisible.value = true
    initializeTest()
  }
}

/**
 * Close the diagnostic
 */
const close = (): void => {
  isVisible.value = false
  allInputsWorking.value = false
  showFailureMessage.value = false

  if (timeoutInterval.value) {
    clearInterval(timeoutInterval.value)
  }

  // Restore previous joystick forwarding state
  controllerStore.enableForwarding = previousEnableForwarding.value

  console.info('Joystick diagnostic closed - forwarding state restored')

  emit('close' as const)
}

/**
 * Restart the test
 */
const restart = (): void => {
  showFailureMessage.value = false
  initializeTest()
}

// Watch for visibility changes
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      show()
    } else {
      close()
    }
  },
  { immediate: true }
)

// Watch for target joystick changes
watch(
  () => props.targetJoystick,
  (joystick) => {
    if (joystick) {
      currentJoystick.value = joystick
      initializeTest()
    }
  },
  { immediate: true }
)

// Prevent joystick forwarding from being re-enabled while diagnostic is visible
watch(
  () => controllerStore.enableForwarding,
  (enabled) => {
    if (enabled && isVisible.value) {
      console.warn('Preventing joystick forwarding from being enabled during diagnostic')
      controllerStore.enableForwarding = false
    }
  }
)

/**
 * Get axis direction description
 * @param {number} axisId
 * @returns {string}
 */
const getAxisDirection = (axisId: number): string => {
  switch (axisId) {
    case JoystickAxis.A0:
      return '(Left X)'
    case JoystickAxis.A1:
      return '(Left Y)'
    case JoystickAxis.A2:
      return '(Right X)'
    case JoystickAxis.A3:
      return '(Right Y)'
    default:
      return `(Axis ${axisId})`
  }
}

/**
 * Monitor joystick state for input detection
 */
const monitorJoystickState = (): void => {
  if (!currentJoystick.value) return

  // Check buttons
  availableButtons.value.forEach((buttonId) => {
    if (!buttonWorkingStatus.value[buttonId] && isButtonPressed(buttonId)) {
      buttonWorkingStatus.value[buttonId] = true
      resetTimeout()
    }
  })

  // Check axes
  availableAxes.value.forEach((axisId) => {
    if (!axisWorkingStatus.value[axisId]) {
      const currentValue = currentJoystick.value?.state.axes[axisId] || 0
      const initialValue = axisInitialValues.value[axisId] || 0
      const movement = Math.abs(currentValue - initialValue)

      if (movement >= AXIS_MOVEMENT_THRESHOLD) {
        axisWorkingStatus.value[axisId] = true
        resetTimeout()
      }
    }
  })

  // Check if all inputs are working
  if (testedInputsCount.value === totalInputsCount.value && !allInputsWorking.value) {
    allInputsWorking.value = true
    if (timeoutInterval.value) {
      clearInterval(timeoutInterval.value)
    }
    setTimeout(() => {
      emit('success' as const, {
        buttons: availableButtons.value.filter((b) => buttonWorkingStatus.value[b]),
        axes: availableAxes.value.filter((a) => axisWorkingStatus.value[a]),
      })
    }, 1000)
  }
}

// Monitor joystick state continuously
let monitoringInterval: number
onMounted(() => {
  monitoringInterval = setInterval(monitorJoystickState, 50) as unknown as number
})

onUnmounted(() => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
  }
  if (timeoutInterval.value) {
    clearInterval(timeoutInterval.value)
  }
})

// Expose methods for parent components
defineExpose({
  show,
  close,
  restart,
})
</script>
