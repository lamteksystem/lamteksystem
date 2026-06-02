import { describe, expect, it } from 'vitest'
import {
  applyRuleToRows,
  filterRowsByRule,
  parseSmartCommandLoose,
  parseSmartCommandPrompt,
  parseSmartSelectionPrompt,
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

  it('parses a change-case command without inventing a condition from the quoted field name', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'check the "Name" field of each item and change all caps lock to Sentence case'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('change_text_case')
    // "all caps lock" → only convert the shouting values.
    expect(rule?.actionParam).toBe('name:sentence:onlycaps')
    // The quoted "Name" must NOT become a door_range/section filter.
    expect(rule?.conditions).toHaveLength(0)
  })

  it('parses a multi-field change-case command targeting capitals', () => {
    const { rule, error } = parseSmartCommandPrompt(
      'change the text in the name and description that is in capitals to Sentence case'
    )
    expect(error).toBeUndefined()
    expect(rule?.action).toBe('change_text_case')
    expect(rule?.actionParam).toBe('name+description:sentence:onlycaps')
    expect(rule?.conditions).toHaveLength(0)
  })

  it('only-caps change-case leaves correctly-cased text untouched', () => {
    const rows = [
      row({ id: 'a', name: 'CORNER WALL CABINET', description: 'WITH SOFT CLOSE' }),
      row({ id: 'b', name: 'Belmont Painted Door', description: 'Already tidy text.' }),
    ]
    const { rule } = parseSmartCommandPrompt(
      'change the text in the name and description that is in capitals to Sentence case'
    )
    const { rows: next, result } = applyRuleToRows(rows, rule!)
    expect(next[0].name).toBe('Corner wall cabinet')
    expect(next[0].description).toBe('With soft close')
    // Mixed-case row is left exactly as-is.
    expect(next[1].name).toBe('Belmont Painted Door')
    expect(next[1].description).toBe('Already tidy text.')
    expect(result.changed).toBe(1)
  })

  it('parses a selection criteria from "word X in the name"', () => {
    const { conditions, error } = parseSmartSelectionPrompt(
      'find all products with the word panel in the name',
    )
    expect(error).toBeUndefined()
    expect(conditions).toHaveLength(1)
    expect(conditions[0]).toMatchObject({ field: 'name', op: 'contains', value: 'panel' })
  })

  it('selection criteria matches the expected rows', () => {
    const rows = [
      row({ id: 'a', name: 'End Panel 720' }),
      row({ id: 'b', name: 'Base Unit 600' }),
      row({ id: 'c', name: 'Tall PANEL infill' }),
    ]
    const { conditions, matchMode } = parseSmartSelectionPrompt('name contains panel')
    const matched = filterRowsByRule(rows, { conditions, matchMode })
    expect(matched.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('loose parser returns a confident rule for clear commands', () => {
    const { rule, confident } = parseSmartCommandLoose('delete all Tealbury No Doors rows')
    expect(confident).toBe(true)
    expect(rule.action).toBe('delete')
  })

  it('loose parser never dead-ends: falls back to a select rule with detected filters', () => {
    const { rule, confident } = parseSmartCommandLoose('the panels in section kitchen units please')
    expect(confident).toBe(false)
    // Always usable: an action is present so it can load into the builder.
    expect(rule.action).toBeTruthy()
    expect(rule.conditions.length).toBeGreaterThan(0)
  })

  it('understands extra verbs (disable / get rid of)', () => {
    const disable = parseSmartCommandPrompt('disable all Lamtek rows')
    expect(disable.rule?.action).toBe('set_inactive')
    const purge = parseSmartCommandPrompt('get rid of every Tealbury No Doors row')
    expect(purge.rule?.action).toBe('delete')
  })

  it('applies sentence case to all rows for a quoted-field change-case command', () => {
    const rows = [
      row({ id: 'a', name: 'B15 — 150 BASE UNIT' }),
      row({ id: 'b', name: 'CORNER WALL CABINET' }),
    ]
    const { rule } = parseSmartCommandPrompt(
      'check the "Name" field of each item and change all caps lock to Sentence case'
    )
    expect(rule).not.toBeNull()
    const { rows: next, result } = applyRuleToRows(rows, rule!)
    expect(result.matched).toBe(2)
    expect(result.changed).toBe(2)
    expect(next[1].name).toBe('Corner wall cabinet')
  })
})
