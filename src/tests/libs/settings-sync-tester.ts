import * as blueos from '../../libs/blueos'
import {
  CockpitSetting,
  OldCockpitSetting,
  clearLocalSettings,
  getCurrentLocalSettings
} from '../../libs/settings-management'
import {
  getMockVehicleStorageState,
  mockGetKeyDataFromCockpitVehicleStorage,
  mockSetKeyDataOnCockpitVehicleStorage,
  resetMockVehicleStorage,
  setupMockVehicle
} from './mock-blueos'

/**
 * Represents a test result for a settings sync test
 */
export interface SettingsSyncTestResult {
  /**
   * The name of the test
   */
  name: string
  /**
   * Test description
   */
  description: string
  /**
   * Whether the test passed or failed
   */
  success: boolean
  /**
   * Test result message
   */
  message: string
  /**
   * Initial state of the test
   */
  initialState: {
    /**
     * Local settings state before test
     */
    localSettings: any
    /**
     * Vehicle settings state before test
     */
    vehicleSettings: any
  }
  /**
   * Final state after test
   */
  finalState: {
    /**
     * Local settings state after test
     */
    localSettings: any
    /**
     * Vehicle settings state after test
     */
    vehicleSettings: any
  }
}

/**
 * Base class for settings sync tests
 */
export abstract class SettingsSyncTest {
  /**
   * Test name
   */
  public name: string
  /**
   * Test description
   */
  public description: string
  /**
   * Vehicle ID used in the test
   */
  protected vehicleId = 'test-vehicle-id'
  /**
   * Vehicle address used in the test
   */
  protected vehicleAddress = 'localhost:8080'
  /**
   * User ID used in the test
   */
  protected userId = 'test-user'
  /**
   * Mock functions for blueos
   */
  protected originalGetKeyData: typeof blueos.getKeyDataFromCockpitVehicleStorage
  protected originalSetKeyData: typeof blueos.setKeyDataOnCockpitVehicleStorage

  /**
   * Constructor
   * @param name - Test name
   * @param description - Test description
   */
  constructor(name: string, description: string) {
    this.name = name
    this.description = description
    this.originalGetKeyData = blueos.getKeyDataFromCockpitVehicleStorage
    this.originalSetKeyData = blueos.setKeyDataOnCockpitVehicleStorage
  }

  /**
   * Install mock functions for blueos
   */
  protected installMocks(): void {
    // Save original functions
    this.originalGetKeyData = blueos.getKeyDataFromCockpitVehicleStorage
    this.originalSetKeyData = blueos.setKeyDataOnCockpitVehicleStorage

    // Override with mock implementations
    // @ts-ignore - we're intentionally overriding these functions
    blueos.getKeyDataFromCockpitVehicleStorage = mockGetKeyDataFromCockpitVehicleStorage
    // @ts-ignore - we're intentionally overriding these functions
    blueos.setKeyDataOnCockpitVehicleStorage = mockSetKeyDataOnCockpitVehicleStorage
  }

  /**
   * Restore original functions
   * @returns void
   */
  protected restoreMocks(): void {
    // Restore original functions
    // @ts-ignore - we're intentionally overriding these functions
    blueos.getKeyDataFromCockpitVehicleStorage = this.originalGetKeyData
    // @ts-ignore - we're intentionally overriding these functions
    blueos.setKeyDataOnCockpitVehicleStorage = this.originalSetKeyData
  }

  /**
   * Set up the test environment with initial conditions
   */
  protected abstract setupTest(): Promise<void>

