<template>
  <div class="flex items-center gap-1">
    <v-menu offset-y :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <button
          v-bind="menuProps"
          class="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-bold text-white hover:bg-slate-600/40 transition-all select-none min-w-[100px]"
        >
          <v-icon size="16">mdi-car-connected</v-icon>
          <span class="truncate max-w-[120px]">{{ currentVehicleName }}</span>
          <v-icon size="14" class="opacity-60">mdi-chevron-down</v-icon>
        </button>
      </template>

      <v-card min-width="260" :style="interfaceStore.globalGlassMenuStyles" class="rounded-lg">
        <v-card-title class="text-sm pb-1">Known Vehicles</v-card-title>

        <v-list v-if="vehicles.length > 0" density="compact" class="bg-transparent">
          <v-list-item
            v-for="vehicle in vehicles"
            :key="vehicle.hash"
            :active="vehicle.address === mainVehicleStore.globalAddress"
            class="rounded-md mx-1"
            @click="switchTo(vehicle.hash)"
          >
            <template #prepend>
              <v-icon size="18" :color="vehicle.address === mainVehicleStore.globalAddress ? 'success' : undefined">
                {{ vehicle.address === mainVehicleStore.globalAddress ? 'mdi-check-circle' : 'mdi-car-connected' }}
              </v-icon>
            </template>

            <v-list-item-title class="text-sm">
              <template v-if="editingHash === vehicle.hash">
                <v-text-field
                  v-model="editingName"
                  density="compact"
                  variant="underlined"
                  hide-details
                  autofocus
                  class="text-sm"
                  @keyup.enter="confirmRename"
                  @keyup.escape="cancelRename"
                  @blur="confirmRename"
                  @click.stop
                />
              </template>
              <template v-else>
                {{ vehicle.name }}
              </template>
            </v-list-item-title>

            <v-list-item-subtitle class="text-xs opacity-60">
              {{ vehicle.address }} &middot; {{ vehicle.hash.slice(0, 8) }}
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex gap-0">
                <v-btn icon variant="text" size="x-small" @click.stop="startRename(vehicle.hash, vehicle.name)">
                  <v-icon size="14">mdi-pencil</v-icon>
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  :disabled="vehicle.address === mainVehicleStore.globalAddress"
                  @click.stop="remove(vehicle.hash)"
                >
                  <v-icon size="14">mdi-delete-outline</v-icon>
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <v-card-text v-else class="text-center text-xs opacity-50 py-4">
          No vehicles registered yet. Connect to a vehicle to add it.
        </v-card-text>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useVehicleRegistry } from '@/composables/useVehicleRegistry'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const interfaceStore = useAppInterfaceStore()
const mainVehicleStore = useMainVehicleStore()
const { vehicles, findByHash, switchToVehicle, renameVehicle, removeVehicle } = useVehicleRegistry()

const editingHash = ref<string | null>(null)
const editingName = ref('')

const currentVehicleName = computed(() => {
  const entry = vehicles.value.find((v) => v.address === mainVehicleStore.globalAddress)
  return entry?.name ?? mainVehicleStore.globalAddress
})

const switchTo = (hash: string): void => {
  const entry = findByHash(hash)
  if (!entry || entry.address === mainVehicleStore.globalAddress) return
  switchToVehicle(hash)
}

const startRename = (hash: string, currentName: string): void => {
  editingHash.value = hash
  editingName.value = currentName
}

const confirmRename = (): void => {
  if (editingHash.value && editingName.value.trim().length > 0) {
    renameVehicle(editingHash.value, editingName.value.trim())
  }
  editingHash.value = null
}

const cancelRename = (): void => {
  editingHash.value = null
}

const remove = (hash: string): void => {
  removeVehicle(hash)
}
</script>
