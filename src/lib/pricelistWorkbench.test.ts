import { describe, expect, it } from 'vitest'
import { mapTealburyAccessoryToCategory } from '@/lib/tealburyPricelistParse'
import { suggestCategoryForPricelistRow } from '@/lib/pricelistWorkbench'
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
})
