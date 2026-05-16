import { supabase } from '@/lib/supabase'
import type { CategoryRow } from '@/types/database'

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
    })
    .select('*')
    .single()

  if (error) return { category: null, error: error.message }
  return { category: data as CategoryRow, error: null }
}

/** Product count per category (junction assignments + primary-only products). */
export async function fetchCategoryProductCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const [{ data: links }, { data: products }] = await Promise.all([
    supabase.from('product_categories').select('product_id, category_id'),
    supabase.from('products').select('id, category_id'),
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
