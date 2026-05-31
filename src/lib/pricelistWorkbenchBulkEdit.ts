/**
 * Bulk-edit engine for the pricelist workbench. Applies a single {@link BulkEditSpec}
 * (many field changes at once) to a set of selected rows. Used by the bulk-edit modal.
 */
import {
  rowSections,
  rowItemKinds,
  rowPartTypes,
  rowCategoryIds,
  setRowSectionsPatch,
  setRowItemKindsPatch,
  setRowPartTypesPatch,
  setRowCategoriesPatch,
  type PricelistWorkbenchRow,
  type WorkbenchItemKindValue,
} from '@/lib/pricelistWorkbench'
import { applyTextCase, type TextCaseField, type TextCaseMode } from '@/lib/pricelistWorkbenchRules'
import type { CategoryRow } from '@/types/database'

/** How a multi-value field change is applied. */
export type MultiMode = 'none' | 'replace' | 'add' | 'clear'
export type TriState = 'none' | 'on' | 'off'
export type PriceMode = 'none' | 'set' | 'increase_pct' | 'decrease_pct' | 'round2'

/** Text fields find/replace and affix can target. */
export type BulkTextField = 'name' | 'description' | 'sku' | 'section' | 'door_range' | 'trade_code'

export interface BulkEditSpec {
  categories: { mode: MultiMode; values: string[] }
  sections: { mode: MultiMode; values: string[] }
  itemKinds: { mode: MultiMode; values: WorkbenchItemKindValue[] }
  partTypes: { mode: MultiMode; values: string[] }
  active: TriState
  isStock: TriState
  cost: { mode: PriceMode; value: number }
  price: { mode: PriceMode; value: number }
  findReplace: { field: BulkTextField | ''; find: string; replace: string }
  textCase: { field: TextCaseField | ''; mode: TextCaseMode }
  affix: { field: BulkTextField; prefix: string; suffix: string }
}

