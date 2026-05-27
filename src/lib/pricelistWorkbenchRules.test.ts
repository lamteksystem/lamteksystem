import { describe, expect, it } from 'vitest'
import {
  applyRuleToRows,
  parseSmartCommandPrompt,
  removeSkuFromName,
  simulateRuleOnRows,
  WORKBENCH_RULE_PRESETS,
} from '@/lib/pricelistWorkbenchRules'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'

function row(partial: Partial<PricelistWorkbenchRow>): PricelistWorkbenchRow {
  return {
    id: partial.id ?? '1',
    source: partial.source ?? 'tealbury',
    catalog_program: partial.catalog_program ?? CATALOG_PROGRAM.TEALBURY,
    sku: partial.sku ?? 'B15 · No Doors',
    name: partial.name ?? 'B15 — 150 BASE UNIT (No Doors)',
    description: '',
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
    door_range: partial.door_range ?? 'No Doors',
    trade_code: partial.trade_code ?? 'B15',
    selected: false,
    options: {},
    item_kind: partial.item_kind ?? 'complete',
    part_type: partial.part_type ?? '',
    ...partial,
  }
}

describe('pricelistWorkbenchRules', () => {
  it('deletes Tealbury No Doors via preset', () => {
    const rows = [
      row({ id: 'a', door_range: 'No Doors' }),
      row({ id: 'b', door_range: 'Dawson' }),
    ]
    const preset = WORKBENCH_RULE_PRESETS[0]
    const { rows: next, result } = applyRuleToRows(rows, preset)
    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('b')
    expect(result.changed).toBe(1)
  })

  it('removes sku prefix from name', () => {
    const cleaned = removeSkuFromName(
      row({ name: 'B15 — 150 BASE UNIT (No Doors)', trade_code: 'B15', door_range: 'No Doors' })
    )
    expect(cleaned).not.toMatch(/^B15\b/i)
    expect(cleaned).not.toContain('(No Doors)')
  })

  it('parses delete Tealbury No Doors prompt', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'Find all items with "No Doors" from the Tealbury catalogue and delete from the product list'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('delete')
    expect(rule?.conditions.some((c) => c.field === 'source' && c.value === 'tealbury')).toBe(true)
    expect(rule?.conditions.some((c) => c.field === 'door_range' && c.value.includes('No Doors'))).toBe(true)
  })

  it('parses remove sku from name prompt', () => {
    const { rule } = parseSmartCommandPrompt(
      'Find all products in the Tealbury catalogue with the SKU showing in the name field and remove the SKU from the name field'
    )
    expect(rule?.action).toBe('remove_sku_from_name')
    expect(rule?.conditions.some((c) => c.op === 'sku_appears_in_name')).toBe(true)
  })

  it('parses remove phrase from all product descriptions', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'remove the phrase "Section:" from all product descriptions'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('strip_text_from_field')
    expect(rule?.actionParam).toBe('description:Section:')
    expect(rule?.conditions).toHaveLength(0)
  })

  it('parses remove Section: from description for each product', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'remove the word "Section:" from the description of each product'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('strip_text_from_field')
    expect(rule?.actionParam).toBe('description:Section:')
    expect(rule?.conditions).toHaveLength(0)
  })

  it('strips Section: prefix from descriptions', () => {
    const { rows: next, result } = applyRuleToRows(
      [
        row({ id: 'a', description: 'Section: HIGHLINE BASE' }),
        row({ id: 'b', description: 'No prefix here' }),
      ],
      {
        id: 'strip',
        name: 'strip section',
        conditions: [],
        matchMode: 'all',
        action: 'strip_text_from_field',
        actionParam: 'description:Section:',
      }
    )
    expect(next[0].description).toBe('HIGHLINE BASE')
    expect(next[1].description).toBe('No prefix here')
    expect(result.changed).toBe(1)
  })

  it('simulates strip without mutating source rows', () => {
    const rows = [row({ id: 'a', description: 'Section: HIGHLINE BASE' })]
    const rule = {
      id: 'strip',
      name: 'strip',
      conditions: [],
      matchMode: 'all' as const,
      action: 'strip_text_from_field' as const,
      actionParam: 'description:Section:',
    }
    const sim = simulateRuleOnRows(rows, rule, undefined, [])
    expect(rows[0].description).toBe('Section: HIGHLINE BASE')
    expect(sim.wouldChange).toBe(1)
    expect(sim.samples[0]?.before).toContain('Section:')
    expect(sim.samples[0]?.after).toContain('HIGHLINE BASE')
  })

  it('simulates delete counts without removing rows', () => {
    const rows = [
      row({ id: 'a', door_range: 'No Doors' }),
      row({ id: 'b', door_range: 'Dawson' }),
    ]
    const sim = simulateRuleOnRows(rows, WORKBENCH_RULE_PRESETS[0], undefined, [])
    expect(rows).toHaveLength(2)
    expect(sim.matched).toBe(1)
    expect(sim.wouldChange).toBe(1)
    expect(sim.samples[0]?.after).toMatch(/removed/i)
  })

  it('parses assign category to unassigned tealbury', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'Assign category "Base units" to all unassigned Tealbury rows'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('assign_category')
    expect(rule?.actionParam).toMatch(/base units/i)
    expect(rule?.conditions.some((c) => c.op === 'unassigned')).toBe(true)
    expect(rule?.conditions.some((c) => c.field === 'source' && c.value === 'tealbury')).toBe(true)
  })
})
