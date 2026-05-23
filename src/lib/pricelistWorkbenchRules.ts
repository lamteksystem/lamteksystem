/**
 * Smart rules & natural-language commands for the pricelist workbench draft list.
 */
import type { PricelistWorkbenchRow, PricelistSource } from '@/lib/pricelistWorkbench'
import type { CategoryRow } from '@/types/database'

export type WorkbenchMatchField =
  | 'source'
  | 'door_range'
  | 'section'
  | 'sku'
  | 'name'
  | 'category_name'
  | 'description'
  | 'cost_price'
  | 'unit_price'
  | 'category'

export type WorkbenchConditionOp =
  | 'contains'
  | 'equals'
  | 'not_contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'sku_appears_in_name'
  | 'empty'
  | 'not_empty'
  | 'unassigned'

export type WorkbenchActionType =
  | 'delete'
  | 'remove_sku_from_name'
  | 'strip_text_from_field'
  | 'select'
  | 'deselect'
  | 'set_active'
  | 'set_inactive'
  | 'assign_category'

export type StripTextField = 'description' | 'name' | 'sku'

export interface WorkbenchCondition {
  field: WorkbenchMatchField
  op: WorkbenchConditionOp
  value: string
}

export interface WorkbenchRule {
  id: string
  name: string
  conditions: WorkbenchCondition[]
  matchMode: 'all' | 'any'
  action: WorkbenchActionType
  /** Category name/slug for assign_category; optional for other actions. */
  actionParam?: string
}

