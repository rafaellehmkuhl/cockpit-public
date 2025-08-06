import { Ref, ref } from 'vue'

import type { Joystick } from '@/types/joystick'

/**
 * Reactive state for joystick diagnostic management
 */
const showDiagnostic = ref(false)
const targetJoystick = ref<Joystick | undefined>()
const autoShowEnabled = ref(true)

/**
 * Composable for managing joystick diagnostic
 * @returns {object} - Object containing the reactive state and functions for managing joystick diagnostic
 */
export function useJoystickDiagnostic(): {
  /**
   * Whether the diagnostic is currently visible
   */
  showDiagnostic: Ref<boolean>
  /**
   * The joystick that is currently being diagnosed
   */
  targetJoystick: Ref<Joystick | undefined>
  /**
   * Whether automatic diagnostic should be shown when a new joystick connects
   */
  autoShowEnabled: Ref<boolean>
  /**
   * Show the diagnostic for a specific joystick
   */
  showDiagnosticFor: (joystick: Joystick) => void
  /**
   * Show the diagnostic modal
   */
  showDiagnosticModal: () => void
  /**
   * Hide the diagnostic modal
   */
  hideDiagnostic: () => void
  /**
   * Trigger automatic diagnostic when a new joystick connects
   */
  triggerAutoDiagnostic: (joystick: Joystick) => void
  /**
   * Enable or disable automatic diagnostic triggering
   */
  setAutoShowEnabled: (enabled: boolean) => void
} {
  /**
   * Show the diagnostic for a specific joystick
   * @param {Joystick} joystick
   */
  const showDiagnosticFor = (joystick: Joystick): void => {
    targetJoystick.value = joystick
    showDiagnostic.value = true
  }

  /**
   * Show the diagnostic (will use first available joystick if none specified)
   */
  const showDiagnosticModal = (): void => {
    showDiagnostic.value = true
  }

  /**
   * Hide the diagnostic
   */
  const hideDiagnostic = (): void => {
    showDiagnostic.value = false
    targetJoystick.value = undefined
  }

  /**
   * Trigger automatic diagnostic when a new joystick connects
   * @param {Joystick} joystick
   */
  const triggerAutoDiagnostic = (joystick: Joystick): void => {
    if (!autoShowEnabled.value) return

    // Small delay to ensure the joystick is fully initialized
    setTimeout(() => {
      showDiagnosticFor(joystick)
    }, 500)
  }

  /**
   * Enable or disable automatic diagnostic triggering
   * @param {boolean} enabled
   */
  const setAutoShowEnabled = (enabled: boolean): void => {
    autoShowEnabled.value = enabled
  }

  return {
    // State
    showDiagnostic,
    targetJoystick,
    autoShowEnabled,

    // Actions
    showDiagnosticFor,
    showDiagnosticModal,
    hideDiagnostic,
    triggerAutoDiagnostic,
    setAutoShowEnabled,
  }
}
