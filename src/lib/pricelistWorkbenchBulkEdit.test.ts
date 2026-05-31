import { describe, expect, it } from 'vitest'
import { applyBulkEdit, emptyBulkEditSpec } from '@/lib/pricelistWorkbenchBulkEdit'
import { rowCategoryIds, rowSections, type PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { CategoryRow } from '@/types/database'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: partial.id ?? '1',
    source: partial.source ?? 'lamtek',
    catalog_program: partial.catalog_program ?? CATALOG_PROGRAM.LAMTEK,
    sku: partial.sku ?? 'SKU1',
    name: partial.name ?? 'END PANEL',
    description: partial.description ?? '',
    unit_price: partial.unit_price ?? 100,
    cost_price: partial.cost_price ?? 75,
    active: partial.active ?? true,
    is_stock: partial.is_stock ?? true,
    image_url: '',
    image_alt: '',
    category_id: partial.category_id ?? null,
    category_slug: '',
    category_name: '',
    section: partial.section ?? '',
    door_range: '',
    trade_code: '',
    selected: false,
    options: {},
    item_kind: partial.item_kind ?? 'component',
    part_type: partial.part_type ?? '',
    ...partial,
  }
}

const categories: CategoryRow[] = [
  { id: 'cat-panels', name: 'Panels', slug: 'panels', sort_order: 0, parent_id: null },
  { id: 'cat-base', name: 'Base units', slug: 'base-units', sort_order: 1, parent_id: null },
]

describe('applyBulkEdit', () => {
  it('assigns a category to all selected rows (the panel example)', () => {
    const rows = [row({ id: 'a', name: 'End Panel' }), row({ id: 'b', name: 'Tall Panel' })]
    const spec = emptyBulkEditSpec()
    spec.categories = { mode: 'replace', values: ['cat-panels'] }
    const { rows: next, changed } = applyBulkEdit(rows, new Set(['a', 'b']), spec, categories)
    expect(changed).toBe(2)
    expect(next[0].category_id).toBe('cat-panels')
    expect(next[0].category_name).toBe('Panels')
    expect(rowCategoryIds(next[1])).toEqual(['cat-panels'])
  })

  it('adds a section without dropping existing ones', () => {
    const rows = [row({ id: 'a', section: 'HIGHLINE' })]
    const spec = emptyBulkEditSpec()
    spec.sections = { mode: 'add', values: ['Panels'] }
    const { rows: next } = applyBulkEdit(rows, new Set(['a']), spec, categories)
    expect(rowSections(next[0]).sort()).toEqual(['HIGHLINE', 'Panels'])
  })

  it('increases price by a percentage and rounds to 2dp', () => {
    const rows = [row({ id: 'a', unit_price: 100 })]
    const spec = emptyBulkEditSpec()
    spec.price = { mode: 'increase_pct', value: 10 }
    const { rows: next } = applyBulkEdit(rows, new Set(['a']), spec, categories)
    expect(next[0].unit_price).toBe(110)
  })

  it('runs find & replace and change case together on a field', () => {
    const rows = [row({ id: 'a', name: 'OLD END PANEL' })]
    const spec = emptyBulkEditSpec()
    spec.findReplace = { field: 'name', find: 'OLD ', replace: '' }
    spec.textCase = { field: 'name', mode: 'sentence' }
    const { rows: next } = applyBulkEdit(rows, new Set(['a']), spec, categories)
    expect(next[0].name).toBe('End panel')
  })

  it('does nothing when the spec is empty', () => {
    const rows = [row({ id: 'a' })]
    const { changed } = applyBulkEdit(rows, new Set(['a']), emptyBulkEditSpec(), categories)
    expect(changed).toBe(0)
  })
})
