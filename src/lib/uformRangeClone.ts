/**
 * Clone UFORM door/drawer-front sizes from one door range to others.
 *
 * UFORM spec PDFs are per range, but leaf sizes (715×497 for a 500 HL base, etc.)
 * are the same across Tealbury ranges — only range name / SKU / finish differ.
 */
import { TEALBURY_DOOR_RANGES } from '@/lib/tealburyDoorRanges'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { buildDoorSku } from '@/lib/uformSpecParse'

export type UformCloneableKind = 'door' | 'drawer_front'

export interface UformSizeTemplate {
  kind: UformCloneableKind
  section: string
  height_mm: number
  width_mm: number
  depth_mm: number | null
  part_type: string
}

export interface UformRangeClonePreview {
  sourceRange: string
  targetRanges: string[]
  templates: number
  wouldAdd: number
  alreadyPresent: number
  samples: string[]
}

export interface UformRangeCloneResult {
  rows: PricelistWorkbenchRow[]
  added: number
  skippedExisting: number
  sourceRange: string
  targetRanges: string[]
  notes: string[]
}

function parseDimsFromRow(row: PricelistWorkbenchRow): { h: number; w: number; d: number | null } | null {
  const opts = row.options
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    const h = Number((opts as Record<string, unknown>).height_mm)
    const w = Number((opts as Record<string, unknown>).width_mm)
    const d = Number((opts as Record<string, unknown>).depth_mm)
    if (Number.isFinite(h) && h > 0 && Number.isFinite(w) && w > 0) {
      return { h: Math.round(h), w: Math.round(w), d: Number.isFinite(d) && d > 0 ? Math.round(d) : null }
    }
  }
  const m = row.sku.match(/(\d{3,4})[x×](\d{3,4})/i)
  if (m) {
    return { h: parseInt(m[1], 10), w: parseInt(m[2], 10), d: null }
  }
  const nameM = row.name.match(/(\d{3,4})\s*[×x]\s*(\d{3,4})/i)
  if (nameM) {
    return { h: parseInt(nameM[1], 10), w: parseInt(nameM[2], 10), d: null }
  }
  return null
}

export function sizeKey(kind: string, section: string, h: number, w: number): string {
  return `${kind}|${section.toLowerCase()}|${h}x${w}`
}

export function extractUformTemplates(
  rows: PricelistWorkbenchRow[],
  sourceRange: string,
): UformSizeTemplate[] {
  const out: UformSizeTemplate[] = []
  const seen = new Set<string>()
  const src = sourceRange.trim().toLowerCase()
  for (const r of rows) {
    if (r.source !== 'uform') continue
    if ((r.door_range ?? '').trim().toLowerCase() !== src) continue
    if (r.item_kind !== 'door' && r.item_kind !== 'drawer_front') continue
    const dims = parseDimsFromRow(r)
    if (!dims) continue
    const key = sizeKey(r.item_kind, r.section, dims.h, dims.w)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: r.item_kind,
      section: r.section || (r.item_kind === 'drawer_front' ? 'Drawer Fronts' : 'Doors'),
      height_mm: dims.h,
      width_mm: dims.w,
      depth_mm: dims.d,
      part_type: r.part_type || (r.item_kind === 'drawer_front' ? 'drawer' : 'door'),
    })
  }
  return out
}

/** Pick the range with the most UFORM door/drawer rows to use as clone source. */
export function bestUformCloneSourceRange(rows: PricelistWorkbenchRow[]): string | null {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.source !== 'uform') continue
    if (r.item_kind !== 'door' && r.item_kind !== 'drawer_front') continue
    const dr = r.door_range?.trim()
    if (!dr) continue
    counts.set(dr, (counts.get(dr) ?? 0) + 1)
  }
  let best: string | null = null
  let max = 0
  for (const [dr, n] of counts) {
    if (n > max) {
      max = n
      best = dr
    }
  }
  return best
}

export function targetRangesMissingUform(
  rows: PricelistWorkbenchRow[],
  sourceRange: string,
): string[] {
  const src = sourceRange.trim().toLowerCase()
  const templates = extractUformTemplates(rows, sourceRange)
  if (!templates.length) return []

  const existingByRange = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.source !== 'uform') continue
    if (r.item_kind !== 'door' && r.item_kind !== 'drawer_front') continue
    const dr = r.door_range?.trim()
    if (!dr || dr.toLowerCase() === src) continue
    const dims = parseDimsFromRow(r)
    if (!dims) continue
    const set = existingByRange.get(dr) ?? new Set()
    set.add(sizeKey(r.item_kind, r.section, dims.h, dims.w))
    existingByRange.set(dr, set)
  }

  const targets: string[] = []
  for (const range of TEALBURY_DOOR_RANGES) {
    if (range.toLowerCase() === src) continue
    const have = existingByRange.get(range) ?? new Set()
    const missing = templates.some((t) => !have.has(sizeKey(t.kind, t.section, t.height_mm, t.width_mm)))
    if (missing) targets.push(range)
  }
  return targets
}

