import { describe, expect, it } from 'vitest'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import {
  buildPrePublishValidation,
  bulkAssignPanelsCategory,
  computeWorkbenchReadiness,
  normalizeBomGapReason,
} from '@/lib/workbenchReadiness'
import type { CategoryRow } from '@/types/database'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: '1',
    source: 'tealbury',
    catalog_program: CATALOG_PROGRAM.TEALBURY,
    sku: 'SKU1',
    name: 'Test',
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
    section: '',
    door_range: 'Dawson',
    trade_code: 'B40',
    selected: false,
    options: {},
    item_kind: 'complete',
    part_type: '',
    ...partial,
  }
}

const panelsCat = { id: 'cat-panels', name: 'Panels', slug: 'panels', sort_order: 0, parent_id: null } as CategoryRow

describe('workbenchReadiness', () => {
  it('computes readiness from named, categorised, BOM, and panel kind', () => {
    const rows = [
      row({ id: 'a', name: 'Unit', category_id: 'c1', item_kind: 'complete' }),
      row({ id: 'b', name: '', category_id: null, item_kind: 'complete' }),
      row({
        id: 'c',
        name: 'Plain End Panel (Dawson)',
        section: 'Panels',
        item_kind: 'accessory',
        category_id: 'cat-panels',
      }),
    ]
    const r = computeWorkbenchReadiness(rows)
    expect(r.named.ok).toBe(2)
    expect(r.categorised.ok).toBe(2)
    expect(r.panelLikeAccessoryKind.ok).toBe(1)
  })

  it('flags duplicate SKUs and accessory-as-complete', () => {
    const rows = [
      row({ id: 'a', sku: 'dup' }),
      row({ id: 'b', sku: 'dup' }),
      row({
        id: 'c',
        name: 'Plain End Panel',
        section: 'ACCESSORIES',
        item_kind: 'complete',
      }),
    ]
    const issues = buildPrePublishValidation(rows)
    expect(issues.some((i) => i.kind === 'duplicate_sku')).toBe(true)
    expect(issues.some((i) => i.kind === 'likely_accessory_as_complete')).toBe(true)
  })

  it('bulk assigns Panels category to panel-like rows', () => {
    const rows = [
      row({
        id: 'p',
        name: 'Plain End Panel (Dawson)',
        section: 'END PANELS',
        item_kind: 'complete',
      }),
    ]
    const { rows: next, changed } = bulkAssignPanelsCategory(rows, [panelsCat])
    expect(changed).toBe(1)
    expect(next[0].category_id).toBe('cat-panels')
    expect(next[0].item_kind).toBe('accessory')
  })

  it('normalizes BOM gap reasons', () => {
    expect(normalizeBomGapReason('No UFORM door 715×397 for Dawson', [])).toBe('Missing UFORM door size')
    expect(normalizeBomGapReason(null, ['No Lamtek carcass for size 260'])).toBe('Missing Lamtek carcass SKU')
  })
})
