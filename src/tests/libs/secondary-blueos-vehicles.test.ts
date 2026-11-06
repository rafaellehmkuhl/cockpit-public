import { describe, expect, it } from 'vitest'

import { normalizeBlueOsAddress } from '@/libs/secondary-blueos-vehicles'

describe('normalizeBlueOsAddress', () => {
  it('keeps a host, with or without a port', () => {
    expect(normalizeBlueOsAddress('192.168.2.2')).toBe('192.168.2.2')
    expect(normalizeBlueOsAddress(' blueos.local:8080 ')).toBe('blueos.local:8080')
  })

  it('drops the protocol, the trailing slash and the casing', () => {
    expect(normalizeBlueOsAddress('http://192.168.2.2/')).toBe('192.168.2.2')
    expect(normalizeBlueOsAddress('HTTPS://BlueOS.local')).toBe('blueos.local')
  })

  it('refuses anything that is not only a host', () => {
    expect(() => normalizeBlueOsAddress('192.168.2.2/mavlink2rest')).toThrow()
    expect(() => normalizeBlueOsAddress('192.168.2.2?a=1')).toThrow()
    expect(() => normalizeBlueOsAddress('user@192.168.2.2')).toThrow()
    expect(() => normalizeBlueOsAddress('')).toThrow()
  })
})
