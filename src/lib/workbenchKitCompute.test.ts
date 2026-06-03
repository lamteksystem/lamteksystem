import { describe, expect, it } from 'vitest'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { buildKitComputePlan, isTealburyKitchenUnitComplete } from '@/lib/workbenchKitCompute'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: '1',
    source: 'tealbury',
    catalog_program: CATALOG_PROGRAM.TEALBURY,
    sku: 'B50 · Dawson',
    name: '500 HL Base Unit',
    description: '',
    unit_price: 1,
    cost_price: null,
    active: true,
    is_stock: false,
    image_url: '',
    image_alt: '',
    category_id: null,
    category_slug: '',
    category_name: '',
    section: 'HIGHLINE BASE UNITS',
    door_range: 'Dawson',
    trade_code: 'B50',
    selected: false,
    options: {},
    item_kind: 'complete',
    part_type: '',
    ...partial,
  }
}

describe('workbenchKitCompute', () => {
  it('excludes end panels mis-tagged as complete', () => {
    expect(isTealburyKitchenUnitComplete(row({}))).toBe(true)
    expect(
      isTealburyKitchenUnitComplete(
        row({
          trade_code: '18MMPLNENDPANEL',
          name: 'Plain End Panel (Dawson)',
          section: 'END PANELS',
        }),
      ),
    ).toBe(false)
  })

  it('plan samples kitchen units not panels', () => {
    const rows = [
      row({}),
      row({
        id: 'p',
        trade_code: '18MMPLNENDPANEL',
        name: 'Plain End Panel (Dawson)',
        section: 'END PANELS',
      }),
    ]
    const plan = buildKitComputePlan(rows, 'all')
    expect(plan.total).toBe(1)
    expect(plan.misTaggedPanels).toBe(1)
    expect(plan.sampleUnits[0].label).toBe('B50')
  })
})
