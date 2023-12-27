import Swal from 'sweetalert2'

import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'

/**
 * A cockpit function to be formed independent of user action
 */
export enum AutomagicId {
  ImportJoystickFunctionsOnBoot = 'ImportJoystickFunctionsOnBoot',
}
export const allAutomagicIds = Object.keys(AutomagicId).filter((v) => isNaN(Number(v))) as unknown as AutomagicId[]

export const availableAutomagics = [
  {
    id: AutomagicId.ImportJoystickFunctionsOnBoot,
    description: 'Import joystick function mappings from the vehicle on Cockpit boot.',
    function: async () => {
      const { globalAddress } = useMainVehicleStore()
      const controllerStore = useControllerStore()
      await controllerStore.importFunctionsMappingFromVehicle(globalAddress)
    },
  },
]

export const runAutomagics = async (selectedAutomagicsIds: AutomagicId[]): Promise<void> => {
  console.info(`Running the following automagics: ${selectedAutomagicsIds}.`)
  availableAutomagics
    .filter((automagic) => selectedAutomagicsIds.includes(automagic.id))
    .forEach(async (automagic) => {
      try {
        console.info(`Running automagic '${automagic.id}'...`)
        await automagic.function()
        console.info(`Success running automagic '${automagic.id}'.`)
      } catch (error) {
        const errorMessage = `Could not run automagic '${automagic.id}'. ${error}`
        Swal.fire({ icon: 'error', text: errorMessage })
        console.error(errorMessage)
      }
    })
}
