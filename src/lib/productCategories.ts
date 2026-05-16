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

/** Load all product ↔ category links (falls back to empty map on error). */
export async function fetchProductCategoryMap(): Promise<ProductCategoryMap> {
  const { data, error } = await supabase
    .from('product_categories')
    .select('product_id, category_id, is_primary')
  if (error) {
    console.warn('product_categories load failed', error.message)
    return new Map()
  }
  const map = new Map<string, string[]>()
  const rows = (data ?? []) as ProductCategoryRow[]
  const primaryFirst = [...rows].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  for (const row of primaryFirst) {
    const list = map.get(row.product_id) ?? []
    if (!list.includes(row.category_id)) list.push(row.category_id)
    map.set(row.product_id, list)
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

export function formatCategoryNames(
  categoryIds: string[],
  categoryMap: Map<string, CategoryRow>
): string {
  const names = categoryIds
    .map((id) => categoryMap.get(id)?.name)
    .filter((n): n is string => Boolean(n))
  return names.length > 0 ? names.join(', ') : '—'
}

export async function saveProductCategories(
  productId: string,
  categoryIds: string[],
  primaryCategoryId: string
): Promise<{ error: string | null }> {
  const unique = [...new Set(categoryIds.filter(Boolean))]
  if (unique.length === 0 || !primaryCategoryId || !unique.includes(primaryCategoryId)) {
    return { error: 'Select at least one category and a valid primary category.' }
  }

  const { error: delErr } = await supabase.from('product_categories').delete().eq('product_id', productId)
  if (delErr) return { error: delErr.message }

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
  return { error: prodErr?.message ?? null }
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