function cloneRow(
  template: UformSizeTemplate,
  targetRange: string,
  sourceRange: string,
  index: number,
): PricelistWorkbenchRow {
  const isDrawer = template.kind === 'drawer_front'
  const section = template.section
  const { height_mm: h, width_mm: w } = template
  const sku = buildDoorSku(targetRange, h, w, section)
  const label = isDrawer ? 'Drawer front' : 'Door'
  const name = `${targetRange} ${label} ${h}×${w} mm`
  return {
    id: `uform-clone-${sku}-${index}`,
    source: 'uform',
    catalog_program: 'tealbury',
    sku,
    name,
    description: `Cloned from ${sourceRange} (${h}×${w} mm) — same size matrix as other ranges; replace with official UFORM spec when available.`,
    unit_price: 0,
    cost_price: null,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    category_id: null,
    category_slug: '',
    category_name: '',
    section,
    door_range: targetRange,
    trade_code: '',
    selected: false,
    item_kind: template.kind,
    part_type: template.part_type,
    options: {
      uform_spec: true,
      uform_cloned_from: sourceRange,
      height_mm: h,
      width_mm: w,
      depth_mm: template.depth_mm,
    },
  }
}

export function previewUformRangeClone(
  rows: PricelistWorkbenchRow[],
  opts?: { sourceRange?: string; targetRanges?: string[] },
): UformRangeClonePreview | null {
  const sourceRange = opts?.sourceRange?.trim() || bestUformCloneSourceRange(rows)
  if (!sourceRange) return null
  const templates = extractUformTemplates(rows, sourceRange)
  if (!templates.length) return null

  const targetRanges =
    opts?.targetRanges?.length ? opts.targetRanges : targetRangesMissingUform(rows, sourceRange)

  const existingSkus = new Set(rows.map((r) => r.sku.trim().toLowerCase()))
  const existingKeysByRange = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.source !== 'uform') continue
    const dr = r.door_range?.trim()
    if (!dr) continue
    const dims = parseDimsFromRow(r)
    if (!dims) continue
    const set = existingKeysByRange.get(dr) ?? new Set()
    set.add(sizeKey(r.item_kind, r.section, dims.h, dims.w))
    existingKeysByRange.set(dr, set)
  }

  let wouldAdd = 0
  let alreadyPresent = 0
  const samples: string[] = []

  for (const target of targetRanges) {
    const have = existingKeysByRange.get(target) ?? new Set()
    for (const t of templates) {
      const key = sizeKey(t.kind, t.section, t.height_mm, t.width_mm)
      if (have.has(key)) {
        alreadyPresent++
        continue
      }
      const sku = buildDoorSku(target, t.height_mm, t.width_mm, t.section)
      if (existingSkus.has(sku.toLowerCase())) {
        alreadyPresent++
        continue
      }
      wouldAdd++
      if (samples.length < 8) {
        samples.push(`${target} ${t.kind} ${t.height_mm}×${t.width_mm}`)
      }
    }
  }

  return {
    sourceRange,
    targetRanges,
    templates: templates.length,
    wouldAdd,
    alreadyPresent,
    samples,
  }
}

export function cloneUformSizesToMissingRanges(
  rows: PricelistWorkbenchRow[],
  opts?: { sourceRange?: string; targetRanges?: string[] },
): UformRangeCloneResult {
  const preview = previewUformRangeClone(rows, opts)
  if (!preview) {
    return {
      rows,
      added: 0,
      skippedExisting: 0,
      sourceRange: opts?.sourceRange ?? '',
      targetRanges: [],
      notes: ['No UFORM door/drawer rows found to use as a clone source. Import Dawson (or another) spec JSON first.'],
    }
  }

  const { sourceRange, targetRanges } = preview
  const templates = extractUformTemplates(rows, sourceRange)
  const existingSkus = new Set(rows.map((r) => r.sku.trim().toLowerCase()))
  const existingKeysByRange = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.source !== 'uform') continue
    const dr = r.door_range?.trim()
    if (!dr) continue
    const dims = parseDimsFromRow(r)
    if (!dims) continue
    const set = existingKeysByRange.get(dr) ?? new Set()
    set.add(sizeKey(r.item_kind, r.section, dims.h, dims.w))
    existingKeysByRange.set(dr, set)
  }

  const addedRows: PricelistWorkbenchRow[] = []
  let added = 0
  let skippedExisting = 0
  let idx = 0

  for (const target of targetRanges) {
    const have = existingKeysByRange.get(target) ?? new Set()
    for (const t of templates) {
      const key = sizeKey(t.kind, t.section, t.height_mm, t.width_mm)
      if (have.has(key)) {
        skippedExisting++
        continue
      }
      const row = cloneRow(t, target, sourceRange, idx++)
      if (existingSkus.has(row.sku.toLowerCase())) {
        skippedExisting++
        continue
      }
      addedRows.push(row)
      existingSkus.add(row.sku.toLowerCase())
      have.add(key)
      added++
    }
    existingKeysByRange.set(target, have)
  }

  const notes = [
    `Cloned ${added} UFORM row(s) from “${sourceRange}” → ${targetRanges.join(', ') || '(none)'}.`,
    `${preview.templates} unique size(s) in source.`,
  ]

  return {
    rows: [...rows, ...addedRows],
    added,
    skippedExisting,
    sourceRange,
    targetRanges,
    notes,
  }
}
