import { describe, expect, it } from 'vitest'

import { assignVehicleNumbers, setVehicleNumber } from '@/libs/vehicle-numbers'

describe('assignVehicleNumbers', () => {
  it('gives new vehicles the lowest numbers not taken', () => {
    expect(assignVehicleNumbers({ a: 2 }, ['a', 'b', 'c'])).toEqual({ a: 2, b: 1, c: 3 })
  })

  it('returns the same object when every vehicle already has a number', () => {
    const numbers = { a: 1 }
    expect(assignVehicleNumbers(numbers, ['a', 'a'])).toBe(numbers)
  })
})

describe('setVehicleNumber', () => {
  it('swaps numbers with the vehicle holding the chosen one', () => {
    expect(setVehicleNumber({ a: 1, b: 2 }, 'a', 2)).toEqual({ a: 2, b: 1 })
  })

  it('moves the holder to the lowest free number when the vehicle had none', () => {
    expect(setVehicleNumber({ a: 1, b: 2 }, 'c', 1)).toEqual({ a: 3, b: 2, c: 1 })
  })

  it('takes a free number without touching the others', () => {
    expect(setVehicleNumber({ a: 1, b: 2 }, 'a', 5)).toEqual({ a: 5, b: 2 })
  })

  it('refuses numbers that are not positive integers', () => {
    expect(() => setVehicleNumber({}, 'a', 0)).toThrow()
    expect(() => setVehicleNumber({}, 'a', 1.5)).toThrow()
  })
})
