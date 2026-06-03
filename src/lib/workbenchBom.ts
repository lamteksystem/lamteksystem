/**
 * Bill of Materials for complete units while still in the workbench draft.
 *
 * Stored on each complete row as `options.workbench_bom`:
 *   { templateId, computedAt, warnings?, lines: [{ component_role, component_sku, quantity, name?, unit_price? }] }
 *
 * Lets staff preview "What's included" before publish. On publish, lines are
 * materialized into `assemblies` + `assembly_lines` when component SKUs exist
 * in the live catalogue.
 */
import { supabase } from '@/lib/supabase'
import {
  addAssemblyLine,
  ensureAssemblyForProduct,
  ASSEMBLY_COMPONENT_ROLE_LABELS,
} from '@/lib/productAssembly'
import {
  carcassSizeFromTradeCode,
  matchBomTemplate,
  type BomLineResolver,
  type CompleteUnitBomTemplate,
} from '@/lib/completeUnitBomTemplates'
import { productMatchesHingeBrand } from '@/lib/tealburyBomResolve'
import type { HingeBrand } from '@/lib/tealburyOrderSetup'
import { doorDimsForUnit } from '@/lib/variantGenerator'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { Json } from '@/types/database'

export interface WorkbenchBomLine {
  component_role: string
  component_sku: string
  quantity: number
  name?: string
  unit_price?: number
}

export interface WorkbenchBom {
  templateId: string | null
  computedAt: string
  warnings: string[]
  lines: WorkbenchBomLine[]
}

const WORKBENCH_BOM_KEY = 'workbench_bom'

export function getWorkbenchBom(row: PricelistWorkbenchRow): WorkbenchBom | null {
  const raw = row.options?.[WORKBENCH_BOM_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const bag = raw as Record<string, unknown>
  const lines = Array.isArray(bag.lines) ? bag.lines : []
  const parsed: WorkbenchBomLine[] = []
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue
    const l = line as Record<string, unknown>
    const sku = String(l.component_sku ?? '').trim()
    if (!sku) continue
    parsed.push({
      component_role: String(l.component_role ?? 'other'),
      component_sku: sku,
      quantity: Math.max(1, Number(l.quantity) || 1),
      name: typeof l.name === 'string' ? l.name : undefined,
      unit_price: Number.isFinite(Number(l.unit_price)) ? Number(l.unit_price) : undefined,
    })
  }
  if (parsed.length === 0) return null
  return {
    templateId: typeof bag.templateId === 'string' ? bag.templateId : null,
    computedAt: typeof bag.computedAt === 'string' ? bag.computedAt : '',
    warnings: Array.isArray(bag.warnings) ? bag.warnings.map(String) : [],
    lines: parsed,
  }
}

export function workbenchBomPatch(bom: WorkbenchBom): Partial<PricelistWorkbenchRow> {
  return {
    options: {
      [WORKBENCH_BOM_KEY]: bom as unknown as Json,
    },
  }
}

export function hasWorkbenchBom(row: PricelistWorkbenchRow): boolean {
  const bom = getWorkbenchBom(row)
  return !!bom?.lines.length
}

export interface BulkDraftBomResult {
  ok: number
  failed: number
  notes: string[]
  /** Row id → patch (options merged by caller). */
  patches: Map<string, Partial<PricelistWorkbenchRow>>
}

/** Compute draft BOM for many Tealbury complete rows (default hinge brand: Titus). */
export function bulkComputeDraftBom(
  targets: PricelistWorkbenchRow[],
  allRows: PricelistWorkbenchRow[],
  hingeBrand: HingeBrand = 'titus',
): BulkDraftBomResult {
  const patches = new Map<string, Partial<PricelistWorkbenchRow>>()
  const notes: string[] = []
  let ok = 0
  let failed = 0
  for (const row of targets) {
    const { bom, error } = computeDraftBom(row, { allRows, hingeBrand })
    if (!bom) {
      failed++
      notes.push(`${row.sku}: ${error ?? 'no BOM'}`)
      continue
    }
    ok++
    patches.set(row.id, workbenchBomPatch(bom))
    if (bom.warnings.length) notes.push(`${row.sku}: ${bom.warnings.join('; ')}`)
  }
  return { ok, failed, notes, patches }
}

