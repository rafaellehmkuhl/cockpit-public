<template>
  <v-tooltip :text="store.isVehicleOnline ? 'Vehicle connected' : 'Vehicle disconnected'" location="top">
    <template #activator="{ props: tooltipProps }">
      <div class="relative" :class="store.isVehicleOnline ? 'text-slate-50' : 'text-gray-700'" v-bind="tooltipProps">
        <v-icon>mdi-swap-horizontal</v-icon>
        <v-icon v-if="!store.isVehicleOnline" class="absolute -left-1">mdi-slash-forward</v-icon>
      </div>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()
</script>
