import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import {
  categoryBrowseModeForRow,
  productMatchesBrowseFilter,
  type CatalogBrowseMode,
} from '@/lib/categoryTaxonomy'
import type { ProductCategoryMap } from '@/lib/productCategories'
import { lineStyleMatchesCategoryName } from '@/lib/tealburyOrderSetup'
import type { CategoryRow, CategoryTypeRow, OrderRow, ProductRow } from '@/types/database'

export type CatalogProductKindFilter = 'all' | 'complete' | 'components'

export interface WorkbenchFilterState {
  productCode: string
  search: string
  browseMode: CatalogBrowseMode
  categoryId: string | null
  doorRange: string | null
  /** System category id (`categories.id`) from product_categories assignments. */
  section: string | null
  productKind: CatalogProductKindFilter
  inStockOnly: boolean
  favouritesOnly: boolean
  catalogProgram: CatalogProgram | null
}

export const EMPTY_WORKBENCH_FILTERS: WorkbenchFilterState = {
  productCode: '',
  search: '',
  browseMode: 'category',
  categoryId: null,
  doorRange: null,
  section: null,
  productKind: 'all',
  inStockOnly: false,
  favouritesOnly: false,
  catalogProgram: null,
}

export interface CatalogSectionOption {
  id: string
  name: string
}

export interface CatalogFacets {
  doorRanges: string[]
  sections: CatalogSectionOption[]
}

export function getProductOpts(product: ProductRow): Record<string, unknown> {
  const o = product.options
  return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
}

export function isInternalOptionKey(key: string): boolean {
  return key.startsWith('lamtek_') || key.startsWith('tealbury_') || key === 'components'
}

