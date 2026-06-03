import { describe, expect, it } from 'vitest'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { rowMatchesCondition } from '@/lib/pricelistWorkbenchRules'
import { previewKitAction } from '@/lib/workbenchSmartPresets'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: '1',
    source: 'tealbury',
    catalog_program: CATALOG_PROGRAM.TEALBURY,
    sku: 'B40 · Dawson',
    name: 'Base',
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
    section: 'HL',
    door_range: 'Dawson',
    trade_code: 'B40',
    selected: false,
    options: {},
    item_kind: 'complete',
    part_type: '',
    ...partial,
  }
}

describe('workbenchSmartPresets', () => {
  it('matches kit missing on completes', () => {
    const r = row({ options: {} })
    expect(
      rowMatchesCondition(r, { field: 'kit', op: 'equals', value: 'missing' }),
    ).toBe(true)
  })

  it('previews compute all kits', () => {
    const rows = [row({}), row({ id: '2', item_kind: 'accessory', name: 'Panel' })]
    const preview = previewKitAction('compute_kits_all', rows, rows, [])
    expect(preview.affected).toBe(1)
    expect(preview.canApply).toBe(true)
  })
})
