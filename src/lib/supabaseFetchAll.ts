import { supabase } from '@/lib/supabase'
import type { ProductRow } from '@/types/database'

const PAGE_SIZE = 1000

type RangeResult<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Fetch every row from a Supabase query (PostgREST defaults to 1000 rows per request).
 */
export async function fetchAllPaginated<T>(
  buildQuery: (from: number, to: number) => PromiseLike<RangeResult<T>>
): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    out.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

export function fetchAllProducts(): Promise<ProductRow[]> {
  return fetchAllPaginated<ProductRow>((from, to) =>
    supabase
      .from('products')
      .select('*')
      .order('sort_order')
      .order('name')
      .range(from, to) as PromiseLike<RangeResult<ProductRow>>
  )
}
