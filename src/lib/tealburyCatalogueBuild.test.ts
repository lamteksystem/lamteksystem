import { describe, expect, it } from 'vitest'
import { inferWorkbenchItemKind } from '@/lib/tealburyCatalogueBuild'
import { productHasDoorFinish } from '@/lib/catalogProductDisplay'
import type { ProductRow } from '@/types/database'

describe('inferWorkbenchItemKind (tealbury)', () => {
  it('classifies panels as accessory', () => {
    expect(
      inferWorkbenchItemKind({
        source: 'tealbury',
        section: 'Panels',
        name: 'Plain end panel',
        description: '',
        sku: '18MMPLNENDPANEL · Dawson',
        options: {},
      }),
    ).toBe('accessory')
  })

  it('classifies high-line base as complete', () => {
    expect(
      inferWorkbenchItemKind({
        source: 'tealbury',
        section: 'HIGHLINE BASE UNITS',
        name: '1000 HL Base',
        description: '',
        sku: 'B100 · Dawson',
        options: {},
      }),
    ).toBe('complete')
  })
})

describe('productHasDoorFinish', () => {
  const panel: ProductRow = {
    id: '1',
    sku: '18MMPLNENDPANEL · Dawson',
    name: 'Plain end panel (dawson)',
    description: '',
    unit_price: 92,
    cost_price: 69,
    active: true,
    is_stock: false,
    stock_quantity: 0,
    category_id: 'panels',
    catalog_program: 'tealbury',
    options: {
      tealbury_door_range: 'Dawson',
      tealbury_finish_prices_gbp: { 'Dawson — DWSN': 92.24 },
    },
  } as unknown as ProductRow

  it('matches trim by door range when finish label is the range variant', () => {
    expect(
      productHasDoorFinish(panel, 'Dawson — DWSN', {
        categories: [{ id: 'panels', name: 'Panels', slug: 'panels', parent_id: null, sort_order: 0, category_kind: 'product_type' }],
        productCategoryMap: new Map([[panel.id, ['panels']]]),
        kitchenRangeName: 'Dawson',
      }),
    ).toBe(true)
  })
})