  /**
   * Run the test and return the result
   * @returns Promise with the test result
   */
  public async run(): Promise<SettingsSyncTestResult> {
    // Reset mock vehicle storage
    resetMockVehicleStorage()
    // Reset local settings
    clearLocalSettings()

    // Install mocks
    this.installMocks()

    try {
      // Set up test
      await this.setupTest()

      // Record initial state
      const initialVehicleSettings = getMockVehicleStorageState(this.vehicleAddress)
      const initialLocalSettings = getCurrentLocalSettings()

      // Trigger sync
      const event = new CustomEvent('vehicle-online', {
        detail: { vehicleAddress: this.vehicleAddress }
      })
      window.dispatchEvent(event)

      // Wait for sync to complete (add delay to ensure async operations complete)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Record final state
      const finalVehicleSettings = getMockVehicleStorageState(this.vehicleAddress)
      const finalLocalSettings = getCurrentLocalSettings()

      return {
        name: this.name,
        description: this.description,
        success: true,
        message: 'Test completed successfully',
        initialState: {
          localSettings: initialLocalSettings,
          vehicleSettings: initialVehicleSettings
        },
        finalState: {
          localSettings: finalLocalSettings,
          vehicleSettings: finalVehicleSettings
        }
      }
    } catch (error) {
      return {
        name: this.name,
        description: this.description,
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        initialState: {
          localSettings: getCurrentLocalSettings(),
          vehicleSettings: getMockVehicleStorageState(this.vehicleAddress)
        },
        finalState: {
          localSettings: getCurrentLocalSettings(),
          vehicleSettings: getMockVehicleStorageState(this.vehicleAddress)
        }
      }
    } finally {
      // Restore original functions
      this.restoreMocks()
    }
  }
}

/**
 * Test case: Vehicle has no settings for the current user
 */
export class NoVehicleSettingsTest extends SettingsSyncTest {
  /**
   * Constructor for NoVehicleSettingsTest
   */
  constructor() {
    super(
      'No Vehicle Settings',
      'Vehicle has no settings for the current user'
    )
  }

  /**
   * Set up the test environment with initial conditions
   * @returns Promise that resolves when setup is complete
   */
  protected async setupTest(): Promise<void> {
    // Set up vehicle with ID but no settings
    setupMockVehicle(this.vehicleAddress, {
      'cockpit/cockpit-vehicle-id': this.vehicleId
    })

    // Add some local settings for the user/vehicle
    const localSettings = getCurrentLocalSettings()
    if (!localSettings[this.userId]) {
      localSettings[this.userId] = {}
    }
    if (!localSettings[this.userId][this.vehicleId]) {
      localSettings[this.userId][this.vehicleId] = {}
    }

    // Add a sample setting
    localSettings[this.userId][this.vehicleId]['cockpit-test-setting'] = {
      epochLastChangedLocally: Date.now(),
      value: 'local-value'
    }
  }
}

/**
 * Test case: Vehicle has settings for the current user but in old format
 */
export class VehicleOldSettingsFormatTest extends SettingsSyncTest {
  /**
   * Constructor for VehicleOldSettingsFormatTest
   */
  constructor() {
    super(
      'Vehicle Old Settings Format',
      'Vehicle has settings for the current user but in old format'
    )
  }

  /**
   * Set up the test environment with initial conditions
   * @returns Promise that resolves when setup is complete
   */
  protected async setupTest(): Promise<void> {
    // Set up vehicle with ID
    setupMockVehicle(this.vehicleAddress, {
      'cockpit/cockpit-vehicle-id': this.vehicleId
    })

    // Add settings in old format to vehicle
    const settings: Record<string, Record<string, OldCockpitSetting>> = {}
    settings[this.userId] = {}
    settings[this.userId]['cockpit-test-setting'] = 'vehicle-old-value'

    // Set up vehicle settings
    await mockSetKeyDataOnCockpitVehicleStorage(this.vehicleAddress, 'settings', settings)

    // Add some local settings in new format
    const localSettings = getCurrentLocalSettings()
    if (!localSettings[this.userId]) {
      localSettings[this.userId] = {}
    }
    if (!localSettings[this.userId][this.vehicleId]) {
      localSettings[this.userId][this.vehicleId] = {}
    }

    // Add a different sample setting with newer timestamp
    localSettings[this.userId][this.vehicleId]['cockpit-different-setting'] = {
      epochLastChangedLocally: Date.now(),
      value: 'local-value'
    }
  }
}

/**
 * Test case: Local has no settings for that vehicle
 */
export class NoLocalSettingsTest extends SettingsSyncTest {
  /**
   * Constructor for NoLocalSettingsTest
   */
  constructor() {
    super(
      'No Local Settings',
      'Local has no settings for the current vehicle'
    )
  }

