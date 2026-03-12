/**
 * A remembered vehicle entry in the local registry
 */
export interface VehicleRegistryEntry {
  /**
   * The vehicle's unique hash (UUID stored on the vehicle via BlueOS bag of holdings)
   */
  hash: string
  /**
   * User-assigned display name for the vehicle
   */
  name: string
  /**
   * Last known IP/address for this vehicle
   */
  address: string
  /**
   * Epoch timestamp of the last successful connection to this vehicle
   */
  lastConnectedAt: number
}
