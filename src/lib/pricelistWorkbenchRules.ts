/**
 * Smart rules & natural-language commands for the pricelist workbench draft list.
 */
import { hasWorkbenchBom } from '@/lib/workbenchBom'
import type { PricelistWorkbenchRow, PricelistSource, WorkbenchItemKindValue } from '@/lib/pricelistWorkbench'
import {
  parseItemKindValue,
  rowCategoryIds,
  rowItemKinds,
  rowPartTypes,
  rowSections,
  setRowCategoriesPatch,
  setRowItemKindsPatch,
  setRowPartTypesPatch,
  setRowSectionsPatch,
} from '@/lib/pricelistWorkbench'
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
  | 'item_kind'
  | 'kit'

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
  | 'change_text_case'
  | 'select'
  | 'deselect'
  | 'set_active'
  | 'set_inactive'
  | 'assign_category'
  | 'assign_taxonomy'

export type StripTextField = 'description' | 'name' | 'sku'

/** Parsed `field=value;field=value` taxonomy assignment (category/section/kind/part_type). */
export interface TaxonomyAssignment {
  categories: string[]
  sections: string[]
  kinds: WorkbenchItemKindValue[]
  partTypes: string[]
  /** Kind words that aren't valid item_kind values (e.g. "panels"). */
  invalidKinds: string[]
}

/**
 * Parse the assign_taxonomy actionParam, e.g. "category=Panels;section=Panels;kind=component".
 * Multiple values for the same field can be separated with "|".
 */
export function parseTaxonomyActionParam(param: string | undefined): TaxonomyAssignment | null {
  if (!param || !param.trim()) return null
  const out: TaxonomyAssignment = { categories: [], sections: [], kinds: [], partTypes: [], invalidKinds: [] }
  for (const part of param.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const field = part.slice(0, eq).trim().toLowerCase()
    const values = part
      .slice(eq + 1)
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean)
    if (!values.length) continue
    if (field === 'category' || field === 'categories') out.categories.push(...values)
    else if (field === 'section' || field === 'sections') out.sections.push(...values)
    else if (field === 'part_type' || field === 'parttype' || field === 'part type' || field === 'part_types') {
      out.partTypes.push(...values)
    } else if (field === 'kind' || field === 'kinds' || field === 'item_kind') {
      for (const v of values) {
        const k = parseItemKindValue(v)
        if (k) out.kinds.push(k)
        else out.invalidKinds.push(v)
      }
    }
  }
  const hasAny =
    out.categories.length || out.sections.length || out.kinds.length || out.partTypes.length || out.invalidKinds.length
  return hasAny ? out : null
}

export type TextCaseField = 'name' | 'description' | 'section' | 'door_range' | 'trade_code' | 'sku'
export type TextCaseMode = 'sentence' | 'title' | 'upper' | 'lower'

export const TEXT_CASE_FIELDS: TextCaseField[] = [
  'name',
  'description',
  'section',
  'door_range',
  'trade_code',
  'sku',
]
export const TEXT_CASE_MODES: TextCaseMode[] = ['sentence', 'title', 'upper', 'lower']

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
    case 'item_kind':
      return row.item_kind
    case 'kit':
      return hasWorkbenchBom(row) ? 'present' : 'missing'
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

/**
 * Action param format for change_text_case:
 *   `field[+field…]:mode[:onlycaps]`
 * e.g. `name:sentence`, `name+description:sentence:onlycaps`.
 * The optional `onlycaps` flag means: only convert values that are currently
 * SHOUTING (all upper-case), leaving correctly-cased text untouched.
 */
export function parseTextCaseActionParam(
  param: string | undefined
): { fields: TextCaseField[]; mode: TextCaseMode; onlyUpper: boolean } | null {
  if (!param?.trim()) return null
  const idx = param.indexOf(':')
  if (idx < 1) return null
  const fieldsPart = param.slice(0, idx).trim()
  const rest = param.slice(idx + 1).trim()
  const [modeRaw, flag] = rest.split(':').map((s) => s.trim())
  const fields = fieldsPart
    .split('+')
    .map((f) => f.trim())
    .filter(Boolean) as TextCaseField[]
  const mode = modeRaw as TextCaseMode
  if (!fields.length || !fields.every((f) => TEXT_CASE_FIELDS.includes(f))) return null
  if (!TEXT_CASE_MODES.includes(mode)) return null
  return { fields: [...new Set(fields)], mode, onlyUpper: flag === 'onlycaps' }
}