export function getTradeCode(product: ProductRow): string | null {
  const opts = getProductOpts(product)
  const v = opts.tealbury_trade_code ?? opts.lamtek_trade_code
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function getDoorRange(product: ProductRow): string | null {
  const v = getProductOpts(product).tealbury_door_range
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function getProductSections(product: ProductRow): string[] {
  const s = getProductOpts(product).tealbury_sections ?? getProductOpts(product).lamtek_sections
  if (Array.isArray(s)) return s.map((x) => String(x).trim()).filter(Boolean)
  if (typeof s === 'string' && s.trim()) return [s.trim()]
  return []
}

export function formatProductDimensions(product: ProductRow): string | null {
  const dims = getProductOpts(product).tealbury_dims_mm ?? getProductOpts(product).lamtek_dims_mm
  if (!dims || typeof dims !== 'object' || Array.isArray(dims)) return null
  const d = dims as { h?: number; w?: number; d?: number }
  const parts: string[] = []
  if (typeof d.h === 'number' && d.h > 0) parts.push(`${d.h}h`)
  if (typeof d.w === 'number' && d.w > 0) parts.push(`${d.w}w`)
  if (typeof d.d === 'number' && d.d > 0) parts.push(`${d.d}d`)
  if (parts.length === 0) return null
  return `${parts.join(' × ')} mm`
}

/** Product is assigned to a system category (junction or legacy single category_id). */
export function productHasSystemCategory(
  product: ProductRow,
  categoryId: string,
  productCategoryMap: ProductCategoryMap,
): boolean {
  const catIds = productCategoryMap.get(product.id) ?? (product.category_id ? [product.category_id] : [])
  return catIds.includes(categoryId)
}

export function buildCatalogFacets(
  products: ProductRow[],
  options?: {
    categories?: CategoryRow[]
    categoryTypes?: CategoryTypeRow[]
    productCategoryMap?: ProductCategoryMap
    lineStylePreference?: OrderRow['line_style_preference']
    completeProductIds?: Set<string>
  },
): CatalogFacets {
  const doorSet = new Set<string>()
  for (const p of products) {
    const door = getDoorRange(p)
    if (door) doorSet.add(door)
  }

  const categories = options?.categories ?? []
  const types = options?.categoryTypes ?? []
  const pcMap = options?.productCategoryMap
  const linePref = options?.lineStylePreference

  const sections: CatalogSectionOption[] = []
  if (categories.length > 0 && pcMap) {
    const productTypeCats = categories.filter((c) => {
      if (categoryBrowseModeForRow(c, types) !== 'product') return false
      if (linePref && !lineStyleMatchesCategoryName(linePref, c.name)) return false
      return products.some((p) => productHasSystemCategory(p, c.id, pcMap))
    })
    for (const c of productTypeCats.sort((a, b) => a.name.localeCompare(b.name))) {
      sections.push({ id: c.id, name: c.name })
    }
  }

  return {
    doorRanges: [...doorSet].sort((a, b) => a.localeCompare(b)),
    sections,
  }
}

/**
 * Collect every door/range finish label that appears on any of these products.
 *
 * Finishes live inside `products.options.tealbury_finish_prices_gbp` and
 * `products.options.lamtek_finish_prices_gbp` — each is an object keyed by the
 * finish label (e.g. "Oakham Soft Matte", "Painted Colour", "Gloss White"),
 * with the £ price as the value. This helper unions the keys across both
 * shapes and returns a sorted, de-duplicated list of label strings.
 *
 * Used by the order-start wizard to populate Step 2 ("which finish of this
 * range?") after the user has picked a kitchen range. Filter `products` to the
 * range first; this helper does not know which range a product belongs to.
 */
export function getProductFinishLabels(products: ProductRow[]): string[] {
  const finishes = new Set<string>()
  for (const p of products) {
    const opts = getProductOpts(p)
    const t = opts.tealbury_finish_prices_gbp
    const l = opts.lamtek_finish_prices_gbp
    for (const src of [t, l]) {
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        for (const key of Object.keys(src)) {
          const trimmed = key.trim()
          if (trimmed) finishes.add(trimmed)
        }
      }
    }
  }
  return [...finishes].sort((a, b) => a.localeCompare(b))
}

export function getSpecificationBullets(product: ProductRow): string[] {
  const bullets: string[] = []
  if (product.description) {
    bullets.push(
      ...product.description
        .split(/[\n•;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  }
  const dims = formatProductDimensions(product)
  if (dims) bullets.push(dims)
  const door = getDoorRange(product)
  if (door && !bullets.some((b) => b.toLowerCase().includes(door.toLowerCase()))) {
    bullets.push(`Door range: ${door}`)
  }
  return bullets.slice(0, 6)
}

export function getPropertiesRows(product: ProductRow): { label: string; value: string }[] {
  const opts = getProductOpts(product)
  const rows: { label: string; value: string }[] = []
  const door = getDoorRange(product)
  if (door) rows.push({ label: 'Door range', value: door })
  const dims = formatProductDimensions(product)
  if (dims) rows.push({ label: 'Dimensions', value: dims })
  const trade = getTradeCode(product)
  if (trade) rows.push({ label: 'Trade code', value: trade })
  const sections = getProductSections(product)
  if (sections.length > 0) rows.push({ label: 'Section', value: sections.join(', ') })
  const program =
    product.catalog_program === CATALOG_PROGRAM.TEALBURY ? 'Tealbury' : 'Lamtek'
  rows.push({ label: 'Catalogue', value: program })
  const finishes =
    (opts.tealbury_finish_prices_gbp as Record<string, number> | undefined) ??
    (opts.lamtek_finish_prices_gbp as Record<string, number> | undefined)
  if (finishes && typeof finishes === 'object' && !Array.isArray(finishes)) {
    const keys = Object.keys(finishes).slice(0, 3)
    if (keys.length > 0) rows.push({ label: 'Finishes', value: keys.join(', ') })
  }
  const general = Object.entries(opts)
    .filter(([k, v]) => !isInternalOptionKey(k) && v != null && String(v).trim() !== '')
    .slice(0, 2)
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }))
  rows.push(...general)
  return rows.slice(0, 7)
}

export function filterCatalogProducts(
  products: ProductRow[],
  filters: WorkbenchFilterState,
  favouriteIds?: Set<string>,
  categories: CategoryRow[] = [],
  options?: {
    productCategoryMap?: ProductCategoryMap
    completeProductIds?: Set<string>
    categoryTypes?: CategoryTypeRow[]
  },
): ProductRow[] {
  const pcMap = options?.productCategoryMap
  const completeIds = options?.completeProductIds

  return products.filter((p) => {
    if (filters.catalogProgram && p.catalog_program !== filters.catalogProgram) return false
    if (
      filters.categoryId &&
      categories.length > 0 &&
      !productMatchesBrowseFilter(p, categories, filters.browseMode, filters.categoryId)
    ) {
      return false
    }
    if (filters.categoryId && categories.length === 0 && p.category_id !== filters.categoryId) return false
    if (filters.doorRange && getDoorRange(p) !== filters.doorRange) return false
    if (filters.section) {
      if (!pcMap) return false
      if (!productHasSystemCategory(p, filters.section, pcMap)) return false
    }
    if (filters.productKind !== 'all' && completeIds) {
      const isComplete = completeIds.has(p.id)
      if (filters.productKind === 'complete' && !isComplete) return false
      if (filters.productKind === 'components' && isComplete) return false
    }
    if (filters.inStockOnly && (p.stock_quantity ?? 0) <= 0) return false
    if (filters.favouritesOnly && favouriteIds && !favouriteIds.has(p.id)) return false

    if (filters.productCode.trim()) {
      const code = filters.productCode.trim().toLowerCase()
      const sku = (p.sku ?? '').toLowerCase()
      const trade = (getTradeCode(p) ?? '').toLowerCase()
      if (!sku.includes(code) && !trade.includes(code)) return false
    }

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      const hay = [
        p.name,
        p.sku,
        p.description,
        getTradeCode(p),
        getDoorRange(p),
        ...getProductSections(p),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

export function categoryNameById(categories: CategoryRow[]): Map<string, string> {
  return new Map(categories.map((c) => [c.id, c.name]))
}

export function displayProductCode(product: ProductRow): string {
  return getTradeCode(product) ?? product.sku ?? '—'
}

export function catalogProgramLabel(program: CatalogProgram | null | undefined): string {
  if (program === CATALOG_PROGRAM.TEALBURY) return 'Tealbury'
  return 'Lamtek'
}
