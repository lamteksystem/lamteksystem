import { supabase } from '@/lib/supabase'
import type { CategoryRow } from '@/types/database'

/** Pricelist imports use slugs like `lamtek-wall-units`; seed categories use `units`. */
export function categorySlugMatchesImported(productSlug: string, selectedSlug: string): boolean {
  const ps = productSlug.toLowerCase()
  const sel = selectedSlug.toLowerCase()
  if (!sel) return true
  if (!ps) return false
  if (ps === sel) return true
  if (ps === `lamtek-${sel}` || ps === `tealbury-${sel}`) return true
  if (ps.endsWith(`-${sel}`)) return true
  const core = ps.startsWith('lamtek-')
    ? ps.slice('lamtek-'.length)
    : ps.startsWith('tealbury-')
      ? ps.slice('tealbury-'.length)
      : ps
  if (sel === 'units' && /(^|-)units(-|$)/.test(core)) return true
  return false
}

export type ProductCategoryMap = Map<string, string[]>

export interface ProductCategoryRow {
  product_id: string
  category_id: string
  is_primary: boolean
}

export interface SaveProductCategoriesResult {
  error: string | null
  categoryIds: string[]
  primaryCategoryId: string | null
}

const PRODUCT_CATEGORIES_PAGE_SIZE = 1000

function mergeRowsIntoMap(map: ProductCategoryMap, rows: ProductCategoryRow[]) {
  const primaryFirst = [...rows].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  for (const row of primaryFirst) {
    const list = map.get(row.product_id) ?? []
    if (!list.includes(row.category_id)) list.push(row.category_id)
    map.set(row.product_id, list)
  }
}

/** Read junction assignments from an in-memory map (null if product not in map). */
export function getProductCategoriesFromMap(
  productId: string,
  fallbackCategoryId: string | null,
  map: ProductCategoryMap | undefined
): { categoryIds: string[]; primaryCategoryId: string } | null {
  if (!map) return null
  const fromJunction = map.get(productId)
  if (!fromJunction?.length) return null
  return {
    categoryIds: fromJunction,
    primaryCategoryId: getPrimaryCategoryId(productId, fallbackCategoryId, map),
  }
}

/** Category assignments for a single product (fast path for product modal). */
export async function fetchProductCategoriesForProduct(
  productId: string,
  primaryCategoryId: string | null
): Promise<{ categoryIds: string[]; primaryCategoryId: string }> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('category_id, is_primary')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false })

  if (error) {
    console.warn('product_categories load failed for product', productId, error.message)
    return {
      categoryIds: primaryCategoryId ? [primaryCategoryId] : [],
      primaryCategoryId: primaryCategoryId ?? '',
    }
  }

  const rows = (data ?? []) as Pick<ProductCategoryRow, 'category_id' | 'is_primary'>[]
  if (rows.length === 0) {
    return {
      categoryIds: primaryCategoryId ? [primaryCategoryId] : [],
      primaryCategoryId: primaryCategoryId ?? '',
    }
  }

  const primary = rows.find((r) => r.is_primary)?.category_id ?? rows[0].category_id
  const categoryIds = rows.map((r) => r.category_id)
  return { categoryIds, primaryCategoryId: primary }
}

/** Load all product ↔ category links (paginated; falls back to empty map on error). */
export async function fetchProductCategoryMap(): Promise<ProductCategoryMap> {
  const map = new Map<string, string[]>()
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('product_categories')
      .select('product_id, category_id, is_primary')
      .range(offset, offset + PRODUCT_CATEGORIES_PAGE_SIZE - 1)

    if (error) {
      console.warn('product_categories load failed', error.message)
      return map
    }

    const rows = (data ?? []) as ProductCategoryRow[]
    if (rows.length === 0) break

    mergeRowsIntoMap(map, rows)

    if (rows.length < PRODUCT_CATEGORIES_PAGE_SIZE) break
    offset += PRODUCT_CATEGORIES_PAGE_SIZE
  }

  return map
}

export function getProductCategoryIds(
  productId: string,
  primaryCategoryId: string | null,
  map: ProductCategoryMap
): string[] {
  const fromJunction = map.get(productId)
  if (fromJunction && fromJunction.length > 0) return fromJunction
  return primaryCategoryId ? [primaryCategoryId] : []
}

/** Primary category id for a product (junction primary first, else products.category_id). */
export function getPrimaryCategoryId(
  productId: string,
  fallbackCategoryId: string | null,
  map: ProductCategoryMap
): string {
  const ids = getProductCategoryIds(productId, fallbackCategoryId, map)
  return ids[0] ?? fallbackCategoryId ?? ''
}

export function normalizeCategorySelection(
  selectedIds: string[],
  primaryId: string
): { ids: string[]; primary: string } {
  const ids = [...new Set(selectedIds.filter(Boolean))]
  if (ids.length === 0) return { ids: [], primary: '' }
  if (ids.length === 1) return { ids, primary: ids[0] }
  if (primaryId && ids.includes(primaryId)) return { ids, primary: primaryId }
  return { ids, primary: ids[0] }
}

export function formatCategoryNames(
  categoryIds: string[],
  categoryMap: Map<string, CategoryRow>
): string {
  const names = categoryIds
    .map((id) => categoryMap.get(id)?.name)
    .filter((n): n is string => Boolean(n))
  return names.length > 0 ? names.join(', ') : '—'
}

function isProductCategoriesTableMissing(message: string, code?: string): boolean {
  if (code === '42P01' || code === 'PGRST205') return true
  const m = message.toLowerCase()
  return (
    m.includes('product_categories') &&
    (m.includes('does not exist') || m.includes('not found') || m.includes('schema cache'))
  )
}