export function mergeWorkbenchRowPatch(
  row: PricelistWorkbenchRow,
  patch: Partial<PricelistWorkbenchRow>,
): PricelistWorkbenchRow {
  if (patch.options && row.options && typeof row.options === 'object' && !Array.isArray(row.options)) {
    return {
      ...row,
      ...patch,
      options: {
        ...(row.options as Record<string, Json>),
        ...(patch.options as Record<string, Json>),
      },
    }
  }
  return { ...row, ...patch }
}

export function unitWidthMmFromWorkbenchRow(row: PricelistWorkbenchRow): number | null {
  const opts = row.options
  const dims = opts?.tealbury_dims_mm ?? opts?.lamtek_dims_mm
  if (dims && typeof dims === 'object' && !Array.isArray(dims)) {
    const w = Number((dims as Record<string, unknown>).w)
    if (Number.isFinite(w) && w > 0) return Math.round(w)
  }
  const fromTrade = carcassSizeFromTradeCode(row.trade_code || row.sku)
  return fromTrade ? Number(fromTrade) : null
}

export type DraftComponentPool = {
  bySku: Map<string, PricelistWorkbenchRow>
  lamtek: PricelistWorkbenchRow[]
  uform: PricelistWorkbenchRow[]
}

export function buildDraftComponentPool(rows: PricelistWorkbenchRow[]): DraftComponentPool {
  const bySku = new Map<string, PricelistWorkbenchRow>()
  const lamtek: PricelistWorkbenchRow[] = []
  const uform: PricelistWorkbenchRow[] = []
  for (const r of rows) {
    const sku = r.sku?.trim()
    if (sku) bySku.set(sku.toLowerCase(), r)
    if (r.source === 'lamtek') lamtek.push(r)
    if (r.source === 'uform') uform.push(r)
  }
  return { bySku, lamtek, uform }
}

