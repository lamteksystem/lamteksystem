import { spawnSync } from 'node:child_process'
import fs from 'fs'
// We can't easily import the parser; instead, reuse it via a small wrapper.
// Simplest: temporarily monkey-patch by reading the file and adding a flag. Skip that; instead, run the importer with --dry-run and print results via a side channel.

// New approach: reimplement the categoryName grouping inline by executing the importer's parse step.
const lamtekPath = String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`

const code = `
import { fileURLToPath } from 'node:url'
const url = new URL('./import-pricelists.mjs', import.meta.url)
// Re-export the parser via dynamic import after temporarily exposing it
`
// Easier path: just invoke a tiny script that imports parseWorkbook from import-pricelists.mjs.

import('./import-pricelists.mjs').catch(() => {
  // import-pricelists.mjs is a script (calls main on import) so this won't work directly.
})

// Fallback: duplicate enough of the parser to print sections.
import * as XLSX from 'xlsx'
const buf = fs.readFileSync(lamtekPath)
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
function clean(raw) {
  return (raw || '').replace(/…+|\.{3,}/g, '').replace(/^[\s_\-•]+/, '').replace(/[\s_\-•]+$/, '').replace(/\s+/g, ' ').slice(0, 200).trim()
}
function isKitchenHdr(row) {
  const c0 = trim(row[0]).toLowerCase(), c1 = trim(row[1]).toLowerCase(), c2 = trim(row[2]).toLowerCase()
  return c0 === 'code' && c1.includes('size') && (c2 === 'description' || c2.includes('escription'))
}
function isBedroomHdr(row) {
  const c0 = trim(row[0]).toLowerCase(), c1 = trim(row[1]).toLowerCase()
  return c0 === 'code' && c1.includes('description')
}
function isToc(row) {
  const c0 = trim(row[0]), c1 = trim(row[1]), c2 = trim(row[2])
  return !c0 && !c1 && c2.includes('…') && c2.length > 12
}
function isBanner(row) {
  const c0 = trim(row[0])
  if (!c0 || c0.length < 6 || c0.length > 120) return false
  if (trim(row[1]) || trim(row[2]) || trim(row[3])) return false
  if (parsePrice(c0) != null) return false
  if (!c0.includes(' ')) return false
  const letters = c0.replace(/[^A-Za-z]/g, '')
  if (!letters.length) return false
  return letters.replace(/[^A-Z]/g, '').length / letters.length >= 0.75
}

const sections = new Map() // section -> count
let section = 'Lamtek kitchen'
let firstToc = null
let firstHdr = false
let table = null
for (let r = 0; r < data.length; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  if (isToc(row)) {
    const t = clean(trim(row[2]))
    const isMeta = /specification|important inform|introduction|^contents$/i.test(t)
    if (t && !firstToc && !isMeta) firstToc = t
    if (!isMeta) section = t
    table = null
    continue
  }
  if (isBanner(row)) { section = clean(trim(row[0])); continue }
  if (isKitchenHdr(row)) {
    table = 'kitchen'
    if (!firstHdr) { firstHdr = true; if (firstToc) section = firstToc }
    continue
  }
  if (isBedroomHdr(row)) { table = 'bedroom'; continue }
  if (!table) continue
  const code = trim(row[0])
  if (!isLikelySku(code)) continue
  sections.set(section, (sections.get(section) || 0) + 1)
}

const sorted = [...sections.entries()].sort((a, b) => b[1] - a[1])
console.log('Sections after parser fix:')
for (const [s, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${s}`)
console.log('Total sections:', sorted.length)
console.log('Total products counted:', sorted.reduce((a, b) => a + b[1], 0))
