/**
 * Structured parser / import notices for the pricelist workbench.
 * Stored in draft warnings JSON and rendered with human explanations.
 */

export type DuplicateSkuMergedWarning = {
  type: 'duplicate_sku_merged'
  sku: string
  keptName: string
  keptSection: string
  mergedCount: number
  mergedNames: string[]
  mergedSections: string[]
}

export type SheetSkippedWarning = {
  type: 'sheet_skipped'
  sheet: string
  reason: 'hub_formulas'
}

export type GenericWorkbenchWarning = {
  type: 'generic'
  message: string
}

export type WorkbenchWarning =
  | DuplicateSkuMergedWarning
  | SheetSkippedWarning
  | GenericWorkbenchWarning

export function warningFromLegacyString(line: string): WorkbenchWarning {
  const dup = line.match(/^Duplicate SKU merged:\s*(.+)$/i)
  if (dup) {
    return {
      type: 'duplicate_sku_merged',
      sku: dup[1].trim(),
      keptName: '',
      keptSection: '',
      mergedCount: 1,
      mergedNames: [],
      mergedSections: [],
    }
  }
  const hub = line.match(/^Sheet "([^"]+)":\s*skipped \(hub with formulas\)/i)
  if (hub) {
    return { type: 'sheet_skipped', sheet: hub[1], reason: 'hub_formulas' }
  }
  return { type: 'generic', message: line }
}

export function parseWarningsJson(raw: unknown): WorkbenchWarning[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (item && typeof item === 'object' && 'type' in item) return item as WorkbenchWarning
    if (typeof item === 'string') return warningFromLegacyString(item)
    return { type: 'generic', message: String(item) }
  })
}

export function warningsToPersist(warnings: WorkbenchWarning[]): WorkbenchWarning[] {
  return warnings
}
