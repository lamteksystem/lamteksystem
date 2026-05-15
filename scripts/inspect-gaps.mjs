import fs from 'fs'
import * as XLSX from 'xlsx'

const f = String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`
const buf = fs.readFileSync(f)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
function trim(v) { return v == null || v === '' ? '' : String(v).replace(/\u00a0/g, ' ').trim() }

// Headers (rough): 110, 177, 216, 248, 314, 350, 398, 450, 506, 568, 624, 689
// Dump rows 124..180 to see what kills the table after B15
console.log('Rows 120..180:')
for (let r = 120; r <= 180; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const cells = row
    .slice(0, 12)
    .map((c, i) => (trim(c) ? `[${i}]="${trim(c).slice(0, 40)}"` : null))
    .filter(Boolean)
  if (!cells.length) continue
  console.log(`R${r}: ${cells.join(' ')}`)
}

console.log('\nRows 200..260:')
for (let r = 200; r <= 260; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const cells = row
    .slice(0, 12)
    .map((c, i) => (trim(c) ? `[${i}]="${trim(c).slice(0, 40)}"` : null))
    .filter(Boolean)
  if (!cells.length) continue
  console.log(`R${r}: ${cells.join(' ')}`)
}

console.log('\nRows 560..700 (single-price tail):')
for (let r = 560; r <= 700; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const cells = row
    .slice(0, 12)
    .map((c, i) => (trim(c) ? `[${i}]="${trim(c).slice(0, 40)}"` : null))
    .filter(Boolean)
  if (!cells.length) continue
  console.log(`R${r}: ${cells.join(' ')}`)
}