function pickLamtekCarcass(pool: DraftComponentPool, carcassSize: string): PricelistWorkbenchRow | null {
  const size = carcassSize.toLowerCase()
  const scored = pool.lamtek
    .filter((r) => r.part_type === 'unit' || !r.part_type)
    .map((r) => {
      const sku = (r.sku ?? '').toLowerCase()
      const name = r.name.toLowerCase()
      let score = 0
      if (sku === `b${size}` || sku.startsWith(`b${size}`)) score += 4
      if (sku.includes(size)) score += 2
      if (name.includes(`${size}mm`) || name.includes(`${size} `)) score += 2
      return { r, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.r ?? null
}

function pickByPartType(
  pool: DraftComponentPool,
  partType: string,
  hingeBrand?: HingeBrand | null,
): PricelistWorkbenchRow | null {
  let candidates = pool.lamtek.filter((r) => r.part_type === partType)
  // Lamtek trade list often has no separate hinge_plate rows — hinges are sold as pairs.
  if (candidates.length === 0 && partType === 'hinge_plate') {
    candidates = pool.lamtek.filter((r) => r.part_type === 'hinge' || /hinge/i.test(r.name))
  }
  if (hingeBrand && (partType === 'hinge' || partType === 'hinge_plate')) {
    const branded = candidates.filter((r) => productMatchesHingeBrand(r, hingeBrand))
    if (branded.length > 0) {
      return branded.sort((a, b) => a.name.localeCompare(b.name))[0]
    }
  }
  return candidates[0] ?? null
}

function pickUformDoor(
  pool: DraftComponentPool,
  doorRange: string,
  height_mm: number,
  width_mm: number,
  preferDrawer = false,
): PricelistWorkbenchRow | null {
  const tag = `${height_mm}x${width_mm}`.toLowerCase()
  const rangeSlug = doorRange.toLowerCase().replace(/\s+/g, '')
  const matches = pool.uform.filter((r) => {
    const sku = (r.sku ?? '').toLowerCase()
    const name = r.name.toLowerCase()
    const isDrawer = sku.includes('-df-') || name.includes('drawer')
    const isDoor = sku.includes('-dr-') || (name.includes('door') && !isDrawer)
    if (preferDrawer && !isDrawer) return false
    if (!preferDrawer && isDrawer && !isDoor) return false
    return (
      (sku.includes(tag) || name.includes(tag.replace('x', '×'))) &&
      (name.includes(doorRange.toLowerCase()) || sku.includes(rangeSlug.slice(0, 12)))
    )
  })
  if (matches.length === 0) return null
  if (preferDrawer) return matches[0]
  return matches.find((p) => (p.sku ?? '').toLowerCase().includes('-dr-')) ?? matches[0]
}

function rowToBomLine(row: PricelistWorkbenchRow, role: string, qty: number): WorkbenchBomLine {
  return {
    component_role: role,
    component_sku: row.sku.trim(),
    quantity: qty,
    name: row.name,
    unit_price: row.unit_price,
  }
}

function resolveDraftLine(
  resolver: BomLineResolver,
  ctx: {
    pool: DraftComponentPool
    tradeCode: string
    doorRange: string
    unitWidthMm: number | null
    hingeBrand?: HingeBrand | null
  },
): { line: WorkbenchBomLine | null; warning?: string } {
  switch (resolver.type) {
    case 'lamtek_carcass_from_trade': {
      const size = carcassSizeFromTradeCode(ctx.tradeCode)
      if (!size) return { line: null }
      const r = pickLamtekCarcass(ctx.pool, size)
      if (!r) return { line: null, warning: `No Lamtek carcass for size ${size}` }
      return { line: rowToBomLine(r, 'unit', 1) }
    }
    case 'lamtek_part_type': {
      const r = pickByPartType(ctx.pool, resolver.part_type, ctx.hingeBrand)
      if (!r) return { line: null, warning: `No Lamtek part_type=${resolver.part_type}` }
      return { line: rowToBomLine(r, resolver.part_type, resolver.quantity) }
    }
    case 'lamtek_part_type_per_door': {
      const r = pickByPartType(ctx.pool, resolver.part_type, ctx.hingeBrand)
      if (!r) return { line: null, warning: `No Lamtek ${resolver.part_type}` }
      const widthRaw = ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode))
      const doorCount =
        Number.isFinite(widthRaw) && widthRaw > 0 ? doorDimsForUnit(widthRaw).count : 1
      return { line: rowToBomLine(r, resolver.part_type, doorCount * resolver.per_door) }
    }
    case 'uform_door': {
      const r = pickUformDoor(ctx.pool, ctx.doorRange, resolver.height_mm, resolver.width_mm, false)
      if (!r) {
        return {
          line: null,
          warning: `No UFORM door ${resolver.height_mm}×${resolver.width_mm} for ${ctx.doorRange}`,
        }
      }
      return { line: rowToBomLine(r, 'door', resolver.quantity) }
    }
    case 'uform_door_auto': {
      const widthRaw = ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode) ?? NaN)
      if (!Number.isFinite(widthRaw) || widthRaw <= 0) return { line: null }
      const dims = doorDimsForUnit(widthRaw)
      const r = pickUformDoor(ctx.pool, ctx.doorRange, dims.heightMm, dims.widthMm, false)
      if (!r) {
        return {
          line: null,
          warning: `No UFORM door ${dims.heightMm}×${dims.widthMm} for ${ctx.doorRange}`,
        }
      }
      return { line: rowToBomLine(r, 'door', dims.count) }
    }
    case 'uform_drawer_auto': {
      const widthRaw = ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode) ?? NaN)
      if (!Number.isFinite(widthRaw) || widthRaw <= 0) return { line: null }
      const leafW = doorDimsForUnit(widthRaw, { doubleDoorMinWidthMm: 9999 }).widthMm
      const r = pickUformDoor(ctx.pool, ctx.doorRange, resolver.drawer_height_mm, leafW, true)
      if (!r) {
        return {
          line: null,
          warning: `No UFORM drawer front ${resolver.drawer_height_mm}×${leafW} for ${ctx.doorRange}`,
        }
      }
      return { line: rowToBomLine(r, 'drawer', resolver.quantity) }
    }
    default:
      return { line: null }
  }
}

export interface ComputeDraftBomOptions {
  templates?: CompleteUnitBomTemplate[]
  hingeBrand?: HingeBrand | null
  allRows: PricelistWorkbenchRow[]
}

