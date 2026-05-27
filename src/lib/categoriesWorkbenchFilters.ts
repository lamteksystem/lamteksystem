import type { CategoryRow } from '@/types/database'

export type CategoriesSortKey = 'name' | 'slug' | 'parent' | 'type' | 'products' | 'subs'

export type CategoriesSortDir = 'asc' | 'desc'

export interface CategoriesTableFilters {
  search: string
  parentId: string
  kind: string
  hasProducts: 'all' | 'yes' | 'no'
  topLevelOnly: boolean
  sortKey: CategoriesSortKey
  sortDir: CategoriesSortDir
}

export const DEFAULT_CATEGORIES_FILTERS: CategoriesTableFilters = {
  search: '',
  parentId: '',
  kind: '',
  hasProducts: 'all',
  topLevelOnly: false,
  sortKey: 'name',
  sortDir: 'asc',
}

export function filterAndSortCategories(
  categories: CategoryRow[],
  filters: CategoriesTableFilters,
  productCountByCategory: Map<string, number>,
): CategoryRow[] {
  const q = filters.search.trim().toLowerCase()
  let list = categories.filter((c) => {
    if (filters.parentId && c.parent_id !== filters.parentId) return false
    if (filters.kind && (c.category_kind ?? '') !== filters.kind) return false
    if (filters.topLevelOnly && c.parent_id) return false
    const pc = productCountByCategory.get(c.id) ?? 0
    if (filters.hasProducts === 'yes' && pc === 0) return false
    if (filters.hasProducts === 'no' && pc > 0) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  })

  const dir = filters.sortDir === 'asc' ? 1 : -1
  list = [...list].sort((a, b) => {
    let c = 0
    switch (filters.sortKey) {
      case 'name':
        c = a.name.localeCompare(b.name)
        break
      case 'slug':
        c = a.slug.localeCompare(b.slug)
        break
      case 'parent': {
        const pa = a.parent_id ?? ''
        const pb = b.parent_id ?? ''
        c = pa.localeCompare(pb)
        break
      }
      case 'type':
        c = (a.category_kind ?? '').localeCompare(b.category_kind ?? '')
        break
      case 'products':
        c =
          (productCountByCategory.get(a.id) ?? 0) - (productCountByCategory.get(b.id) ?? 0)
        break
      case 'subs':
        c = 0
        break
      default:
        c = 0
    }
    return c * dir
  })
  return list
}
