import fs from 'fs'
import * as XLSX from 'xlsx'

const COST_FACTOR = 0.75
const f = String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`
const buf = fs.readFileSync(f)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

function trim(v) { return v == null || v === '' ? '' : String(v).replace(/\u00a0/g, ' ').trim() }
function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(v * 100) / 100
  const n = parseFloat(String(v).replace(/,/g, '').replace(/£/g, '').trim())
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}
function isLikelySku(s) {
  if (!s || s.length > 48) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-]*$/i.test(s)
}
function looksLikeKitchenHeader(row) {
  const c0 = trim(row[0]).toLowerCase()
  const c1 = trim(row[1]).toLowerCase()
  const c2 = trim(row[2]).toLowerCase()
  return c0 === 'code' && c1.includes('size') && (c2 === 'description' || c2.includes('escription'))
}
function looksLikeBedroomHeader(row) {
  const c0 = trim(row[0]).toLowerCase()
  const c1 = trim(row[1]).toLowerCase()
  return c0 === 'code' && c1.includes('description')
}
function looksLikeTocSectionKitchen(row) {
  const c0 = trim(row[0])
  const c1 = trim(row[1])
  const c2 = trim(row[2])
  return !c0 && !c1 && c2.includes('…') && c2.length > 12
}
function buildKitchenTableFromHeader(row) {
  const finishCols = []
  for (let c = 3; c < Math.min(row.length, 48); c++) {
    const lab = trim(row[c])
    if (!lab || lab.length > 60) continue
    if (/^[\d.£]+$/.test(lab)) continue
    if (!/[a-z]/i.test(lab)) continue
    finishCols.push({ label: lab, col: c })
  }
  return { code: 0, size: 1, desc: 2, finishCols }
}

const collected = []
const skipped = { noFinishPrices: 0, noTable: 0, notSku: 0, hadFinishButZeroPrice: 0 }
const droppedSkus = []
let table = null
let section = 'Lamtek kitchen'
let totalSkuLike = 0

for (let r = 0; r < data.length; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue

  if (looksLikeTocSectionKitchen(row)) {
    section = trim(row[2]).replace(/…+/g, '').replace(/\s+/g, ' ').slice(0, 200).trim()
    table = null
    continue
  }
  if (looksLikeKitchenHeader(row)) {
    table = buildKitchenTableFromHeader(row)
    console.log(`\nHEADER R${r}: finishCols = ${JSON.stringify(table.finishCols)}`)
    continue
  }
  // also detect bedroom header so we can keep parsing
  if (looksLikeBedroomHeader(row)) {
    // treat as kitchen-shaped using cols starting at 2 (bedroom layout: code, desc, finishes from col 2)
    const finishCols = []
    for (let c = 2; c < Math.min(row.length, 48); c++) {
      const lab = trim(row[c])
      if (!lab || lab.length > 60) continue
      if (/^[\d.£]+$/.test(lab)) continue
      if (!/[a-z]/i.test(lab)) continue
      if (lab.toLowerCase() === 'description') continue
      finishCols.push({ label: lab, col: c })
    }
    table = { code: 0, size: -1, desc: 1, finishCols }
    console.log(`\nBEDROOM HEADER R${r}: finishCols = ${JSON.stringify(table.finishCols)}`)
    continue
  }

  const code = trim(row[0])
  if (!isLikelySku(code)) continue
  totalSkuLike += 1

  if (!table) {
    skipped.noTable += 1
    droppedSkus.push({ r, code, reason: 'no table' })
    continue
  }
  if (!table.finishCols.length) {
    skipped.noFinishPrices += 1
    droppedSkus.push({ r, code, reason: 'finishCols empty' })
    continue
  }
  const fp = {}
  for (const f of table.finishCols) {
    const p = parsePrice(row[f.col])
    if (p != null && p > 0) fp[f.label] = p
  }
  if (!Object.keys(fp).length) {
    skipped.hadFinishButZeroPrice += 1
    droppedSkus.push({ r, code, reason: 'no positive price in finishCols' })
    continue
  }
  const unit = Math.min(...Object.values(fp))
  collected.push({ sku: code, unit, section })
}

console.log(`\nSKU-like rows: ${totalSkuLike}`)
console.log(`Collected: ${collected.length}`)
console.log('Skipped:', skipped)
console.log('\nFirst 20 dropped SKUs:')
droppedSkus.slice(0, 20).forEach((d) => console.log(' ', d))
console.log('\nLast 20 dropped SKUs:')
droppedSkus.slice(-20).forEach((d) => console.log(' ', d))
console.log('\nUnique collected SKUs:', new Set(collected.map((c) => c.sku)).size)
