// Run the parser and dump every parsed row + count by section.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scriptPath = join(__dirname, 'import-pricelists.mjs')

// Re-import the parser bits we need. Instead, duplicate the small bits inline.
import fs from 'fs'
import * as XLSX from 'xlsx'

const f = String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`
const buf = fs.readFileSync(f)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

function trim(v) {
  return v == null || v === '' ? '' : String(v).replace(/\u00a0/g, ' ').trim()
}
function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(v * 100) / 100
  const n = parseFloat(String(v).replace(/,/g, '').replace(/£/g, '').trim())
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}

// Find ALL rows that have a SKU-like value in col 0 AND a price in col 3 (or any other column)
const candidates = []
for (let r = 0; r < data.length; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const code = trim(row[0])
  if (!code || /^code$/i.test(code)) continue
  if (!/^[A-Z0-9][A-Z0-9./\-]*$/i.test(code)) continue
  if (code.length > 30) continue
  const prices = []
  for (let c = 3; c < Math.min(row.length, 30); c++) {
    const p = parsePrice(row[c])
    if (p != null && p > 0) prices.push(`[${c}]=${p}`)
  }
  if (!prices.length) continue
  candidates.push({ r, code, size: trim(row[1]), desc: trim(row[2]), prices })
}

console.log('Total candidate data rows (col 0 = SKU-ish AND has at least one price ≥ col 3):', candidates.length)

// Dedupe by SKU
const skus = new Map()
for (const c of candidates) {
  if (!skus.has(c.code)) skus.set(c.code, [])
  skus.get(c.code).push(c)
}
console.log('Unique SKUs:', skus.size)
console.log('SKUs appearing multiple times:')
let dupCount = 0
for (const [sku, occs] of skus) {
  if (occs.length > 1) {
    dupCount++
    if (dupCount < 30) {
      console.log(`  ${sku}: ${occs.length} rows → R${occs.map((o) => o.r).join(', R')}`)
    }
  }
}
console.log(`(${dupCount} SKUs have duplicates)`)
