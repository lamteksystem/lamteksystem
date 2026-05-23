import { supabase } from '@/lib/supabase'
import { CORE_CATALOGUE_CATEGORY_NAMES } from '@/lib/coreCatalogueCategories'

export interface PruneImportedCategoriesResult {
  removedCategories: number
  productsUncategorised: number
  error: string | null
}

/** Remove import/Tealbury auto-created categories; keep core taxonomy only. Products become uncategorised when needed. */
export async function pruneImportedCategories(): Promise<PruneImportedCategoriesResult> {
  const { data, error } = await supabase.rpc('prune_imported_categories')
  if (error) {
    return { removedCategories: 0, productsUncategorised: 0, error: error.message }
  }
  const row = (data ?? {}) as { removed_categories?: number; products_uncategorised?: number }
  return {
    removedCategories: Number(row.removed_categories ?? 0),
    productsUncategorised: Number(row.products_uncategorised ?? 0),
    error: null,
  }
}

export { CORE_CATALOGUE_CATEGORY_NAMES }
