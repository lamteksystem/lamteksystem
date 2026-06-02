import { describe, expect, it } from 'vitest'
import { effectiveBaseUnitPrice, getFinishPriceMap, resolveFinishBasePrice } from '@/lib/finishPricing'
import type { ProductRow } from '@/types/database'

function product(options: Record<string, unknown>, unitPrice = 100): ProductRow {
  return { options, unit_price: unitPrice } as unknown as ProductRow
}

describe('finishPricing', () => {
  it('reads the tealbury finish price map', () => {
    const p = product({ tealbury_finish_prices_gbp: { 'Oakham Soft Matte': 142.5, 'Painted Colour': 175 } })
    expect(getFinishPriceMap(p)).toEqual({ 'Oakham Soft Matte': 142.5, 'Painted Colour': 175 })
  })

  it('reads the lamtek finish price map when tealbury is absent', () => {
    const p = product({ lamtek_finish_prices_gbp: { 'Gloss White': 90 } })
    expect(getFinishPriceMap(p)).toEqual({ 'Gloss White': 90 })
  })

  it('returns null when there is no finish matrix', () => {
    expect(getFinishPriceMap(product({ lead_time_days: 5 }))).toBeNull()
  })

  it('resolves a finish price case-insensitively', () => {
    const p = product({ tealbury_finish_prices_gbp: { 'Oakham Soft Matte': 142.5 } })
    expect(resolveFinishBasePrice(p, 'oakham soft matte')).toBe(142.5)
    expect(resolveFinishBasePrice(p, '  Oakham Soft Matte ')).toBe(142.5)
  })

  it('returns null for an unmatched or empty finish', () => {
    const p = product({ tealbury_finish_prices_gbp: { 'Oakham Soft Matte': 142.5 } })
    expect(resolveFinishBasePrice(p, 'Gloss White')).toBeNull()
    expect(resolveFinishBasePrice(p, '')).toBeNull()
    expect(resolveFinishBasePrice(p, '— none recorded —')).toBeNull()
  })

  it('effectiveBaseUnitPrice uses the finish price when available, else unit_price', () => {
    const doorProduct = product({ tealbury_finish_prices_gbp: { Dawson: 200, White: 150 } }, 150)
    const carcass = product({ lead_time_days: 3 }, 80)
    expect(effectiveBaseUnitPrice(doorProduct, 'Dawson')).toBe(200)
    // carcass has no finish matrix -> keeps its unit_price regardless of finish
    expect(effectiveBaseUnitPrice(carcass, 'Dawson')).toBe(80)
    // door product with no chosen finish -> falls back to cheapest imported unit_price
    expect(effectiveBaseUnitPrice(doorProduct, null)).toBe(150)
  })
})
