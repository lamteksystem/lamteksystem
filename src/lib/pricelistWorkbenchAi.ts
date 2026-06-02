/**
 * AI-backed command parsing for the pricelist workbench. Calls the
 * `parse-workbench-command` Supabase edge function (Google Gemini) and validates
 * the returned rule. Any failure (no API key, offline, malformed) resolves to a
 * null rule so callers can silently fall back to the offline parser.
 */
import { supabase } from '@/lib/supabase'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type {
  WorkbenchActionType,
  WorkbenchCondition,
  WorkbenchConditionOp,
  WorkbenchMatchField,
  WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'

const FIELDS: WorkbenchMatchField[] = [
  'source',
  'door_range',
  'section',
  'sku',
  'name',
  'category_name',
  'description',
  'cost_price',
  'unit_price',
  'category',
]
const OPS: WorkbenchConditionOp[] = [
  'contains',
  'equals',
  'not_contains',
  'starts_with',
  'greater_than',
  'less_than',
  'sku_appears_in_name',
  'empty',
  'not_empty',
  'unassigned',
]
const ACTIONS: WorkbenchActionType[] = [
  'delete',
  'remove_sku_from_name',
  'strip_text_from_field',
  'change_text_case',
  'select',
  'deselect',
  'set_active',
  'set_inactive',
  'assign_category',
  'assign_taxonomy',
]

function uniqueStrings(values: (string | null | undefined)[], limit = 80): string[] {
  const seen = new Set<string>()
  for (const v of values) {
    const t = (v ?? '').trim()
    if (t) seen.add(t)
    if (seen.size >= limit) break
  }
  return [...seen]
}

/** Lists the AI uses for context: category names, sections and door ranges in scope. */
export function buildAiContext(
  rows: PricelistWorkbenchRow[],
  categoryNames: string[],
): { categories: string[]; sections: string[]; doorRanges: string[] } {
  return {
    categories: uniqueStrings(categoryNames),
    sections: uniqueStrings(rows.map((r) => r.section)),
    doorRanges: uniqueStrings(rows.map((r) => r.door_range)),
  }
}

function validateRule(raw: unknown, prompt: string): WorkbenchRule | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const action = obj.action as WorkbenchActionType
  if (!ACTIONS.includes(action)) return null
  const matchMode = obj.matchMode === 'any' ? 'any' : 'all'
  const actionParam = typeof obj.actionParam === 'string' && obj.actionParam.trim() ? obj.actionParam.trim() : undefined

  const conditions: WorkbenchCondition[] = []
  if (Array.isArray(obj.conditions)) {
    for (const c of obj.conditions) {
      if (!c || typeof c !== 'object') continue
      const cond = c as Record<string, unknown>
      const field = cond.field as WorkbenchMatchField
      const op = cond.op as WorkbenchConditionOp
      if (!FIELDS.includes(field) || !OPS.includes(op)) continue
      conditions.push({ field, op, value: typeof cond.value === 'string' ? cond.value : '' })
    }
  }

  return {
    id: `ai-${Date.now()}`,
    name: prompt.length > 72 ? `${prompt.slice(0, 69)}…` : prompt,
    conditions,
    matchMode,
    action,
    actionParam,
  }
}

export type AiParseResult = {
  rule: WorkbenchRule | null
  /** True when the AI service is unavailable (no key / offline) — fall back quietly. */
  unavailable: boolean
  error?: string
}

export async function parseCommandWithAi(
  prompt: string,
  ctx: { categories: string[]; sections: string[]; doorRanges: string[] },
): Promise<AiParseResult> {
  try {
    const { data, error } = await supabase.functions.invoke('parse-workbench-command', {
      body: {
        prompt,
        categories: ctx.categories,
        sections: ctx.sections,
        doorRanges: ctx.doorRanges,
      },
    })
    if (error) {
      // Pull the HTTP status when supabase-js attaches the original Response.
      let status = 0
      const ctxResp = (error as { context?: unknown }).context
      if (ctxResp && typeof ctxResp === 'object' && 'status' in ctxResp) {
        status = Number((ctxResp as { status?: number }).status) || 0
      }
      const unavailable = status === 503 || /not configured/i.test(error.message ?? '')
      return { rule: null, unavailable, error: error.message }
    }
    const rule = validateRule((data as { rule?: unknown } | null)?.rule, prompt)
    if (!rule) return { rule: null, unavailable: false, error: 'AI returned an unusable result.' }
    return { rule, unavailable: false }
  } catch (e) {
    return { rule: null, unavailable: true, error: e instanceof Error ? e.message : String(e) }
  }
}
