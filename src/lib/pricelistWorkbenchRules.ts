/**
 * Smart rules & natural-language commands for the pricelist workbench draft list.
 */
import type { PricelistWorkbenchRow, PricelistSource } from '@/lib/pricelistWorkbench'

export type WorkbenchMatchField =
  | 'source'
  | 'door_range'
  | 'section'
  | 'sku'
  | 'name'
  | 'category_name'
  | 'description'

export type WorkbenchConditionOp =
  | 'contains'
  | 'equals'
  | 'not_contains'
  | 'sku_appears_in_name'
  | 'empty'
  | 'not_empty'

export type WorkbenchActionType =
  | 'delete'
  | 'remove_sku_from_name'
  | 'select'
  | 'deselect'
  | 'set_active'
  | 'set_inactive'

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
    default:
      return ''
  }
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
  if (!rule.conditions.length) return []
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

export function applyRuleToRows(
  rows: PricelistWorkbenchRow[],
  rule: WorkbenchRule,
  targetIds?: Set<string>
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
    select: 'selected',
    deselect: 'deselected',
    set_active: 'activated',
    set_inactive: 'deactivated',
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

/**
 * Parse a short English command into a workbench rule (best-effort).
 */
export function parseSmartCommandPrompt(prompt: string): { rule: WorkbenchRule | null; error?: string } {
  const raw = prompt.trim()
  if (!raw) return { rule: null, error: 'Enter a command first.' }

  const lower = normalizePrompt(raw)
  const quoted = extractQuotedPhrases(raw)

  let action: WorkbenchActionType | null = null
  if (/\b(remove|strip|clean)\b/.test(lower) && /\bsku\b/.test(lower) && /\bname\b/.test(lower)) {
    action = 'remove_sku_from_name'
  } else if (/\b(delete|drop)\b/.test(lower) || (/\bremove\b/.test(lower) && /\bfrom\b/.test(lower))) {
    action = 'delete'
  } else if (/\b(select|tick)\b/.test(lower)) action = 'select'
  else if (/\b(deselect|untick)\b/.test(lower)) action = 'deselect'

  if (!action) {
    return {
      rule: null,
      error: 'Could not detect an action. Try: DELETE, REMOVE SKU FROM NAME, or SELECT.',
    }
  }

  const conditions: WorkbenchCondition[] = []

  if (/\btealbury\b/.test(lower)) {
    conditions.push({ field: 'source', op: 'equals', value: 'tealbury' })
  } else if (/\blamtek\b/.test(lower)) {
    conditions.push({ field: 'source', op: 'equals', value: 'lamtek' })
  }

  const noDoors = quoted.find((q) => /no doors/i.test(q)) ?? (/\bno doors\b/.test(lower) ? 'No Doors' : '')
  if (noDoors) {
    conditions.push({ field: 'door_range', op: 'contains', value: noDoors })
  }

  for (const q of quoted) {
    if (/no doors/i.test(q)) continue
    if (/\bsku\b/.test(lower) && /name/.test(lower)) continue
    conditions.push({ field: 'door_range', op: 'contains', value: q })
  }

  if (action === 'remove_sku_from_name' || /\bsku\b.*\bname\b/.test(lower) || /\bname\b.*\bsku\b/.test(lower)) {
    if (!conditions.some((c) => c.op === 'sku_appears_in_name')) {
      conditions.push({ field: 'name', op: 'sku_appears_in_name', value: '' })
    }
  }

  if (!conditions.length) {
    return {
      rule: null,
      error: 'Could not detect filters. Mention Tealbury/Lamtek, a range like "No Doors", or SKU-in-name.',
    }
  }

  const name =
    raw.length > 60 ? `${raw.slice(0, 57)}…` : raw

  return {
    rule: {
      id: `cmd-${Date.now()}`,
      name,
      conditions,
      matchMode: 'all',
      action,
    },
  }
}

export function sourceLabel(source: PricelistSource): string {
  return source === 'tealbury' ? 'Tealbury' : 'Lamtek trade'
}

export function describeRule(rule: WorkbenchRule): string {
  const conds = rule.conditions
    .map((c) => {
      if (c.op === 'sku_appears_in_name') return 'SKU appears in name'
      if (c.op === 'empty') return `${c.field} is empty`
      if (c.op === 'not_empty') return `${c.field} has value`
      return `${c.field} ${c.op} "${c.value}"`
    })
    .join(rule.matchMode === 'any' ? ' OR ' : ' AND ')
  return `${rule.action}: ${conds}`
}
