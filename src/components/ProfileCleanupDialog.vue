<template>
  <GlassModal :is-visible="isVisible" position="center" class="pa-5 z-[1000000]" is-persistent>
    <div class="w-[520px] flex flex-col gap-4 pa-2">
      <div class="flex items-center gap-2">
        <v-icon color="amber" size="28">mdi-broom</v-icon>
        <span class="text-lg font-semibold">Profile cleanup for {{ vehicleDisplayName }}</span>
      </div>

      <p class="text-sm text-gray-300">
        Your current settings contain profiles configured for other vehicle types. We recommend removing them to keep
        your {{ vehicleDisplayName }} configuration clean.
      </p>

      <p class="text-xs text-gray-400">
        These settings are specific to this vehicle. Removing them will not affect profiles saved for your other
        vehicles, even under the same user.
      </p>

      <div v-if="cleanupWidgetItems.length > 0" class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Widget Profiles</span>
        <div
          v-for="item in cleanupWidgetItems"
          :key="item.hash"
          class="flex items-center rounded-md px-2 py-1"
          :class="selectedHashes.has(item.hash) ? 'bg-amber-900/30' : 'bg-transparent'"
        >
          <v-checkbox
            :model-value="selectedHashes.has(item.hash)"
            hide-details
            density="compact"
            color="amber"
            class="mr-2 flex-shrink-0"
            @update:model-value="toggleSelection(item.hash, $event)"
          />
          <div class="flex flex-col">
            <span class="text-sm">{{ item.name }}</span>
            <span class="text-xs" :class="item.reason === 'mismatched' ? 'text-amber-400' : 'text-gray-500'">
              {{ item.vehicleTypeName }}
            </span>
          </div>
          <v-icon class="ml-auto" :class="item.reason === 'mismatched' ? 'text-amber-500' : 'text-gray-500'" size="18">
            {{ item.reason === 'mismatched' ? 'mdi-alert-circle-outline' : 'mdi-link-variant-off' }}
          </v-icon>
        </div>
      </div>

      <div v-if="cleanupJoystickItems.length > 0" class="flex flex-col gap-1">
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Joystick Mappings</span>
        <div
          v-for="item in cleanupJoystickItems"
          :key="item.hash"
          class="flex items-center rounded-md px-2 py-1"
          :class="selectedHashes.has(item.hash) ? 'bg-amber-900/30' : 'bg-transparent'"
        >
          <v-checkbox
            :model-value="selectedHashes.has(item.hash)"
            hide-details
            density="compact"
            color="amber"
            class="mr-2 flex-shrink-0"
            @update:model-value="toggleSelection(item.hash, $event)"
          />
          <div class="flex flex-col">
            <span class="text-sm">{{ item.name }}</span>
            <span class="text-xs" :class="item.reason === 'mismatched' ? 'text-amber-400' : 'text-gray-500'">
              {{ item.vehicleTypeName }}
            </span>
          </div>
          <v-icon class="ml-auto" :class="item.reason === 'mismatched' ? 'text-amber-500' : 'text-gray-500'" size="18">
            {{ item.reason === 'mismatched' ? 'mdi-alert-circle-outline' : 'mdi-link-variant-off' }}
          </v-icon>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <v-btn variant="text" color="white" @click="dismiss">Keep all</v-btn>
        <v-btn variant="flat" color="amber-darken-2" :disabled="selectedHashes.size === 0" @click="removeSelected">
          Remove selected ({{ selectedHashes.size }})
        </v-btn>
      </div>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getVehicleTypeDisplayName } from '@/assets/defaults'
import { useSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'

import GlassModal from './GlassModal.vue'

/**
 * Represents a profile or mapping item that may be removed during cleanup.
 */
interface CleanupItem {
  /**
   * Unique identifier for the profile/mapping
   */
  hash: string
  /**
   * Display name of the profile/mapping
   */
  name: string
  /**
   * Human-readable label for the vehicle type association (or 'Not tied to any vehicle type')
   */
  vehicleTypeName: string
  /**
   * Whether this item is tied to a different vehicle type ('mismatched') or not tied at all ('untied')
   */
  reason: 'mismatched' | 'untied'
}

const { openSnackbar } = useSnackbar()
const vehicleStore = useMainVehicleStore()
const widgetStore = useWidgetManagerStore()
const controllerStore = useControllerStore()

const isVisible = ref(false)
const hasBeenDismissed = ref(false)
const selectedHashes = ref<Set<string>>(new Set())

const vehicleDisplayName = computed(() => {
  if (!vehicleStore.vehicleType) return ''
  return getVehicleTypeDisplayName(vehicleStore.vehicleType)
})

const buildProfileHashToVehicleType = (correspondency: Record<string, string | undefined>): Map<string, MavType> => {
  const result = new Map<string, MavType>()
  for (const [vType, hash] of Object.entries(correspondency)) {
    if (hash) result.set(hash, vType as MavType)
  }
  return result
}

const cleanupWidgetItems = ref<CleanupItem[]>([])
const cleanupJoystickItems = ref<CleanupItem[]>([])

const checkForMismatches = (currentVehicleType: MavType): void => {
  const widgetMap = buildProfileHashToVehicleType(widgetStore.vehicleTypeProfileCorrespondency)
  const hasWidgetProfileForCurrentType = [...widgetMap.values()].includes(currentVehicleType)

  const mismatchedWidgets: CleanupItem[] = []
  const untiedWidgets: CleanupItem[] = []

  for (const p of widgetStore.savedProfiles) {
    const tied = widgetMap.get(p.hash)
    if (tied !== undefined && tied !== currentVehicleType) {
      mismatchedWidgets.push({
        hash: p.hash,
        name: p.name,
        vehicleTypeName: getVehicleTypeDisplayName(tied),
        reason: 'mismatched',
      })
    } else if (tied === undefined) {
      untiedWidgets.push({
        hash: p.hash,
        name: p.name,
        vehicleTypeName: 'Not tied to any vehicle type',
        reason: 'untied',
      })
    }
  }

  cleanupWidgetItems.value = hasWidgetProfileForCurrentType
    ? [...mismatchedWidgets, ...untiedWidgets]
    : mismatchedWidgets

  const joystickMap = buildProfileHashToVehicleType(controllerStore.vehicleTypeProtocolMappingCorrespondency)
  const hasJoystickMappingForCurrentType = [...joystickMap.values()].includes(currentVehicleType)

  const mismatchedJoystick: CleanupItem[] = []
  const untiedJoystick: CleanupItem[] = []

  for (const m of controllerStore.protocolMappings) {
    const tied = joystickMap.get(m.hash)
    if (tied !== undefined && tied !== currentVehicleType) {
      mismatchedJoystick.push({
        hash: m.hash,
        name: m.name,
        vehicleTypeName: getVehicleTypeDisplayName(tied),
        reason: 'mismatched',
      })
    } else if (tied === undefined) {
      untiedJoystick.push({
        hash: m.hash,
        name: m.name,
        vehicleTypeName: 'Not tied to any vehicle type',
        reason: 'untied',
      })
    }
  }

  cleanupJoystickItems.value = hasJoystickMappingForCurrentType
    ? [...mismatchedJoystick, ...untiedJoystick]
    : mismatchedJoystick

  if (cleanupWidgetItems.value.length === 0 && cleanupJoystickItems.value.length === 0) return

  selectedHashes.value = new Set([
    ...cleanupWidgetItems.value.map((i) => i.hash),
    ...cleanupJoystickItems.value.map((i) => i.hash),
  ])

  isVisible.value = true
}

watch(
  () => vehicleStore.vehicleType,
  (newType) => {
    if (!newType || hasBeenDismissed.value) return
    checkForMismatches(newType)
  }
)

const toggleSelection = (hash: string, checked: boolean | null): void => {
  const next = new Set(selectedHashes.value)
  if (checked) {
    next.add(hash)
  } else {
    next.delete(hash)
  }
  selectedHashes.value = next
}

const removeSelected = (): void => {
  let removedCount = 0

  const widgetCorrespondency = widgetStore.vehicleTypeProfileCorrespondency
  for (const item of cleanupWidgetItems.value) {
    if (!selectedHashes.value.has(item.hash)) continue
    const profile = widgetStore.savedProfiles.find((p) => p.hash === item.hash)
    if (!profile) continue

    for (const [vType, hash] of Object.entries(widgetCorrespondency)) {
      if (hash === item.hash) {
        // @ts-ignore: Enums in TS such
        widgetCorrespondency[vType] = undefined
      }
    }
    widgetStore.deleteProfile(profile)
    removedCount++
  }

  const joystickCorrespondency = controllerStore.vehicleTypeProtocolMappingCorrespondency
  for (const item of cleanupJoystickItems.value) {
    if (!selectedHashes.value.has(item.hash)) continue

    for (const [vType, hash] of Object.entries(joystickCorrespondency)) {
      if (hash === item.hash) {
        // @ts-ignore: Enums in TS such
        joystickCorrespondency[vType] = undefined
      }
    }
    controllerStore.deleteProtocolMapping(item.hash)
    removedCount++
  }

  openSnackbar({ message: `${removedCount} mismatched profile(s) removed.`, variant: 'success', duration: 3000 })

  isVisible.value = false
  hasBeenDismissed.value = true
}

const dismiss = (): void => {
  isVisible.value = false
  hasBeenDismissed.value = true
}
</script>
