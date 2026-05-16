/**
 * Parse Tealbury pricelist XLSX for admin import.
 *
 * 1) **Tealbury customer draft** (Tom / Tealbury workbook): per-sheet tables with
 *    `CODE`, `H (MM)`, `W (MM)`, `D (MM)`, `PRICE`. The **Pricelist** sheet is usually a hub
 *    (dropdown + INDIRECT/VLOOKUP into other sheets). When the workbook also contains those
 *    **range sheets** (e.g. No Doors, Oakham Soft Matte), we skip the hub and import each range
 *    sheet separately: storage SKU becomes `CODE · SheetName`, display name gets `(SheetName)`,
 *    and `options.tealbury_trade_code` / `tealbury_door_range` preserve the workbook code and door range.
 * 2) **Lamtek trade layout** (legacy): kitchen Code/Size/Description + finish columns; bedroom Code/Description + finishes.
 */
import * as XLSX from 'xlsx'
import type { Json } from '@/types/database'

const COST_FACTOR = 0.75

export interface TealburyParsedRow {
  sku: string
  name: string
  description: string
  categoryName: string
  unitPrice: number
  cost_price: number
  options: Record<string, Json>
}

export function slugifyCategorySegment(name: string): string {
  if (!name || typeof name !== 'string') return 'general'
  const s = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/…+|\.{3,}/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return s || 'general'
}

function trimCell(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v).replace(/\u00a0/g, ' ').trim()
}

function parsePrice(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(v * 100) / 100
  const n = parseFloat(String(v).replace(/,/g, '').replace(/£/g, '').trim())
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}

function looksLikeKitchenHeader(row: unknown[]) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  const c2 = trimCell(row[2]).toLowerCase()
  return c0 === 'code' && c1.includes('size') && (c2 === 'description' || c2.includes('escription'))
}

function looksLikeBedroomHeader(row: unknown[]) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  return c0 === 'code' && c1.includes('description')
}

function looksLikeTocSectionKitchen(row: unknown[]) {
  const c0 = trimCell(row[0])
  const c1 = trimCell(row[1])
  const c2 = trimCell(row[2])
  return !c0 && !c1 && c2.includes('…') && c2.length > 12
}

function looksLikeTocSectionBedroom(row: unknown[]) {
  const c4 = trimCell(row[4] || '')
  return c4.includes('…') && c4.length > 15 && !trimCell(row[0])
}

function isLikelySku(s: string): boolean {
  if (!s || s.length > 48) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-]*$/i.test(s)
}

/** Tealbury customer workbook SKUs (e.g. B50D(2), CBD80). */
function isLikelyTealburyCustomerSku(s: string): boolean {
  if (!s || s.length > 56) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-()]*$/i.test(s)
}

function shouldSkipTealburyAuxSheet(sheetName: string, data: unknown[][]): boolean {
  if (!/^sheet1$/i.test(sheetName)) return false
  const nonempty = data.filter((r) => Array.isArray(r) && r.some((c) => trimCell(c)))
  if (nonempty.length > 30) return false
  return nonempty.every((r) => {
    const row = r as unknown[]
    const cells = row.map((c) => trimCell(c)).filter(Boolean)
    return cells.length <= 2 && cells.every((t) => /^PG\d+$/i.test(t) || /^[A-Z]{2,4}\d*$/i.test(t))
  })
}

/** Hub sheet: live prices depend on dropdown; static prices live on per-range sheets. */
function isTealburyPricelistHubSheet(sheetName: string): boolean {
  return /^pricelist$/i.test(sheetName.trim())
}

/**
 * When the workbook has both the Pricelist hub and one or more range sheets, skip importing the hub.
 * When only the hub exists, import it once (no door-range suffix).
 */
export function tealburySkipPricelistHub(productiveSheetNames: string[]): boolean {
  if (productiveSheetNames.length < 2) return false
  return productiveSheetNames.some((n) => isTealburyPricelistHubSheet(n))
}

