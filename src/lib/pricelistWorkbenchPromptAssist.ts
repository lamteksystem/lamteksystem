/**
 * Diagnose mis-parsed smart commands and propose repaired rules (no external AI).
 */
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { CategoryRow } from '@/types/database'
import {
  describeRule,
  parseSmartCommandPrompt,
  parseStripTextActionParam,
  simulateRuleOnRows,
  type RuleSimulationResult,
  type WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'

export type PromptAssistSuggestion = {
  id: string
  label: string
  reason: string
  rule: WorkbenchRule
  canonicalPrompt: string
  simulation: RuleSimulationResult
}

export type PromptAssistResult = {
  diagnosis: string[]
  suggestions: PromptAssistSuggestion[]
  needsAttention: boolean
}

function stripIntentInPrompt(lower: string, _raw: string): boolean {
  return (
    /\b(remove|strip)\b/.test(lower) &&
    /\b(phrase|word|text)\b/.test(lower) &&
    /\bfrom\b/.test(lower) &&
    /\b(descriptions?|names?|skus?)\b/.test(lower) &&
    !/\bfrom\s+(?:the\s+)?(?:workbench|list|draft)\b/.test(lower)
  )
}

function buildStripRuleFromPrompt(prompt: string): WorkbenchRule | null {
  const raw = prompt.trim()
  const lower = raw.toLowerCase()
  if (!stripIntentInPrompt(lower, raw)) return null

  const quoted = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim())
  const text = quoted[0]
  if (!text) return null

  let field: 'description' | 'name' | 'sku' = 'description'
  if (/\bfrom\s+(?:all\s+)?(?:product\s+)?names?\b/i.test(raw)) field = 'name'
  else if (/\bfrom\s+(?:all\s+)?(?:product\s+)?skus?\b/i.test(raw)) field = 'sku'
  else if (/\bfrom\s+(?:the\s+)?name\b/i.test(raw)) field = 'name'
  else if (/\bfrom\s+(?:the\s+)?sku\b/i.test(raw)) field = 'sku'

  const conditions: WorkbenchRule['conditions'] = []
  if (/\btealbury\b/i.test(raw)) {
    conditions.push({ field: 'source', op: 'equals', value: 'tealbury' })
  } else if (/\blamtek\b/i.test(raw)) {
    conditions.push({ field: 'source', op: 'equals', value: 'lamtek' })
  }
  if (/\bunassigned\b/i.test(raw)) {
    conditions.push({ field: 'category', op: 'unassigned', value: '' })
  }

  const canonicalPrompt = `Remove "${text}" from the ${field} of each product in scope`

  return {
    id: `repair-strip-${Date.now()}`,
    name: canonicalPrompt.slice(0, 120),
    conditions,
    matchMode: 'all',
    action: 'strip_text_from_field',
    actionParam: `${field}:${text}`,
  }
}

function ruleWithoutSpuriousSectionFilter(rule: WorkbenchRule, stripPhrase?: string): WorkbenchRule | null {
  if (!stripPhrase || rule.action !== 'delete') return null
  const cleaned = rule.conditions.filter(
    (c) => !(c.field === 'section' && c.value.toLowerCase() === stripPhrase.toLowerCase())
  )
  if (cleaned.length === rule.conditions.length) return null
  return { ...rule, conditions: cleaned }
}

function countRowsWithSubstring(
  rows: PricelistWorkbenchRow[],
  field: 'description' | 'name' | 'sku',
  text: string
): number {
  const needle = text.toLowerCase()
  return rows.filter((r) => (r[field] as string).toLowerCase().includes(needle)).length
}

