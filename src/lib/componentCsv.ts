/**
 * Component CSV / XLSX round-trip for the component-first catalogue rebuild.
 *
 * Columns (header row required, case-insensitive on import):
 *   sku             unique component code, e.g. 1000-HL-B-WHI
 *   name            human-friendly name
 *   description     free text (optional)
 *   part_type       assembly_part_types.code (carcass, door, hinge, plinth, …)
 *   categories      pipe-separated category names, e.g. "Base units|Dawson"
 *   range           door-range name (optional; must exist as category_kind=door_range)
 *   unit_price      sell price, GBP
 *   cost_price      cost from supplier, GBP (optional)
 *   stock_quantity  on-hand qty (default 0)
 *   is_stock        TRUE/FALSE (default TRUE)
 *   active          TRUE/FALSE (default TRUE)
 */

import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type {
  AssemblyPartTypeRow,
  CategoryRow,
  ProductRow,
} from '@/types/database'

export const COMPONENT_HEADERS = [
  'sku',
  'name',
  'description',
  'part_type',
  'categories',
  'range',
  'unit_price',
  'cost_price',
  'stock_quantity',
  'is_stock',
  'active',
] as const

export type ComponentHeader = (typeof COMPONENT_HEADERS)[number]

export interface ComponentRow {
  sku: string
  name: string
  description: string
  part_type: string
  categories: string
  range: string
  unit_price: number
  cost_price: number | null
  stock_quantity: number
  is_stock: boolean
  active: boolean
}

export interface ParsedComponentRow extends ComponentRow {
  rowNumber: number
}

// ── Export ────────────────────────────────────────────────────────────────

export function buildComponentExportRows(
  products: ProductRow[],
  categories: CategoryRow[],
  productCategoryMap: Map<string, string[]>
): ComponentRow[] {
  const catById = new Map(categories.map((c) => [c.id, c]))
  return products.map((p) => {
    const linkedIds = productCategoryMap.get(p.id) ?? (p.category_id ? [p.category_id] : [])
    const linkedCats = linkedIds.map((id) => catById.get(id)).filter((c): c is CategoryRow => !!c)
    const rangeCat = linkedCats.find((c) => c.category_kind === 'door_range')
    const nonRange = linkedCats.filter((c) => c.id !== rangeCat?.id)
    return {
      sku: p.sku ?? '',
      name: p.name ?? '',
      description: p.description ?? '',
      part_type: p.part_type ?? '',
      categories: nonRange.map((c) => c.name).join('|'),
      range: rangeCat?.name ?? '',
      unit_price: Number(p.unit_price ?? 0),
      cost_price: p.cost_price != null ? Number(p.cost_price) : null,
      stock_quantity: Number(p.stock_quantity ?? 0),
      is_stock: p.is_stock !== false,
      active: p.active !== false,
    }
  })
}

function rowToCells(r: ComponentRow): (string | number)[] {
  return [
    r.sku,
    r.name,
    r.description,
    r.part_type,
    r.categories,
    r.range,
    r.unit_price,
    r.cost_price ?? '',
    r.stock_quantity,
    r.is_stock ? 'TRUE' : 'FALSE',
    r.active ? 'TRUE' : 'FALSE',
  ]
}

