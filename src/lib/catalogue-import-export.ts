/**
 * Catalogue import/export: CSV and XLSX.
 * Export columns: category_slug, category_name, name, description, sku, unit_price, active
 */

import * as XLSX from 'xlsx'
import type { CategoryRow, ProductRow } from '@/types/database'

export interface CatalogueExportRow {
  category_slug: string
  category_name: string
  name: string
  description: string
  sku: string
  unit_price: number
  active: boolean
  image_url: string
  image_alt: string
  is_stock: boolean
}

export function buildExportRows(
  products: ProductRow[],
  categories: CategoryRow[]
): CatalogueExportRow[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  return products.map((p) => {
    const cat = p.category_id ? catMap.get(p.category_id) : undefined
    return {
      category_slug: cat?.slug ?? '',
      category_name: cat?.name ?? '',
      name: p.name ?? '',
      description: p.description ?? '',
      sku: p.sku ?? '',
      unit_price: Number(p.unit_price),
      active: !!p.active,
      image_url: p.image_url ?? '',
      image_alt: p.image_alt ?? '',
      is_stock: p.is_stock !== false,
    }
  })
}

const EXPORT_HEADERS = ['category_slug', 'category_name', 'name', 'description', 'sku', 'unit_price', 'active', 'image_url', 'image_alt', 'is_stock']