/** True when text is "shouting" — has letters and is entirely upper-case. */
export function isShoutyText(value: string): boolean {
  if (!/\p{Lu}/u.test(value)) return false
  return value === value.toUpperCase() && value !== value.toLowerCase()
}

/** Title Case: capitalise the first letter of each word. */
function toTitleCase(value: string): string {
  return value.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase())
}

/** Sentence case: lower-case, then capitalise the first letter of each sentence/line. */
function toSentenceCase(value: string): string {
  const lower = value.toLowerCase()
  return lower.replace(/(^\s*\p{L})|([.!?]\s+\p{L})|(\n\s*\p{L})/gu, (m) => m.toUpperCase())
}

export function applyTextCase(value: string, mode: TextCaseMode): string {
  switch (mode) {
    case 'upper':
      return value.toUpperCase()
    case 'lower':
      return value.toLowerCase()
    case 'title':
      return toTitleCase(value)
    case 'sentence':
      return toSentenceCase(value)
    default:
      return value
  }
}

export function textCaseFieldLabel(field: TextCaseField): string {
  switch (field) {
    case 'name':
      return 'Name'
    case 'description':
      return 'Description'
    case 'section':
      return 'Section'
    case 'door_range':
      return 'Door / range'
    case 'trade_code':
      return 'Trade code'
    case 'sku':
      return 'SKU'
    default:
      return field
  }
}