/** Whether to append door/range (sheet title) to SKU + name for customer-matrix rows on this sheet. */
export function tealburyShouldAppendDoorRange(
  sheetName: string,
  productiveSheetNames: string[],
  skipPricelistHub: boolean
): boolean {
  if (isTealburyPricelistHubSheet(sheetName)) return false
  if (skipPricelistHub) return true
  if (productiveSheetNames.length > 1) return true
  return productiveSheetNames.length === 1
}

function buildTealburyStorageSku(tradeCode: string, sheetName: string): string {
  const s = `${tradeCode} · ${sheetName}`.replace(/\s{2,}/g, ' ').trim()
  return s.length > 200 ? s.slice(0, 200) : s
}

function augmentCustomerRowWithDoorRange(row: TealburyParsedRow, sheetName: string): TealburyParsedRow {
  const tradeCode = row.sku
  return {
    ...row,
    sku: buildTealburyStorageSku(tradeCode, sheetName),
    name: `${row.name} (${sheetName})`.slice(0, 300),
    options: {
      ...row.options,
      tealbury_trade_code: tradeCode,
      tealbury_door_range: sheetName,
    },
  }
}

function priceVariantLabelForCustomerSheet(sheetName: string, data: unknown[][]): string {
  if (/^pricelist$/i.test(sheetName)) return 'Pricelist'
  for (let ri = 0; ri < Math.min(4, data.length); ri++) {
    const row = data[ri]
    if (!Array.isArray(row)) continue
    const joined = row.map((c) => trimCell(c)).join(' ')
    if (!/SELECT PRICE GROUP/i.test(joined) && !/SELECT DOOR/i.test(joined)) continue
    for (let c = row.length - 1; c >= 0; c--) {
      const t = trimCell(row[c])
      if (!t || t.length > 36) continue
      if (/^SELECT\b/i.test(t)) continue
      if (t === '>' || /^nett\b/i.test(t)) continue
      return `${sheetName} — ${t}`
    }
  }
  return sheetName
}

type TealburyCustomerColMap = { code: number; price: number; h: number; w: number; d: number; desc: number }

function mapTealburyCustomerHeaderRow(row: unknown[]): TealburyCustomerColMap | null {
  let code = -1
  let price = -1
  let h = -1
  let w = -1
  let d = -1
  for (let i = 0; i < row.length; i++) {
    const t = trimCell(row[i]).toLowerCase()
    if (t === 'code') code = i
    else if (t === 'price' || t === 'nett price' || t === 'unit price' || t === 'net price') price = i
    else if (t.includes('h') && t.includes('mm')) h = i
    else if (t.includes('w') && t.includes('mm')) w = i
    else if (t.includes('d') && t.includes('mm')) d = i
  }
  if (code < 0 || price < 0) return null
  // Tealbury customer tables always carry at least one H/W/D (mm) dimension column. The Lamtek
  // workbook uses a freeform "Size" column and a single "Price" column with no mm-labelled
  // dimensions; without this guard those headers would shadow the multi-finish kitchen parser.
  if (h < 0 && w < 0 && d < 0) return null
  const desc = code > 0 ? code - 1 : -1
  return { code, price, h, w, d, desc }
}

function sectionFromCustomerHeaderRow(row: unknown[], codeCol: number): string {
  const parts: string[] = []
  for (let i = 0; i < codeCol; i++) {
    const t = trimCell(row[i])
    if (!t) continue
    const low = t.toLowerCase()
    if (low === 'code') continue
    if (/^select\b/i.test(low)) continue
    parts.push(t)
  }
  const s = parts.join(' — ').replace(/\s+/g, ' ').trim().slice(0, 200)
  return s || 'Tealbury catalogue'
}

