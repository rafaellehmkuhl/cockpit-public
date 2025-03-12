// Mock implementation of BlueOS functions for testing settings sync

/**
 * Mock storage for simulating vehicle storage
 */
export interface MockVehicleStorage {
  [vehicleAddress: string]: {
    [path: string]: any
  }
}

/**
 * Mock storage for simulating BlueOS vehicles
 */
const mockVehicleStorage: MockVehicleStorage = {}

/**
 * Reset the mock vehicle storage to a clean state
 */
export const resetMockVehicleStorage = (): void => {
  Object.keys(mockVehicleStorage).forEach(key => {
    delete mockVehicleStorage[key]
  })
}

/**
 * Set up a mock vehicle with predefined data
 * @param vehicleAddress - Address of the mock vehicle
 * @param initialData - Initial data for the mock vehicle
 */
export const setupMockVehicle = (
  vehicleAddress: string,
  initialData: { [path: string]: any } = {}
): void => {
  mockVehicleStorage[vehicleAddress] = { ...initialData }
}

/**
 * Mock implementation of getBagOfHoldingFromVehicle
 * @param vehicleAddress - Vehicle address
 * @param bagPath - Path to the data in storage
 * @returns The data at the specified path, or undefined if not found
 */
export const mockGetBagOfHoldingFromVehicle = async (
  vehicleAddress: string,
  bagPath: string
): Promise<any> => {
  if (!mockVehicleStorage[vehicleAddress]) {
    throw new Error(`Vehicle not found: ${vehicleAddress}`)
  }

  return mockVehicleStorage[vehicleAddress][bagPath]
}

/**
 * Mock implementation of getKeyDataFromCockpitVehicleStorage
 * @param vehicleAddress - Vehicle address
 * @param storageKey - Storage key
 * @returns The data at the specified key, or undefined if not found
 */
export const mockGetKeyDataFromCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string
): Promise<any | undefined> => {
  return await mockGetBagOfHoldingFromVehicle(vehicleAddress, `cockpit/${storageKey}`)
}

/**
 * Mock implementation of setBagOfHoldingOnVehicle
 * @param vehicleAddress - Vehicle address
 * @param bagName - Bag name
 * @param bagData - Data to store
 */
export const mockSetBagOfHoldingOnVehicle = async (
  vehicleAddress: string,
  bagName: string,
  bagData: any
): Promise<void> => {
  if (!mockVehicleStorage[vehicleAddress]) {
    mockVehicleStorage[vehicleAddress] = {}
  }

  mockVehicleStorage[vehicleAddress][bagName] = bagData
}

/**
 * Mock implementation of setKeyDataOnCockpitVehicleStorage
 * @param vehicleAddress - Vehicle address
 * @param storageKey - Storage key
 * @param storageData - Data to store
 */
export const mockSetKeyDataOnCockpitVehicleStorage = async (
  vehicleAddress: string,
  storageKey: string,
  storageData: any
): Promise<void> => {
  await mockSetBagOfHoldingOnVehicle(vehicleAddress, `cockpit/${storageKey}`, storageData)
}

/**
 * Get the current state of the mock vehicle storage for a specific vehicle
 * @param vehicleAddress - Vehicle address to inspect
 * @returns A copy of the current state for the specified vehicle
 */
export const getMockVehicleStorageState = (vehicleAddress: string): Record<string, any> => {
  return { ...mockVehicleStorage[vehicleAddress] }
}

/**
 * Get the complete mock vehicle storage state
 * @returns A copy of the entire mock vehicle storage
 */
export const getAllMockVehicleStorageState = (): MockVehicleStorage => {
  return { ...mockVehicleStorage }
}