export interface ApplyRuleResult {
  matched: number
  changed: number
  message: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fieldValue(row: PricelistWorkbenchRow, field: WorkbenchMatchField): string {
  switch (field) {
    case 'source':
      return row.source
    case 'door_range':
      return row.door_range
    case 'section':
      return row.section
    case 'sku':
      return row.sku
    case 'name':
      return row.name
    case 'category_name':
      return row.category_name
    case 'description':
      return row.description
    case 'cost_price':
      return String(row.cost_price ?? 0)
    case 'unit_price':
      return String(row.unit_price ?? 0)
    case 'category':
      return row.category_id ?? ''
    default:
      return ''
  }
}

function numericFieldValue(row: PricelistWorkbenchRow, field: 'cost_price' | 'unit_price'): number {
  if (field === 'cost_price') return row.cost_price ?? 0
  return row.unit_price ?? 0
}

function skuAppearsInName(row: PricelistWorkbenchRow): boolean {
  const name = row.name.toLowerCase()
  const sku = row.sku.trim().toLowerCase()
  const trade = row.trade_code.trim().toLowerCase()
  if (sku && name.includes(sku)) return true
  if (trade && name.includes(trade)) return true
  const codePart = sku.split(' · ')[0]?.trim().toLowerCase()
  if (codePart && codePart.length >= 2 && name.includes(codePart)) return true
  return false
}

export function rowMatchesCondition(row: PricelistWorkbenchRow, cond: WorkbenchCondition): boolean {
  if (cond.field === 'category' && cond.op === 'unassigned') {
    return !row.category_id
  }

  if (cond.field === 'cost_price' || cond.field === 'unit_price') {
    const num = numericFieldValue(row, cond.field)
    const threshold = parseFloat(cond.value)
    if (Number.isNaN(threshold)) return false
    switch (cond.op) {
      case 'greater_than':
        return num > threshold
      case 'less_than':
        return num < threshold
      case 'equals':
        return Math.abs(num - threshold) < 0.005
      default:
        return false
    }
  }

  const raw = fieldValue(row, cond.field)
  const val = cond.value.trim()
  const hay = raw.toLowerCase()
  const needle = val.toLowerCase()

  switch (cond.op) {
    case 'empty':
      return !raw.trim()
    case 'not_empty':
      return !!raw.trim()
    case 'equals':
      return hay === needle
    case 'starts_with':
      return needle ? hay.startsWith(needle) : true
    case 'contains':
      return needle ? hay.includes(needle) : true
    case 'not_contains':
      return needle ? !hay.includes(needle) : true
    case 'sku_appears_in_name':
      return skuAppearsInName(row)
    default:
      return false
  }
}

export function filterRowsByRule(
  rows: PricelistWorkbenchRow[],
  rule: Pick<WorkbenchRule, 'conditions' | 'matchMode'>
): PricelistWorkbenchRow[] {
  if (!rule.conditions.length) return rows
  return rows.filter((row) => {
    const checks = rule.conditions.map((c) => rowMatchesCondition(row, c))
    return rule.matchMode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
  })
}

/** Strip redundant SKU / trade code from display name. */
export function removeSkuFromName(row: PricelistWorkbenchRow): string {
  let name = row.name.trim()
  const prefixes = [...new Set([row.trade_code.trim(), row.sku.split(' · ')[0]?.trim(), row.sku.trim()])].filter(
    (p) => p.length >= 2
  )

  for (const prefix of prefixes) {
    const reList = [
      new RegExp(`^${escapeRegex(prefix)}\\s*[—–-]\\s*`, 'i'),
      new RegExp(`^${escapeRegex(prefix)}\\s+`, 'i'),
    ]
    for (const re of reList) {
      const next = name.replace(re, '').trim()
      if (next !== name) name = next
    }
  }

  if (row.door_range) {
    const paren = `(${row.door_range})`
    if (name.endsWith(paren)) name = name.slice(0, -paren.length).trim()
    const spaced = ` (${row.door_range})`
    if (name.endsWith(spaced)) name = name.slice(0, -spaced.length).trim()
  }

  return name.slice(0, 300)
}

export function parseStripTextActionParam(
  param: string | undefined
): { field: StripTextField; text: string } | null {
  if (!param?.trim()) return null
  const idx = param.indexOf(':')
  if (idx < 1) return null
  const field = param.slice(0, idx).trim() as StripTextField
  const text = param.slice(idx + 1)
  if (field !== 'description' && field !== 'name' && field !== 'sku') return null
  if (!text) return null
  return { field, text }
}

export function stripTextFromFieldValue(value: string, text: string): string {
  const needle = text.trim()
  if (!needle) return value
  const re = new RegExp(escapeRegex(needle), 'gi')
  return value.replace(re, '').replace(/\s{2,}/g, ' ').trim()
}

export function findCategoryForRule(
  categories: CategoryRow[],
  param: string | undefined
): CategoryRow | null {
  const q = (param ?? '').trim().toLowerCase()
  if (!q) return null
  const exact = categories.find(
    (c) => c.name.toLowerCase() === q || c.slug.toLowerCase() === q
  )
  if (exact) return exact
  const partial = categories.find(
    (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
  )
  return partial ?? null
}

export function applyRuleToRows(
  rows: PricelistWorkbenchRow[],
  rule: WorkbenchRule,
  targetIds?: Set<string>,
  categories?: CategoryRow[]
): { rows: PricelistWorkbenchRow[]; result: ApplyRuleResult } {
  const pool = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows
  const matched = filterRowsByRule(pool, rule)
  const matchedIds = new Set(matched.map((r) => r.id))
  let changed = 0

  if (rule.action === 'delete') {
    const next = rows.filter((r) => !matchedIds.has(r.id))
    return {
      rows: next,
      result: {
        matched: matched.length,
        changed: matched.length,
        message: `Removed ${matched.length} row(s) from the workbench draft.`,
      },
    }
  }

  if (rule.action === 'assign_category') {
    const cat = findCategoryForRule(categories ?? [], rule.actionParam)
    if (!cat) {
      return {
        rows,
        result: {
          matched: matched.length,
          changed: 0,
          message: matched.length
            ? `No category matched “${rule.actionParam ?? ''}”. Check the category name in Categories.`
            : 'No rows matched.',
        },
      }
    }
    const next = rows.map((row) => {
      if (!matchedIds.has(row.id)) return row
      if (row.category_id === cat.id) return row
      changed++
      return {
        ...row,
        category_id: cat.id,
        category_slug: cat.slug,
        category_name: cat.name,
      }
    })
    return {
      rows: next,
      result: {
        matched: matched.length,
        changed,
        message: `Assigned category “${cat.name}” to ${changed} of ${matched.length} matched row(s).`,
      },
    }
  }

  const stripParam = rule.action === 'strip_text_from_field' ? parseStripTextActionParam(rule.actionParam) : null

  const next = rows.map((row) => {
    if (!matchedIds.has(row.id)) return row
    changed++
    switch (rule.action) {
      case 'remove_sku_from_name': {
        const name = removeSkuFromName(row)
        if (name === row.name) {
          changed--
          return row
        }
        return { ...row, name }
      }
      case 'strip_text_from_field': {
        if (!stripParam) {
          changed--
          return row
        }
        const current = row[stripParam.field] as string
        const cleaned = stripTextFromFieldValue(current, stripParam.text)
        if (cleaned === current) {
          changed--
          return row
        }
        return { ...row, [stripParam.field]: cleaned }
      }
      case 'select':
        return { ...row, selected: true }
      case 'deselect':
        return { ...row, selected: false }
      case 'set_active':
        return { ...row, active: true }
      case 'set_inactive':
        return { ...row, active: false }
      default:
        return row
    }
  })

  const actionLabel: Record<WorkbenchActionType, string> = {
    delete: 'deleted',
    remove_sku_from_name: 'cleaned names on',
    strip_text_from_field: 'updated text on',
    select: 'selected',
    deselect: 'deselected',
    set_active: 'activated',
    set_inactive: 'deactivated',
    assign_category: 'assigned category on',
  }

  return {
    rows: next,
    result: {
      matched: matched.length,
      changed,
      message: `${actionLabel[rule.action] ?? 'Updated'} ${changed} of ${matched.length} matched row(s).`,
    },
  }
}

export function deleteRowsByIds(rows: PricelistWorkbenchRow[], ids: Set<string>): PricelistWorkbenchRow[] {
  if (!ids.size) return rows
  return rows.filter((r) => !ids.has(r.id))
}

export type RuleSimulationSample = {
  sku: string
  name: string
  detail: string
}

export type RuleSimulationResult = {
  rule: WorkbenchRule
  interpretedAs: string
  poolSize: number
  matched: number
  wouldChange: number
  message: string
  samples: RuleSimulationSample[]
  warnings: string[]
}

function simulationSampleDetail(
  before: PricelistWorkbenchRow,
  after: PricelistWorkbenchRow | undefined,
  rule: WorkbenchRule
): string | null {
  if (rule.action === 'delete') return 'Would remove from workbench draft'
  if (!after) return null

  switch (rule.action) {
    case 'assign_category': {
      if (before.category_id === after.category_id) return null
      const label = after.category_name || rule.actionParam || 'category'
      return `Category → ${label}`
    }
    case 'remove_sku_from_name': {
      if (before.name === after.name) return null
      return `Name: "${before.name}" → "${after.name}"`
    }
    case 'strip_text_from_field': {
      const strip = parseStripTextActionParam(rule.actionParam)
      if (!strip) return null
      const b = before[strip.field] as string
      const a = after[strip.field] as string
      if (b === a) return null
      return `${strip.field}: "${b}" → "${a}"`
    }
    case 'select':
      return before.selected === after.selected ? null : 'Would select row'
    case 'deselect':
      return before.selected === after.selected ? null : 'Would deselect row'
    case 'set_active':
      return before.active === after.active ? null : 'Would set active'
    case 'set_inactive':
      return before.active === after.active ? null : 'Would set inactive'
    default:
      return null
  }
}

/** Dry-run a rule on the current draft (no mutations). */
export function simulateRuleOnRows(
  rows: PricelistWorkbenchRow[],
  rule: WorkbenchRule,
  targetIds: Set<string> | undefined,
  categories: CategoryRow[],
  options?: { sampleLimit?: number }
): RuleSimulationResult {
  const sampleLimit = options?.sampleLimit ?? 12
  const pool = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows
  const matched = filterRowsByRule(pool, rule)
  const warnings: string[] = []

  if (!pool.length) {
    return {
      rule,
      interpretedAs: describeRule(rule),
      poolSize: 0,
      matched: 0,
      wouldChange: 0,
      message: 'No rows in the chosen scope.',
      samples: [],
      warnings,
    }
  }

  if (rule.action === 'assign_category' && matched.length) {
    const cat = findCategoryForRule(categories, rule.actionParam)
    if (!cat) {
      warnings.push(
        `No category matched “${rule.actionParam ?? ''}”. Create or rename the category before running.`
      )
    }
  }

  if (rule.action === 'delete' && matched.length === pool.length && pool.length > 20) {
    warnings.push('This would delete every row in scope — check filters carefully.')
  } else if (matched.length > 0 && matched.length >= pool.length * 0.85 && pool.length > 30) {
    warnings.push(`Matches ${matched.length} of ${pool.length} rows in scope (${Math.round((matched.length / pool.length) * 100)}%).`)
  }

  const draftCopy = rows.map((r) => ({ ...r }))
  const { rows: afterRows, result } = applyRuleToRows(draftCopy, rule, targetIds, categories)
  const afterById = new Map(afterRows.map((r) => [r.id, r]))
  const samples: RuleSimulationSample[] = []

  for (const row of matched) {
    if (samples.length >= sampleLimit) break
    const after = afterById.get(row.id)
    const detail = simulationSampleDetail(row, after, rule)
    if (!detail) continue
    samples.push({ sku: row.sku, name: row.name, detail })
  }

  if (matched.length > sampleLimit && samples.length < sampleLimit) {
    for (const row of matched) {
      if (samples.length >= sampleLimit) break
      if (samples.some((s) => s.sku === row.sku && s.name === row.name)) continue
      const detail = simulationSampleDetail(row, afterById.get(row.id), rule)
      samples.push({
        sku: row.sku,
        name: row.name,
        detail: detail ?? 'Matched (no field change)',
      })
    }
  }

  if (matched.length > 0 && result.changed === 0 && rule.action !== 'delete') {
    warnings.push('Rows match but nothing would change — check action parameters or field values.')
  }

  return {
    rule,
    interpretedAs: describeRule(rule),
    poolSize: pool.length,
    matched: matched.length,
    wouldChange: result.changed,
    message: result.message,
    samples,
    warnings,
  }
}

/** Built-in rules users can run or clone. */
export const WORKBENCH_RULE_PRESETS: WorkbenchRule[] = [
  {
    id: 'preset-tealbury-no-doors-delete',
    name: 'Delete Tealbury — No Doors range',
    matchMode: 'all',
    conditions: [
      { field: 'source', op: 'equals', value: 'tealbury' },
      { field: 'door_range', op: 'contains', value: 'No Doors' },
    ],
    action: 'delete',
  },
  {
    id: 'preset-tealbury-sku-in-name-clean',
    name: 'Tealbury — remove SKU from name',
    matchMode: 'all',
    conditions: [
      { field: 'source', op: 'equals', value: 'tealbury' },
      { field: 'name', op: 'sku_appears_in_name', value: '' },
    ],
    action: 'remove_sku_from_name',
  },
]

function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractQuotedPhrases(text: string): string[] {
  const out: string[] = []
  const re = /"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push(m[1].trim())
  return out
}

function parseMatchMode(lower: string): 'all' | 'any' {
  if (/\b(any|either)\b/.test(lower) && /\bcondition/.test(lower)) return 'any'
  if (/\bmatch\s+any\b/.test(lower)) return 'any'
  if (/\bor\b/.test(lower) && !/\band\b/.test(lower)) return 'any'
  return 'all'
}

type ParsedAction =
  | { action: WorkbenchActionType; actionParam?: string }
  | { error: string }
  | null

function parseStripFieldFromPrompt(lower: string, raw: string): StripTextField {
  if (/\bdescription\b/.test(lower)) return 'description'
  if (/\bname\b/.test(lower) && !/\bdescription\b/.test(lower)) return 'name'
  if (/\bsku\b/.test(lower)) return 'sku'
  const m = raw.match(/\bfrom\s+(?:the\s+)?(description|name|sku)\b/i)
  if (m) return m[1].toLowerCase() as StripTextField
  return 'description'
}

/** User wants to remove literal text from description/name/sku — not delete rows. */
function looksLikeStripFromFieldPrompt(lower: string, raw: string): boolean {
  if (!/\b(remove|strip|delete)\b/.test(lower)) return false
  if (!/\bfrom\b/.test(lower)) return false
  if (!/\b(descriptions?|names?|skus?)\b/.test(lower)) return false
  if (/\bfrom\s+(?:the\s+)?(?:workbench|list|draft)\b/.test(lower)) return false
  return (
    /\b(phrase|word|text)\b/.test(lower) ||
    /"[^"]+"/.test(raw) ||
    /\bfrom\s+(?:all\s+)?(?:product\s+)?descriptions?\b/i.test(raw)
  )
}

function parseAction(lower: string, raw: string, quoted: string[]): ParsedAction {
  if (looksLikeStripFromFieldPrompt(lower, raw)) {
    const field = parseStripFieldFromPrompt(lower, raw)
    const fromAllDescriptions = /\bfrom\s+(?:all\s+)?(?:product\s+)?descriptions?\b/i.test(raw)
    const removePhraseFromDescriptions = raw.match(
      /\b(?:remove|strip|delete)\s+(?:the\s+)?(?:word|text|phrase)\s+"([^"]+)"\s+from\s+(?:all\s+)?(?:product\s+)?descriptions?\b/i
    )
    const removePhraseFromField = raw.match(
      /\b(?:remove|strip|delete)\s+(?:the\s+)?(?:word|text|phrase)\s+"([^"]+)"\s+from\s+(?:all\s+)?(?:product\s+)?(description|name|sku)s?\b/i
    )
    const text =
      removePhraseFromDescriptions?.[1] ??
      removePhraseFromField?.[1] ??
      quoted[0] ??
      raw.match(/\b(?:word|text|phrase)\s+"([^"]+)"/i)?.[1]
    if (text) {
      const resolvedField =
        removePhraseFromField?.[2]?.toLowerCase() as StripTextField | undefined
      return {
        action: 'strip_text_from_field',
        actionParam: `${resolvedField ?? (fromAllDescriptions ? 'description' : field)}:${text}`,
      }
    }
  }

  const assignMatch =
    lower.match(
      /\b(?:assign(?:\s+category)?|categor(?:y|ise|ize)(?:\s+as)?|put\s+in(?:to)?)\s+(?:to\s+)?(?:"([^"]+)"|([a-z][\w\s&/-]{2,40}))/
    ) ?? lower.match(/\bcategory\s+(?:is|=)\s+"([^"]+)"/)
  if (assignMatch) {
    const param = (assignMatch[1] ?? assignMatch[2] ?? quoted.find((q) => !/no doors/i.test(q)))?.trim()
    if (!param) {
      return { error: 'Name the category to assign (e.g. assign category "Base units").' }
    }
    return { action: 'assign_category', actionParam: param }
  }

  if (/\b(remove|strip|clean)\b/.test(lower) && /\bsku\b/.test(lower) && /\bname\b/.test(lower)) {
    return { action: 'remove_sku_from_name' }
  }

  const removeFromFieldQuoted = raw.match(
    /\b(?:remove|strip|delete)\s+(?:the\s+)?(?:word|text|phrase)?\s*"([^"]+)"\s+from\s+(?:the\s+)?(description|name|sku)\b/i
  )
  if (removeFromFieldQuoted) {
    const field = removeFromFieldQuoted[2].toLowerCase() as StripTextField
    return {
      action: 'strip_text_from_field',
      actionParam: `${field}:${removeFromFieldQuoted[1]}`,
    }
  }

  if (isStripTextCommand(lower, raw) && !looksLikeStripFromFieldPrompt(lower, raw)) {
    const field = parseStripFieldFromPrompt(lower, raw)
    const text =
      quoted[0] ??
      raw.match(/\b(?:word|text|phrase)\s+"([^"]+)"/i)?.[1] ??
      raw.match(/\b(?:remove|strip|delete)\s+(?:the\s+)?(?:word|text|phrase)?\s+([A-Za-z][\w\s:.-]{0,40}?)\s+from\b/i)?.[1]?.trim()
    if (text) {
      return { action: 'strip_text_from_field', actionParam: `${field}:${text}` }
    }
  }

  if (/\b(deactivate|mark\s+inactive|set\s+inactive)\b/.test(lower)) {
    return { action: 'set_inactive' }
  }
  if (/\b(activate|mark\s+active|set\s+active)\b/.test(lower) && !/\binactiv/.test(lower)) {
    return { action: 'set_active' }
  }
  if (/\b(select|tick|check)\b/.test(lower) && !/\b(de)?select/.test(lower)) {
    return { action: 'select' }
  }
  if (/\b(deselect|untick|uncheck|clear\s+selection)\b/.test(lower)) {
    return { action: 'deselect' }
  }
  if (/\b(delete|drop|remove\s+from\s+(?:the\s+)?(?:workbench|list|draft))\b/.test(lower)) {
    return { action: 'delete' }
  }
  if (/\b(remove|drop)\b/.test(lower) && /\b(row|product|item|line)s?\b/.test(lower)) {
    return { action: 'delete' }
  }

  return null
}