export function textCaseModeLabel(mode: TextCaseMode): string {
  switch (mode) {
    case 'sentence':
      return 'Sentence case'
    case 'title':
      return 'Title Case'
    case 'upper':
      return 'UPPER CASE'
    case 'lower':
      return 'lower case'
    default:
      return mode
  }
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

  if (rule.action === 'assign_taxonomy') {
    const tax = parseTaxonomyActionParam(rule.actionParam)
    if (!tax) {
      return { rows, result: { matched: matched.length, changed: 0, message: 'No taxonomy values to assign.' } }
    }
    const cats = categories ?? []
    const resolvedCatIds: string[] = []
    const missingCats: string[] = []
    for (const name of tax.categories) {
      const cat = findCategoryForRule(cats, name)
      if (cat) resolvedCatIds.push(cat.id)
      else missingCats.push(name)
    }
    const next = rows.map((row) => {
      if (!matchedIds.has(row.id)) return row
      let mutated = row
      let rowChanged = false

      if (resolvedCatIds.length) {
        const current = rowCategoryIds(mutated)
        const merged = [...current]
        for (const id of resolvedCatIds) if (!merged.includes(id)) merged.push(id)
        if (merged.length !== current.length || !Array.isArray(mutated.category_ids)) {
          mutated = { ...mutated, ...setRowCategoriesPatch(merged, cats) }
          if (merged.length !== current.length) rowChanged = true
        }
      }
      if (tax.sections.length) {
        const current = rowSections(mutated)
        const merged = [...current]
        for (const s of tax.sections) if (!merged.some((c) => c.toLowerCase() === s.toLowerCase())) merged.push(s)
        if (merged.length !== current.length) {
          mutated = { ...mutated, ...setRowSectionsPatch(merged) }
          rowChanged = true
        }
      }
      if (tax.kinds.length) {
        const current = rowItemKinds(mutated)
        const merged = [...current]
        for (const k of tax.kinds) if (!merged.includes(k)) merged.push(k)
        if (merged.length !== current.length) {
          mutated = { ...mutated, ...setRowItemKindsPatch(merged) }
          rowChanged = true
        }
      }
      if (tax.partTypes.length) {
        const current = rowPartTypes(mutated)
        const merged = [...current]
        for (const p of tax.partTypes) if (!merged.some((c) => c.toLowerCase() === p.toLowerCase())) merged.push(p)
        if (merged.length !== current.length) {
          mutated = { ...mutated, ...setRowPartTypesPatch(merged) }
          rowChanged = true
        }
      }
      if (rowChanged) changed++
      return mutated
    })
    const parts: string[] = []
    if (tax.categories.length) parts.push(`category ${tax.categories.join(', ')}`)
    if (tax.sections.length) parts.push(`section ${tax.sections.join(', ')}`)
    if (tax.kinds.length) parts.push(`kind ${tax.kinds.join(', ')}`)
    if (tax.partTypes.length) parts.push(`part type ${tax.partTypes.join(', ')}`)
    let message = `Assigned ${parts.join(' + ') || 'taxonomy'} to ${changed} of ${matched.length} matched row(s).`
    if (missingCats.length) message += ` Category not found: ${missingCats.join(', ')}.`
    if (tax.invalidKinds.length) message += ` Not a valid Kind: ${tax.invalidKinds.join(', ')} (Kind is a fixed type).`
    return { rows: next, result: { matched: matched.length, changed, message } }
  }

  const stripParam = rule.action === 'strip_text_from_field' ? parseStripTextActionParam(rule.actionParam) : null
  const caseParam = rule.action === 'change_text_case' ? parseTextCaseActionParam(rule.actionParam) : null

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
      case 'change_text_case': {
        if (!caseParam) {
          changed--
          return row
        }
        let mutated = row
        let anyChange = false
        for (const field of caseParam.fields) {
          const current = mutated[field] as string
          if (caseParam.onlyUpper && !isShoutyText(current)) continue
          const updated = applyTextCase(current, caseParam.mode)
          if (updated !== current) {
            mutated = { ...mutated, [field]: updated }
            anyChange = true
          }
        }
        if (!anyChange) {
          changed--
          return row
        }
        return mutated
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
    change_text_case: 'changed text case on',
    select: 'selected',
    deselect: 'deselected',
    set_active: 'activated',
    set_inactive: 'deactivated',
    assign_category: 'assigned category on',
    assign_taxonomy: 'assigned taxonomy on',
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
  /** Field or aspect being changed (e.g. Description, Name, Row). */
  fieldLabel: string
  before: string
  after: string
}

const SAMPLE_TEXT_MAX = 160

function truncateSampleText(value: string, max = SAMPLE_TEXT_MAX): string {
  const t = value.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fieldLabelForStrip(field: StripTextField): string {
  if (field === 'description') return 'Description'
  if (field === 'name') return 'Name'
  return 'SKU'
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

function buildSimulationSample(
  before: PricelistWorkbenchRow,
  after: PricelistWorkbenchRow | undefined,
  rule: WorkbenchRule
): RuleSimulationSample | null {
  if (rule.action === 'delete') {
    return {
      sku: before.sku,
      name: before.name,
      fieldLabel: 'Row',
      before: truncateSampleText(`${before.sku} — ${before.name}`),
      after: '(removed from workbench draft)',
    }
  }
  if (!after) return null

  switch (rule.action) {
    case 'assign_category': {
      if (before.category_id === after.category_id) return null
      const beforeCat = before.category_name || '(unassigned)'
      const afterCat = after.category_name || rule.actionParam || '(assigned)'
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Category',
        before: truncateSampleText(beforeCat),
        after: truncateSampleText(afterCat),
      }
    }
    case 'assign_taxonomy': {
      const beforeCats = rowCategoryIds(before).length
      const afterCats = rowCategoryIds(after).length
      if (afterCats !== beforeCats) {
        return {
          sku: before.sku,
          name: before.name,
          fieldLabel: 'Categories',
          before: truncateSampleText(before.category_name || `${beforeCats} assigned`),
          after: truncateSampleText(`${afterCats} assigned`),
        }
      }
      const beforeSec = rowSections(before).join(', ')
      const afterSec = rowSections(after).join(', ')
      if (afterSec !== beforeSec) {
        return {
          sku: before.sku,
          name: before.name,
          fieldLabel: 'Section',
          before: truncateSampleText(beforeSec || '(none)'),
          after: truncateSampleText(afterSec || '(none)'),
        }
      }
      const beforeKind = rowItemKinds(before).join(', ')
      const afterKind = rowItemKinds(after).join(', ')
      if (afterKind !== beforeKind) {
        return {
          sku: before.sku,
          name: before.name,
          fieldLabel: 'Kind',
          before: truncateSampleText(beforeKind || '(none)'),
          after: truncateSampleText(afterKind || '(none)'),
        }
      }
      const beforePt = rowPartTypes(before).join(', ')
      const afterPt = rowPartTypes(after).join(', ')
      if (afterPt !== beforePt) {
        return {
          sku: before.sku,
          name: before.name,
          fieldLabel: 'Part type',
          before: truncateSampleText(beforePt || '(none)'),
          after: truncateSampleText(afterPt || '(none)'),
        }
      }
      return null
    }
    case 'remove_sku_from_name': {
      if (before.name === after.name) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Name',
        before: truncateSampleText(before.name),
        after: truncateSampleText(after.name),
      }
    }
    case 'strip_text_from_field': {
      const strip = parseStripTextActionParam(rule.actionParam)
      if (!strip) return null
      const b = before[strip.field] as string
      const a = after[strip.field] as string
      if (b === a) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: fieldLabelForStrip(strip.field),
        before: truncateSampleText(b || '(empty)'),
        after: truncateSampleText(a || '(empty)'),
      }
    }
    case 'change_text_case': {
      const cs = parseTextCaseActionParam(rule.actionParam)
      if (!cs) return null
      for (const field of cs.fields) {
        const b = before[field] as string
        const a = after[field] as string
        if (b === a) continue
        return {
          sku: before.sku,
          name: before.name,
          fieldLabel: textCaseFieldLabel(field),
          before: truncateSampleText(b || '(empty)'),
          after: truncateSampleText(a || '(empty)'),
        }
      }
      return null
    }
    case 'select':
      if (before.selected === after.selected) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Selected',
        before: before.selected ? 'Yes' : 'No',
        after: after.selected ? 'Yes' : 'No',
      }
    case 'deselect':
      if (before.selected === after.selected) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Selected',
        before: before.selected ? 'Yes' : 'No',
        after: after.selected ? 'Yes' : 'No',
      }
    case 'set_active':
      if (before.active === after.active) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Active',
        before: before.active ? 'Yes' : 'No',
        after: after.active ? 'Yes' : 'No',
      }
    case 'set_inactive':
      if (before.active === after.active) return null
      return {
        sku: before.sku,
        name: before.name,
        fieldLabel: 'Active',
        before: before.active ? 'Yes' : 'No',
        after: after.active ? 'Yes' : 'No',
      }
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

  if (rule.action === 'assign_taxonomy' && matched.length) {
    const tax = parseTaxonomyActionParam(rule.actionParam)
    if (tax) {
      for (const name of tax.categories) {
        if (!findCategoryForRule(categories, name)) {
          warnings.push(`No category matched “${name}”. Create it in Categories first, or it will be skipped.`)
        }
      }
      if (tax.invalidKinds.length) {
        warnings.push(
          `“${tax.invalidKinds.join(', ')}” isn’t a valid Kind. Kind is a fixed type (complete, component, door, drawer_front, accessory, other) — use Section/Category for groupings like “Panels”.`
        )
      }
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
    const sample = buildSimulationSample(row, after, rule)
    if (!sample) continue
    samples.push(sample)
  }

  if (matched.length > sampleLimit && samples.length < sampleLimit) {
    for (const row of matched) {
      if (samples.length >= sampleLimit) break
      if (samples.some((s) => s.sku === row.sku)) continue
      const sample = buildSimulationSample(row, afterById.get(row.id), rule)
      if (sample) samples.push(sample)
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
    id: 'preset-completes-no-kit-select',
    name: 'Select completes — kit missing',
    matchMode: 'all',
    conditions: [
      { field: 'source', op: 'equals', value: 'tealbury' },
      { field: 'item_kind', op: 'equals', value: 'complete' },
      { field: 'kit', op: 'equals', value: 'missing' },
    ],
    action: 'select',
  },
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

function looksLikeCaseCommand(lower: string): boolean {
  const caseWord =
    /\bcase\b/.test(lower) ||
    /\b(uppercase|lowercase)\b/.test(lower) ||
    /\bcapitali[sz]e/.test(lower) ||
    /\ball\s*caps\b/.test(lower)
  if (!caseWord) return false
  return /\b(sentence|title|upper|lower|caps|capital)/.test(lower)
}

/** Every field the user mentions (so "name and description" updates both). */
function parseCaseFields(lower: string): TextCaseField[] {
  const fields: TextCaseField[] = []
  if (/\bname/.test(lower)) fields.push('name')
  if (/\bdescription/.test(lower)) fields.push('description')
  if (/\bsection/.test(lower)) fields.push('section')
  if (/\b(door|range)\b/.test(lower)) fields.push('door_range')
  if (/\btrade\s*code/.test(lower)) fields.push('trade_code')
  if (/\bsku/.test(lower)) fields.push('sku')
  return fields.length ? [...new Set(fields)] : ['name']
}

function parseCaseMode(lower: string): TextCaseMode {
  if (/\bsentence/.test(lower)) return 'sentence'
  if (/\btitle/.test(lower)) return 'title'
  if (/\b(upper|all\s*caps|capitali[sz]e)/.test(lower)) return 'upper'
  if (/\blower/.test(lower)) return 'lower'
  return 'sentence'
}

/**
 * True when the user is targeting only the SHOUTING (all-caps) values — e.g.
 * "the text that is in capitals" / "fix the all-caps names". When converting
 * to sentence/title/lower we then leave already-tidy text untouched.
 */
function caseOnlyUpperSource(lower: string, mode: TextCaseMode): boolean {
  if (mode === 'upper') return false
  return /\b(all\s*caps|caps\s*lock|in\s*caps|capitals?|capitali[sz]ed|uppercase|shouting)\b/.test(lower)
}

function parseAction(lower: string, raw: string, quoted: string[]): ParsedAction {
  if (looksLikeCaseCommand(lower)) {
    const mode = parseCaseMode(lower)
    const fields = parseCaseFields(lower)
    const onlyUpper = caseOnlyUpperSource(lower, mode)
    return {
      action: 'change_text_case',
      actionParam: `${fields.join('+')}:${mode}${onlyUpper ? ':onlycaps' : ''}`,
    }
  }

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

  // Combined taxonomy assignment, e.g. "Section: Panels / Categories: Panels / Kind: component".
  const taxParts: string[] = []
  const secLabel = raw.match(/\bsections?\s*[:=]\s*([^\r\n;]+)/i)
  const catLabel = raw.match(/\bcategor(?:y|ies)\s*[:=]\s*([^\r\n;]+)/i)
  const kindLabel = raw.match(/\bkinds?\s*[:=]\s*([^\r\n;]+)/i)
  const ptLabel = raw.match(/\bpart\s*types?\s*[:=]\s*([^\r\n;]+)/i)
  if (secLabel) taxParts.push(`section=${secLabel[1].trim()}`)
  if (catLabel) taxParts.push(`category=${catLabel[1].trim()}`)
  if (kindLabel) taxParts.push(`kind=${kindLabel[1].trim()}`)
  if (ptLabel) taxParts.push(`part_type=${ptLabel[1].trim()}`)
  if (taxParts.length >= 2) {
    return { action: 'assign_taxonomy', actionParam: taxParts.join(';') }
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

  if (/\b(deactivate|disable|mark\s+inactive|set\s+inactive|turn\s+off|switch\s+off)\b/.test(lower)) {
    return { action: 'set_inactive' }
  }
  if (
    /\b(activate|enable|mark\s+active|set\s+active|turn\s+on|switch\s+on)\b/.test(lower) &&
    !/\binactiv/.test(lower) &&
    !/\bdisable/.test(lower)
  ) {
    return { action: 'set_active' }
  }
  if (/\b(select|tick|check)\b/.test(lower) && !/\b(de)?select/.test(lower)) {
    return { action: 'select' }
  }
  if (/\b(deselect|untick|uncheck|clear\s+selection)\b/.test(lower)) {
    return { action: 'deselect' }
  }
  if (/\b(delete|drop|get\s+rid\s+of|purge|remove\s+from\s+(?:the\s+)?(?:workbench|list|draft))\b/.test(lower)) {
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
  // For these actions a quoted word usually names the *field* to edit (e.g. the "Name"
  // field), not a filter value — so don't turn stray quotes into conditions.
  const fieldNamedByQuote = stripCommand || action === 'change_text_case'

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

  if (!fieldNamedByQuote) {
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
      action === 'change_text_case' ||
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

/**
 * Best-effort parse that NEVER fails: if the strict parser can't fully understand
 * the prompt, we still detect whatever action/filters we can and fall back to a
 * "select" action so the command can be loaded into the dropdown builder and
 * fixed in place — instead of dead-ending the user. `confident` is true only when
 * the strict parser succeeded.
 */
export function parseSmartCommandLoose(prompt: string): {
  rule: WorkbenchRule
  confident: boolean
  note?: string
} {
  const strict = parseSmartCommandPrompt(prompt)
  if (strict.rule) return { rule: strict.rule, confident: true }

  const raw = prompt.trim()
  const lower = normalizePrompt(raw)
  const quoted = extractQuotedPhrases(raw)
  const matchMode = parseMatchMode(lower)

  const actionParsed = parseAction(lower, raw, quoted)
  let action: WorkbenchActionType = 'select'
  let actionParam: string | undefined
  if (actionParsed && !('error' in actionParsed)) {
    action = actionParsed.action
    actionParam = actionParsed.actionParam
  }

  let conditions = parseFieldConditions(lower, raw, quoted, action, actionParam)
  if (!conditions.length) {
    const sel = parseSmartSelectionPrompt(raw)
    if (!sel.error) conditions = sel.conditions
  }

  return {
    rule: {
      id: `cmd-${Date.now()}`,
      name: raw.length > 72 ? `${raw.slice(0, 69)}…` : raw,
      conditions,
      matchMode,
      action,
      actionParam,
    },
    confident: false,
    note: strict.error,
  }
}

/**
 * Parse a plain-English *selection* (criteria only — no action). Used by the bulk
 * editor to gather the products to open. Falls back to keyword heuristics like
 * "products with the word panel in the name".
 */
export function parseSmartSelectionPrompt(prompt: string): {
  conditions: WorkbenchCondition[]
  matchMode: 'all' | 'any'
  error?: string
} {
  const raw = prompt.trim()
  if (!raw) return { conditions: [], matchMode: 'all', error: 'Enter what to select first.' }

  const lower = normalizePrompt(raw)
  const quoted = extractQuotedPhrases(raw)
  const matchMode = parseMatchMode(lower)
  const conditions = parseFieldConditions(lower, raw, quoted, 'select')

  const fieldWord = '(name|description|sku|section|door|range|category)'
  const toField = (w: string): WorkbenchMatchField => {
    const x = w.toLowerCase()
    if (x === 'door' || x === 'range') return 'door_range'
    if (x === 'category') return 'category_name'
    return x as WorkbenchMatchField
  }

  if (!conditions.length) {
    // "with the word panel in the name", "the words 'x y' in description"
    const m = raw.match(
      new RegExp(`\\bwords?\\s+"?([A-Za-z0-9][\\w&/ -]{0,60}?)"?\\s+(?:in|on|of)\\s+(?:the\\s+)?${fieldWord}`, 'i'),
    )
    if (m) pushUniqueCondition(conditions, { field: toField(m[2]), op: 'contains', value: m[1].trim() })
  }

  if (!conditions.length) {
    // "name contains panel", "description includes foo"
    const m = raw.match(
      new RegExp(`\\b${fieldWord}\\s+(?:that\\s+)?(?:contains?|with|has|having|includes?|including)\\s+"?([A-Za-z0-9][\\w&/ -]{0,60}?)"?\\s*$`, 'i'),
    )
    if (m) pushUniqueCondition(conditions, { field: toField(m[1]), op: 'contains', value: m[2].trim() })
  }

  if (!conditions.length) {
    // "<keyword> in the name"
    const m = raw.match(
      new RegExp(`"?([A-Za-z0-9][\\w&/ -]{0,60}?)"?\\s+(?:in|on)\\s+(?:the\\s+)?${fieldWord}\\b`, 'i'),
    )
    if (m && !/\b(all|each|every|products?|items?|rows?)\b/i.test(m[1])) {
      pushUniqueCondition(conditions, { field: toField(m[2]), op: 'contains', value: m[1].trim() })
    }
  }

  if (!conditions.length) {
    return {
      conditions,
      matchMode,
      error:
        'Could not detect criteria. Try: name contains "panel", or "products with the word panel in the name".',
    }
  }
  return { conditions, matchMode }
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