/** Tealbury "Customer Copy" style: CODE / H/W/D / PRICE blocks (one price column per sheet). */
function parseTealburyCustomerCatalogMatrix(
  data: unknown[][],
  sheetName: string,
  doorRangeCtx?: { appendDoorRange: boolean }
): TealburyParsedRow[] {
  if (shouldSkipTealburyAuxSheet(sheetName, data)) return []

  const finishLabel = priceVariantLabelForCustomerSheet(sheetName, data)
  const out: TealburyParsedRow[] = []
  let colMap: TealburyCustomerColMap | null = null
  let section = 'Tealbury catalogue'

  for (let r = 0; r < data.length; r++) {
    const line = data[r]
    if (!Array.isArray(line)) continue

    const hdr = mapTealburyCustomerHeaderRow(line)
    if (hdr) {
      colMap = hdr
      section = sectionFromCustomerHeaderRow(line, hdr.code)
      continue
    }

    if (!colMap) continue

    const code = trimCell(line[colMap.code])
    if (!code || !isLikelyTealburyCustomerSku(code)) continue

    const p = parsePrice(line[colMap.price])
    if (p == null || p <= 0) continue

    const descCol = colMap.desc >= 0 ? colMap.desc : -1
    const desc = descCol >= 0 ? trimCell(line[descCol]) : ''
    const hm = colMap.h >= 0 ? trimCell(line[colMap.h]) : ''
    const wm = colMap.w >= 0 ? trimCell(line[colMap.w]) : ''
    const dm = colMap.d >= 0 ? trimCell(line[colMap.d]) : ''
    const dims = [hm && `H ${hm}mm`, wm && `W ${wm}mm`, dm && `D ${dm}mm`].filter(Boolean).join(', ')
    const name = [code, desc ? desc.slice(0, 160) : null].filter(Boolean).join(' — ').slice(0, 300)
    const description = [`Section: ${section}`, desc ? `Item: ${desc}` : null, dims ? `Dimensions: ${dims}` : null]
      .filter(Boolean)
      .join('\n')

    let parsed: TealburyParsedRow = {
      sku: code,
      name,
      description,
      categoryName: section,
      unitPrice: p,
      cost_price: Math.round(p * COST_FACTOR * 100) / 100,
      options: {
        tealbury_layout: 'customer_code_hwmm_price',
        tealbury_source_sheet: sheetName,
        tealbury_sections: [section],
        tealbury_finish_prices_gbp: { [finishLabel]: p },
        tealbury_dims_mm: { h: hm || null, w: wm || null, d: dm || null },
      },
    }
    if (doorRangeCtx?.appendDoorRange) parsed = augmentCustomerRowWithDoorRange(parsed, sheetName)
    out.push(parsed)
  }

  return out
}

function finalizeTealburyRowPricing(row: TealburyParsedRow): TealburyParsedRow {
  const fp =
    ((row.options.tealbury_finish_prices_gbp ?? row.options.lamtek_finish_prices_gbp) as Record<string, number>) || {}
  const keys = Object.keys(fp)
  const pricelistKey = keys.find((k) => k === 'Pricelist' || k.startsWith('Pricelist'))
  const vals = Object.values(fp).filter((n) => typeof n === 'number' && n > 0)
  const unit =
    pricelistKey != null && fp[pricelistKey] != null && fp[pricelistKey]! > 0
      ? fp[pricelistKey]!
      : vals.length
        ? Math.min(...vals)
        : row.unitPrice
  const u = Math.round(unit * 100) / 100
  return {
    ...row,
    unitPrice: u,
    cost_price: Math.round(u * COST_FACTOR * 100) / 100,
  }
}

function buildKitchenTableFromHeader(row: unknown[]) {
  const finishCols: { label: string; col: number }[] = []
  for (let c = 3; c < Math.min(row.length, 48); c++) {
    const lab = trimCell(row[c])
    if (!lab || lab.length > 60) continue
    if (/^[\d.£]+$/.test(lab)) continue
    if (!/[a-z]/i.test(lab)) continue
    finishCols.push({ label: lab, col: c })
  }
  return { code: 0, size: 1, desc: 2, finishCols }
}

function cleanSectionTitle(raw: string): string {
  return (raw || '')
    .replace(/…+|\.{3,}/g, '')
    .replace(/^[\s_\-•]+/, '')
    .replace(/[\s_\-•]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200)
    .trim()
}

