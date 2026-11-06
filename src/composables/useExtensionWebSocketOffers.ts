import { type ComputedRef, type Ref, computed, onScopeDispose, ref } from 'vue'

import { numberedSecondaryBlueOsVehicles, secondaryBlueOsStates } from '@/composables/secondaryVehicles'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { getExtensionExtrasFromBlueOS, webSocketOffersFromExtensionExtras } from '@/libs/blueos'
import { addGenericWebSocketConnection, listenToGenericWebSocketConnections } from '@/libs/generic-websocket'
import { replaceDataLakeInputsInString } from '@/libs/utils-data-lake'
import type { WebSocketOfferFromExtension } from '@/types/blueos'

/**
 * Return type of {@link useExtensionWebSocketOffers}.
 */
export interface UseExtensionWebSocketOffersReturn {
  /**
   * Connections the main vehicle's extensions offer, as last read from their extras
   */
  discoveredOffers: Ref<WebSocketOfferFromExtension[]>
  /**
   * Reads the connections the extensions of every reachable secondary vehicle offer
   */
  fetchSecondaryVehicleOffers: () => Promise<void>
  /**
   * Offers the operator has neither accepted nor ignored, and that are not connected already
   */
  pendingOffers: ComputedRef<WebSocketOfferFromExtension[]>
  /**
   * Offers the operator accepted or ignored before that are not connected now, so they can still be connected
   */
  handledOffers: ComputedRef<WebSocketOfferFromExtension[]>
  /**
   * Connects to an offered WebSocket and stops offering it
   */
  acceptOffer: (offer: WebSocketOfferFromExtension) => void
  /**
   * Stops offering a WebSocket without connecting to it
   */
  ignoreOffer: (offer: WebSocketOfferFromExtension) => void
  /**
   * Unconnected offers of the same connection by the same extension on every vehicle, the given one included
   */
  sameOfferOnEveryVehicle: (offer: WebSocketOfferFromExtension) => WebSocketOfferFromExtension[]
  /**
   * Connects to the same offered WebSocket on every vehicle whose extension offers it
   */
  acceptOfferOnEveryVehicle: (offer: WebSocketOfferFromExtension) => void
}

/**
 * Names where an offer comes from, for the user: its extension, and the vehicle it runs on when not the main one.
 * @param {WebSocketOfferFromExtension} offer The offer
 * @returns {string} The extension's name, with the vehicle's number for a secondary vehicle
 */
export const webSocketOfferSource = (offer: WebSocketOfferFromExtension): string =>
  offer.vehicleNumber === undefined ? offer.extensionName : `${offer.extensionName} on vehicle ${offer.vehicleNumber}`

/**
 * WebSocket connections BlueOS extensions offer in their extras, which the operator accepts or ignores once. An
 * accepted offer becomes a generic WebSocket connection, managed from the general settings like any other.
 * @returns {UseExtensionWebSocketOffersReturn} The offers and the actions to resolve them
 */
export const useExtensionWebSocketOffers = (): UseExtensionWebSocketOffersReturn => {
  const handledOfferUrls = useBlueOsStorage<string[]>('cockpit-handled-websocket-offers', [])
  const discoveredOffers = ref<WebSocketOfferFromExtension[]>([])
  const secondaryVehicleOffers = ref<WebSocketOfferFromExtension[]>([])
  const connectedUrls = ref<string[]>([])

  // Left as the vehicle's address variable rather than the address itself, so an accepted connection follows the
  // vehicle to a new address, as the main vehicle's do.
  const fetchSecondaryVehicleOffers = async (): Promise<void> => {
    const reachableVehicles = numberedSecondaryBlueOsVehicles.value.filter(
      ({ address }) => secondaryBlueOsStates.value[address]?.isReachable === true
    )
    const offersPerVehicle = await Promise.all(
      reachableVehicles.map(async ({ address, vehicleNumber }) => {
        try {
          const extensionExtras = await getExtensionExtrasFromBlueOS(address)
          const addressTemplate = `{{ /vehicles/${vehicleNumber}/address }}`
          const offers = webSocketOffersFromExtensionExtras(extensionExtras, addressTemplate)
          return offers.map((offer) => ({ ...offer, vehicleNumber }))
        } catch (error) {
          console.error(`Failed to fetch the extension features of vehicle ${vehicleNumber}:`, error)
          return []
        }
      })
    )
    secondaryVehicleOffers.value = offersPerVehicle.flat()
  }

  const stopListening = listenToGenericWebSocketConnections((connections) => {
    connectedUrls.value = Object.keys(connections)
  })
  onScopeDispose(stopListening)

  // Compared resolved, as the connection list compares them, so a connection typed in by hand with the vehicle's
  // address counts as the offered one.
  const isConnected = (offer: WebSocketOfferFromExtension): boolean => {
    const resolvedUrl = replaceDataLakeInputsInString(offer.url)
    return connectedUrls.value.some((url) => replaceDataLakeInputsInString(url) === resolvedUrl)
  }
  const unconnectedOffers = computed(() =>
    [...discoveredOffers.value, ...secondaryVehicleOffers.value].filter((offer) => !isConnected(offer))
  )
  const pendingOffers = computed(() =>
    unconnectedOffers.value.filter((offer) => !handledOfferUrls.value.includes(offer.url))
  )
  const handledOffers = computed(() =>
    unconnectedOffers.value.filter((offer) => handledOfferUrls.value.includes(offer.url))
  )

  const markHandled = (offer: WebSocketOfferFromExtension): void => {
    if (handledOfferUrls.value.includes(offer.url)) return
    handledOfferUrls.value = [...handledOfferUrls.value, offer.url]
  }

  const acceptOffer = (offer: WebSocketOfferFromExtension): void => {
    addGenericWebSocketConnection(offer.url)
    markHandled(offer)
    logUserAction(`Accepted the '${offer.name}' WebSocket offered by ${webSocketOfferSource(offer)}`)
    openSnackbar({ message: `Connecting to "${offer.name}" from ${webSocketOfferSource(offer)}.`, variant: 'success' })
  }

  const sameOfferOnEveryVehicle = (offer: WebSocketOfferFromExtension): WebSocketOfferFromExtension[] =>
    unconnectedOffers.value.filter((other) => other.extensionName === offer.extensionName && other.name === offer.name)

  const acceptOfferOnEveryVehicle = (offer: WebSocketOfferFromExtension): void => {
    const offers = sameOfferOnEveryVehicle(offer)
    offers.forEach((sameOffer) => {
      addGenericWebSocketConnection(sameOffer.url)
      markHandled(sameOffer)
    })
    logUserAction(
      `Accepted the '${offer.name}' WebSocket offered by ${offer.extensionName} on ${offers.length} vehicles`
    )
    const message = `Connecting to "${offer.name}" from ${offer.extensionName} on ${offers.length} vehicles.`
    openSnackbar({ message, variant: 'success' })
  }

  const ignoreOffer = (offer: WebSocketOfferFromExtension): void => {
    markHandled(offer)
    logUserAction(`Ignored the '${offer.name}' WebSocket offered by ${webSocketOfferSource(offer)}`)
    const message = `"${offer.name}" ignored. You can still connect it from the Connections tab.`
    openSnackbar({ message, variant: 'info' })
  }

  return {
    discoveredOffers,
    fetchSecondaryVehicleOffers,
    pendingOffers,
    handledOffers,
    acceptOffer,
    ignoreOffer,
    sameOfferOnEveryVehicle,
    acceptOfferOnEveryVehicle,
  }
}
