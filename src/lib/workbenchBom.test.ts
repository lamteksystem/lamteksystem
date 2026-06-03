import { describe, expect, it } from 'vitest'
import {
  applyHingeBrandToDraftBom,
  buildDraftComponentPool,
  bulkComputeDraftBom,
  computeDraftBom,
  getWorkbenchBom,
  hasWorkbenchBom,
  mergeWorkbenchRowPatch,
  workbenchBomPatch,
} from '@/lib/workbenchBom'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'

function row(partial: Partial<PricelistWorkbenchRow> & Pick<PricelistWorkbenchRow, 'id' | 'sku' | 'name'>): PricelistWorkbenchRow {
  return {
    id: partial.id,
    sku: partial.sku,
    name: partial.name,
    description: partial.description ?? '',
    trade_code: partial.trade_code ?? 'B100',
    door_range: partial.door_range ?? 'Dawson',
    section: partial.section ?? 'HIGHLINE BASE UNITS',
    source: partial.source ?? 'tealbury',
    catalog_program: partial.catalog_program ?? 'tealbury',
    item_kind: partial.item_kind ?? 'complete',
    part_type: partial.part_type ?? '',
    category_id: partial.category_id ?? null,
    category_slug: partial.category_slug ?? '',
    category_name: partial.category_name ?? '',
    category_ids: partial.category_ids ?? [],
    image_url: partial.image_url ?? '',
    image_alt: partial.image_alt ?? '',
    cost_price: partial.cost_price ?? 0,
    unit_price: partial.unit_price ?? 100,
    active: true,
    is_stock: false,
    selected: false,
    options: partial.options ?? { tealbury_dims_mm: { w: '400' } },
  }
}

describe('workbenchBom', () => {
  const poolRows: PricelistWorkbenchRow[] = [
    row({ id: 'c1', sku: '1000-HL-BASE-DAW', name: '400 HL Base Dawson', item_kind: 'complete' }),
    row({ id: 'l1', sku: 'B100', name: '1000mm base carcass', source: 'lamtek', item_kind: 'component', part_type: 'unit' }),
    row({ id: 'l2', sku: 'TIT110', name: 'Titus hinge 110', source: 'lamtek', item_kind: 'component', part_type: 'hinge' }),
    row({ id: 'l3', sku: 'TIT111', name: 'Titus plate', source: 'lamtek', item_kind: 'component', part_type: 'hinge_plate' }),
    row({ id: 'l4', sku: 'LEG1', name: 'Leg kit', source: 'lamtek', item_kind: 'component', part_type: 'leg_kit' }),
    row({ id: 'l5', sku: 'FIT1', name: 'Fittings pack', source: 'lamtek', item_kind: 'component', part_type: 'fittings' }),
    row({
      id: 'u1',
      sku: 'UF-DAWSON-DR-715X397',
      name: 'Dawson door 715×397',
      source: 'uform',
      item_kind: 'door',
      part_type: 'door',
    }),
  ]

  it('computes draft BOM with auto-sized door for 400mm unit', () => {
    const complete = poolRows[0]
    const { bom, error } = computeDraftBom(complete, { allRows: poolRows, hingeBrand: 'titus' })
    expect(error).toBeNull()
    expect(bom?.lines.length).toBeGreaterThan(0)
    const door = bom?.lines.find((l) => l.component_role === 'door')
    expect(door?.component_sku).toMatch(/715/i)
    expect(door?.component_sku).toMatch(/397/i)
    expect(bom?.templateId).toBe('hl-base-standard')
  })

  it('stores and reads workbench_bom via patch helpers', () => {
    const complete = poolRows[0]
    const { bom } = computeDraftBom(complete, { allRows: poolRows })
    expect(bom).toBeTruthy()
    const patched = mergeWorkbenchRowPatch(complete, workbenchBomPatch(bom!))
    expect(hasWorkbenchBom(patched)).toBe(true)
    expect(getWorkbenchBom(patched)?.lines.length).toBe(bom!.lines.length)
  })

  it('swaps hinge lines when previewing Hafele', () => {
    const rows = [
      ...poolRows,
      row({ id: 'h1', sku: 'HET110', name: 'Hettich hinge', source: 'lamtek', item_kind: 'component', part_type: 'hinge' }),
      row({ id: 'h2', sku: 'HET111', name: 'Hettich plate', source: 'lamtek', item_kind: 'component', part_type: 'hinge_plate' }),
    ]
    const { bom } = computeDraftBom(rows[0], { allRows: rows, hingeBrand: 'titus' })
    const pool = buildDraftComponentPool(rows)
    const swapped = applyHingeBrandToDraftBom(bom!, 'hafele', pool)
    const hinge = swapped.lines.find((l) => l.component_role === 'hinge')
    expect(hinge?.component_sku.toLowerCase()).toContain('het')
  })

  it('bulkComputeDraftBom counts successes', () => {
    const res = bulkComputeDraftBom([poolRows[0]], poolRows, 'titus')
    expect(res.ok).toBe(1)
    expect(res.patches.size).toBe(1)
  })
})
