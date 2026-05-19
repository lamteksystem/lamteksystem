/**
 * Smart categorisation memory.
 *
 * Stores token→category mappings each time an admin confirms (or corrects) a category
 * assignment in the Smart Categorise modal. The next time we score categories for a product,
 * we look up tokens from the product name/description and add a learning bonus to the
 * category the admin previously chose for similar products. Over time the heuristic gets
 * better the more it is used.
 */
import { supabase } from '@/lib/supabase'

export interface LearningRow {
  token: string
  category_id: string
  weight: number
  last_learned_at?: string
}

export type LearningIndex = Map<string, Map<string, number>>

/** Sorted list of learned rows for the History UI. */
export async function loadSmartCategoryHistory(): Promise<LearningRow[]> {
  const { data, error } = await supabase
    .from('smart_category_learning')
    .select('token, category_id, weight, last_learned_at')
    .order('last_learned_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return data as LearningRow[]
}

/** Wipe everything the smart categorise heuristic has learnt. */
export async function resetSmartCategoryLearning(): Promise<{ deleted: number; error: string | null }> {
  const { error, count } = await supabase
    .from('smart_category_learning')
    .delete({ count: 'exact' })
    .neq('token', '')
  if (error) return { deleted: 0, error: error.message }
  return { deleted: count ?? 0, error: null }
}

/** Remove a single learned (token, category) pair. */
export async function deleteSmartCategoryToken(
  token: string,
  categoryId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('smart_category_learning')
    .delete()
    .eq('token', token)
    .eq('category_id', categoryId)
  return { error: error?.message ?? null }
}

/** Delete every learned row for a token, across all categories. Used by "Ignore everywhere". */
export async function deleteSmartCategoryTokenEverywhere(
  token: string,
): Promise<{ deleted: number; error: string | null }> {
  const { error, count } = await supabase
    .from('smart_category_learning')
    .delete({ count: 'exact' })
    .eq('token', token)
  if (error) return { deleted: 0, error: error.message }
  return { deleted: count ?? 0, error: null }
}

/** Set (or insert) the weight for a learned token. weight <= 0 deletes the row instead. */
export async function setSmartCategoryWeight(
  token: string,
  categoryId: string,
  weight: number,
): Promise<{ error: string | null }> {
  if (weight <= 0) return deleteSmartCategoryToken(token, categoryId)
  const now = new Date().toISOString()
  // Upsert by (token, category_id) — table has a unique index on that pair.
  const { error } = await supabase
    .from('smart_category_learning')
    .upsert(
      { token, category_id: categoryId, weight, last_learned_at: now },
      { onConflict: 'token,category_id' },
    )
  return { error: error?.message ?? null }
}

const BUILT_IN_STOP_WORDS = [
  'the',
  'and',
  'for',
  'with',
  'mm',
  'lamtek',
  'tealbury',
  'pack',
  'unit',
  'panel',
  'item',
  'qty',
  'size',
]

export const BUILT_IN_STOP_WORD_SET: ReadonlySet<string> = new Set(BUILT_IN_STOP_WORDS)
export function listBuiltInStopWords(): string[] {
  return [...BUILT_IN_STOP_WORDS]
}

/** In-memory cache of user-managed stop words, refreshed on demand. */
let userStopWordCache: Set<string> | null = null

export async function loadUserSmartStopWords(): Promise<string[]> {
  const { data, error } = await supabase
    .from('smart_category_stop_words')
    .select('token')
    .order('token')
  if (error || !data) {
    userStopWordCache = userStopWordCache ?? new Set()
    return []
  }
  const list = (data as { token: string }[]).map((r) => r.token).filter(Boolean)
  userStopWordCache = new Set(list)
  return list
}

export function getCachedUserSmartStopWords(): Set<string> {
  return userStopWordCache ?? new Set()
}

export async function addUserSmartStopWord(rawToken: string): Promise<{ error: string | null }> {
  const token = rawToken.trim().toLowerCase()
  if (!token) return { error: 'Empty token' }
  const { error } = await supabase
    .from('smart_category_stop_words')
    .upsert({ token }, { onConflict: 'token' })
  if (!error) {
    if (!userStopWordCache) userStopWordCache = new Set()
    userStopWordCache.add(token)
  }
  return { error: error?.message ?? null }
}

export async function removeUserSmartStopWord(rawToken: string): Promise<{ error: string | null }> {
  const token = rawToken.trim().toLowerCase()
  if (!token) return { error: 'Empty token' }
  const { error } = await supabase
    .from('smart_category_stop_words')
    .delete()
    .eq('token', token)
  if (!error && userStopWordCache) userStopWordCache.delete(token)
  return { error: error?.message ?? null }
}

/** Combined effective stop-word set (built-in + cached user-managed). */
function effectiveStopWordSet(): Set<string> {
  const merged = new Set<string>(BUILT_IN_STOP_WORD_SET)
  for (const t of getCachedUserSmartStopWords()) merged.add(t)
  return merged
}

/** Tokenise a product name/description for learning + matching. Same shape as the heuristic. */
export function learningTokens(text: string): string[] {
  const stopWords = effectiveStopWordSet()
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !stopWords.has(t)),
    ),
  )
}

