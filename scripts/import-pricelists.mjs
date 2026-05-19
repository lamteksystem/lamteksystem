/**
 * Import Lamtek trade kitchen and / or Tealbury customer pricelists into Supabase.
 *
 * Uses the same parsing logic as `src/lib/tealburyPricelistParse.ts` (ported to plain JS):
 * - Tealbury customer workbook: Pricelist hub + per door-range sheets (No Doors, Oakham Soft Matte, …).
 *   Hub is skipped, each range sheet is imported separately and SKU becomes `CODE · SheetName`.
 * - Lamtek trade kitchen: single sheet with Code / Size / Description + finish columns and TOC section markers.
 *
 * Per-program purge: only deletes existing products with the matching `catalog_program`, so importing
 * Tealbury never wipes Lamtek and vice versa.
 *
 * Usage:
 *   node --env-file=.env scripts/import-pricelists.mjs --dry-run --tealbury "C:\...\Tealbury.xlsx"
 *   node --env-file=.env scripts/import-pricelists.mjs --yes \
 *     --lamtek   "C:\...\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx" \
 *     --tealbury "C:\...\Tealbury Pricelist Customer Copy - Draft.xlsx"
 *
 * Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const COST_FACTOR = 0.75
const CHUNK = 200

// -------- args --------

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return null
}
function argFlag(flag) {
  return process.argv.includes(flag)
}

// -------- helpers --------

function trimCell(v) {
  if (v == null || v === '') return ''
  return String(v).replace(/\u00a0/g, ' ').trim()
}

function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(v * 100) / 100
  const n = parseFloat(String(v).replace(/,/g, '').replace(/£/g, '').trim())
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}

function slugifyCategorySegment(name) {
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

function isLikelySku(s) {
  if (!s || s.length > 48) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-]*$/i.test(s)
}
function isLikelyTealburyCustomerSku(s) {
  if (!s || s.length > 56) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-()]*$/i.test(s)
}

function looksLikeKitchenHeader(row) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  const c2 = trimCell(row[2]).toLowerCase()
  return c0 === 'code' && c1.includes('size') && (c2 === 'description' || c2.includes('escription'))
}
function looksLikeBedroomHeader(row) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  return c0 === 'code' && c1.includes('description')
}
function looksLikeTocSectionKitchen(row) {
  const c0 = trimCell(row[0])
  const c1 = trimCell(row[1])
  const c2 = trimCell(row[2])
  return !c0 && !c1 && c2.includes('…') && c2.length > 12
}
function looksLikeTocSectionBedroom(row) {
  const c4 = trimCell(row[4] || '')
  return c4.includes('…') && c4.length > 15 && !trimCell(row[0])
}

function shouldSkipTealburyAuxSheet(sheetName, data) {
  if (!/^sheet1$/i.test(sheetName)) return false
  const nonempty = data.filter((r) => Array.isArray(r) && r.some((c) => trimCell(c)))
  if (nonempty.length > 30) return false
  return nonempty.every((r) => {
    const cells = r.map((c) => trimCell(c)).filter(Boolean)
    return cells.length <= 2 && cells.every((t) => /^PG\d+$/i.test(t) || /^[A-Z]{2,4}\d*$/i.test(t))
  })
}
function isTealburyPricelistHubSheet(sheetName) {
  return /^pricelist$/i.test(sheetName.trim())
}
function tealburySkipPricelistHub(productiveSheetNames) {
  if (productiveSheetNames.length < 2) return false
  return productiveSheetNames.some((n) => isTealburyPricelistHubSheet(n))
}
function tealburyShouldAppendDoorRange(sheetName, productiveSheetNames, skipPricelistHub) {
  if (isTealburyPricelistHubSheet(sheetName)) return false
  if (skipPricelistHub) return true
  if (productiveSheetNames.length > 1) return true
  return productiveSheetNames.length === 1
}

/**
 * Classify a PLAIN END PANEL into base/wall/tower/showback based on dimensions.
 *
 * The Tealbury catalogue lumps every end-panel variant under one "PLAIN END PANEL" name even
 * though the same product code can describe a tiny wall-cabinet side panel, a tower-height
 * panel, or a full-wall showback panel. The kitchen-trade convention is to read the panel
 * type from its height + width:
 *
 *   - Showback panel:  H >= 2000 AND W >= 800   (tall + wide enough to back a wall area)
 *   - Tower panel:     H >= 2000 AND W < 800    (tall but only cabinet-depth-wide)
 *   - Wall panel:      H < 1500 AND W < 500     (short, narrow — wall cabinet side)
 *   - Base panel:      H < 1500 AND W >= 500    (short, wider — base cabinet side)
 *
 * Returns "" when the desc isn't a PLAIN END PANEL or the dimensions don't classify cleanly,
 * otherwise " - SHOWBACK PANEL" etc. (note the leading " - "). Callers append it to the
 * existing `Item: <desc>` line so the augmented description looks like:
 *   Item: PLAIN END PANEL - SHOWBACK PANEL
 *   Dimensions: H 2450mm, W 910mm, D 18mm
 */
