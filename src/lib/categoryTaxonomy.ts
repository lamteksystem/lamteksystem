import type { CategoryRow, ProductRow } from '@/types/database'
import { getDoorRange } from '@/lib/catalogProductDisplay'

export type CategoryKind = 'product_type' | 'door_range' | 'universal'
export type CatalogBrowseMode = 'category' | 'range'

export function getCategoryKind(category: CategoryRow): CategoryKind {
  if (category.category_kind) return category.category_kind
  return inferCategoryKindFromName(category.name)
}

export function inferCategoryKindFromName(name: string): CategoryKind {
  const n = name.toLowerCase()
  if (
    /\b(oakham|dawson|norwood|alto|bryson|harborne|greenwich|lincoln|cambridge|windsor|hamilton)\b/.test(
      n,
    ) ||
    /\bdoor range\b/.test(n) ||
    (n.includes('kitchen') && n.includes('range') && n.split(/\s+/).length <= 4)
  ) {
    return 'door_range'
  }
  if (
    /wirework|accessor|drawer box|drawer boxes|hinge|fitting|plinth|cornice|pelmet|worktop|internal storage|orgatray|cutlery|cabinet|base unit|wall unit|tall unit|carcass|\bunits\b|\bunit\b|panel/.test(
      n,
    )
  ) {
    return 'universal'
  }
  return 'product_type'
}

export function categoryKindLabel(kind: CategoryKind): string {
  if (kind === 'door_range') return 'Kitchen range'
  if (kind === 'universal') return 'Cross-range'
  return 'Product category'
}

/** Category id plus all direct child category ids. */
export function expandCategorySelection(
  categories: CategoryRow[],
  categoryId: string | null,
): Set<string> | null {
  if (!categoryId) return null
  const ids = new Set<string>()
  const queue = [categoryId]
  while (queue.length > 0) {
    const id = queue.pop()!
    if (ids.has(id)) continue
    ids.add(id)
    for (const c of categories) {
      if (c.parent_id === id) queue.push(c.id)
    }
  }
  return ids
}

export function buildCategoryTreeOptions(
  categories: CategoryRow[],
  mode: CatalogBrowseMode,
): { id: string; label: string; depth: number; kind: CategoryKind }[] {
  const sorted = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  )

  if (mode === 'range') {
    const doorRanges = sorted.filter((c) => getCategoryKind(c) === 'door_range')
    const universal = sorted.filter((c) => getCategoryKind(c) === 'universal')
    return [
      ...doorRanges.map((c) => ({ id: c.id, label: c.name, depth: 0, kind: 'door_range' as const })),
      ...universal.map((c) => ({
        id: c.id,
        label: `${c.name} (all ranges)`,
        depth: 0,
        kind: 'universal' as const,
      })),
    ]
  }

  const parents = sorted.filter((c) => !c.parent_id && getCategoryKind(c) !== 'door_range')
  const options: { id: string; label: string; depth: number; kind: CategoryKind }[] = []
  for (const parent of parents) {
    if (getCategoryKind(parent) === 'universal') continue
    options.push({ id: parent.id, label: parent.name, depth: 0, kind: getCategoryKind(parent) })
    for (const child of sorted.filter((c) => c.parent_id === parent.id)) {
      options.push({
        id: child.id,
        label: child.name,
        depth: 1,
        kind: getCategoryKind(child),
      })
    }
  }
  return options
}

export function productMatchesBrowseFilter(
  product: ProductRow,
  categories: CategoryRow[],
  browseMode: CatalogBrowseMode,
  categoryId: string | null,
): boolean {
  if (!categoryId) return true

  const selected = categories.find((c) => c.id === categoryId)
  if (!selected) return product.category_id === categoryId

  const kind = getCategoryKind(selected)
  const idSet = expandCategorySelection(categories, categoryId)

  if (browseMode === 'range' && kind === 'door_range') {
    const door = getDoorRange(product)?.trim().toLowerCase()
    const name = selected.name.trim().toLowerCase()
    if (product.category_id === categoryId) return true
    if (door && name && (door === name || door.includes(name) || name.includes(door))) return true
    return false
  }

  if (product.category_id && idSet?.has(product.category_id)) return true
  return false
}

export function countProductsForBrowseOption(
  products: ProductRow[],
  categories: CategoryRow[],
  browseMode: CatalogBrowseMode,
  categoryId: string,
): number {
  return products.filter((p) => productMatchesBrowseFilter(p, categories, browseMode, categoryId)).length
}
