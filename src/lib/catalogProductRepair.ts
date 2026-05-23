import { supabase } from '@/lib/supabase'
import { deriveWorkbenchProductName } from '@/lib/pricelistWorkbench'
import type { ProductRow } from '@/types/database'

/** Backfill blank product names from description / SKU (e.g. after a Tealbury publish). */
export async function repairEmptyCatalogueProductNames(opts?: {
  catalog_program?: ProductRow['catalog_program']
}): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  let query = supabase.from('products').select('id, name, description, sku, catalog_program')
  if (opts?.catalog_program) query = query.eq('catalog_program', opts.catalog_program)

  const { data, error } = await query
  if (error) {
    result.errors.push(error.message)
    return result
  }

  for (const row of data ?? []) {
    if (row.name?.trim()) {
      result.skipped++
      continue
    }
    const name = deriveWorkbenchProductName({
      name: '',
      sku: row.sku ?? '',
      description: row.description ?? '',
      section: '',
      trade_code: row.sku ?? '',
    }).trim()
    if (!name) {
      result.skipped++
      continue
    }
    const { error: upErr } = await supabase.from('products').update({ name: name.slice(0, 255) }).eq('id', row.id)
    if (upErr) result.errors.push(`${row.sku ?? row.id}: ${upErr.message}`)
    else result.updated++
  }

  return result
}
