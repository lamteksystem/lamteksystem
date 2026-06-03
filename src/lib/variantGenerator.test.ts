import { describe, it, expect } from 'vitest'
import {
  applyVariantTemplate,
  buildFinishPriceMatrix,
  cheapestFinishPrice,
  doorCountForWidth,
  doorDimsForUnit,
  doorWidthForUnit,
  finishCode,
} from './variantGenerator'

describe('door geometry', () => {
  it('uses one door up to 600mm, two above', () => {
    expect(doorCountForWidth(300)).toBe(1)
    expect(doorCountForWidth(400)).toBe(1)
    expect(doorCountForWidth(600)).toBe(1)
    expect(doorCountForWidth(800)).toBe(2)
    expect(doorCountForWidth(1000)).toBe(2)
  })

  it('subtracts the 3mm opening tolerance (user spec: 400 unit => 397 door)', () => {
    expect(doorWidthForUnit(400, 1)).toBe(397)
    expect(doorWidthForUnit(600, 1)).toBe(597)
    expect(doorWidthForUnit(1000, 2)).toBe(497)
    expect(doorWidthForUnit(800, 2)).toBe(397)
  })

  it('derives full door dims for a unit', () => {
    expect(doorDimsForUnit(400)).toEqual({ count: 1, widthMm: 397, heightMm: 715 })
    expect(doorDimsForUnit(1000)).toEqual({ count: 2, widthMm: 497, heightMm: 715 })
  })
})

describe('finish price matrix', () => {
  it('builds a colour→price map from explicit prices', () => {
    expect(
      buildFinishPriceMatrix([
        { label: 'White', price: 62.54 },
        { label: 'Plain', price: 77.64 },
      ]),
    ).toEqual({ White: 62.54, Plain: 77.64 })
  })

  it('derives prices from base + uplift and rounds to 2dp', () => {
    expect(
      buildFinishPriceMatrix(
        [
          { label: 'White' },
          { label: 'Oak', uplift: 12.5 },
        ],
        50,
      ),
    ).toEqual({ White: 50, Oak: 62.5 })
  })

  it('finds the cheapest finish for the catalogue price', () => {
    expect(cheapestFinishPrice({ White: 62.54, Plain: 77.64, Grained: 81.22 })).toBe(62.54)
    expect(cheapestFinishPrice({})).toBeNull()
  })

  it('abbreviates finish labels', () => {
    expect(finishCode('White')).toBe('WHI')
    expect(finishCode('Light Oak')).toBe('LIG')
  })
})

describe('applyVariantTemplate', () => {
  it('substitutes placeholders and collapses whitespace', () => {
    expect(
      applyVariantTemplate('{SIZE} {RANGE} Base Unit', { size: '1000', range: 'Dawson' }),
    ).toBe('1000 Dawson Base Unit')
    expect(
      applyVariantTemplate('B{SIZE}-HL-{RANGE_CODE}', { size: '1000', rangeCode: 'DAW' }),
    ).toBe('B1000-HL-DAW')
  })

  it('drops missing placeholders cleanly', () => {
    expect(applyVariantTemplate('{SIZE} Base ({FINISH})', { size: '600' })).toBe('600 Base ()')
  })
})
