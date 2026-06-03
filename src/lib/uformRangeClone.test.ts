import { describe, expect, it } from 'vitest'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import {
  cloneUformSizesToMissingRanges,
  extractUformTemplates,
  previewUformRangeClone,
} from '@/lib/uformRangeClone'

function uformRow(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: 'u1',
    source: 'uform',
    catalog_program: CATALOG_PROGRAM.TEALBURY,
    sku: 'UF-DAWSON-DR-715X497',
    name: 'Dawson Door 715×497 mm',
    description: '',
    unit_price: 0,
    cost_price: null,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    category_id: null,
    category_slug: '',
    category_name: '',
    section: 'Doors',
    door_range: 'Dawson',
    trade_code: '',
    selected: false,
    options: { height_mm: 715, width_mm: 497 },
    item_kind: 'door',
    part_type: 'door',
    ...partial,
  }
}

describe('uformRangeClone', () => {
  it('extracts unique templates from source range', () => {
    const rows = [
      uformRow({}),
      uformRow({ id: 'u2', sku: 'UF-DAWSON-DR-715X497', options: { height_mm: 715, width_mm: 497 } }),
      uformRow({ id: 'u3', sku: 'UF-DAWSON-DR-715X597', options: { height_mm: 715, width_mm: 597 } }),
    ]
    expect(extractUformTemplates(rows, 'Dawson')).toHaveLength(2)
  })

  it('clones missing sizes into Oakham', () => {
    const rows = [uformRow({})]
    const preview = previewUformRangeClone(rows, { sourceRange: 'Dawson' })
    expect(preview?.targetRanges).toContain('Oakham Soft Matte')
    expect(preview?.wouldAdd).toBeGreaterThan(0)

    const res = cloneUformSizesToMissingRanges(rows, { sourceRange: 'Dawson', targetRanges: ['Oakham Soft Matte'] })
    expect(res.added).toBe(1)
    const oak = res.rows.find((r) => r.door_range === 'Oakham Soft Matte' && r.item_kind === 'door')
    expect(oak?.sku).toMatch(/OAKHAM/i)
    expect(oak?.name).toContain('715')
  })
})