function isSaveRpcMissing(message: string, code?: string): boolean {
  if (code === 'PGRST202' || code === '42883') return true
  const m = message.toLowerCase()
  return m.includes('save_product_categories') && (m.includes('not find') || m.includes('does not exist'))
}

async function saveProductCategoriesLegacy(
  productId: string,
  unique: string[],
  primaryCategoryId: string
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase.from('product_categories').delete().eq('product_id', productId)
  if (delErr) {
    if (isProductCategoriesTableMissing(delErr.message, delErr.code)) {
      return {
        error:
          'Multi-category storage is not available (product_categories table missing). Run migrations 068 and 071 on your database.',
      }
    }
    return { error: delErr.message }
  }

  const rows = unique.map((category_id) => ({
    product_id: productId,
    category_id,
    is_primary: category_id === primaryCategoryId,
  }))
  const { error: insErr } = await supabase.from('product_categories').insert(rows)
  if (insErr) return { error: insErr.message }

  const { error: prodErr } = await supabase
    .from('products')
    .update({ category_id: primaryCategoryId })
    .eq('id', productId)
  if (prodErr) return { error: prodErr.message }

  return { error: null }
}

export async function saveProductCategories(
  productId: string,
  categoryIds: string[],
  primaryCategoryId: string | null
): Promise<SaveProductCategoriesResult> {
  const unique = [...new Set(categoryIds.filter(Boolean))]

  if (unique.length === 0) {
    const { error: rpcErr } = await supabase.rpc('save_product_categories', {
      p_product_id: productId,
      p_category_ids: [],
      p_primary_category_id: null,
    })
    if (rpcErr && !isSaveRpcMissing(rpcErr.message, rpcErr.code)) {
      return { error: rpcErr.message, categoryIds: [], primaryCategoryId: null }
    }
    if (rpcErr && isSaveRpcMissing(rpcErr.message, rpcErr.code)) {
      const { error: delErr } = await supabase.from('product_categories').delete().eq('product_id', productId)
      if (delErr) return { error: delErr.message, categoryIds: [], primaryCategoryId: null }
      const { error: prodErr } = await supabase
        .from('products')
        .update({ category_id: null })
        .eq('id', productId)
      if (prodErr) return { error: prodErr.message, categoryIds: [], primaryCategoryId: null }
    }
    return { error: null, categoryIds: [], primaryCategoryId: null }
  }

  if (!primaryCategoryId || !unique.includes(primaryCategoryId)) {
    return {
      error: 'Select at least one category and a valid primary category.',
      categoryIds: [],
      primaryCategoryId: null,
    }
  }

  const { error: rpcErr } = await supabase.rpc('save_product_categories', {
    p_product_id: productId,
    p_category_ids: unique,
    p_primary_category_id: primaryCategoryId,
  })

  if (rpcErr) {
    if (!isSaveRpcMissing(rpcErr.message, rpcErr.code)) {
      return { error: rpcErr.message, categoryIds: [], primaryCategoryId: '' }
    }
    const legacy = await saveProductCategoriesLegacy(productId, unique, primaryCategoryId)
    if (legacy.error) {
      return { error: legacy.error, categoryIds: [], primaryCategoryId: '' }
    }
  }

  const fresh = await fetchProductCategoriesForProduct(productId, primaryCategoryId)
  if (fresh.categoryIds.length <= 1 && unique.length > 1) {
    return {
      error:
        'Categories did not persist — the database may be missing migration 071_save_product_categories_rpc. Run npm run db:push:remote.',
      categoryIds: fresh.categoryIds,
      primaryCategoryId: fresh.primaryCategoryId,
    }
  }

  return {
    error: null,
    categoryIds: fresh.categoryIds.length > 0 ? fresh.categoryIds : unique,
    primaryCategoryId: fresh.primaryCategoryId || primaryCategoryId,
  }
}

/** Update one product's entry in the map from the database. */
export async function refreshProductCategoryMapEntry(
  map: ProductCategoryMap,
  productId: string,
  fallbackCategoryId: string | null
): Promise<ProductCategoryMap> {
  const fresh = await fetchProductCategoriesForProduct(productId, fallbackCategoryId)
  const next = new Map(map)
  next.set(productId, fresh.categoryIds)
  return next
}

export function productMatchesCategoryFilter(
  categoryIds: string[],
  primaryCategoryId: string | null,
  filterCategoryId: string,
  categoryMap: Map<string, CategoryRow>,
  slugMatcher: (productSlug: string, selectedSlug: string) => boolean
): boolean {
  if (!filterCategoryId) return true
  const allIds =
    categoryIds.length > 0 ? categoryIds : primaryCategoryId ? [primaryCategoryId] : []
  if (allIds.length === 0) return false

  const selected = categoryMap.get(filterCategoryId)
  const selSlug = selected?.slug ?? ''

  for (const catId of allIds) {
    if (catId === filterCategoryId) return true
    if (!selSlug) continue
    const pc = categoryMap.get(catId)
    if (pc && slugMatcher(pc.slug ?? '', selSlug)) return true
  }
  return false
}

export function productMatchesAnyCategorySlug(
  categoryIds: string[],
  primaryCategoryId: string | null,
  categoryMap: Map<string, CategoryRow>,
  predicate: (slug: string) => boolean
): boolean {
  const allIds =
    categoryIds.length > 0 ? categoryIds : primaryCategoryId ? [primaryCategoryId] : []
  for (const catId of allIds) {
    const cat = categoryMap.get(catId)
    if (cat && predicate((cat.slug ?? '').toLowerCase())) return true
  }
  return false
}
