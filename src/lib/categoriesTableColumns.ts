import type { ColumnDef } from '@/hooks/useColumnVisibility'

export type CategoriesColumnId = 'name' | 'slug' | 'parent' | 'type' | 'products' | 'subs' | 'actions'

export type CategoriesColumnDef = ColumnDef & {
  tip: string
  minWidth: number
  defaultWidth: number
}

export const CATEGORIES_TABLE_COLUMNS: CategoriesColumnDef[] = [
  { id: 'name', label: 'Name', tip: 'Category display name', minWidth: 140, defaultWidth: 180 },
  { id: 'slug', label: 'Slug', tip: 'URL slug', minWidth: 100, defaultWidth: 120 },
  { id: 'parent', label: 'Parent', tip: 'Parent category', minWidth: 120, defaultWidth: 140 },
  { id: 'type', label: 'Type', tip: 'Category type', minWidth: 100, defaultWidth: 120 },
  { id: 'products', label: 'Products', tip: 'Products in this category', minWidth: 72, defaultWidth: 80 },
  { id: 'subs', label: 'Subs', tip: 'Sub-categories', minWidth: 56, defaultWidth: 64 },
  { id: 'actions', label: '', tip: 'Actions', minWidth: 88, defaultWidth: 92 },
]

export function categoriesColumnWidth(id: string, widths: Record<string, number>): number {
  const def = CATEGORIES_TABLE_COLUMNS.find((c) => c.id === id)
  return Math.max(def?.minWidth ?? 60, widths[id] ?? def?.defaultWidth ?? 100)
}