function looksLikeInlineSectionBanner(row: unknown[]): boolean {
  const c0 = trimCell(row[0])
  if (!c0 || c0.length < 6 || c0.length > 120) return false
  const c1 = trimCell(row[1])
  const c2 = trimCell(row[2])
  const c3 = trimCell(row[3])
  if (c1 || c2 || c3) return false
  if (parsePrice(c0) != null) return false
  if (!c0.includes(' ')) return false
  const letters = c0.replace(/[^A-Za-z]/g, '')
  if (!letters.length) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.75) return false
  return true
}

/** Kitchen-style table, or bedroom-shaped header inside a Lamtek kitchen sheet (size col unused). */
type KitchenFlowTable =
  | ReturnType<typeof buildKitchenTableFromHeader>
  | { code: 0; size: -1; desc: 1; finishCols: { label: string; col: number }[] }

function parseKitchenMatrix(data: unknown[][], sheetLabel: string): TealburyParsedRow[] {
  const bySku = new Map<string, TealburyParsedRow>()
  let section = 'Lamtek kitchen'
  let table: KitchenFlowTable | null = null
  let firstTocEntry: string | null = null
  let firstKitchenHeaderSeen = false

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionKitchen(row)) {
      const t = cleanSectionTitle(trimCell(row[2]))
      const isMeta = /specification|important inform|introduction|^contents$/i.test(t)
      if (t && !firstTocEntry && !isMeta) firstTocEntry = t
      if (!isMeta) section = t
      table = null
      continue
    }

    if (looksLikeInlineSectionBanner(row)) {
      section = cleanSectionTitle(trimCell(row[0]))
      continue
    }

    if (looksLikeKitchenHeader(row)) {
      table = buildKitchenTableFromHeader(row)
      if (!firstKitchenHeaderSeen) {
        firstKitchenHeaderSeen = true
        if (firstTocEntry) section = firstTocEntry
      }
      continue
    }

    if (looksLikeBedroomHeader(row)) {
      const sample = data[r + 1]
      const finishCols: { label: string; col: number }[] = []
      for (let c = 2; c < Math.min(row.length, 48); c++) {
        const lab = trimCell(row[c])
        if (!lab || lab.length > 60) continue
        if (/^[\d.£]+$/.test(lab)) continue
        if (!/[a-z]/i.test(lab)) continue
        if (/^(code|description)$/i.test(lab)) continue
        if (!Array.isArray(sample) || parsePrice(sample[c]) == null) continue
        finishCols.push({ label: lab, col: c })
      }
      table = { code: 0, size: -1, desc: 1, finishCols }
      continue
    }

    if (!table) continue

    if (!trimCell(row[table.code]) && trimCell(row[table.desc]).includes('…') && trimCell(row[table.desc]).length > 18) {
      section = cleanSectionTitle(trimCell(row[table.desc]))
      table = null
      continue
    }

    const code = trimCell(row[table.code])
    if (!code || !isLikelySku(code)) continue

    const size = table.size >= 0 ? trimCell(row[table.size]) : ''
    const desc = trimCell(row[table.desc])
    const finishPrices: Record<string, number> = {}
    for (const f of table.finishCols) {
      const p = parsePrice(row[f.col])
      if (p != null && p > 0) finishPrices[f.label] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const prices = Object.values(finishPrices)
    const unitPrice = Math.min(...prices)
    const name = [code, size || null, desc ? desc.slice(0, 120) : null].filter(Boolean).join(' — ').slice(0, 300)
    const description = [`Section: ${section}`, desc ? `Specification: ${desc}` : null, size ? `Size: ${size}` : null]
      .filter(Boolean)
      .join('\n')

    const baseOpts = {
      lamtek_sheet: 'kitchen',
      lamtek_source_sheet: sheetLabel,
      lamtek_sections: [section],
      lamtek_finish_prices_gbp: finishPrices,
      lamtek_sizes: size ? [size] : [],
    } satisfies Record<string, Json>

    if (bySku.has(code)) {
      const prev = bySku.get(code)!
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      const prevFin = (prev.options.lamtek_finish_prices_gbp as Record<string, number>) || {}
      prev.options = {
        ...prev.options,
        lamtek_finish_prices_gbp: { ...prevFin, ...finishPrices },
        lamtek_sections: [...new Set([...((prev.options.lamtek_sections as string[]) || []), section])],
        lamtek_sizes: [...new Set([...((prev.options.lamtek_sizes as string[]) || []), ...(size ? [size] : [])])],
      }
    } else {
      bySku.set(code, {
        sku: code,
        name,
        description,
        categoryName: section,
        unitPrice,
        cost_price: Math.round(unitPrice * COST_FACTOR * 100) / 100,
        options: { ...baseOpts },
      })
    }
  }

  return [...bySku.values()].map((p) => ({
    ...p,
    cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100,
  }))
}

