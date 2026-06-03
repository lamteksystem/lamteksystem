import { describe, expect, it } from 'vitest'
import { mapTealburyAccessoryToCategory } from '@/lib/tealburyPricelistParse'
import {
  deriveWorkbenchProductName,
  importSectionOptionsFromRows,
  suggestCategoryForPricelistRow,
  type PricelistWorkbenchRow,
} from '@/lib/pricelistWorkbench'
import type { CategoryRow } from '@/types/database'

const categories: CategoryRow[] = [
  {
    id: '1',
    name: 'Plinth',
    slug: 'plinth',
    parent_id: null,
    sort_order: 0,
    category_kind: 'product_type',
  },
  {
    id: '2',
    name: 'Doors',
    slug: 'doors',
    parent_id: null,
    sort_order: 1,
    category_kind: 'product_type',
  },
]

describe('suggestCategoryForPricelistRow', () => {
  it('matches existing category by name', () => {
    const r = suggestCategoryForPricelistRow('Doors', categories, 'tealbury')
    expect(r.category_id).toBe('2')
    expect(r.category_name).toBe('Doors')
  })

  it('maps Tealbury accessories via accessory rules', () => {
    expect(mapTealburyAccessoryToCategory('150 Plinth', 'PL150')).toBe('Plinth')
    const r = suggestCategoryForPricelistRow('ACCESSORIES', categories, 'tealbury', {
      description: '150 Plinth',
      code: 'PL150',
    })
    expect(r.category_name).toBe('Plinth')
    expect(r.category_id).toBe('1')
  })

  it('does not invent categories when no match exists', () => {
    const r = suggestCategoryForPricelistRow('ACCESSORIES', categories, 'tealbury', {
      description: 'Modern cornice 2.4m',
      code: 'MC240',
    })
    expect(r.category_id).toBeNull()
    expect(r.category_slug).toBe('')
    expect(r.category_name).toBe('')
  })
})

describe('deriveWorkbenchProductName', () => {
  it('uses Item line from description when name is empty', () => {
    const name = deriveWorkbenchProductName({
      name: '',
      sku: 'TB-1',
      description: 'Section: ACCESSORIES\nItem: 150 Plinth\nDimensions: H 150mm',
      section: 'ACCESSORIES',
      trade_code: 'PL150',
    })
    expect(name).toBe('150 Plinth')
  })
})

describe('importSectionOptionsFromRows', () => {
  const base = {
    source: 'tealbury' as const,
    catalog_program: 'tealbury' as const,
    sku: 'x',
    name: 'x',
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
    door_range: '',
    trade_code: '',
    selected: false,
    options: {},
    item_kind: 'complete' as const,
    part_type: '',
  }

  it('excludes catalogue category names and sorts height-prefixed sections numerically', () => {
    const rows: PricelistWorkbenchRow[] = [
      { ...base, id: '1', section: '720 HIGH WALL UNITS' },
      { ...base, id: '2', section: '575 HIGH WALL UNITS' },
      { ...base, id: '3', section: 'HIGHLINE BASE UNITS' },
      { ...base, id: '4', section: 'Doors' },
    ]
    const opts = importSectionOptionsFromRows(rows, categories)
    const labels = opts.map((o) => o.label)
    expect(labels).not.toContain('Doors')
    expect(labels[0]).toBe('575 HIGH WALL UNITS')
    expect(labels[1]).toBe('720 HIGH WALL UNITS')
    expect(labels).toContain('HIGHLINE BASE UNITS')
  })
})
