import { describe, expect, it } from 'vitest'
import { tealburyShouldAppendDoorRange, tealburySkipPricelistHub } from '@/lib/tealburyPricelistParse'

describe('tealburySkipPricelistHub', () => {
  it('returns false when only one productive sheet', () => {
    expect(tealburySkipPricelistHub(['Pricelist'])).toBe(false)
    expect(tealburySkipPricelistHub(['Oakham Soft Matte'])).toBe(false)
  })
  it('returns true when Pricelist and another sheet both have rows', () => {
    expect(tealburySkipPricelistHub(['Pricelist', 'Oakham Soft Matte'])).toBe(true)
  })
})

describe('tealburyShouldAppendDoorRange', () => {
  it('never appends on Pricelist hub sheet', () => {
    expect(tealburyShouldAppendDoorRange('Pricelist', ['Pricelist', 'Oakham'], true)).toBe(false)
  })
  it('appends on range sheets when hub is skipped', () => {
    expect(tealburyShouldAppendDoorRange('Oakham Soft Matte', ['Pricelist', 'Oakham Soft Matte'], true)).toBe(true)
  })
  it('no suffix on Pricelist-only workbook', () => {
    expect(tealburyShouldAppendDoorRange('Pricelist', ['Pricelist'], false)).toBe(false)
  })
  it('suffix on single non-Pricelist sheet', () => {
    expect(tealburyShouldAppendDoorRange('Oakham Soft Matte', ['Oakham Soft Matte'], false)).toBe(true)
  })
  it('suffix when multiple productive sheets without hub skip', () => {
    expect(tealburyShouldAppendDoorRange('No Doors', ['No Doors', 'Oakham Gloss'], false)).toBe(true)
  })
})