function parseBedroomMatrix(data: unknown[][], sheetLabel: string): TealburyParsedRow[] {
  const bySku = new Map<string, TealburyParsedRow>()
  let section = 'Lamtek bedroom'
  let hdr: { labels: string[]; cols: number[] } | null = null

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionBedroom(row)) {
      section = trimCell(row[4])
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      hdr = null
      continue
    }

    const cD = trimCell(row[4] || '')
    if (!trimCell(row[0]) && cD.includes('…') && cD.length > 22) {
      section = cD
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      hdr = null
      continue
    }

    if (looksLikeBedroomHeader(row)) {
      const sample = data[r + 1]
      const cols: number[] = []
      const labels: string[] = []
      for (let c = 2; c < row.length; c++) {
        const h = trimCell(row[c])
        if (!h || h.length > 140) continue
        const low = h.toLowerCase()
        if (low === 'code' || low === 'description') continue
        if (!Array.isArray(sample) || parsePrice(sample[c]) == null) continue
        cols.push(c)
        labels.push(h)
      }
      hdr = { cols, labels }
      continue
    }

    if (!hdr || !hdr.cols.length) continue

    const code = trimCell(row[0])
    const desc = trimCell(row[1])
    if (!code || !isLikelySku(code)) continue

    const finishPrices: Record<string, number> = {}
    for (let i = 0; i < hdr.cols.length; i++) {
      const col = hdr.cols[i]
      const lab = hdr.labels[i] || `Finish ${col}`
      const p = parsePrice(row[col])
      if (typeof p === 'number' && p > 0) finishPrices[lab] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const unitPrice = Math.min(...Object.values(finishPrices))
    const name = [code, desc ? desc.slice(0, 200) : null].filter(Boolean).join(' — ').slice(0, 300)
    const description = [`Section: ${section}`, desc ? `Specification: ${desc}` : null].filter(Boolean).join('\n')

    const baseOpts = {
      lamtek_sheet: 'bedroom',
      lamtek_source_sheet: sheetLabel,
      lamtek_sections: [section],
      lamtek_finish_prices_gbp: finishPrices,
    } satisfies Record<string, Json>

    if (bySku.has(code)) {
      const prev = bySku.get(code)!
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      const prevFin = (prev.options.lamtek_finish_prices_gbp as Record<string, number>) || {}
      prev.options = {
        ...prev.options,
        lamtek_finish_prices_gbp: { ...prevFin, ...finishPrices },
        lamtek_sections: [...new Set([...((prev.options.lamtek_sections as string[]) || []), section])],
      }
    } else {
      bySku.set(code, {
        sku: code,
        name,
        description,
        categoryName: section,
        unitPrice,
        cost_price: Math.round(unitPrice * COST_FACTOR * 100) / 100,
        options: { ...baseOpts },
      })
    }
  }

  return [...bySku.values()].map((p) => ({
    ...p,
    cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100,
  }))
}