export function emptyBulkEditSpec(): BulkEditSpec {
  return {
    categories: { mode: 'none', values: [] },
    sections: { mode: 'none', values: [] },
    itemKinds: { mode: 'none', values: [] },
    partTypes: { mode: 'none', values: [] },
    active: 'none',
    isStock: 'none',
    cost: { mode: 'none', value: 0 },
    price: { mode: 'none', value: 0 },
    findReplace: { field: '', find: '', replace: '' },
    textCase: { field: '', mode: 'sentence' },
    affix: { field: 'name', prefix: '', suffix: '' },
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyPriceMode(current: number, mode: PriceMode, value: number): number {
  switch (mode) {
    case 'set':
      return Math.max(0, value)
    case 'increase_pct':
      return Math.max(0, current * (1 + value / 100))
    case 'decrease_pct':
      return Math.max(0, current * (1 - value / 100))
    case 'round2':
      return Math.max(0, Math.round(current * 100) / 100)
    default:
      return current
  }
}

function mergeMulti(existing: string[], spec: { mode: MultiMode; values: string[] }): string[] | null {
  switch (spec.mode) {
    case 'replace':
      return [...spec.values]
    case 'add':
      return [...existing, ...spec.values]
    case 'clear':
      return []
    default:
      return null
  }
}

/** True when the spec would touch at least one field. */
export function bulkSpecHasChanges(spec: BulkEditSpec): boolean {
  return (
    spec.categories.mode !== 'none' ||
    spec.sections.mode !== 'none' ||
    spec.itemKinds.mode !== 'none' ||
    spec.partTypes.mode !== 'none' ||
    spec.active !== 'none' ||
    spec.isStock !== 'none' ||
    spec.cost.mode !== 'none' ||
    spec.price.mode !== 'none' ||
    (!!spec.findReplace.field && spec.findReplace.find.trim() !== '') ||
    !!spec.textCase.field ||
    spec.affix.prefix.trim() !== '' ||
    spec.affix.suffix.trim() !== ''
  )
}

function buildRowPatch(
  row: PricelistWorkbenchRow,
  spec: BulkEditSpec,
  categories: CategoryRow[],
): Partial<PricelistWorkbenchRow> {
  let patch: Partial<PricelistWorkbenchRow> = {}
  const working: PricelistWorkbenchRow = { ...row }

  const cats = mergeMulti(rowCategoryIds(row), spec.categories)
  if (cats) {
    const p = setRowCategoriesPatch(cats, categories)
    patch = { ...patch, ...p }
    Object.assign(working, p)
  }

  const secs = mergeMulti(rowSections(row), spec.sections)
  if (secs) {
    const p = setRowSectionsPatch(secs)
    patch = { ...patch, ...p }
    Object.assign(working, p)
  }

  const kinds = spec.itemKinds.mode === 'none' ? null : mergeMulti(rowItemKinds(row), spec.itemKinds)
  if (kinds) {
    const p = setRowItemKindsPatch(kinds as WorkbenchItemKindValue[])
    patch = { ...patch, ...p }
    Object.assign(working, p)
  }

  const parts = mergeMulti(rowPartTypes(row), spec.partTypes)
  if (parts) {
    const p = setRowPartTypesPatch(parts)
    patch = { ...patch, ...p }
    Object.assign(working, p)
  }

  if (spec.active !== 'none') patch.active = spec.active === 'on'
  if (spec.isStock !== 'none') patch.is_stock = spec.isStock === 'on'

  if (spec.cost.mode !== 'none') {
    const next = applyPriceMode(working.cost_price ?? 0, spec.cost.mode, spec.cost.value)
    patch.cost_price = Math.round(next * 100) / 100
  }
  if (spec.price.mode !== 'none') {
    const next = applyPriceMode(working.unit_price ?? 0, spec.price.mode, spec.price.value)
    patch.unit_price = Math.round(next * 100) / 100
  }

  // Text transforms applied in sequence on a working copy of the field value.
  const textField =
    spec.findReplace.field || (spec.textCase.field as BulkTextField | '') || spec.affix.field
  if (
    (spec.findReplace.field && spec.findReplace.find.trim()) ||
    spec.textCase.field ||
    spec.affix.prefix.trim() ||
    spec.affix.suffix.trim()
  ) {
    // find/replace on its own field
    if (spec.findReplace.field && spec.findReplace.find.trim()) {
      const f = spec.findReplace.field
      const current = String(working[f] ?? '')
      const re = new RegExp(escapeRegex(spec.findReplace.find), 'gi')
      const updated = current.replace(re, spec.findReplace.replace).replace(/\s{2,}/g, ' ').trim()
      patch = { ...patch, [f]: updated }
      Object.assign(working, { [f]: updated })
    }
    if (spec.textCase.field) {
      const f = spec.textCase.field
      const current = String(working[f] ?? '')
      const updated = applyTextCase(current, spec.textCase.mode)
      patch = { ...patch, [f]: updated }
      Object.assign(working, { [f]: updated })
    }
    if (spec.affix.prefix.trim() || spec.affix.suffix.trim()) {
      const f = spec.affix.field
      const current = String(working[f] ?? '')
      const updated = `${spec.affix.prefix}${current}${spec.affix.suffix}`.trim()
      patch = { ...patch, [f]: updated }
    }
  }
  void textField

  return patch
}

export interface BulkEditResult {
  rows: PricelistWorkbenchRow[]
  changed: number
}

/** Apply a bulk-edit spec to the rows whose id is in `ids`. */
export function applyBulkEdit(
  rows: PricelistWorkbenchRow[],
  ids: Set<string>,
  spec: BulkEditSpec,
  categories: CategoryRow[],
): BulkEditResult {
  if (!ids.size || !bulkSpecHasChanges(spec)) return { rows, changed: 0 }
  let changed = 0
  const next = rows.map((row) => {
    if (!ids.has(row.id)) return row
    const patch = buildRowPatch(row, spec, categories)
    if (Object.keys(patch).length === 0) return row
    const updated = { ...row, ...patch }
    const updatedRec = updated as unknown as Record<string, unknown>
    const rowRec = row as unknown as Record<string, unknown>
    // Count only when something actually differs on a patched key.
    const differs = Object.keys(patch).some(
      (k) => JSON.stringify(updatedRec[k]) !== JSON.stringify(rowRec[k]),
    )
    if (differs) changed++
    return updated
  })
  return { rows: next, changed }
}