/** Pull all learned rows once per session; the caller caches. */
export async function loadSmartCategoryLearning(): Promise<LearningIndex> {
  const index: LearningIndex = new Map()
  const { data, error } = await supabase
    .from('smart_category_learning')
    .select('token, category_id, weight')
  if (error || !data) return index
  for (const row of data as LearningRow[]) {
    if (!row.token || !row.category_id) continue
    let bucket = index.get(row.token)
    if (!bucket) {
      bucket = new Map()
      index.set(row.token, bucket)
    }
    bucket.set(row.category_id, (bucket.get(row.category_id) ?? 0) + (row.weight ?? 1))
  }
  return index
}

/** Increment learned weight for every token in the product name+description against this category. */
export async function recordSmartCategoryLearning(
  productText: string,
  categoryId: string,
): Promise<void> {
  const tokens = learningTokens(productText)
  if (tokens.length === 0 || !categoryId) return
  const rows = tokens.map((token) => ({ token, category_id: categoryId, weight: 1 }))
  // Try an RPC-style upsert: on conflict (token, category_id) -> weight = existing + 1. Supabase
  // PostgREST does not support `on conflict do update set weight = weight + 1` directly via the
  // JS client, so we read existing rows for these tokens+category and merge weights manually.
  const { data: existing } = await supabase
    .from('smart_category_learning')
    .select('token, category_id, weight')
    .in('token', tokens)
    .eq('category_id', categoryId)

  const existingByToken = new Map<string, number>()
  for (const row of (existing ?? []) as LearningRow[]) {
    existingByToken.set(row.token, row.weight ?? 0)
  }

  const updates: { token: string; category_id: string; weight: number; last_learned_at: string }[] = []
  const inserts: { token: string; category_id: string; weight: number }[] = []
  const now = new Date().toISOString()
  for (const row of rows) {
    if (existingByToken.has(row.token)) {
      updates.push({
        token: row.token,
        category_id: row.category_id,
        weight: (existingByToken.get(row.token) ?? 0) + 1,
        last_learned_at: now,
      })
    } else {
      inserts.push(row)
    }
  }

  if (inserts.length > 0) {
    await supabase.from('smart_category_learning').insert(inserts)
  }
  for (const u of updates) {
    await supabase
      .from('smart_category_learning')
      .update({ weight: u.weight, last_learned_at: u.last_learned_at })
      .eq('token', u.token)
      .eq('category_id', u.category_id)
  }
}

/**
 * Given a learning index and a product text, return per-category boost weights derived from how
 * many product tokens have been associated with each category in the past.
 */
export function learningBoosts(
  index: LearningIndex,
  productText: string,
): Map<string, number> {
  const totals = new Map<string, number>()
  if (index.size === 0) return totals
  const tokens = learningTokens(productText)
  for (const token of tokens) {
    const bucket = index.get(token)
    if (!bucket) continue
    for (const [categoryId, weight] of bucket) {
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + weight)
    }
  }
  return totals
}