function mergeBySku(rows: TealburyParsedRow[], warnings: string[]): TealburyParsedRow[] {
  const bySku = new Map<string, TealburyParsedRow>()
  for (const row of rows) {
    const code = row.sku
    if (!bySku.has(code)) {
      bySku.set(code, { ...row, options: { ...row.options } })
      continue
    }
    warnings.push(`Duplicate SKU merged: ${code}`)
    const k = bySku.get(code)!
    k.description = `${k.description}\n---\n${row.description}`
    k.unitPrice = Math.min(k.unitPrice, row.unitPrice)
    k.cost_price = Math.round(k.unitPrice * COST_FACTOR * 100) / 100
    const kFin =
      (k.options.tealbury_finish_prices_gbp as Record<string, number> | undefined) ??
      (k.options.lamtek_finish_prices_gbp as Record<string, number> | undefined) ??
      {}
    const rFin =
      (row.options.tealbury_finish_prices_gbp as Record<string, number> | undefined) ??
      (row.options.lamtek_finish_prices_gbp as Record<string, number> | undefined) ??
      {}
    const finishKey = k.options.tealbury_finish_prices_gbp != null ? 'tealbury_finish_prices_gbp' : 'lamtek_finish_prices_gbp'
    const sectionKey = k.options.tealbury_sections != null ? 'tealbury_sections' : 'lamtek_sections'
    const sizeKey = k.options.tealbury_sizes != null ? 'tealbury_sizes' : 'lamtek_sizes'
    k.options = {
      ...k.options,
      ...row.options,
      [finishKey]: { ...kFin, ...rFin },
      [sectionKey]: [
        ...new Set([
          ...(((k.options[sectionKey] as string[]) || []) as string[]),
          ...(((row.options[sectionKey] as string[]) || []) as string[]),
        ]),
      ],
      [sizeKey]: [
        ...new Set([
          ...(((k.options[sizeKey] as string[]) || []) as string[]),
          ...(((row.options[sizeKey] as string[]) || []) as string[]),
        ]),
      ],
    }
  }
  return [...bySku.values()]
}

export function parseTealburyPricelistWorkbook(buf: ArrayBuffer): { rows: TealburyParsedRow[]; warnings: string[] } {
  const warnings: string[] = []
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const collected: TealburyParsedRow[] = []

  const sheetPayloads: { sheetName: string; data: unknown[][] }[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
    sheetPayloads.push({ sheetName, data })
  }

  const customerRowCounts = new Map<string, number>()
  for (const { sheetName, data } of sheetPayloads) {
    if (shouldSkipTealburyAuxSheet(sheetName, data)) {
      customerRowCounts.set(sheetName, 0)
      continue
    }
    customerRowCounts.set(sheetName, parseTealburyCustomerCatalogMatrix(data, sheetName).length)
  }

  const productiveCustomerSheets = sheetPayloads
    .filter(({ sheetName, data }) => (customerRowCounts.get(sheetName) ?? 0) > 0 && !shouldSkipTealburyAuxSheet(sheetName, data))
    .map((s) => s.sheetName)

  const skipPricelistHub = tealburySkipPricelistHub(productiveCustomerSheets)

  for (const { sheetName, data } of sheetPayloads) {
    if (shouldSkipTealburyAuxSheet(sheetName, data)) continue

    const customerCount = customerRowCounts.get(sheetName) ?? 0
    if (customerCount > 0) {
      if (skipPricelistHub && isTealburyPricelistHubSheet(sheetName)) {
        warnings.push(
          `Sheet "${sheetName}": skipped (workbook hub with INDIRECT/VLOOKUP). Imported static prices from per-range sheets instead.`
        )
        continue
      }
      const appendDoorRange = tealburyShouldAppendDoorRange(sheetName, productiveCustomerSheets, skipPricelistHub)
      const customer = parseTealburyCustomerCatalogMatrix(data, sheetName, { appendDoorRange })
      collected.push(...customer)
      continue
    }

    const kitchen = parseKitchenMatrix(data, sheetName)
    const bedroom = parseBedroomMatrix(data, sheetName)
    if (kitchen.length) collected.push(...kitchen)
    if (bedroom.length) collected.push(...bedroom)
    if (!kitchen.length && !bedroom.length) {
      warnings.push(
        `Sheet "${sheetName}": no Tealbury customer tables (CODE / H (MM) / PRICE) or Lamtek kitchen/bedroom tables detected.`
      )
    }
  }

  const merged = mergeBySku(collected, warnings)
  const rows = merged.map(finalizeTealburyRowPricing)
  return { rows, warnings }
}
