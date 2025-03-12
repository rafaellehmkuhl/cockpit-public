# Settings Sync Testing

This directory contains tools for testing the settings synchronization functionality between local storage and BlueOS vehicle storage.

## Overview

The settings sync mechanism handles synchronization of user settings between the local browser and connected BlueOS vehicles. It supports:

1. Multiple users (user IDs)
2. Multiple vehicles (vehicle IDs)
3. Migration from old settings format to new format
4. Conflict resolution based on timestamps

Testing this functionality is challenging because it involves interaction with remote vehicles. This test harness provides a set of tools to simulate different scenarios and verify the behavior of the sync mechanism.

## Test Cases

The test suite includes the following test cases:

1. **No Vehicle Settings**: Vehicle has no settings for the current user
2. **Vehicle Old Settings Format**: Vehicle has settings for the current user but in the old pattern
3. **No Local Settings**: Local has no settings for that vehicle
4. **Local Old Settings Format**: Local has only settings in the old pattern, for that vehicle
5. **Local Old Settings for Different Vehicle**: Local has only settings in the old pattern, for another vehicle

## How to Use

### Accessing the Test UI

1. Run the application
2. Navigate to `/settings-test` in the browser
3. The test harness will automatically install the mock BlueOS functions and create a test vehicle

### Running Tests

1. Click "Run All Tests" to execute all test cases
2. View the results, including initial and final state of both local and vehicle settings
3. Use "Clear Results" to reset the test results display

### Interpreting Results

For each test case, you'll see:

- Test name and description
- Success/failure status
- Initial state (before sync)
- Final state (after sync)

This information helps you verify that:
- Settings are correctly synchronized in both directions
- Old format settings are properly migrated to the new format
- Conflict resolution based on timestamps works correctly

## Adding Custom Tests

To add new test cases:

1. Create a new class extending `SettingsSyncTest` in `src/tests/libs/settings-sync-tester.ts`
2. Implement the `setupTest()` method to configure the initial conditions
3. Add your new test to the `getAllTestCases()` function

## Mock Implementation

The mock implementation of BlueOS functions is in `src/tests/libs/mock-blueos.ts`. It provides:

- In-memory storage for simulating vehicle storage
- Mock implementations of `getKeyDataFromCockpitVehicleStorage` and `setKeyDataOnCockpitVehicleStorage`
- Functions to initialize mock vehicles with custom data

## Development Notes

- The test harness monkeypatches the BlueOS functions at runtime
- Original functions are preserved and can be restored
- Tests run in the browser, no server component is needed