import * as blueos from '../../libs/blueos'
import {
  mockGetKeyDataFromCockpitVehicleStorage,
  mockSetKeyDataOnCockpitVehicleStorage,
  resetMockVehicleStorage,
  setupMockVehicle
} from './mock-blueos'

/**
 * Original function references
 */
let originalGetKeyData: typeof blueos.getKeyDataFromCockpitVehicleStorage
let originalSetKeyData: typeof blueos.setKeyDataOnCockpitVehicleStorage

/**
 * Flag to track if mocks are installed
 */
let mocksInstalled = false

/**
 * Install mock BlueOS functions
 * @returns void
 */
export const installMocks = (): void => {
  if (mocksInstalled) {
    return
  }

  // Save original functions
  originalGetKeyData = blueos.getKeyDataFromCockpitVehicleStorage
  originalSetKeyData = blueos.setKeyDataOnCockpitVehicleStorage

  // Override with mock implementations
  // @ts-ignore - we're intentionally overriding these functions
  blueos.getKeyDataFromCockpitVehicleStorage = mockGetKeyDataFromCockpitVehicleStorage
  // @ts-ignore - we're intentionally overriding these functions
  blueos.setKeyDataOnCockpitVehicleStorage = mockSetKeyDataOnCockpitVehicleStorage

  mocksInstalled = true
  console.log('BlueOS mock functions installed')
}

/**
 * Remove mock BlueOS functions
 * @returns void
 */
export const removeMocks = (): void => {
  if (!mocksInstalled) {
    return
  }

  // Restore original functions
  // @ts-ignore - we're intentionally overriding these functions
  blueos.getKeyDataFromCockpitVehicleStorage = originalGetKeyData
  // @ts-ignore - we're intentionally overriding these functions
  blueos.setKeyDataOnCockpitVehicleStorage = originalSetKeyData

  mocksInstalled = false
  console.log('BlueOS mock functions removed')
}

/**
 * Create a test vehicle for manual testing
 * @param vehicleAddress - Address of the mock vehicle
 * @param vehicleId - ID of the mock vehicle
 * @param userId - User ID for settings
 * @returns void
 */
export const createTestVehicle = (
  vehicleAddress = 'localhost:8080',
  vehicleId = 'test-vehicle-id',
  userId = 'test-user'
): void => {
  // Reset mock storage
  resetMockVehicleStorage()

  // Set up vehicle with ID
  setupMockVehicle(vehicleAddress, {
    'cockpit/cockpit-vehicle-id': vehicleId
  })

  console.log(`Test vehicle created: ${vehicleAddress} (ID: ${vehicleId}) for user ${userId}`)
}