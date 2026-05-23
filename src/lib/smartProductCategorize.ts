import { supabase } from '@/lib/supabase'
import type { CategoryRow, ProductRow } from '@/types/database'
import {
  categoriesForSmartProductAssignment,
  getCategoryKind,
  inferCategoryKindFromName,
  isCompleteUnitsCategoryName,
  type CategoryKind,
} from '@/lib/categoryTaxonomy'
import { saveProductCategories } from '@/lib/productCategories'
import {
  learningBoosts,
  loadSmartCategoryLearning,
  recordSmartCategoryLearning,
  type LearningIndex,
} from '@/lib/smartCategoryLearning'
import { getCachedSmartCategorySettings } from '@/lib/smartCategorySettings'
import { mapTealburyAccessoryToCategory } from '@/lib/tealburyPricelistParse'
import { slugifyCategoryName } from '@/lib/categoryAdmin'

export interface SmartCategorySuggestion {
  productId: string
  productName: string
  productText: string
  currentCategoryId: string | null
  suggestedCategoryId: string
  suggestedCategoryName: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  learningBoost: number
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
    [/cornice|pelmet/i, ['cornice', 'pelmet']],
    [/plinth/i, ['plinth']],
    [/(corbel|mantle|mantel|universal moulding|moulding|quadrant|skirting)/i, ['mould', 'corbel', 'mantle']],
    [/(corner post|tall feature end post|\bpost\b)/i, ['post']],
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

function isGenericAccessoriesCategory(categoryName: string): boolean {
  return /^accessories$/i.test(categoryName.trim())
}

function findCategoryByDisplayName(
  categories: CategoryRow[],
  targetName: string,
): CategoryRow | null {
  const t = targetName.trim().toLowerCase()
  if (!t) return null
  const slug = slugifyCategoryName(targetName)
  return (
    categories.find((c) => c.name.trim().toLowerCase() === t) ??
    categories.find((c) => c.slug === slug) ??
    null
  )
}

export interface SuggestOptions {
  browseMode?: 'category' | 'range'
  learning?: LearningIndex
}

export function suggestCategoryForProduct(
  product: Pick<ProductRow, 'id' | 'name' | 'description' | 'sku' | 'category_id'>,
  categories: CategoryRow[],
  options?: SuggestOptions,
): SmartCategorySuggestion | null {
  const mode = options?.browseMode ?? 'category'
  const pool =
    mode === 'range'
      ? categories.filter((c) => {
          const kind = getCategoryKind(c)
          return kind === 'door_range' || kind === 'universal'
        })
      : categoriesForSmartProductAssignment(categories)
  if (pool.length === 0) return null

  const haystack = [product.name, product.description, product.sku].filter(Boolean).join(' ')

  const tealburyAccessoryTarget = mapTealburyAccessoryToCategory(haystack, product.sku ?? '')
  if (tealburyAccessoryTarget) {
    const exact = findCategoryByDisplayName(categories, tealburyAccessoryTarget)
    if (exact && pool.some((c) => c.id === exact.id)) {
      if (exact.id === product.category_id) return null
      return {
        productId: product.id,
        productName: product.name,
        productText: haystack,
        currentCategoryId: product.category_id,
        suggestedCategoryId: exact.id,
        suggestedCategoryName: exact.name,
        score: 0.95,
        confidence: 'high',
        learningBoost: 0,
      }
    }
  }

  const settings = getCachedSmartCategorySettings()
  const boosts =
    options?.learning && settings.boostEnabled ? learningBoosts(options.learning, haystack) : null
  let best: { category: CategoryRow; score: number; boost: number } | null = null

  for (const category of pool) {
    if (
      tealburyAccessoryTarget &&
      isGenericAccessoriesCategory(category.name) &&
      !isGenericAccessoriesCategory(tealburyAccessoryTarget)
    ) {
      continue
    }

    let baseScore = scoreNameMatch(haystack, category.name)
    if (tealburyAccessoryTarget) {
      const target = tealburyAccessoryTarget.toLowerCase()
      const catName = category.name.toLowerCase()
      if (catName === target || catName.includes(target) || target.includes(catName)) {
        baseScore = Math.max(baseScore, 0.9)
      }
    }
    const learnWeight = boosts?.get(category.id) ?? 0
    // Cap the learning boost so a single accidental confirmation can't dominate.
    const learnBoost = Math.min(
      settings.learningBoostCap,
      learnWeight * settings.learningBoostPerWeight,
    )
    const score = Math.min(1, baseScore + learnBoost)
    if (!best || score > best.score) best = { category, score, boost: learnBoost }
  }

  if (!best || best.score < settings.minScore) return null
  if (best.category.id === product.category_id && best.score < 0.9) return null

  const confidence: SmartCategorySuggestion['confidence'] =
    best.score >= settings.highThreshold
      ? 'high'
      : best.score >= settings.mediumThreshold
        ? 'medium'
        : 'low'

  return {
    productId: product.id,
    productName: product.name,
    productText: haystack,
    currentCategoryId: product.category_id,
    suggestedCategoryId: best.category.id,
    suggestedCategoryName: best.category.name,
    score: best.score,
    confidence,
    learningBoost: best.boost,
  }
}

export function buildSmartCategorizationSuggestions(
  products: ProductRow[],
  categories: CategoryRow[],
  learning?: LearningIndex,
): SmartCategorySuggestion[] {
  return products
    .map((p) => suggestCategoryForProduct(p, categories, { learning }))
    .filter((s): s is SmartCategorySuggestion => s != null)
    .sort((a, b) => b.score - a.score)
}

/**
 * A per-row override: either a single category (legacy) or a primary + extras for
 * products that should sit in multiple categories at once.
 */
export type SmartCategoryOverride =
  | string
  | { primary: string; additional?: string[] }

/**
 * Apply per-row category overrides. The caller passes the override map
 * (productId -> override) so each row can:
 *   - target a different primary category than the heuristic's suggestion, AND/OR
 *   - assign additional categories on top of the primary one.
 *
 * Every successful apply also feeds the learning store so future suggestions are improved.
 */
export async function applySmartCategorySuggestions(
  suggestions: SmartCategorySuggestion[],
  overrides?: Map<string, SmartCategoryOverride>,
): Promise<{ applied: number; errors: string[] }> {
  let applied = 0
  const errors: string[] = []

  for (const s of suggestions) {
    const override = overrides?.get(s.productId)
    const primaryId =
      typeof override === 'string'
        ? override
        : override?.primary ?? s.suggestedCategoryId
    const additional =
      typeof override === 'object' && override !== null
        ? override.additional ?? []
        : []
    if (!primaryId) continue
    const allIds = [primaryId, ...additional.filter((id) => id && id !== primaryId)]
    const result = await saveProductCategories(s.productId, allIds, primaryId)
    if (result.error) {
      errors.push(`${s.productName}: ${result.error}`)
      continue
    }
    // Fire-and-forget — don't block the loop on learning writes.
    // Learning is recorded against the primary only — the chosen "best" bucket.
    void recordSmartCategoryLearning(s.productText, primaryId)
    applied += 1
  }

  return { applied, errors }
}

export { loadSmartCategoryLearning }

/** Infer category_kind for categories missing explicit kind (admin batch). */
export function suggestCategoryKind(category: CategoryRow): CategoryKind {
  return inferCategoryKindFromName(category.name)
}

export async function syncInferredCategoryKinds(categories: CategoryRow[]): Promise<number> {
  let updated = 0
  for (const c of categories) {
    if (isCompleteUnitsCategoryName(c.name)) continue
    const row = c as CategoryRow & { category_kind?: string }
    if (row.category_kind && row.category_kind !== 'product_type') continue
    const inferred = suggestCategoryKind(c)
    if (inferred === 'product_type') continue
    const { error } = await supabase.from('categories').update({ category_kind: inferred }).eq('id', c.id)
    if (!error) updated += 1
  }
  return updated
}