export function buildPromptAssist(
  prompt: string,
  parsedRule: WorkbenchRule,
  initialSim: RuleSimulationResult,
  rows: PricelistWorkbenchRow[],
  targetIds: Set<string> | undefined,
  categories: CategoryRow[]
): PromptAssistResult {
  const diagnosis: string[] = []
  const suggestions: PromptAssistSuggestion[] = []
  const lower = prompt.toLowerCase()
  const quoted = [...prompt.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim())
  const stripPhrase = quoted[0]

  const stripIntent = stripIntentInPrompt(lower, prompt)
  const misreadAsDelete = stripIntent && parsedRule.action === 'delete'
  const zeroEffect =
    initialSim.wouldChange === 0 &&
    (parsedRule.action === 'delete' ? initialSim.matched === 0 : true)

  if (misreadAsDelete) {
    diagnosis.push(
      'Your command reads like removing text from a field, but the parser treated it as deleting rows.'
    )
    if (stripPhrase && parsedRule.conditions.some((c) => c.field === 'section' && c.value === stripPhrase)) {
      diagnosis.push(
        `The quoted text "${stripPhrase}" was mistaken for a section filter — it should be text removed from descriptions, not a section name.`
      )
    }
  } else if (parsedRule.action === 'strip_text_from_field' && zeroEffect && stripPhrase) {
    const param = parseStripTextActionParam(parsedRule.actionParam)
    const field = param?.field ?? 'description'
    const pool = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows
    const inField = countRowsWithSubstring(pool, field, stripPhrase)
    if (inField === 0) {
      diagnosis.push(`No rows in scope contain "${stripPhrase}" in the ${field} field.`)
    } else if (initialSim.matched === 0) {
      diagnosis.push('Filters matched no rows — try widening scope or removing extra conditions.')
    } else {
      diagnosis.push('Rows matched but no descriptions would change — the phrase may already be removed or spelled differently.')
    }
  } else if (zeroEffect) {
    diagnosis.push('This command would not change any rows in the current scope.')
    if (parsedRule.action === 'delete' && initialSim.matched === 0) {
      diagnosis.push('No rows matched the filters — check Tealbury/Lamtek, range, or section wording.')
    }
  }

  const addSuggestion = (rule: WorkbenchRule, label: string, reason: string, canonicalPrompt: string) => {
    const simulation = simulateRuleOnRows(rows, rule, targetIds, categories)
    if (suggestions.some((s) => describeRule(s.rule) === describeRule(rule))) return
    suggestions.push({
      id: `sug-${suggestions.length}-${Date.now()}`,
      label,
      reason,
      rule,
      canonicalPrompt,
      simulation,
    })
  }

  const repairedStrip = buildStripRuleFromPrompt(prompt)
  if (repairedStrip && (misreadAsDelete || parsedRule.action !== 'strip_text_from_field')) {
    addSuggestion(
      repairedStrip,
      'Remove text from field (recommended)',
      'Uses strip-text on descriptions/names instead of deleting rows.',
      repairedStrip.name
    )
  }

  if (misreadAsDelete && stripPhrase) {
    const withoutSection = ruleWithoutSpuriousSectionFilter(parsedRule, stripPhrase)
    if (withoutSection) {
      addSuggestion(
        withoutSection,
        'Keep delete but drop section filter',
        'Only if you really intended to delete rows — unlikely for this prompt.',
        prompt
      )
    }
  }

  if (parsedRule.action === 'strip_text_from_field' && zeroEffect && stripPhrase) {
    const bareStrip: WorkbenchRule = {
      ...parsedRule,
      id: `repair-bare-${Date.now()}`,
      conditions: [],
      name: parsedRule.name,
    }
    addSuggestion(
      bareStrip,
      'Apply to all rows in scope',
      'Removes extra filters so every row in scope is checked.',
      `Remove "${stripPhrase}" from the description of each product`
    )
  }

  // Re-parse after parser fixes may already work
  const reparsed = parseSmartCommandPrompt(prompt)
  if (reparsed.rule && describeRule(reparsed.rule) !== describeRule(parsedRule)) {
    addSuggestion(
      reparsed.rule,
      'Re-interpret command',
      'Updated parser reading for the same sentence.',
      prompt.trim()
    )
  }

  suggestions.sort((a, b) => b.simulation.wouldChange - a.simulation.wouldChange)

  const needsAttention =
    misreadAsDelete ||
    zeroEffect ||
    (stripIntent && parsedRule.action === 'strip_text_from_field' && initialSim.wouldChange === 0)

  return { diagnosis, suggestions, needsAttention }
}

export function bestPromptSuggestion(result: PromptAssistResult): PromptAssistSuggestion | null {
  const viable = result.suggestions.filter((s) => s.simulation.wouldChange > 0)
  return viable[0] ?? result.suggestions[0] ?? null
}
