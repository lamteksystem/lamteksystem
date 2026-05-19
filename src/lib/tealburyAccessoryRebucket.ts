/**
 * Re-bucket already-imported Tealbury "ACCESSORIES" products into the user's specialised
 * categories: Cornice & Pelmet, Plinth, Panels, Mouldings, Posts.
 *
 * The Tealbury pricelist puts cornice/pelmet/plinth/panel/post/moulding lines together under a
 * single ACCESSORIES section per door range. This helper looks at the product name, description
 * and SKU and assigns the right destination category.
 */
import { supabase } from '@/lib/supabase'
import { mapTealburyAccessoryToCategory } from '@/lib/tealburyPricelistParse'
import { saveProductCategories } from '@/lib/productCategories'
import {
  createCategory,
  fetchAllCategories,
  slugifyCategoryName,
  updateCategory,
} from '@/lib/categoryAdmin'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { CategoryRow, ProductRow } from '@/types/database'

export const TEALBURY_ACCESSORY_TARGETS: { name: string; slug: string }[] = [
  { name: 'Cornice & Pelmet', slug: 'cornice-pelmet' },
  { name: 'Plinth', slug: 'plinth' },
  { name: 'Panels', slug: 'panels' },
  { name: 'Mouldings', slug: 'mouldings' },
  { name: 'Posts', slug: 'posts' },
]

export interface TealburyRebucketSummary {
  ensured: number
  reassigned: number
  skipped: number
  errors: string[]
}

function nameMatches(category: CategoryRow, target: { name: string; slug: string }): boolean {
  return (
    category.name.trim().toLowerCase() === target.name.toLowerCase() ||
    category.slug === target.slug ||
    category.slug === slugifyCategoryName(target.name)
  )
}

/** Ensure the 5 destination categories exist as top-level "universal" cross-range categories. */
export async function ensureTealburyAccessoryCategories(
  existing: CategoryRow[],
): Promise<{ map: Map<string, string>; ensured: number; errors: string[] }> {
  const map = new Map<string, string>()
  const errors: string[] = []
  let ensured = 0

  for (const target of TEALBURY_ACCESSORY_TARGETS) {
    let cat = existing.find((c) => nameMatches(c, target))
    if (!cat) {
      const { category, error } = await createCategory({
        name: target.name,
        slug: target.slug,
        category_kind: 'universal',
      })
      if (error || !category) {
        errors.push(`${target.name}: ${error ?? 'create failed'}`)
        continue
      }
      cat = category
      ensured += 1
    } else if (cat.category_kind !== 'universal') {
      await updateCategory(cat.id, { category_kind: 'universal' })
    }
    map.set(target.name, cat.id)
  }

  return { map, ensured, errors }
}

function looksLikeTealburyAccessory(product: ProductRow): boolean {
  if (product.catalog_program !== CATALOG_PROGRAM.TEALBURY) return false
  const opts = product.options as Record<string, unknown> | null
  const sections = Array.isArray(opts?.tealbury_sections)
    ? ((opts!.tealbury_sections as unknown[]).map((s) => String(s)).join(' '))
    : ''
  return /accessor/i.test(sections)
}

/** Re-categorise Tealbury accessory products that ended up in a generic "Accessories" bucket. */
export async function rebucketTealburyAccessories(): Promise<TealburyRebucketSummary> {
  const summary: TealburyRebucketSummary = { ensured: 0, reassigned: 0, skipped: 0, errors: [] }

  const categories = await fetchAllCategories()
  const { map, ensured, errors: ensureErrors } = await ensureTealburyAccessoryCategories(categories)
  summary.ensured = ensured
  summary.errors.push(...ensureErrors)
  if (map.size === 0) return summary

  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, sku, category_id, catalog_program, options')
    .eq('catalog_program', CATALOG_PROGRAM.TEALBURY)

  if (error) {
    summary.errors.push(`Load products: ${error.message}`)
    return summary
  }

  const products = (data ?? []) as ProductRow[]
  for (const product of products) {
    if (!looksLikeTealburyAccessory(product)) {
      summary.skipped += 1
      continue
    }
    const targetName = mapTealburyAccessoryToCategory(
      `${product.name ?? ''} ${product.description ?? ''}`,
      product.sku ?? '',
    )
    if (!targetName) {
      summary.skipped += 1
      continue
    }
    const targetId = map.get(targetName)
    if (!targetId) {
      summary.skipped += 1
      continue
    }
    if (targetId === product.category_id) {
      summary.skipped += 1
      continue
    }
    const result = await saveProductCategories(product.id, [targetId], targetId)
    if (result.error) {
      summary.errors.push(`${product.name}: ${result.error}`)
      continue
    }
    summary.reassigned += 1
  }

  return summary
}