function rowToCells(row: CatalogueExportRow): string[] {
  return [
    row.category_slug,
    row.category_name,
    row.name,
    row.description,
    row.sku,
    String(row.unit_price),
    row.active ? '1' : '0',
    row.image_url,
    row.image_alt,
    row.is_stock ? '1' : '0',
  ]
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(rows: CatalogueExportRow[], filename = 'catalogue-export.csv') {
  const headerLine = EXPORT_HEADERS.map(escapeCsvCell).join(',')
  const dataLines = rows.map((r) => rowToCells(r).map(escapeCsvCell).join(','))
  const blob = new Blob(['\uFEFF' + [headerLine, ...dataLines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadXlsx(rows: CatalogueExportRow[], filename = 'catalogue-export.xlsx') {
  const data = [EXPORT_HEADERS, ...rows.map((r) => rowToCells(r))]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue')
  XLSX.writeFile(wb, filename)
}

/** Full backup: Categories sheet + Catalogue sheet. Restore via Admin Catalogue import (Catalogue sheet); categories are recreated from category_slug/name. */
const CATEGORIES_HEADERS = ['name', 'slug', 'sort_order', 'parent_slug']

export function downloadFullBackupXlsx(
  categories: CategoryRow[],
  products: ProductRow[],
  filename = `inventory-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const catRows = categories.map((c) => [
    c.name ?? '',
    c.slug ?? '',
    String(c.sort_order ?? 0),
    c.parent_id ? catMap.get(c.parent_id)?.slug ?? '' : '',
  ])
  const catSheet = XLSX.utils.aoa_to_sheet([CATEGORIES_HEADERS, ...catRows])

  const productRows = buildExportRows(products, categories)
  const catalogueData = [EXPORT_HEADERS, ...productRows.map((r) => rowToCells(r))]
  const catalogueSheet = XLSX.utils.aoa_to_sheet(catalogueData)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, catalogueSheet, 'Catalogue')
  XLSX.utils.book_append_sheet(wb, catSheet, 'Categories')
  XLSX.writeFile(wb, filename)
}

// ---- Import ----

export interface CatalogueImportRow {
  category_slug: string
  category_name: string
  name: string
  description: string
  sku: string
  unit_price: number
  active: boolean
  image_url: string
  image_alt: string
  is_stock: boolean
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v ?? '').replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, '_').trim()
}

export function parseCsvFile(file: File): Promise<CatalogueImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) {
          resolve([])
          return
        }
        const headers = lines[0].split(',').map((h) => normaliseHeader(h.replace(/^"|"$/g, '').trim()))
        const rows: CatalogueImportRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i])
          const raw: Record<string, string> = {}
          headers.forEach((h, j) => {
            raw[h] = cells[j] ?? ''
          })
          const slug = (raw.category_slug ?? '').trim() || slugify(raw.category_name ?? '')
          const name = (raw.name ?? '').trim()
          if (!name) continue
          const isStockRaw = raw.is_stock ?? raw.stocked_item ?? ''
          rows.push({
            category_slug: slug,
            category_name: (raw.category_name ?? '').trim() || slug.replace(/-/g, ' '),
            name,
            description: (raw.description ?? '').trim(),
            sku: (raw.sku ?? '').trim(),
            unit_price: parseNumber(raw.unit_price),
            active: parseBool(raw.active),
            image_url: (raw.image_url ?? '').trim(),
            image_alt: (raw.image_alt ?? '').trim(),
            is_stock: isStockRaw === '' ? true : parseBool(isStockRaw),
          })
        }
        resolve(rows)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'UTF-8')
  })
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

export function parseXlsxFile(file: File): Promise<CatalogueImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const firstSheet = wb.SheetNames[0]
        if (!firstSheet) {
          resolve([])
          return
        }
        const ws = wb.Sheets[firstSheet]
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (aoa.length < 2) {
          resolve([])
          return
        }
        const headers = (aoa[0] as string[]).map((h) => normaliseHeader(String(h ?? '')))
        const rows: CatalogueImportRow[] = []
        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i] as unknown[]
          const raw: Record<string, string> = {}
          headers.forEach((h, j) => {
            raw[h] = String(row[j] ?? '').trim()
          })
          const slug = (raw.category_slug ?? '').trim() || slugify(raw.category_name ?? '')
          const name = (raw.name ?? '').trim()
          if (!name) continue
          const isStockRaw = raw.is_stock ?? raw.stocked_item ?? ''
          rows.push({
            category_slug: slug,
            category_name: (raw.category_name ?? '').trim() || slug.replace(/-/g, ' '),
            name,
            description: raw.description ?? '',
            sku: raw.sku ?? '',
            unit_price: parseNumber(raw.unit_price),
            active: parseBool(raw.active),
            image_url: (raw.image_url ?? '').trim(),
            image_alt: (raw.image_alt ?? '').trim(),
            is_stock: isStockRaw === '' ? true : parseBool(isStockRaw),
          })
        }
        resolve(rows)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

/** Result of comparing a master spreadsheet (by SKU) to the current DB products. */
export interface CatalogueAuditResult {
  /** SKUs present in the file but not in the database (missing products). */
  missingInDb: string[]
  /** SKUs present in the database but not in the file (extra/orphan products). */
  extraInDb: string[]
  /** SKUs that appear more than once in the database (duplicate product rows). */
  duplicateSkus: { sku: string; count: number; productIds: string[] }[]
  /** Total rows in file (with a non-empty SKU). */
  fileSkuCount: number
  /** Total products in DB. */
  dbProductCount: number
}

/**
 * Compare master spreadsheet rows to current DB products by SKU.
 * Use the same CSV/XLSX format as import (columns include sku, name, etc.).
 */
export function runCatalogueAudit(
  fileRows: CatalogueImportRow[],
  dbProducts: { id: string; sku: string | null }[]
): CatalogueAuditResult {
  const fileSkus = new Set<string>()
  const fileRowsBySku = new Map<string, CatalogueImportRow[]>()
  for (const row of fileRows) {
    const sku = (row.sku ?? '').trim()
    if (!sku) continue
    fileSkus.add(sku)
    const list = fileRowsBySku.get(sku) ?? []
    list.push(row)
    fileRowsBySku.set(sku, list)
  }

  const dbBySku = new Map<string, { id: string }[]>()
  for (const p of dbProducts) {
    const sku = (p.sku ?? '').trim()
    if (!sku) continue
    const list = dbBySku.get(sku) ?? []
    list.push({ id: p.id })
    dbBySku.set(sku, list)
  }

  const missingInDb: string[] = []
  for (const sku of fileSkus) {
    if (!dbBySku.has(sku)) missingInDb.push(sku)
  }
  missingInDb.sort()

  const extraInDb: string[] = []
  for (const sku of dbBySku.keys()) {
    if (!fileSkus.has(sku)) extraInDb.push(sku)
  }
  extraInDb.sort()

  const duplicateSkus: { sku: string; count: number; productIds: string[] }[] = []
  for (const [sku, list] of dbBySku) {
    if (list.length > 1) {
      duplicateSkus.push({
        sku,
        count: list.length,
        productIds: list.map((x) => x.id),
      })
    }
  }
  duplicateSkus.sort((a, b) => a.sku.localeCompare(b.sku))

  return {
    missingInDb,
    extraInDb,
    duplicateSkus,
    fileSkuCount: fileSkus.size,
    dbProductCount: dbProducts.length,
  }
}

// ---- Image mapping (CSV: sku/product_name/path + image_url) ----

export interface ImageMappingRow {
  sku?: string
  product_name?: string
  path?: string
  image_url: string
}

/** Parse CSV with columns: sku, image_url OR product_name, image_url OR path, image_url. */
export function parseImageMappingCsv(file: File): Promise<ImageMappingRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) {
          resolve([])
          return
        }
        const headers = lines[0].split(',').map((h) => normaliseHeader(h.replace(/^"|"$/g, '').trim()))
        const rows: ImageMappingRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i])
          const raw: Record<string, string> = {}
          headers.forEach((h, j) => {
            raw[h] = (cells[j] ?? '').trim()
          })
          const image_url = (raw.image_url ?? raw.url ?? '').trim()
          if (!image_url) continue
          const sku = (raw.sku ?? '').trim()
          const product_name = (raw.product_name ?? raw.name ?? raw.product ?? '').trim()
          const path = (raw.path ?? raw.file_path ?? raw.folder ?? '').trim()
          rows.push({ sku: sku || undefined, product_name: product_name || undefined, path: path || undefined, image_url })
        }
        resolve(rows)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file, 'UTF-8')
  })
}

/** Normalise string for matching: lowercase, collapse spaces. */
function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Derive product search term from path e.g. "Door Ascot MTM/Ascot Kitchen/vanilla.jpg" -> "Ascot Kitchen". */
function productNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim()
  const parts = normalized.split('/').filter(Boolean)
  const fileName = parts[parts.length - 1] ?? ''
  const withoutExt = fileName.replace(/\.[^.]+$/, '').trim()
  const folder = parts[parts.length - 2] ?? ''
  return folder || withoutExt || normalized
}

/** Simple word overlap score (0–1): share of words from search that appear in product name. */
function nameMatchScore(searchTerm: string, productName: string): number {
  const searchWords = normaliseForMatch(searchTerm).split(/\s+/).filter(Boolean)
  const productNorm = normaliseForMatch(productName)
  if (searchWords.length === 0) return 0
  let hits = 0
  for (const w of searchWords) {
    if (productNorm.includes(w)) hits++
  }
  return hits / searchWords.length
}

export interface ImageMatchResult {
  imageUrl: string
  imagePathOrName: string
  products: ProductRow[]
  status: 'matched' | 'no_match'
  suggestedName?: string
}

/**
 * Match image mapping rows to products. Uses SKU (exact), then product_name/path (name/category match).
 * threshold: 0–1; e.g. 0.8 = strict (most words must match), 0.5 = looser.
 */
export function matchImageRowsToProducts(
  products: ProductRow[],
  imageRows: ImageMappingRow[],
  threshold: number
): ImageMatchResult[] {
  const results: ImageMatchResult[] = []
  const bySku = new Map<string, ProductRow[]>()
  for (const p of products) {
    const sku = (p.sku ?? '').trim().toLowerCase()
    if (!sku) continue
    const list = bySku.get(sku) ?? []
    list.push(p)
    bySku.set(sku, list)
  }

  for (const row of imageRows) {
    const imageUrl = row.image_url
    const pathOrName = row.path ?? row.product_name ?? row.sku ?? imageUrl

    if (row.sku?.trim()) {
      const skuNorm = row.sku.trim().toLowerCase()
      const matched = bySku.get(skuNorm) ?? []
      results.push({
        imageUrl,
        imagePathOrName: pathOrName,
        products: matched,
        status: matched.length ? 'matched' : 'no_match',
        suggestedName: row.sku.trim(),
      })
      continue
    }

    const searchTerm = (row.product_name?.trim() || productNameFromPath(row.path ?? '')).trim()
    if (!searchTerm) {
      results.push({
        imageUrl,
        imagePathOrName: pathOrName,
        products: [],
        status: 'no_match',
      })
      continue
    }

    const matched: ProductRow[] = []
    for (const p of products) {
      const name = p.name ?? ''
      const score = nameMatchScore(searchTerm, name)
      if (score >= threshold) matched.push(p)
    }
    results.push({
      imageUrl,
      imagePathOrName: pathOrName,
      products: matched,
      status: matched.length ? 'matched' : 'no_match',
      suggestedName: searchTerm,
    })
  }
  return results
}
