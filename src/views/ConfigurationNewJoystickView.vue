<template>
  <BaseConfigurationView>
    <template #title>New Joystick configuration</template>
    <template #content>
      <div
        class="flex flex-col justify-around align-start ml-5 max-h-[85vh] overflow-y-auto"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[70vw]' : 'max-w-[40vw]'"
      >
        <div v-for="[joystickIndex, joystick] in controllerStore.joysticks" :key="joystickIndex">
          <span>{{ joystick.model }}</span>
          <div class="flex justify-center align-center">
            <div class="flex flex-col justify-center align-center">
              <span>Raw state</span>
              <span>Buttons</span>
              <div v-for="[buttonIndex, button] in joystick.rawState.buttons.entries()" :key="buttonIndex">
                <span class="font-mono text-center">{{ button?.toFixed(3) }}</span>
              </div>
              <span>Axes</span>
              <div v-for="[axisIndex, axis] in joystick.rawState.axes.entries()" :key="axisIndex">
                <span class="font-mono text-center">{{ axis?.toFixed(3) }}</span>
              </div>
            </div>
            <div class="flex flex-col justify-center align-center">
              <span>Standard state</span>
              <span>Buttons</span>
              <div v-for="[buttonIndex, button] in joystick.state.buttons.entries()" :key="buttonIndex">
                <span class="font-mono text-center">{{ button?.toFixed(3) }}</span>
              </div>
              <span>Axes</span>
              <div v-for="[axisIndex, axis] in joystick.state.axes.entries()" :key="axisIndex">
                <span class="font-mono text-center">{{ axis?.toFixed(3) }}</span>
              </div>
            </div>
            <div class="flex flex-col justify-center align-center">
              <span>Data Lake</span>
              <span>Buttons</span>
              <div v-for="buttonIndex in joystick.state.buttons.keys()" :key="buttonIndex">
                <span class="font-mono text-center">
                  {{ inputDataLakeValue(joystickIndex, 'button', buttonIndex)?.toFixed(3) }}
                </span>
              </div>
              <span>Axes</span>
              <div v-for="axisIndex in joystick.state.axes.keys()" :key="axisIndex">
                <span class="font-mono text-center">
                  {{ inputDataLakeValue(joystickIndex, 'axis', axisIndex)?.toFixed(3) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { joystickInputDataLakeId, useControllerStore } from '@/stores/controller'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const controllerStore = useControllerStore()

const inputDataLakeValue = (
  joystickIndex: number,
  inputType: 'button' | 'axis',
  inputId: number | string
): number | undefined => {
  const id = joystickInputDataLakeId(joystickIndex, inputType, inputId)
  return getDataLakeVariableData(id)
}
</script>
