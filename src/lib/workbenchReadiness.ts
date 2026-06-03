/**
 * Pre-publish readiness, validation issues, and BOM/component gap analysis for the workbench draft.
 */
import { computeDraftBom, hasWorkbenchBom } from '@/lib/workbenchBom'
import { findCategoryForRule } from '@/lib/pricelistWorkbenchRules'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { CategoryRow } from '@/types/database'

const PANEL_LIKE = /\b(end\s*)?panel\b|filler\s*panel|decor\s*panel/i
const ACCESSORY_LIKE = /\b(end\s*)?panel\b|plinth|cornice|pelmet|post\b|mould|corbel|filler|splash|handle\b/i
const UNIT_SECTION = /high[\s-]*line|drawer[\s-]*line|wall\s*unit|base\s*unit|tower|multidrawer|larder|corner|appliance|wine/i

export type ValidationIssueKind =
  | 'missing_name'
  | 'missing_sku'
  | 'unassigned_category'
  | 'complete_without_bom'
  | 'likely_accessory_as_complete'
  | 'duplicate_sku'
  | 'panel_missing_door_range'
  | 'no_doors_complete'

export interface ValidationIssue {
  kind: ValidationIssueKind
  severity: 'error' | 'warn'
  count: number
  description: string
  /** Up to 8 sample labels for the modal. */
  samples: string[]
}

export interface ReadinessSlice {
  ok: number
  total: number
  percent: number
}

export interface WorkbenchReadiness {
  totalRows: number
  overallPercent: number
  named: ReadinessSlice
  categorised: ReadinessSlice
  tealburyCompletesWithBom: ReadinessSlice
  panelLikeAccessoryKind: ReadinessSlice
}

export interface BomGapGroup {
  reason: string
  count: number
  samples: string[]
}

export interface BomGapReport {
  completeCount: number
  okCount: number
  failedCount: number
  groups: BomGapGroup[]
}

export interface PrePublishReport {
  readiness: WorkbenchReadiness
  issues: ValidationIssue[]
  bomGaps: BomGapReport | null
}

function slice(ok: number, total: number): ReadinessSlice {
  const percent = total > 0 ? Math.round((ok / total) * 100) : 100
  return { ok, total, percent }
}

function averagePercents(slices: ReadinessSlice[]): number {
  const active = slices.filter((s) => s.total > 0)
  if (!active.length) return 100
  return Math.round(active.reduce((sum, s) => sum + s.percent, 0) / active.length)
}

export function computeWorkbenchReadiness(rows: PricelistWorkbenchRow[]): WorkbenchReadiness {
  const namedOk = rows.filter((r) => r.name?.trim()).length
  const catOk = rows.filter((r) => r.category_id).length

  const completes = rows.filter((r) => r.source === 'tealbury' && r.item_kind === 'complete')
  const bomOk = completes.filter((r) => hasWorkbenchBom(r)).length

  const panelLike = rows.filter((r) => PANEL_LIKE.test(`${r.name} ${r.section}`))
  const panelKindOk = panelLike.filter((r) => r.item_kind === 'accessory').length

  const named = slice(namedOk, rows.length)
  const categorised = slice(catOk, rows.length)
  const tealburyCompletesWithBom = slice(bomOk, completes.length)
  const panelLikeAccessoryKind = slice(panelKindOk, panelLike.length)

  return {
    totalRows: rows.length,
    overallPercent: averagePercents([named, categorised, tealburyCompletesWithBom, panelLikeAccessoryKind]),
    named,
    categorised,
    tealburyCompletesWithBom,
    panelLikeAccessoryKind,
  }
}