function pushUniqueCondition(conditions: WorkbenchCondition[], cond: WorkbenchCondition) {
  const key = `${cond.field}:${cond.op}:${cond.value}`
  if (conditions.some((c) => `${c.field}:${c.op}:${c.value}` === key)) return
  conditions.push(cond)
}

function isStripTextCommand(lower: string, raw = ''): boolean {
  if (looksLikeStripFromFieldPrompt(lower, raw)) return true
  const scrubbed = lower
    .replace(/\beach\s+product\b/g, ' ')
    .replace(/\bevery\s+product\b/g, ' ')
    .replace(/\ball\s+products?\b/g, ' ')
    .replace(/\bproduct\s+descriptions?\b/g, ' field-descriptions ')
    .replace(/\bproduct\s+names?\b/g, ' field-names ')
  return (
    /\b(remove|strip|delete)\b/.test(lower) &&
    /\b(description|name|sku|field-descriptions|field-names)\b/.test(lower) &&
    !/\bfrom\s+(?:the\s+)?(?:workbench|list|draft)\b/.test(lower) &&
    !/\b(remove|delete)\s+(?:all\s+)?(?:row|product|item|line)s?\b/.test(scrubbed)
  )
}

function parseFieldConditions(
  lower: string,
  raw: string,
  quoted: string[],
  action: WorkbenchActionType,
  actionParam?: string
): WorkbenchCondition[] {
  const conditions: WorkbenchCondition[] = []
  const stripCommand = action === 'strip_text_from_field' || isStripTextCommand(lower, raw)
  const stripPhrase = parseStripTextActionParam(actionParam)?.text?.toLowerCase()

  if (/\btealbury\b/.test(lower)) {
    pushUniqueCondition(conditions, { field: 'source', op: 'equals', value: 'tealbury' })
  } else if (/\blamtek\b/.test(lower)) {
    pushUniqueCondition(conditions, { field: 'source', op: 'equals', value: 'lamtek' })
  }

  if (/\b(unassigned|no\s+category|without\s+category|missing\s+category)\b/.test(lower)) {
    pushUniqueCondition(conditions, { field: 'category', op: 'unassigned', value: '' })
  }

  const sectionMatch =
    raw.match(/\bsection\s+(?:contains|with|is|equals?|=)\s+"([^"]+)"/i) ??
    raw.match(/\bsection\s+(?:contains|with|is|equals?|=)\s+([A-Za-z0-9][\w\s/-]{2,60})/i)
  if (sectionMatch) {
    pushUniqueCondition(conditions, { field: 'section', op: 'contains', value: sectionMatch[1].trim() })
  }

  const rangeMatch =
    raw.match(/\b(?:door|range)\s+(?:contains|with|is|equals?|=)\s+"([^"]+)"/i) ??
    raw.match(/\b(?:door|range)\s+(?:contains|with|is|equals?|=)\s+([A-Za-z0-9][\w\s/-]{2,40})/i)
  if (rangeMatch) {
    pushUniqueCondition(conditions, { field: 'door_range', op: 'contains', value: rangeMatch[1].trim() })
  }

  const skuMatch = raw.match(/\bsku\s+(?:contains|with|is|equals?|=)\s+"([^"]+)"/i)
  if (skuMatch) {
    pushUniqueCondition(conditions, { field: 'sku', op: 'contains', value: skuMatch[1].trim() })
  }

  const nameMatch = raw.match(/\bname\s+(?:contains|with|is|equals?|=)\s+"([^"]+)"/i)
  if (nameMatch) {
    pushUniqueCondition(conditions, { field: 'name', op: 'contains', value: nameMatch[1].trim() })
  }

  const costGt = lower.match(/\b(?:cost|lamtek\s+cost)\s+(?:price\s+)?(?:over|above|greater\s+than|>)\s*£?\s*([\d.]+)/)
  if (costGt) {
    pushUniqueCondition(conditions, { field: 'cost_price', op: 'greater_than', value: costGt[1] })
  }
  const listGt = lower.match(/\b(?:list|sell|unit)\s+price\s+(?:over|above|greater\s+than|>)\s*£?\s*([\d.]+)/)
  if (listGt) {
    pushUniqueCondition(conditions, { field: 'unit_price', op: 'greater_than', value: listGt[1] })
  }

  const noDoors = quoted.find((q) => /no doors/i.test(q)) ?? (/\bno doors\b/.test(lower) ? 'No Doors' : '')
  if (noDoors) {
    pushUniqueCondition(conditions, { field: 'door_range', op: 'contains', value: noDoors })
  }

  if (!stripCommand) {
    for (const q of quoted) {
      if (/no doors/i.test(q)) continue
      if (stripPhrase && q.toLowerCase() === stripPhrase) continue
      if (/\bsection\b/.test(lower) && !conditions.some((c) => c.field === 'section' && c.value === q)) {
        pushUniqueCondition(conditions, { field: 'section', op: 'contains', value: q })
      } else if (!conditions.some((c) => c.field === 'door_range' && c.value === q)) {
        pushUniqueCondition(conditions, { field: 'door_range', op: 'contains', value: q })
      }
    }
  }

  if (/\bsku\b.*\bname\b/.test(lower) || /\bname\b.*\bsku\b/.test(lower)) {
    if (!conditions.some((c) => c.op === 'sku_appears_in_name')) {
      pushUniqueCondition(conditions, { field: 'name', op: 'sku_appears_in_name', value: '' })
    }
  }

  return conditions
}

