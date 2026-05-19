/**
 * Smart categorise: tunable settings cache.
 *
 * Centralises every knob that affects scoring, tokenisation and learning so
 * the Settings tab can edit them without code changes. The tokeniser and
 * scoring functions read the *cached* settings (synchronously) — the cache is
 * populated by the hub on mount (see `loadSmartCategorySettings`) and after
 * every save. Defaults are baked in so behaviour stays sane before the first
 * fetch lands.
 */
import { supabase } from '@/lib/supabase'

export interface SmartCategorySettings {
  /** Suggestions with score below this are not returned at all. */
  minScore: number
  /** score >= this → "medium" confidence band. */
  mediumThreshold: number
  /** score >= this → "high" confidence band. */
  highThreshold: number
  /** Each learned weight unit contributes this much score boost (pre-cap). */
  learningBoostPerWeight: number
  /** Maximum total boost any single category can earn from learning. */
  learningBoostCap: number
  /** Tokens shorter than this are dropped from learning + scoring. */
  minTokenLength: number
  /**
   * Tokens that are pure digits (or digits+unit suffix like "18mm") and
   * shorter than this are dropped. Set to 0 to disable.
   */
  ignoreShortNumericBelow: number
  /** A token learned for this many categories or more is flagged ambiguous. */
  autoAmbiguousThreshold: number
  /** Master switch: when false, new corrections are NOT recorded. */
  learningEnabled: boolean
  /** Master switch: when false, learned tokens do NOT boost scoring. */
  boostEnabled: boolean
}

export const DEFAULT_SMART_CATEGORY_SETTINGS: SmartCategorySettings = {
  minScore: 0.35,
  mediumThreshold: 0.5,
  highThreshold: 0.75,
  learningBoostPerWeight: 0.04,
  learningBoostCap: 0.4,
  minTokenLength: 3,
  ignoreShortNumericBelow: 0,
  autoAmbiguousThreshold: 2,
  learningEnabled: true,
  boostEnabled: true,
}

let cache: SmartCategorySettings = { ...DEFAULT_SMART_CATEGORY_SETTINGS }

/** Returns the current cached settings — always non-null thanks to defaults. */
export function getCachedSmartCategorySettings(): SmartCategorySettings {
  return cache
}

interface SmartCategorySettingsRow {
  id: number
  min_score: string | number
  medium_threshold: string | number
  high_threshold: string | number
  learning_boost_per_weight: string | number
  learning_boost_cap: string | number
  min_token_length: number
  ignore_short_numeric_below: number
  auto_ambiguous_threshold: number
  learning_enabled: boolean
  boost_enabled: boolean
  updated_at: string
}

function rowToSettings(row: SmartCategorySettingsRow | null | undefined): SmartCategorySettings {
  if (!row) return { ...DEFAULT_SMART_CATEGORY_SETTINGS }
  const num = (v: string | number | null | undefined, fallback: number) => {
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'string' ? Number(v) : v
    return Number.isFinite(n) ? n : fallback
  }
  return {
    minScore: num(row.min_score, DEFAULT_SMART_CATEGORY_SETTINGS.minScore),
    mediumThreshold: num(row.medium_threshold, DEFAULT_SMART_CATEGORY_SETTINGS.mediumThreshold),
    highThreshold: num(row.high_threshold, DEFAULT_SMART_CATEGORY_SETTINGS.highThreshold),
    learningBoostPerWeight: num(
      row.learning_boost_per_weight,
      DEFAULT_SMART_CATEGORY_SETTINGS.learningBoostPerWeight,
    ),
    learningBoostCap: num(row.learning_boost_cap, DEFAULT_SMART_CATEGORY_SETTINGS.learningBoostCap),
    minTokenLength: row.min_token_length ?? DEFAULT_SMART_CATEGORY_SETTINGS.minTokenLength,
    ignoreShortNumericBelow:
      row.ignore_short_numeric_below ?? DEFAULT_SMART_CATEGORY_SETTINGS.ignoreShortNumericBelow,
    autoAmbiguousThreshold:
      row.auto_ambiguous_threshold ?? DEFAULT_SMART_CATEGORY_SETTINGS.autoAmbiguousThreshold,
    learningEnabled: row.learning_enabled ?? DEFAULT_SMART_CATEGORY_SETTINGS.learningEnabled,
    boostEnabled: row.boost_enabled ?? DEFAULT_SMART_CATEGORY_SETTINGS.boostEnabled,
  }
}

export async function loadSmartCategorySettings(): Promise<SmartCategorySettings> {
  const { data, error } = await supabase
    .from('smart_category_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    cache = { ...DEFAULT_SMART_CATEGORY_SETTINGS }
    return cache
  }
  cache = rowToSettings(data as SmartCategorySettingsRow)
  return cache
}

export async function saveSmartCategorySettings(
  patch: Partial<SmartCategorySettings>,
): Promise<{ error: string | null; settings: SmartCategorySettings }> {
  const next: SmartCategorySettings = { ...cache, ...patch }
  // Clamp ordering: min ≤ medium ≤ high — the table check would otherwise reject.
  next.mediumThreshold = Math.max(next.mediumThreshold, next.minScore)
  next.highThreshold = Math.max(next.highThreshold, next.mediumThreshold)
  const payload = {
    id: 1,
    min_score: next.minScore,
    medium_threshold: next.mediumThreshold,
    high_threshold: next.highThreshold,
    learning_boost_per_weight: next.learningBoostPerWeight,
    learning_boost_cap: next.learningBoostCap,
    min_token_length: next.minTokenLength,
    ignore_short_numeric_below: next.ignoreShortNumericBelow,
    auto_ambiguous_threshold: next.autoAmbiguousThreshold,
    learning_enabled: next.learningEnabled,
    boost_enabled: next.boostEnabled,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('smart_category_settings')
    .upsert(payload, { onConflict: 'id' })
  if (!error) cache = next
  return { error: error?.message ?? null, settings: cache }
}

/** Returns true when `token` is "short numeric" relative to the current settings. */
export function isShortNumericToken(token: string, settings = cache): boolean {
  const limit = settings.ignoreShortNumericBelow
  if (limit <= 0) return false
  if (token.length >= limit) return false
  // Matches "18", "18mm", "910mm", "2430mm" etc — digits with an optional alpha unit suffix.
  return /^\d+[a-z]*$/i.test(token)
}