function panelSubtypeSuffix(desc, hRaw, wRaw) {
  if (!desc || !/PLAIN END PANEL/i.test(desc)) return ''
  const h = Number(hRaw)
  const w = Number(wRaw)
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return ''
  if (h >= 2000 && w >= 800) return ' - SHOWBACK PANEL'
  if (h >= 2000 && w >= 400 && w < 800) return ' - TOWER PANEL'
  if (h < 1500 && w < 500) return ' - WALL PANEL'
  if (h < 1500 && w >= 500) return ' - BASE PANEL'
  return ''
}

function buildTealburyStorageSku(tradeCode, sheetName) {
  const s = `${tradeCode} · ${sheetName}`.replace(/\s{2,}/g, ' ').trim()
  return s.length > 200 ? s.slice(0, 200) : s
}
function augmentCustomerRowWithDoorRange(row, sheetName) {
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
function priceVariantLabelForCustomerSheet(sheetName, data) {
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

function mapTealburyCustomerHeaderRow(row) {
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
  // workbook uses a freeform "Size" column (e.g. 1200mm) and a single "Price" column with no
  // mm-labelled dimensions, so without this guard we'd shadow the multi-finish kitchen parser.
  if (h < 0 && w < 0 && d < 0) return null
  const desc = code > 0 ? code - 1 : -1
  return { code, price, h, w, d, desc }
}

function sectionFromCustomerHeaderRow(row, codeCol) {
  const parts = []
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

function parseTealburyCustomerCatalogMatrix(data, sheetName, doorRangeCtx) {
  if (shouldSkipTealburyAuxSheet(sheetName, data)) return []
  const finishLabel = priceVariantLabelForCustomerSheet(sheetName, data)
  const out = []
  let colMap = null
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
    // Name is the human-readable description; SKU stays in the `sku` column. Falling back to
    // `code` only when no description exists at all (e.g. pure accessory rows).
    const name = (desc ? desc.slice(0, 160) : code).slice(0, 300)
    // Description excludes the redundant "Section: ..." line — the category column already
    // encodes that. We keep Item + Dimensions because those carry information the category
    // doesn't (item variant + measured size).
    const description = [
      desc ? `Item: ${desc}${dims ? panelSubtypeSuffix(desc, hm, wm) : ''}` : null,
      dims ? `Dimensions: ${dims}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    let parsed = {
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

function finalizeTealburyRowPricing(row) {
  const fp = row.options.tealbury_finish_prices_gbp || {}
  const keys = Object.keys(fp)
  const pricelistKey = keys.find((k) => k === 'Pricelist' || k.startsWith('Pricelist'))
  const vals = Object.values(fp).filter((n) => typeof n === 'number' && n > 0)
  const unit =
    pricelistKey != null && fp[pricelistKey] != null && fp[pricelistKey] > 0
      ? fp[pricelistKey]
      : vals.length
        ? Math.min(...vals)
        : row.unitPrice
  const u = Math.round(unit * 100) / 100
  return { ...row, unitPrice: u, cost_price: Math.round(u * COST_FACTOR * 100) / 100 }
}

function buildKitchenTableFromHeader(row) {
  const finishCols = []
  for (let c = 3; c < Math.min(row.length, 48); c++) {
    const lab = trimCell(row[c])
    if (!lab || lab.length > 60) continue
    if (/^[\d.£]+$/.test(lab)) continue
    if (!/[a-z]/i.test(lab)) continue
    finishCols.push({ label: lab, col: c })
  }
  return { code: 0, size: 1, desc: 2, finishCols }
}

function cleanSectionTitle(raw) {
  return (raw || '')
    .replace(/…+|\.{3,}/g, '')
    .replace(/^[\s_\-•]+/, '')
    .replace(/[\s_\-•]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200)
    .trim()
}

function looksLikeInlineSectionBanner(row) {
  // Section banner: col 0 has uppercase text 8..80 chars, no digits-like price, col 1/2/3 empty.
  const c0 = trimCell(row[0])
  if (!c0 || c0.length < 6 || c0.length > 120) return false
  const c1 = trimCell(row[1])
  const c2 = trimCell(row[2])
  const c3 = trimCell(row[3])
  if (c1 || c2 || c3) return false
  if (parsePrice(c0) != null) return false
  // Must contain at least one space (multi-word) and be mostly uppercase letters.
  if (!c0.includes(' ')) return false
  const letters = c0.replace(/[^A-Za-z]/g, '')
  if (!letters.length) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.75) return false
  return true
}

function parseKitchenMatrix(data, sheetLabel) {
  const bySku = new Map()
  let section = 'Lamtek kitchen'
  let table = null
  // Lamtek workbooks have a TOC at the top with every section name. We track the FIRST TOC entry
  // (e.g. "Standard Base Units") and use it as the section for products that appear before any
  // inline section banner is seen. Without this, all products before the first banner inherit
  // the LAST TOC entry seen (e.g. "Metabox Drawers"), miscategorising them.
  let firstTocEntry = null
  let firstKitchenHeaderSeen = false

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionKitchen(row)) {
      const t = cleanSectionTitle(trimCell(row[2]))
      // Filter TOC metadata entries (cover page, important info, etc.) — these aren't product sections.
      const isMeta = /specification|important inform|introduction|^contents$/i.test(t)
      if (t && !firstTocEntry && !isMeta) firstTocEntry = t
      if (!isMeta) section = t
      table = null
      continue
    }
    if (looksLikeInlineSectionBanner(row)) {
      section = cleanSectionTitle(trimCell(row[0]))
      // Keep the existing table active — the banner just changes the section label.
      continue
    }
    if (looksLikeKitchenHeader(row)) {
      table = buildKitchenTableFromHeader(row)
      if (!firstKitchenHeaderSeen) {
        firstKitchenHeaderSeen = true
        // First header has no preceding inline banner, so seed section from the first TOC entry.
        if (firstTocEntry) section = firstTocEntry
      }
      continue
    }
    if (looksLikeBedroomHeader(row)) {
      // Bedroom layout: code at col 0, description at col 1, finish prices from col 2+.
      const finishCols = []
      const sample = data[r + 1]
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

    const size = trimCell(row[table.size])
    const desc = trimCell(row[table.desc])
    const finishPrices = {}
    for (const f of table.finishCols) {
      const p = parsePrice(row[f.col])
      if (p != null && p > 0) finishPrices[f.label] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const prices = Object.values(finishPrices)
    const unitPrice = Math.min(...prices)
    // Human-friendly name: just the spec/desc (+ optional size suffix). SKU lives in `sku`.
    const namePieces = [desc ? desc.slice(0, 120) : null, size || null].filter(Boolean)
    const name = (namePieces.length ? namePieces.join(' — ') : code).slice(0, 300)
    // Drop the redundant Section: line — the category column already encodes that.
    const description = [
      desc ? `Specification: ${desc}` : null,
      size ? `Size: ${size}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const baseOpts = {
      lamtek_sheet: 'kitchen',
      lamtek_source_sheet: sheetLabel,
      lamtek_sections: [section],
      lamtek_finish_prices_gbp: finishPrices,
      lamtek_sizes: size ? [size] : [],
    }

    if (bySku.has(code)) {
      const prev = bySku.get(code)
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      prev.options.lamtek_finish_prices_gbp = { ...prev.options.lamtek_finish_prices_gbp, ...finishPrices }
      prev.options.lamtek_sections = [...new Set([...(prev.options.lamtek_sections || []), section])]
      if (size) prev.options.lamtek_sizes = [...new Set([...(prev.options.lamtek_sizes || []), size])]
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
  return [...bySku.values()].map((p) => ({ ...p, cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100 }))
}

function parseBedroomMatrix(data, sheetLabel) {
  const bySku = new Map()
  let section = 'Lamtek bedroom'
  let hdr = null

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionBedroom(row)) {
      section = trimCell(row[4]).replace(/…+/g, '').replace(/\s+/g, ' ').slice(0, 200).trim()
      hdr = null
      continue
    }

    const cD = trimCell(row[4] || '')
    if (!trimCell(row[0]) && cD.includes('…') && cD.length > 22) {
      section = cD.replace(/…+/g, '').replace(/\s+/g, ' ').slice(0, 200).trim()
      hdr = null
      continue
    }

    if (looksLikeBedroomHeader(row)) {
      const sample = data[r + 1]
      const cols = []
      const labels = []
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

    const finishPrices = {}
    for (let i = 0; i < hdr.cols.length; i++) {
      const col = hdr.cols[i]
      const lab = hdr.labels[i] || `Finish ${col}`
      const p = parsePrice(row[col])
      if (typeof p === 'number' && p > 0) finishPrices[lab] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const unitPrice = Math.min(...Object.values(finishPrices))
    // Human-friendly name from the spec, falling back to the code when there's nothing else.
    const name = (desc ? desc.slice(0, 200) : code).slice(0, 300)
    // Drop the redundant Section: line — the category column already encodes that.
    const description = desc ? `Specification: ${desc}` : ''

    if (bySku.has(code)) {
      const prev = bySku.get(code)
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      prev.options.lamtek_finish_prices_gbp = { ...prev.options.lamtek_finish_prices_gbp, ...finishPrices }
      prev.options.lamtek_sections = [...new Set([...(prev.options.lamtek_sections || []), section])]
    } else {
      bySku.set(code, {
        sku: code,
        name,
        description,
        categoryName: section,
        unitPrice,
        cost_price: Math.round(unitPrice * COST_FACTOR * 100) / 100,
        options: { lamtek_sheet: 'bedroom', lamtek_source_sheet: sheetLabel, lamtek_sections: [section], lamtek_finish_prices_gbp: finishPrices },
      })
    }
  }
  return [...bySku.values()].map((p) => ({ ...p, cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100 }))
}

function mergeBySku(rows, warnings) {
  const bySku = new Map()
  for (const row of rows) {
    const code = row.sku
    if (!bySku.has(code)) {
      bySku.set(code, { ...row, options: { ...row.options } })
      continue
    }
    warnings.push(`Duplicate SKU merged: ${code}`)
    const k = bySku.get(code)
    k.description = `${k.description}\n---\n${row.description}`
    k.unitPrice = Math.min(k.unitPrice, row.unitPrice)
    k.cost_price = Math.round(k.unitPrice * COST_FACTOR * 100) / 100
    const kFin = k.options.tealbury_finish_prices_gbp || k.options.lamtek_finish_prices_gbp || {}
    const rFin = row.options.tealbury_finish_prices_gbp || row.options.lamtek_finish_prices_gbp || {}
    const finishKey = k.options.tealbury_finish_prices_gbp ? 'tealbury_finish_prices_gbp' : 'lamtek_finish_prices_gbp'
    const sectionKey = k.options.tealbury_sections ? 'tealbury_sections' : 'lamtek_sections'
    const sizeKey = k.options.tealbury_sizes ? 'tealbury_sizes' : 'lamtek_sizes'
    k.options = {
      ...k.options,
      ...row.options,
      [finishKey]: { ...kFin, ...rFin },
      [sectionKey]: [...new Set([...(k.options[sectionKey] || []), ...(row.options[sectionKey] || [])])],
      [sizeKey]: [...new Set([...(k.options[sizeKey] || []), ...(row.options[sizeKey] || [])])],
    }
  }
  return [...bySku.values()]
}

function parseWorkbook(filepath, programHint) {
  const buf = fs.readFileSync(filepath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const warnings = []
  const collected = []

  const sheetPayloads = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    sheetPayloads.push({ sheetName, data })
  }

  const customerRowCounts = new Map()
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
        warnings.push(`Sheet "${sheetName}": skipped (hub with formulas). Imported static prices from per-range sheets.`)
        continue
      }
      const appendDoorRange = tealburyShouldAppendDoorRange(sheetName, productiveCustomerSheets, skipPricelistHub)
      collected.push(...parseTealburyCustomerCatalogMatrix(data, sheetName, { appendDoorRange }))
      continue
    }

    const kitchen = parseKitchenMatrix(data, sheetName)
    const bedroom = parseBedroomMatrix(data, sheetName)
    if (kitchen.length) collected.push(...kitchen)
    if (bedroom.length) collected.push(...bedroom)
    if (!kitchen.length && !bedroom.length) {
      warnings.push(`Sheet "${sheetName}" (${programHint}): no recognised tables.`)
    }
  }

  const merged = mergeBySku(collected, warnings)
  const rows = merged.map(finalizeTealburyRowPricing)
  return { rows, warnings }
}

// -------- DB --------

async function ensureCategoryId(supabase, name, slugPrefix) {
  // Avoid `lamtek-lamtek-...` / `tealbury-tealbury-...` slugs when the supplied name already
  // contains the program word (e.g. "Lamtek — Wall Units" or "Tealbury — Highline Base Units, Single").
  const cleanedName = cleanSectionTitle(name)
  let slugCore = slugifyCategorySegment(cleanedName)
  const programWord = slugPrefix.replace(/-$/, '')
  if (slugCore.startsWith(`${programWord}-`)) slugCore = slugCore.slice(programWord.length + 1)
  const slug = `${slugPrefix}${slugCore}`.slice(0, 80)
  const { data: existing, error: selErr } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (selErr) throw selErr
  if (existing?.id) return existing.id
  const { data: ins, error: insErr } = await supabase
    .from('categories')
    .insert({ name: cleanedName.slice(0, 200), slug, sort_order: slugPrefix === 'tealbury-' ? 520 : 200 })
    .select('id')
    .single()
  if (insErr) throw insErr
  return ins.id
}

async function purgeProgram(supabase, program) {
  console.log(`  purging existing products with catalog_program = '${program}' …`)
  const ids = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data: page, error: selErr } = await supabase
      .from('products')
      .select('id')
      .eq('catalog_program', program)
      .range(from, from + PAGE - 1)
    if (selErr) throw selErr
    if (!page?.length) break
    ids.push(...page.map((r) => r.id))
    if (page.length < PAGE) break
    from += PAGE
  }
  if (!ids.length) {
    console.log('    none to purge.')
    return
  }
  console.log(`    found ${ids.length} product(s) to remove.`)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const { error: alErr } = await supabase.from('assembly_lines').delete().in('product_id', part)
    if (alErr) throw alErr
  }
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const { error: delErr } = await supabase.from('products').delete().in('id', part)
    if (delErr) throw delErr
  }
}