function escapeCsvCell(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadComponentCsv(
  rows: ComponentRow[],
  filename = `components-${new Date().toISOString().slice(0, 10)}.csv`
) {
  const header = (COMPONENT_HEADERS as readonly string[]).map(escapeCsvCell).join(',')
  const lines = rows.map((r) => rowToCells(r).map(escapeCsvCell).join(','))
  const blob = new Blob(['\uFEFF' + [header, ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadComponentXlsx(
  rows: ComponentRow[],
  filename = `components-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const aoa: (string | number)[][] = [
    [...COMPONENT_HEADERS] as string[],
    ...rows.map((r) => rowToCells(r)),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Components')
  XLSX.writeFile(wb, filename)
}

export function downloadComponentTemplateXlsx() {
  const example: ComponentRow[] = [
    {
      sku: '1000-HL-B-WHI',
      name: '1000 HL Base Carcass (White)',
      description: 'Lamtek HL base carcass, 1000mm, white finish.',
      part_type: 'carcass',
      categories: 'Base units',
      range: '',
      unit_price: 55,
      cost_price: 32,
      stock_quantity: 0,
      is_stock: true,
      active: true,
    },
    {
      sku: '1000-DOOR-DAW-WHI',
      name: '1000mm Door (Dawson, White)',
      description: 'Dawson shaker door, 1000mm, painted white.',
      part_type: 'door',
      categories: 'Doors',
      range: 'Dawson',
      unit_price: 95,
      cost_price: 47.5,
      stock_quantity: 0,
      is_stock: true,
      active: true,
    },
  ]
  downloadComponentXlsx(example, 'components-template.xlsx')
}

// ── Parse ────────────────────────────────────────────────────────────────

function normaliseHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  if (['1', 'true', 't', 'yes', 'y'].includes(s)) return true
  if (['0', 'false', 'f', 'no', 'n'].includes(s)) return false
  return fallback
}

function parseNumber(value: unknown, fallback: number | null = null): number | null {
  if (value == null || value === '') return fallback
  const n = Number(String(value).replace(/[£,]/g, '').trim())
  return Number.isFinite(n) ? n : fallback
}

export interface ParseResult {
  rows: ParsedComponentRow[]
  errors: { rowNumber: number; message: string }[]
  unknownHeaders: string[]
}

function rowsFromAoa(aoa: unknown[][]): ParseResult {
  const errors: { rowNumber: number; message: string }[] = []
  const unknownHeaders: string[] = []
  if (aoa.length === 0) return { rows: [], errors: [{ rowNumber: 0, message: 'Empty file' }], unknownHeaders }

  const rawHeaders = (aoa[0] ?? []).map((h) => normaliseHeader(String(h ?? '')))
  rawHeaders.forEach((h) => {
    if (h && !(COMPONENT_HEADERS as readonly string[]).includes(h)) unknownHeaders.push(h)
  })

  const idx = (key: ComponentHeader): number => rawHeaders.indexOf(key)
  const skuIdx = idx('sku')
  const nameIdx = idx('name')
  if (skuIdx < 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'Missing required header "sku"' }],
      unknownHeaders,
    }
  }
  if (nameIdx < 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'Missing required header "name"' }],
      unknownHeaders,
    }
  }

  const rows: ParsedComponentRow[] = []
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r || r.every((cell) => cell == null || String(cell).trim() === '')) continue

    const get = (key: ComponentHeader): string => {
      const j = idx(key)
      if (j < 0) return ''
      return String(r[j] ?? '').trim()
    }

    const sku = get('sku')
    const name = get('name')
    if (!sku) {
      errors.push({ rowNumber: i + 1, message: 'Missing sku' })
      continue
    }
    if (!name) {
      errors.push({ rowNumber: i + 1, message: 'Missing name' })
      continue
    }

    const unit_price = parseNumber(get('unit_price'), 0) ?? 0
    const cost_price = parseNumber(get('cost_price'))
    const stock_quantity = parseNumber(get('stock_quantity'), 0) ?? 0

    rows.push({
      rowNumber: i + 1,
      sku,
      name,
      description: get('description'),
      part_type: get('part_type'),
      categories: get('categories'),
      range: get('range'),
      unit_price,
      cost_price,
      stock_quantity,
      is_stock: parseBool(get('is_stock'), true),
      active: parseBool(get('active'), true),
    })
  }
  return { rows, errors, unknownHeaders }
}

export async function parseComponentFile(file: File): Promise<ParseResult> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  if (isCsv) {
    const text = await file.text()
    const wb = XLSX.read(text, { type: 'string' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return { rows: [], errors: [{ rowNumber: 0, message: 'No sheet in CSV' }], unknownHeaders: [] }
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
    return rowsFromAoa(aoa)
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { rows: [], errors: [{ rowNumber: 0, message: 'No sheet in workbook' }], unknownHeaders: [] }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  return rowsFromAoa(aoa)
}

// ── Dry-run preview ──────────────────────────────────────────────────────

export interface ImportPlanRow extends ParsedComponentRow {
  action: 'create' | 'update' | 'error'
  existingProductId: string | null
  resolvedCategoryIds: string[]
  resolvedRangeId: string | null
  errors: string[]
}

export interface ImportPlan {
  rows: ImportPlanRow[]
  totals: { create: number; update: number; error: number }
  unknownPartTypes: string[]
  unknownCategories: string[]
  unknownRanges: string[]
}

export function buildImportPlan(
  parsed: ParsedComponentRow[],
  existingProducts: ProductRow[],
  categories: CategoryRow[],
  partTypes: AssemblyPartTypeRow[]
): ImportPlan {
  const productBySku = new Map<string, ProductRow>()
  for (const p of existingProducts) {
    if (p.sku) productBySku.set(p.sku.trim().toLowerCase(), p)
  }
  const catByName = new Map<string, CategoryRow>()
  for (const c of categories) {
    catByName.set(c.name.trim().toLowerCase(), c)
  }
  const partTypeCodes = new Set(partTypes.map((t) => t.code))

  const unknownPartTypes = new Set<string>()
  const unknownCategories = new Set<string>()
  const unknownRanges = new Set<string>()

  const rows: ImportPlanRow[] = parsed.map((r) => {
    const errs: string[] = []
    let action: 'create' | 'update' | 'error' = 'create'
    const existing = productBySku.get(r.sku.trim().toLowerCase()) ?? null
    if (existing) action = 'update'

    if (r.part_type && !partTypeCodes.has(r.part_type)) {
      unknownPartTypes.add(r.part_type)
      errs.push(`Unknown part_type "${r.part_type}". Leave blank or add the part type in Settings first.`)
    }

    const resolvedCategoryIds: string[] = []
    const catNames = r.categories
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const cn of catNames) {
      const c = catByName.get(cn.toLowerCase())
      if (!c) {
        unknownCategories.add(cn)
        errs.push(`Unknown category "${cn}".`)
        continue
      }
      resolvedCategoryIds.push(c.id)
    }

    let resolvedRangeId: string | null = null
    if (r.range) {
      const c = catByName.get(r.range.trim().toLowerCase())
      if (!c) {
        unknownRanges.add(r.range)
        errs.push(`Unknown range "${r.range}".`)
      } else if (c.category_kind !== 'door_range') {
        errs.push(`"${r.range}" exists but is not a door_range category.`)
      } else {
        resolvedRangeId = c.id
        resolvedCategoryIds.push(c.id)
      }
    }

    if (errs.length > 0) action = 'error'

    return {
      ...r,
      action,
      existingProductId: existing?.id ?? null,
      resolvedCategoryIds,
      resolvedRangeId,
      errors: errs,
    }
  })

  const totals = rows.reduce(
    (acc, r) => {
      acc[r.action]++
      return acc
    },
    { create: 0, update: 0, error: 0 }
  )

  return {
    rows,
    totals,
    unknownPartTypes: [...unknownPartTypes],
    unknownCategories: [...unknownCategories],
    unknownRanges: [...unknownRanges],
  }
}

// ── Apply ────────────────────────────────────────────────────────────────

export interface ImportApplyResult {
  created: number
  updated: number
  failed: number
  failures: { sku: string; message: string }[]
}

export async function applyImportPlan(plan: ImportPlan): Promise<ImportApplyResult> {
  const result: ImportApplyResult = { created: 0, updated: 0, failed: 0, failures: [] }
  const actionable = plan.rows.filter((r) => r.action !== 'error')
  if (actionable.length === 0) return result

  // Build upsert payload. Primary `category_id` = first resolved category (or null).
  const payload = actionable.map((r) => ({
    sku: r.sku,
    name: r.name,
    description: r.description || null,
    part_type: r.part_type || null,
    category_id: r.resolvedCategoryIds[0] ?? null,
    unit_price: r.unit_price,
    cost_price: r.cost_price,
    stock_quantity: r.stock_quantity,
    is_stock: r.is_stock,
    active: r.active,
  }))

  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'sku' })
    .select('id, sku')
  if (error) {
    result.failed = actionable.length
    result.failures.push({ sku: '*', message: error.message })
    return result
  }

  const upsertedBySku = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.sku && row.id) upsertedBySku.set(row.sku, row.id)
  }

  for (const r of actionable) {
    const productId = upsertedBySku.get(r.sku)
    if (!productId) {
      result.failed += 1
      result.failures.push({ sku: r.sku, message: 'No product id returned from upsert' })
      continue
    }
    if (r.action === 'create') result.created += 1
    else result.updated += 1

    // Replace product_categories for this product to match the resolved list.
    if (r.resolvedCategoryIds.length > 0) {
      try {
        const primaryId = r.resolvedCategoryIds[0]
        const { error: rpcError } = await supabase.rpc('save_product_categories', {
          p_product_id: productId,
          p_category_ids: r.resolvedCategoryIds,
          p_primary_category_id: primaryId,
        })
        if (rpcError) {
          result.failures.push({ sku: r.sku, message: `categories: ${rpcError.message}` })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        result.failures.push({ sku: r.sku, message: `categories: ${msg}` })
      }
    }
  }

  return result
}