/**
 * Parse a plain-English command into a workbench rule (best-effort).
 */
export function parseSmartCommandPrompt(prompt: string): { rule: WorkbenchRule | null; error?: string } {
  const raw = prompt.trim()
  if (!raw) return { rule: null, error: 'Enter a command first.' }

  const lower = normalizePrompt(raw)
  const quoted = extractQuotedPhrases(raw)
  const matchMode = parseMatchMode(lower)

  const actionParsed = parseAction(lower, raw, quoted)
  if (!actionParsed) {
    return {
      rule: null,
      error:
        'Could not detect an action. Try: delete, assign category "Base units", remove "Section:" from description, remove SKU from name, select, activate, or deactivate.',
    }
  }
  if ('error' in actionParsed) {
    return { rule: null, error: actionParsed.error }
  }

  const { action, actionParam } = actionParsed
  const conditions = parseFieldConditions(lower, raw, quoted, action, actionParam)

  if (action === 'remove_sku_from_name' && !conditions.some((c) => c.op === 'sku_appears_in_name')) {
    pushUniqueCondition(conditions, { field: 'name', op: 'sku_appears_in_name', value: '' })
  }

  const matchAll =
    !conditions.length &&
    (action === 'strip_text_from_field' ||
      /\b(each|every|all)\s+(product|row|item|line)s?\b/.test(lower) ||
      /\ball\s+rows\b/.test(lower))

  if (!conditions.length && !matchAll) {
    return {
      rule: null,
      error:
        'Could not detect filters. Mention Tealbury/Lamtek, a range like "No Doors", section contains "…", unassigned, SKU-in-name, or say "each product" / "all rows".',
    }
  }

  const name = raw.length > 72 ? `${raw.slice(0, 69)}…` : raw

  return {
    rule: {
      id: `cmd-${Date.now()}`,
      name,
      conditions,
      matchMode,
      action,
      actionParam,
    },
  }
}

export function sourceLabel(source: PricelistSource): string {
  return source === 'tealbury' ? 'Tealbury' : 'Lamtek trade'
}

export function describeRule(rule: WorkbenchRule): string {
  const condText = rule.conditions.length
    ? rule.conditions
        .map((c) => {
          if (c.op === 'sku_appears_in_name') return 'SKU appears in name'
          if (c.op === 'unassigned') return 'category is unassigned'
          if (c.op === 'empty') return `${c.field} is empty`
          if (c.op === 'not_empty') return `${c.field} has value`
          if (c.op === 'greater_than') return `${c.field} > ${c.value}`
          if (c.op === 'less_than') return `${c.field} < ${c.value}`
          return `${c.field} ${c.op} "${c.value}"`
        })
        .join(rule.matchMode === 'any' ? ' OR ' : ' AND ')
    : 'all rows in scope'
  const param = rule.actionParam ? ` → ${rule.actionParam}` : ''
  return `${rule.action}${param}: ${condText}`
}
