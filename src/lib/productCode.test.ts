import { describe, it, expect } from 'vitest'
import {
  abbreviateRange,
  abbreviateToken,
  buildStyleCode,
  carcassFinishCode,
  composeProductCode,
  composeAssemblyCode,
  composeProductLineCode,
  deriveWidthMm,
  unitTypeCode,
  type OrderSetupForCode,
} from './productCode'

const SETUP: OrderSetupForCode = {
  build_style: 'flat_pack',
  line_style_preference: 'high_line',
  carcass_finish: 'white',
  door_finish: 'Dawson White',
  rangeName: 'Dawson',
}

describe('abbreviateRange', () => {
  it('takes the first three letters uppercased', () => {
    expect(abbreviateRange('Dawson')).toBe('DAW')
    expect(abbreviateRange('Norwood')).toBe('NOR')
    expect(abbreviateRange('Papplewick')).toBe('PAP')
  })
  it('handles empty/null', () => {
    expect(abbreviateRange(null)).toBe('')
    expect(abbreviateRange('')).toBe('')
  })
})

describe('abbreviateToken', () => {
  it('uses the last word of a finish label', () => {
    expect(abbreviateToken('Dawson White')).toBe('WHI')
    expect(abbreviateToken('Soft Matte')).toBe('MAT')
  })
})

describe('carcassFinishCode', () => {
  it('maps known finishes', () => {
    expect(carcassFinishCode('white')).toBe('WHI')
    expect(carcassFinishCode('light-oak')).toBe('OAK')
    expect(carcassFinishCode('graphite')).toBe('GRA')
  })
  it('falls back to an abbreviation for unknown finishes', () => {
    expect(carcassFinishCode('Sage Green')).toBe('GRE')
  })
})

describe('buildStyleCode', () => {
  it('prefers line style', () => {
    expect(buildStyleCode('flat_pack', 'high_line')).toBe('HL')
    expect(buildStyleCode('rigid', 'drawer_line')).toBe('DL')
    expect(buildStyleCode(null, 'mixed')).toBe('MX')
  })
  it('falls back to build style when no line style', () => {
    expect(buildStyleCode('flat_pack', null)).toBe('FP')
    expect(buildStyleCode('rigid', null)).toBe('RG')
    expect(buildStyleCode(null, null)).toBe('')
  })
})

describe('unitTypeCode', () => {
  it('maps unit types', () => {
    expect(unitTypeCode('base_unit')).toBe('BASE')
    expect(unitTypeCode('wall_unit')).toBe('WALL')
    expect(unitTypeCode('tall_unit')).toBe('TALL')
    expect(unitTypeCode('other')).toBe('UNIT')
    expect(unitTypeCode(null)).toBe('')
  })
})

describe('deriveWidthMm', () => {
  it('prefers the assembly width', () => {
    expect(deriveWidthMm({ assemblyWidthMm: 1000 })).toBe(1000)
  })
  it('reads options dims', () => {
    expect(
      deriveWidthMm({ product: { options: { tealbury_dims_mm: { w: 600 } }, name: 'x', sku: 'x' } }),
    ).toBe(600)
  })
  it('parses a width from the name when no dims', () => {
    expect(deriveWidthMm({ product: { options: {}, name: '1000 Base unit', sku: 'BASE' } })).toBe(1000)
  })
  it('returns null when nothing usable', () => {
    expect(deriveWidthMm({ product: { options: {}, name: 'Hinge', sku: 'HNG' } })).toBeNull()
  })
})

describe('composeProductCode', () => {
  it('builds the full dashed code in order', () => {
    expect(
      composeProductCode({
        widthMm: 1000,
        buildStyle: 'flat_pack',
        lineStyle: 'high_line',
        unitType: 'base_unit',
        carcassFinish: 'white',
        rangeName: 'Dawson',
        doorFinish: 'Dawson White',
      }),
    ).toBe('1000-HL-BASE-WHI-DAW-WHI')
  })
  it('omits empty segments', () => {
    expect(composeProductCode({ widthMm: 600, rangeName: 'Norwood' })).toBe('600-NOR')
    expect(composeProductCode({})).toBe('')
  })
})

describe('composeAssemblyCode', () => {
  it('uses assembly type/width with order setup', () => {
    expect(
      composeAssemblyCode({ unit_type: 'base_unit', width_mm: 1000 }, SETUP),
    ).toBe('1000-HL-BASE-WHI-DAW-WHI')
  })
})

describe('composeProductLineCode', () => {
  it('composes a best-effort code without a unit type', () => {
    expect(
      composeProductLineCode({ options: {}, name: '600 Wall unit', sku: 'W600' }, SETUP),
    ).toBe('600-HL-WHI-DAW-WHI')
  })
})
