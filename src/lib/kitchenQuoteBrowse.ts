import {
  EMPTY_WORKBENCH_FILTERS,
  filterCatalogProducts,
  type CatalogProductKindFilter,
  type WorkbenchFilterState,
} from '@/lib/catalogProductDisplay'
import type { ProductCategoryMap } from '@/lib/productCategories'
import type { CategoryRow, CategoryTypeRow, ProductRow } from '@/types/database'
import type { TealburyOrderSetup } from '@/lib/tealburyOrderSetup'

export interface KitchenSectionShortcut {
  id: string
  label: string
  /** Match assigned category names (case-insensitive). */
  categoryNames?: string[]
  /** Restrict to complete units, accessories, or all. */
  productKind?: CatalogProductKindFilter
  /** Match import section text on the product. */
  sectionPattern?: RegExp
}

export const KITCHEN_SECTION_SHORTCUTS: KitchenSectionShortcut[] = [
  {
    id: 'base_units',
    label: 'Base units',
    productKind: 'complete',
    sectionPattern: /high[\s-]*line.*base|drawer[\s-]*line.*base|multidrawer.*base/i,
  },
  {
    id: 'wall_units',
    label: 'Wall units',
    productKind: 'complete',
    sectionPattern: /wall\s*unit/i,
  },
  {
    id: 'panels',
    label: 'Panels',
    categoryNames: ['Panels'],
    productKind: 'accessories',
  },
  {
    id: 'plinth',
    label: 'Plinth',
    categoryNames: ['Plinth'],
    productKind: 'accessories',
  },
  {
    id: 'cornice',
    label: 'Cornice & pelmet',
    categoryNames: ['Cornice & Pelmet'],
    productKind: 'accessories',
  },
  {
    id: 'posts',
    label: 'Posts',
    categoryNames: ['Posts'],
    productKind: 'accessories',
  },
  {
    id: 'handles',
    label: 'Handles',
    categoryNames: ['Handles'],
    productKind: 'accessories',
  },
]

function productCategoryNames(
  product: ProductRow,
  categories: CategoryRow[],
  productCategoryMap: ProductCategoryMap,
): string[] {
  const ids = productCategoryMap.get(product.id) ?? (product.category_id ? [product.category_id] : [])
  return ids.map((id) => categories.find((c) => c.id === id)?.name ?? '').filter(Boolean)
}

function productMatchesShortcut(
  product: ProductRow,
  shortcut: KitchenSectionShortcut,
  categories: CategoryRow[],
  productCategoryMap: ProductCategoryMap,
): boolean {
  if (shortcut.categoryNames?.length) {
    const names = productCategoryNames(product, categories, productCategoryMap).map((n) =>
      n.toLowerCase(),
    )
    const want = shortcut.categoryNames.map((n) => n.toLowerCase())
    if (!want.some((w) => names.includes(w))) return false
  }
  if (shortcut.sectionPattern) {
    const hay = `${product.description ?? ''} ${product.name}`.toLowerCase()
    if (!shortcut.sectionPattern.test(hay)) return false
  }
  return true
}

/** Products visible for the saved kitchen setup (range + finish), before search/section chips. */
export function productsForKitchenContext(
  products: ProductRow[],
  setup: TealburyOrderSetup,
  categories: CategoryRow[],
  options: {
    productCategoryMap?: ProductCategoryMap
    completeProductIds?: Set<string>
    categoryTypes?: CategoryTypeRow[]
  },
): ProductRow[] {
  const base: WorkbenchFilterState = {
    ...EMPTY_WORKBENCH_FILTERS,
    browseMode: 'range',
    categoryId: setup.kitchen_range_id,
    productKind: 'all',
  }
  return filterCatalogProducts(products, base, undefined, categories, {
    ...options,
    tealburySetup: setup,
  })
}

export function countKitchenShortcutProducts(
  products: ProductRow[],
  shortcut: KitchenSectionShortcut,
  setup: TealburyOrderSetup,
  categories: CategoryRow[],
  options: {
    productCategoryMap?: ProductCategoryMap
    completeProductIds?: Set<string>
    categoryTypes?: CategoryTypeRow[]
  },
): number {
  const inContext = productsForKitchenContext(products, setup, categories, options)
  const filters: WorkbenchFilterState = {
    ...EMPTY_WORKBENCH_FILTERS,
    browseMode: 'range',
    categoryId: setup.kitchen_range_id,
    productKind: shortcut.productKind ?? 'all',
  }
  const filtered = filterCatalogProducts(inContext, filters, undefined, categories, {
    ...options,
    tealburySetup: setup,
  })
  return filtered.filter((p) => productMatchesShortcut(p, shortcut, categories, options.productCategoryMap ?? new Map())).length
}

export function resolveShortcutCategoryId(
  shortcut: KitchenSectionShortcut,
  categories: CategoryRow[],
): string | null {
  if (!shortcut.categoryNames?.length) return null
  for (const want of shortcut.categoryNames) {
    const hit = categories.find((c) => c.name.trim().toLowerCase() === want.toLowerCase())
    if (hit) return hit.id
  }
  return null
}

export function filtersForKitchenShortcut(
  shortcut: KitchenSectionShortcut,
  setup: TealburyOrderSetup,
  categories: CategoryRow[],
): Partial<WorkbenchFilterState> {
  const catId = resolveShortcutCategoryId(shortcut, categories)
  return {
    browseMode: catId ? 'category' : 'range',
    categoryId: catId ?? setup.kitchen_range_id,
    section: null,
    productKind: shortcut.productKind ?? 'all',
    search: '',
    doorRange: null,
  }
}