async function insertProgramProducts(supabase, rows, program) {
  const slugPrefix = program === 'tealbury' ? 'tealbury-' : 'lamtek-'
  const categoryCache = new Map()
  async function catIdFor(section) {
    const k = (section || '').trim() || (program === 'tealbury' ? 'Tealbury' : 'Lamtek')
    if (categoryCache.has(k)) return categoryCache.get(k)
    let name = k
    if (program === 'tealbury' && !k.toLowerCase().startsWith('tealbury')) name = `Tealbury — ${k}`
    if (program === 'lamtek' && !k.toLowerCase().startsWith('lamtek')) name = `Lamtek — ${k}`
    const id = await ensureCategoryId(supabase, name, slugPrefix)
    categoryCache.set(k, id)
    return id
  }

  const payloads = []
  for (const row of rows) {
    const category_id = await catIdFor(row.categoryName)
    payloads.push({
      category_id,
      name: row.name,
      description: (row.description || '').slice(0, 4500),
      sku: row.sku,
      unit_price: row.unitPrice,
      cost_price: row.cost_price,
      options: { ...row.options, default_price_basis: 'lowest_finish_gbp_ex_vat' },
      active: true,
      is_stock: true,
      sort_order: 0,
      stock_quantity: 0,
      catalog_program: program,
    })
  }
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK)
    const { error: insErr } = await supabase.from('products').insert(slice)
    if (insErr) throw insErr
    process.stdout.write(`    inserted ${Math.min(i + CHUNK, payloads.length)} / ${payloads.length}\r`)
  }
  process.stdout.write('\n')
}

