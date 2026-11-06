/**
 * Numbers that name each vehicle's data-lake variables, kept per vehicle id so a vehicle keeps its number across
 * address changes and restarts. Numbers start at 1 and are never shared by two vehicles.
 */
export type VehicleNumbers = Record<string, number>

const lowestFreeNumber = (takenNumbers: Set<number>): number => {
  let candidate = 1
  while (takenNumbers.has(candidate)) candidate++
  return candidate
}

/**
 * Gives every vehicle that has no number yet the lowest one not taken.
 * @param {VehicleNumbers} numbers Current numbers
 * @param {string[]} vehicleIds Vehicles that should have a number
 * @returns {VehicleNumbers} The numbers, as the same object when nothing changed
 */
export const assignVehicleNumbers = (numbers: VehicleNumbers, vehicleIds: string[]): VehicleNumbers => {
  const missingIds = [...new Set(vehicleIds)].filter((vehicleId) => numbers[vehicleId] === undefined)
  if (missingIds.length === 0) return numbers

  const assigned = { ...numbers }
  const takenNumbers = new Set(Object.values(assigned))
  missingIds.forEach((vehicleId) => {
    const vehicleNumber = lowestFreeNumber(takenNumbers)
    assigned[vehicleId] = vehicleNumber
    takenNumbers.add(vehicleNumber)
  })
  return assigned
}

/**
 * Gives a vehicle a chosen number. A vehicle already holding it swaps to the one the vehicle had, or, when the
 * vehicle had none, to the lowest one free.
 * @param {VehicleNumbers} numbers Current numbers
 * @param {string} vehicleId Vehicle to renumber
 * @param {number} vehicleNumber Number to give it, a positive integer
 * @returns {VehicleNumbers} The new numbers
 * @throws {Error} When the number is not a positive integer
 */
export const setVehicleNumber = (numbers: VehicleNumbers, vehicleId: string, vehicleNumber: number): VehicleNumbers => {
  if (!Number.isInteger(vehicleNumber) || vehicleNumber < 1) {
    throw new Error(`A vehicle number must be a positive integer, got ${vehicleNumber}.`)
  }

  const renumbered = { ...numbers }
  const previousNumber = renumbered[vehicleId]
  const holderId = Object.keys(renumbered).find((id) => id !== vehicleId && renumbered[id] === vehicleNumber)
  renumbered[vehicleId] = vehicleNumber
  if (holderId !== undefined) {
    renumbered[holderId] = previousNumber ?? lowestFreeNumber(new Set(Object.values(renumbered)))
  }
  return renumbered
}
