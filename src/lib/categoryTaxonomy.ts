import type { CategoryRow, CategoryTypeRow, ProductRow } from '@/types/database'
import { getDoorRange } from '@/lib/catalogProductDisplay'
import { categoryTypeBrowseMode } from '@/lib/categoryTypes'

export type CategoryKind = string
export type CatalogBrowseMode = 'category' | 'range'

const LEGACY_KIND_LABELS: Record<string, string> = {
  product_type: 'Product category',
  door_range: 'Kitchen range',
  universal: 'Cross-range',
}

export function getCategoryKind(category: CategoryRow): CategoryKind {
  if (category.category_kind) return category.category_kind
  return inferCategoryKindFromName(category.name)
}

/** Tealbury/Lamtek door family names spotted in pricelists. Used by smart categorise + browse mode. */
export const KNOWN_DOOR_RANGE_PATTERNS: RegExp[] = [
  /\boakham(\s+(glass|soft\s*matte|matte|gloss))?\b/i,
  /\bknightsbridge(\s+(std|standard|prm|premium))?\b/i,
  /\bdawson\b/i,
  /\bpopplewick\b/i,
  /\bnorwood\b/i,
  /\bcleveland\b/i,
  /\bharrington\b/i,
  /\bfenton\b/i,
  /\bhadfield\b/i,
  /\bberkeley\b/i,
  /\bdover\b/i,
  /\baura\b/i,
  /\balto\b/i,
  /\bbryson\b/i,
  /\bharborne\b/i,
  /\bgreenwich\b/i,
  /\blincoln\b/i,
  /\bcambridge\b/i,
  /\bwindsor\b/i,
  /\bhamilton\b/i,
]

/** Product-type buckets that must never be inferred as kitchen ranges or cross-range. */
export function isCompleteUnitsCategoryName(name: string): boolean {
  return /^complete(\s+units?)?$/i.test(name.trim())
}

export function inferCategoryKindFromName(name: string): CategoryKind {
  if (isCompleteUnitsCategoryName(name)) return 'product_type'
  const n = name.toLowerCase()
  if (
    KNOWN_DOOR_RANGE_PATTERNS.some((re) => re.test(n)) ||
    /\bdoor range\b/.test(n) ||
    (n.includes('kitchen') && n.includes('range') && n.split(/\s+/).length <= 4)
  ) {
    return 'door_range'
  }
  if (
    /wirework|accessor|drawer box|drawer boxes|hinge|fitting|plinth|cornice|pelmet|worktop|internal storage|orgatray|cutlery|cabinet|base unit|wall unit|tall unit|carcass|\bunits\b|\bunit\b|\bpanels?\b|\bposts?\b|mould(ing|s)?|corbel|mantle|mantel/.test(
      n,
    )
  ) {
    return 'universal'
  }
  return 'product_type'
}

export function categoryKindLabel(kind: CategoryKind, types?: CategoryTypeRow[]): string {
  const fromDb = types?.find((t) => t.code === kind)?.label
  if (fromDb) return fromDb
  return LEGACY_KIND_LABELS[kind] ?? kind
}

export function categoryBrowseModeForRow(
  category: CategoryRow,
  types: CategoryTypeRow[],
): CategoryTypeRow['browse_mode'] {
  return categoryTypeBrowseMode(types, category.category_kind ?? 'product_type')
}

/** True when smart categorise may assign products to this category (kitchen ranges excluded). */
export function isAssignableProductCategory(
  category: CategoryRow,
  types?: CategoryTypeRow[],
): boolean {
  if (types?.length) {
    if (categoryBrowseModeForRow(category, types) !== 'door_range') return true
    return isCompleteUnitsCategoryName(category.name)
  }
  const kind = getCategoryKind(category)
  if (kind !== 'door_range') return true
  return isCompleteUnitsCategoryName(category.name)
}

/** Categories shown in smart categorise pickers and used for suggestion scoring. */
export function categoriesForSmartProductAssignment(
  categories: CategoryRow[],
  types?: CategoryTypeRow[],
): CategoryRow[] {
  return [...categories]
    .filter((c) => isAssignableProductCategory(c, types))
    .sort((a, b) => {
      const order: Record<CategoryKind, number> = { product_type: 0, universal: 1, door_range: 2 }
      const ka = order[getCategoryKind(a)]
      const kb = order[getCategoryKind(b)]
      if (ka !== kb) return ka - kb
      return a.name.localeCompare(b.name)
    })
}

export function formatSmartCategoryOptionLabel(
  category: CategoryRow,
  types?: CategoryTypeRow[],
): string {
  if (types?.length) {
    const mode = categoryBrowseModeForRow(category, types)
    if (mode === 'universal') return `${category.name} (cross-range)`
    if (mode === 'door_range') return `${category.name} (kitchen range)`
    return category.name
  }
  const kind = getCategoryKind(category)
  if (kind === 'universal') return `${category.name} (cross-range)`
  if (kind === 'door_range') return `${category.name} (kitchen range)`
  return category.name
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