// -------- main --------

async function main() {
  const dryRun = argFlag('--dry-run') || argFlag('--dry')
  const yes = argFlag('--yes')
  const tealburyPath = argValue('--tealbury')
  const lamtekPath = argValue('--lamtek')

  if (!tealburyPath && !lamtekPath) {
    console.error('Specify at least one of --tealbury <path> or --lamtek <path>')
    process.exit(1)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SVC) {
    console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } })

  const programs = []
  if (lamtekPath) {
    if (!fs.existsSync(lamtekPath)) {
      console.error('Lamtek file not found:', lamtekPath)
      process.exit(1)
    }
    console.log(`Parsing Lamtek workbook: ${lamtekPath}`)
    const { rows, warnings } = parseWorkbook(lamtekPath, 'lamtek')
    console.log(`  parsed ${rows.length} product row(s), ${warnings.length} parser notice(s).`)
    if (warnings.length) warnings.slice(0, 10).forEach((w) => console.log('   !', w))
    if (rows.length) {
      console.log('  sample:')
      rows.slice(0, 5).forEach((p) => console.log('    ', p.sku, '|', p.name.slice(0, 80), '| £' + p.unitPrice))
    }
    programs.push({ program: 'lamtek', rows })
  }
  if (tealburyPath) {
    if (!fs.existsSync(tealburyPath)) {
      console.error('Tealbury file not found:', tealburyPath)
      process.exit(1)
    }
    console.log(`Parsing Tealbury workbook: ${tealburyPath}`)
    const { rows, warnings } = parseWorkbook(tealburyPath, 'tealbury')
    console.log(`  parsed ${rows.length} product row(s), ${warnings.length} parser notice(s).`)
    if (warnings.length) warnings.slice(0, 10).forEach((w) => console.log('   !', w))
    if (rows.length) {
      console.log('  sample:')
      rows.slice(0, 5).forEach((p) => console.log('    ', p.sku, '|', p.name.slice(0, 80), '| £' + p.unitPrice))
    }
    programs.push({ program: 'tealbury', rows })
  }

  if (dryRun) {
    console.log('\nDRY RUN: no changes written. Re-run with --yes to import.')
    return
  }
  if (!yes) {
    console.error('\nRefusing to write without --yes. Re-run with --yes.')
    process.exit(1)
  }

  for (const { program, rows } of programs) {
    console.log(`\n== Importing ${program} (${rows.length} products) ==`)
    await purgeProgram(supabase, program)
    await insertProgramProducts(supabase, rows, program)
    console.log(`  done: ${program}.`)
  }

  console.log('\nAll imports complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