/** Compute and return a draft BOM for one Tealbury complete unit (does not mutate row). */
export function computeDraftBom(
  completeRow: PricelistWorkbenchRow,
  opts: ComputeDraftBomOptions,
): { bom: WorkbenchBom | null; error: string | null } {
  const tradeCode = completeRow.trade_code?.trim() || completeRow.sku.replace(/\s*·.*/, '').trim()
  const section = completeRow.section?.trim() ?? ''
  const doorRange = completeRow.door_range?.trim() ?? ''
  const template = matchBomTemplate(tradeCode, section, opts.templates)
  if (!template) {
    return {
      bom: null,
      error: `No BOM template for trade “${tradeCode}” / section “${section}”.`,
    }
  }

  const pool = buildDraftComponentPool(opts.allRows)
  const unitWidthMm = unitWidthMmFromWorkbenchRow(completeRow)
  const warnings: string[] = []
  const lines: WorkbenchBomLine[] = []

  for (const def of template.lines) {
    const resolved = resolveDraftLine(def, {
      pool,
      tradeCode,
      doorRange,
      unitWidthMm,
      hingeBrand: opts.hingeBrand,
    })
    if (!resolved) continue
    if (!resolved.line) {
      if (resolved.warning) warnings.push(resolved.warning)
      continue
    }
    lines.push(resolved.line)
  }

  if (lines.length === 0) {
    return {
      bom: null,
      error: 'No BOM lines resolved — check Lamtek carcass SKUs (B40, B100…) and UFORM doors in the draft.',
    }
  }

  return {
    bom: {
      templateId: template.id,
      computedAt: new Date().toISOString(),
      warnings,
      lines,
    },
    error: null,
  }
}

/** Apply hinge brand swap to an existing draft BOM (hinge + hinge_plate lines only). */
export function applyHingeBrandToDraftBom(
  bom: WorkbenchBom,
  hingeBrand: HingeBrand,
  pool: DraftComponentPool,
): WorkbenchBom {
  const lines = bom.lines.map((line) => {
    if (line.component_role !== 'hinge' && line.component_role !== 'hinge_plate') return line
    const replacement = pickByPartType(pool, line.component_role, hingeBrand)
    if (!replacement) return line
    return rowToBomLine(replacement, line.component_role, line.quantity)
  })
  return { ...bom, lines }
}

export function roleLabel(code: string): string {
  return ASSEMBLY_COMPONENT_ROLE_LABELS[code] ?? code
}

/** After publish: create assembly + lines from draft BOM using live product IDs. */
export async function materializeWorkbenchBomOnPublish(params: {
  completeProductId: string
  bom: WorkbenchBom
  skuToProductId: Map<string, string>
  replaceExisting?: boolean
}): Promise<{ linesAdded: number; warnings: string[] }> {
  const { completeProductId, bom, skuToProductId, replaceExisting = true } = params
  const warnings = [...bom.warnings]
  let linesAdded = 0

  const { data: product } = await supabase.from('products').select('*').eq('id', completeProductId).single()
  if (!product) {
    warnings.push('Complete product not found for BOM materialize.')
    return { linesAdded: 0, warnings }
  }

  const { assemblyId, error: asmErr } = await ensureAssemblyForProduct(product)
  if (asmErr || !assemblyId) {
    warnings.push(asmErr ?? 'Could not create assembly.')
    return { linesAdded: 0, warnings }
  }

  if (replaceExisting) {
    await supabase.from('assembly_lines').delete().eq('assembly_id', assemblyId)
  }

  let sort = 1
  for (const line of bom.lines) {
    const productId = skuToProductId.get(line.component_sku.trim().toLowerCase())
    if (!productId) {
      warnings.push(`Component SKU not published: ${line.component_sku}`)
      continue
    }
    const { error } = await addAssemblyLine({
      assemblyId,
      productId,
      quantity: line.quantity,
      componentRole: line.component_role,
      sortOrder: sort++,
    })
    if (error) warnings.push(`${line.component_sku}: ${error}`)
    else linesAdded++
  }

  return { linesAdded, warnings }
}