  /**
   * Set up the test environment with initial conditions
   * @returns Promise that resolves when setup is complete
   */
  protected async setupTest(): Promise<void> {
    // Set up vehicle with ID
    setupMockVehicle(this.vehicleAddress, {
      'cockpit/cockpit-vehicle-id': this.vehicleId
    })

    // Add settings in new format to vehicle
    const settings: Record<string, Record<string, CockpitSetting>> = {}
    settings[this.userId] = {}
    settings[this.userId]['cockpit-test-setting'] = {
      epochLastChangedLocally: Date.now(),
      value: 'vehicle-value'
    }

    // Set up vehicle settings
    await mockSetKeyDataOnCockpitVehicleStorage(this.vehicleAddress, 'settings', settings)

    // No local settings for this vehicle
    // (local settings are cleared at the beginning of the test)
  }
}

/**
 * Test case: Local has only settings in old pattern for that vehicle
 */
export class LocalOldSettingsFormatTest extends SettingsSyncTest {
  /**
   * Constructor for LocalOldSettingsFormatTest
   */
  constructor() {
    super(
      'Local Old Settings Format',
      'Local has only settings in old format for the current vehicle'
    )
  }

  /**
   * Set up the test environment with initial conditions
   * @returns Promise that resolves when setup is complete
   */
  protected async setupTest(): Promise<void> {
    // Set up vehicle with ID
    setupMockVehicle(this.vehicleAddress, {
      'cockpit/cockpit-vehicle-id': this.vehicleId
    })

    // Add settings in new format to vehicle
    const settings: Record<string, Record<string, CockpitSetting>> = {}
    settings[this.userId] = {}
    settings[this.userId]['cockpit-test-setting'] = {
      epochLastChangedLocally: Date.now(),
      value: 'vehicle-value'
    }

    // Set up vehicle settings
    await mockSetKeyDataOnCockpitVehicleStorage(this.vehicleAddress, 'settings', settings)

    // Set up local settings in old format
    localStorage.setItem('cockpit-old-test-setting', JSON.stringify('local-old-value'))
  }
}

/**
 * Test case: Local has only settings in old pattern for another vehicle
 */
export class LocalOldSettingsForDifferentVehicleTest extends SettingsSyncTest {
  /**
   * Constructor for LocalOldSettingsForDifferentVehicleTest
   */
  constructor() {
    super(
      'Local Old Settings for Different Vehicle',
      'Local has only settings in old format for a different vehicle'
    )
  }

  /**
   * Set up the test environment with initial conditions
   * @returns Promise that resolves when setup is complete
   */
  protected async setupTest(): Promise<void> {
    // Set up vehicle with ID
    setupMockVehicle(this.vehicleAddress, {
      'cockpit/cockpit-vehicle-id': this.vehicleId
    })

    // Add settings in new format to vehicle
    const settings: Record<string, Record<string, CockpitSetting>> = {}
    settings[this.userId] = {}
    settings[this.userId]['cockpit-test-setting'] = {
      epochLastChangedLocally: Date.now(),
      value: 'vehicle-value'
    }

    // Set up vehicle settings
    await mockSetKeyDataOnCockpitVehicleStorage(this.vehicleAddress, 'settings', settings)

    // Set up local settings for a different vehicle ID in old format
    const differentVehicleId = 'different-vehicle-id'
    localStorage.setItem('cockpit-last-connected-vehicle-id', differentVehicleId)
    localStorage.setItem('cockpit-old-test-setting', JSON.stringify('local-old-value'))
  }
}

/**
 * Get all available test cases
 * @returns Array of test cases
 */
export const getAllTestCases = (): SettingsSyncTest[] => {
  return [
    new NoVehicleSettingsTest(),
    new VehicleOldSettingsFormatTest(),
    new NoLocalSettingsTest(),
    new LocalOldSettingsFormatTest(),
    new LocalOldSettingsForDifferentVehicleTest()
  ]
}

/**
 * Run all test cases
 * @returns Promise with array of test results
 */
export const runAllTests = async (): Promise<SettingsSyncTestResult[]> => {
  const tests = getAllTestCases()
  const results: SettingsSyncTestResult[] = []

  for (const test of tests) {
    const result = await test.run()
    results.push(result)
  }

  return results
}