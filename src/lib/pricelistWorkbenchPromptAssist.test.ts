import { describe, expect, it } from 'vitest'
import { buildPromptAssist, bestPromptSuggestion } from '@/lib/pricelistWorkbenchPromptAssist'
import { parseSmartCommandPrompt, simulateRuleOnRows } from '@/lib/pricelistWorkbenchRules'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: partial.id ?? '1',
    source: partial.source ?? 'tealbury',
    catalog_program: partial.catalog_program ?? CATALOG_PROGRAM.TEALBURY,
    sku: partial.sku ?? 'B15',
    name: partial.name ?? 'Unit',
    description: partial.description ?? '',
    unit_price: 10,
    cost_price: 7.5,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    category_id: null,
    category_slug: '',
    category_name: '',
    section: 'Units',
    door_range: 'No Doors',
    trade_code: 'B15',
    selected: false,
    options: {},
    item_kind: partial.item_kind ?? 'complete',
    part_type: partial.part_type ?? '',
    ...partial,
  }
}

describe('pricelistWorkbenchPromptAssist', () => {
  it('suggests strip repair when phrase-from-descriptions was misread', () => {
    const prompt = 'remove the phrase "Section:" from all product descriptions'
    const rows = [row({ id: 'a', description: 'Section: HIGHLINE' })]
    const { rule } = parseSmartCommandPrompt(prompt)
    expect(rule?.action).toBe('strip_text_from_field')
    const sim = simulateRuleOnRows(rows, rule!, undefined, [])
    const assist = buildPromptAssist(prompt, rule!, sim, rows, undefined, [])
    expect(assist.needsAttention).toBe(false)
    expect(sim.wouldChange).toBe(1)
  })

  it('offers strip fix when old mis-parse would delete zero rows', () => {
    const prompt = 'remove the phrase "Section:" from all product descriptions'
    const rows = [row({ id: 'a', description: 'Section: HIGHLINE' })]
    const badRule = {
      id: 'bad',
      name: 'bad',
      conditions: [{ field: 'section' as const, op: 'contains' as const, value: 'Section:' }],
      matchMode: 'all' as const,
      action: 'delete' as const,
    }
    const sim = simulateRuleOnRows(rows, badRule, undefined, [])
    expect(sim.wouldChange).toBe(0)
    const assist = buildPromptAssist(prompt, badRule, sim, rows, undefined, [])
    expect(assist.diagnosis.length).toBeGreaterThan(0)
    const best = bestPromptSuggestion(assist)
    expect(best?.rule.action).toBe('strip_text_from_field')
    expect(best?.simulation.wouldChange).toBe(1)
  })
})