export function buildPrePublishValidation(
  rows: PricelistWorkbenchRow[],
  _categories?: CategoryRow[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const missingName = rows.filter((r) => !r.name?.trim())
  if (missingName.length) {
    issues.push({
      kind: 'missing_name',
      severity: 'error',
      count: missingName.length,
      description: 'Rows with no product name — fix before publish.',
      samples: missingName.slice(0, 8).map((r) => r.sku || r.id),
    })
  }

  const missingSku = rows.filter((r) => !r.sku?.trim())
  if (missingSku.length) {
    issues.push({
      kind: 'missing_sku',
      severity: 'error',
      count: missingSku.length,
      description: 'Rows with empty SKU — publish will skip these.',
      samples: missingSku.slice(0, 8).map((r) => r.name.slice(0, 60) || r.id),
    })
  }

  const unassigned = rows.filter((r) => !r.category_id)
  if (unassigned.length) {
    issues.push({
      kind: 'unassigned_category',
      severity: 'warn',
      count: unassigned.length,
      description: 'No portal category assigned — use Smart categorise or bulk rules.',
      samples: unassigned.slice(0, 8).map((r) => `${r.sku} · ${r.name.slice(0, 40)}`),
    })
  }

  const completesNoBom = rows.filter(
    (r) => r.source === 'tealbury' && r.item_kind === 'complete' && !hasWorkbenchBom(r),
  )
  if (completesNoBom.length) {
    issues.push({
      kind: 'complete_without_bom',
      severity: 'warn',
      count: completesNoBom.length,
      description: 'Tealbury complete units without a unit kit — use Smart controls → Compute unit kits (all completes).',
      samples: completesNoBom.slice(0, 8).map((r) => `${r.trade_code || r.sku} · ${r.door_range || '—'}`),
    })
  }

  const wrongKind = rows.filter((r) => {
    if (r.source !== 'tealbury' || r.item_kind !== 'complete') return false
    const hay = `${r.section} ${r.name}`.toLowerCase()
    return ACCESSORY_LIKE.test(hay) && !UNIT_SECTION.test(hay)
  })
  if (wrongKind.length) {
    issues.push({
      kind: 'likely_accessory_as_complete',
      severity: 'warn',
      count: wrongKind.length,
      description: 'Panel/trim rows still marked complete — run Infer part types or bulk Assign Panels.',
      samples: wrongKind.slice(0, 8).map((r) => r.name.slice(0, 50)),
    })
  }

  const skuMap = new Map<string, PricelistWorkbenchRow[]>()
  for (const r of rows) {
    const key = r.sku.trim().toLowerCase()
    if (!key) continue
    const list = skuMap.get(key) ?? []
    list.push(r)
    skuMap.set(key, list)
  }
  const dupes: string[] = []
  for (const [sku, list] of skuMap) {
    if (list.length > 1) dupes.push(`${sku} (${list.length} rows)`)
  }
  if (dupes.length) {
    issues.push({
      kind: 'duplicate_sku',
      severity: 'error',
      count: dupes.length,
      description: 'Duplicate SKUs in the draft — only one row should publish per SKU.',
      samples: dupes.slice(0, 8),
    })
  }

  const panelsNoRange = rows.filter(
    (r) =>
      PANEL_LIKE.test(`${r.name} ${r.section}`) &&
      !r.door_range?.trim() &&
      (r.source === 'tealbury' || r.source === 'uform'),
  )
  if (panelsNoRange.length) {
    issues.push({
      kind: 'panel_missing_door_range',
      severity: 'warn',
      count: panelsNoRange.length,
      description: 'Panel-like rows missing door range — quoting may not match kitchen setup.',
      samples: panelsNoRange.slice(0, 8).map((r) => r.name.slice(0, 50)),
    })
  }

  const noDoors = rows.filter(
    (r) =>
      r.source === 'tealbury' &&
      r.item_kind === 'complete' &&
      /^no\s*doors?$/i.test(r.door_range?.trim() ?? ''),
  )
  if (noDoors.length) {
    issues.push({
      kind: 'no_doors_complete',
      severity: 'warn',
      count: noDoors.length,
      description: '“No Doors” completes cannot resolve UFORM doors — expect BOM failures unless excluded.',
      samples: noDoors.slice(0, 8).map((r) => r.trade_code || r.sku),
    })
  }

  return issues
}

export function normalizeBomGapReason(error: string | null, warnings: string[]): string {
  const text = (error ?? warnings[0] ?? '').trim()
  if (!text) return 'Unknown failure'
  if (/no bom template/i.test(text)) return 'No BOM template (trade/section)'
  if (/no uform door/i.test(text)) return 'Missing UFORM door size'
  if (/no uform drawer/i.test(text)) return 'Missing UFORM drawer front'
  if (/no lamtek carcass/i.test(text)) return 'Missing Lamtek carcass SKU'
  if (/no lamtek/i.test(text)) return 'Missing Lamtek component'
  if (/no bom lines resolved/i.test(text)) return 'No BOM lines resolved'
  return text.length > 72 ? `${text.slice(0, 69)}…` : text
}

/** Recompute draft BOM for all Tealbury completes (does not mutate rows). */
export function buildBomGapReport(rows: PricelistWorkbenchRow[]): BomGapReport {
  const completes = rows.filter((r) => r.source === 'tealbury' && r.item_kind === 'complete')
  const groupMap = new Map<string, { count: number; samples: string[] }>()
  let okCount = 0
  let failedCount = 0

  for (const row of completes) {
    const { bom, error } = computeDraftBom(row, { allRows: rows, hingeBrand: 'titus' })
    if (bom?.lines.length) {
      okCount++
      if (bom.warnings.length) {
        const reason = normalizeBomGapReason(null, bom.warnings)
        bumpGroup(groupMap, reason, row)
      }
      continue
    }
    failedCount++
    const reason = normalizeBomGapReason(error, bom?.warnings ?? [])
    bumpGroup(groupMap, reason, row)
  }

  const groups: BomGapGroup[] = [...groupMap.entries()]
    .map(([reason, g]) => ({ reason, count: g.count, samples: g.samples }))
    .sort((a, b) => b.count - a.count)

  return {
    completeCount: completes.length,
    okCount,
    failedCount,
    groups,
  }
}

function bumpGroup(
  map: Map<string, { count: number; samples: string[] }>,
  reason: string,
  row: PricelistWorkbenchRow,
): void {
  const label = `${row.trade_code || row.sku.replace(/\s*·.*/, '')} · ${row.door_range || '—'}`
  const g = map.get(reason) ?? { count: 0, samples: [] }
  g.count++
  if (g.samples.length < 6) g.samples.push(label)
  map.set(reason, g)
}

export function buildPrePublishReport(
  rows: PricelistWorkbenchRow[],
  categories: CategoryRow[],
  opts?: { includeBomGaps?: boolean },
): PrePublishReport {
  return {
    readiness: computeWorkbenchReadiness(rows),
    issues: buildPrePublishValidation(rows, categories),
    bomGaps: opts?.includeBomGaps !== false ? buildBomGapReport(rows) : null,
  }
}

export function isPanelLikeRow(row: PricelistWorkbenchRow): boolean {
  const hay = `${row.name} ${row.section} ${row.description ?? ''}`
  return PANEL_LIKE.test(hay) || /\bpanel\b/i.test(row.section)
}

/** Assign Panels category + accessory kind to panel-like rows (Tealbury/UFORM). */
export function bulkAssignPanelsCategory(
  rows: PricelistWorkbenchRow[],
  categories: CategoryRow[],
): { rows: PricelistWorkbenchRow[]; changed: number } {
  const panelsCat = findCategoryForRule(categories, 'Panels')
  if (!panelsCat) {
    return { rows, changed: 0 }
  }
  let changed = 0
  const next = rows.map((r) => {
    if (!isPanelLikeRow(r)) return r
    if (r.source !== 'tealbury' && r.source !== 'uform') return r
    const needsCat = r.category_id !== panelsCat.id
    const needsKind = r.item_kind !== 'accessory'
    if (!needsCat && !needsKind) return r
    changed++
    return {
      ...r,
      category_id: panelsCat.id,
      category_slug: panelsCat.slug,
      category_name: panelsCat.name,
      category_ids: [panelsCat.id],
      item_kind: 'accessory' as const,
      item_kinds: ['accessory' as const],
      part_type: '',
      part_types: [] as string[],
    }
  })
  return { rows: next, changed }
}
