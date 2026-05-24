import { supabase } from '@/lib/supabase'
import type { CategoryKind, CategoryRow } from '@/types/database'

export function slugifyCategoryName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  )
}

function uniqueSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let n = 2
  while (existingSlugs.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export async function fetchAllCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryRow[]
}

export async function createCategory(params: {
  name: string
  slug?: string
  parent_id?: string | null
  sort_order?: number
  category_kind?: CategoryKind
}): Promise<{ category: CategoryRow | null; error: string | null }> {
  const name = params.name.trim()
  if (!name) return { category: null, error: 'Category name is required.' }

  const { data: existing, error: listErr } = await supabase.from('categories').select('slug, sort_order')
  if (listErr) return { category: null, error: listErr.message }

  const slugs = new Set((existing ?? []).map((c) => c.slug))
  const baseSlug = slugifyCategoryName((params.slug?.trim() || name).slice(0, 80))
  const slug = uniqueSlug(baseSlug, slugs)
  const maxSort = Math.max(0, ...(existing ?? []).map((c) => c.sort_order ?? 0))

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: name.slice(0, 200),
      slug,
      sort_order: params.sort_order ?? maxSort + 10,
      parent_id: params.parent_id ?? null,
      category_kind: params.category_kind ?? 'product_type',
    })
    .select('*')
    .single()

  if (error) return { category: null, error: error.message }
  return { category: data as CategoryRow, error: null }
}

export function normalizeCategorySlug(raw: string): string {
  return slugifyCategoryName(raw.trim().slice(0, 80))
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<CategoryRow, 'name' | 'slug' | 'sort_order' | 'parent_id' | 'category_kind'>>,
): Promise<{ category: CategoryRow | null; error: string | null }> {
  const body = { ...patch }
  if (body.slug !== undefined) {
    const slug = normalizeCategorySlug(String(body.slug))
    if (!slug) return { category: null, error: 'Slug is required.' }
    const { data: clash, error: clashErr } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()
    if (clashErr) return { category: null, error: clashErr.message }
    if (clash) return { category: null, error: `Slug "${slug}" is already used by another category.` }
    body.slug = slug
  }

  const { data, error } = await supabase.from('categories').update(body).eq('id', id).select('*').single()
  if (error) return { category: null, error: error.message }
  return { category: data as CategoryRow, error: null }
}

export type DeleteCategoryResult = {
  error: string | null
  productsUncategorised?: number
  productsRepointed?: number
  subcategoriesPromoted?: number
}

/** Delete a category (staff). Products lose this assignment; sole primary becomes uncategorised. */
export async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  const { data, error } = await supabase.rpc('delete_category_admin', { p_category_id: id })
  if (error) return { error: error.message }
  const row = (data ?? {}) as Record<string, number>
  return {
    error: null,
    productsUncategorised: row.products_uncategorised ?? 0,
    productsRepointed: row.products_repointed ?? 0,
    subcategoriesPromoted: row.subcategories_promoted ?? 0,
  }
}

/** Product count per category (junction assignments + primary-only products). */
export async function fetchCategoryProductCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const [{ data: links }, { data: products }] = await Promise.all([
    supabase.from('product_categories').select('product_id, category_id'),
    supabase.from('products').select('id, category_id').not('category_id', 'is', null),
  ])
  const productIdsWithLinks = new Set((links ?? []).map((l) => l.product_id))
  for (const row of links ?? []) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }
  for (const p of products ?? []) {
    if (!p.category_id || productIdsWithLinks.has(p.id)) continue
    counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  }
  return counts
}
