import { supabase } from '@/lib/supabase'
import type { CategoryRow, ProductRow } from '@/types/database'
import {
  getCategoryKind,
  inferCategoryKindFromName,
  type CategoryKind,
} from '@/lib/categoryTaxonomy'
import { saveProductCategories } from '@/lib/productCategories'

export interface SmartCategorySuggestion {
  productId: string
  productName: string
  currentCategoryId: string | null
  suggestedCategoryId: string
  suggestedCategoryName: string
  score: number
  confidence: 'high' | 'medium' | 'low'
}

const STOP_WORDS = new Set([
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
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

function scoreNameMatch(productName: string, categoryName: string): number {
  const productTokens = new Set(tokenize(productName))
  const categoryTokens = tokenize(categoryName)
  if (categoryTokens.length === 0) return 0

  let hits = 0
  for (const t of categoryTokens) {
    if (productTokens.has(t)) hits += 1
    else if ([...productTokens].some((p) => p.includes(t) || t.includes(p))) hits += 0.5
  }

  const ratio = hits / categoryTokens.length
  const name = productName.toLowerCase()
  const cat = categoryName.toLowerCase()
  if (name.includes(cat) || cat.includes(name.slice(0, Math.min(12, name.length)))) {
    return Math.max(ratio, 0.85)
  }

  const keywordBoosts: [RegExp, string[]][] = [
    [/handle|knob|gola|rail/i, ['handle', 'knob', 'rail', 'profile']],
    [/door|frontal|drawer front/i, ['door', 'frontal', 'front']],
    [/hinge|runner|bracket|fitting|soft close/i, ['hinge', 'fitting', 'runner', 'bracket']],
    [/worktop|upstand|splashback/i, ['worktop', 'panel', 'upstand']],
    [/plinth|cornice|pelmet|mould/i, ['plinth', 'cornice', 'pelmet', 'mould']],
    [/wirework|pull out|carousel|bin|storage/i, ['wirework', 'storage', 'internal', 'bin']],
    [/accessor|orgatray|cutlery/i, ['accessor', 'cutlery', 'tray']],
    [/base|wall|tall|larder|carcass|cabinet/i, ['unit', 'cabinet', 'carcass', 'base', 'wall']],
    [/panel|end panel|filler/i, ['panel', 'filler']],
  ]

  for (const [pattern, catHints] of keywordBoosts) {
    if (!pattern.test(productName)) continue
    if (catHints.some((h) => cat.includes(h))) return Math.max(ratio, 0.75)
  }

  return ratio
}

export function suggestCategoryForProduct(
  product: Pick<ProductRow, 'id' | 'name' | 'description' | 'sku' | 'category_id'>,
  categories: CategoryRow[],
  options?: { browseMode?: 'category' | 'range' },
): SmartCategorySuggestion | null {
  const mode = options?.browseMode ?? 'category'
  const pool = categories.filter((c) => {
    const kind = getCategoryKind(c)
    if (mode === 'range') return kind === 'door_range' || kind === 'universal'
    return kind !== 'door_range'
  })
  if (pool.length === 0) return null

  const haystack = [product.name, product.description, product.sku].filter(Boolean).join(' ')
  let best: { category: CategoryRow; score: number } | null = null

  for (const category of pool) {
    const score = scoreNameMatch(haystack, category.name)
    if (!best || score > best.score) best = { category, score }
  }

  if (!best || best.score < 0.35) return null
  if (best.category.id === product.category_id && best.score < 0.9) return null

  const confidence: SmartCategorySuggestion['confidence'] =
    best.score >= 0.75 ? 'high' : best.score >= 0.5 ? 'medium' : 'low'

  return {
    productId: product.id,
    productName: product.name,
    currentCategoryId: product.category_id,
    suggestedCategoryId: best.category.id,
    suggestedCategoryName: best.category.name,
    score: best.score,
    confidence,
  }
}

export function buildSmartCategorizationSuggestions(
  products: ProductRow[],
  categories: CategoryRow[],
): SmartCategorySuggestion[] {
  return products
    .map((p) => suggestCategoryForProduct(p, categories))
    .filter((s): s is SmartCategorySuggestion => s != null)
    .sort((a, b) => b.score - a.score)
}

export async function applySmartCategorySuggestions(
  suggestions: SmartCategorySuggestion[],
): Promise<{ applied: number; errors: string[] }> {
  let applied = 0
  const errors: string[] = []

  for (const s of suggestions) {
    const result = await saveProductCategories(s.productId, [s.suggestedCategoryId], s.suggestedCategoryId)
    if (result.error) {
      errors.push(`${s.productName}: ${result.error}`)
      continue
    }
    applied += 1
  }

  return { applied, errors }
}

/** Infer category_kind for categories missing explicit kind (admin batch). */
export function suggestCategoryKind(category: CategoryRow): CategoryKind {
  return inferCategoryKindFromName(category.name)
}

export async function syncInferredCategoryKinds(categories: CategoryRow[]): Promise<number> {
  let updated = 0
  for (const c of categories) {
    const row = c as CategoryRow & { category_kind?: string }
    if (row.category_kind && row.category_kind !== 'product_type') continue
    const inferred = suggestCategoryKind(c)
    if (inferred === 'product_type') continue
    const { error } = await supabase.from('categories').update({ category_kind: inferred }).eq('id', c.id)
    if (!error) updated += 1
  }
  return updated
}
