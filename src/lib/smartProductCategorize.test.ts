import { describe, expect, it } from 'vitest'
import { suggestCategoryForProduct } from '@/lib/smartProductCategorize'
import type { CategoryRow } from '@/types/database'

const categories: CategoryRow[] = [
  {
    id: 'acc',
    name: 'Accessories',
    slug: 'accessories',
    parent_id: null,
    sort_order: 0,
    category_kind: 'universal',
  },
  {
    id: 'cornice',
    name: 'Cornice & Pelmet',
    slug: 'cornice-pelmet',
    parent_id: null,
    sort_order: 1,
    category_kind: 'universal',
  },
]

describe('suggestCategoryForProduct', () => {
  it('prefers Cornice & Pelmet over Accessories for cornice lines', () => {
    const s = suggestCategoryForProduct(
      {
        id: 'p1',
        name: 'MC240',
        description: 'Section: ACCESSORIES\nItem: Modern cornice 2400mm',
        sku: 'MC240',
        category_id: 'acc',
      },
      categories,
    )
    expect(s?.suggestedCategoryId).toBe('cornice')
    expect(s?.suggestedCategoryName).toBe('Cornice & Pelmet')
  })
})
