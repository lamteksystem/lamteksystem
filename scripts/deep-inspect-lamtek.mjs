import XLSX from 'xlsx'
import fs from 'fs'

const f = String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`
const buf = fs.readFileSync(f)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

function trim(v) {
  return v == null || v === '' ? '' : String(v).replace(/\u00a0/g, ' ').trim()
}

console.log('Total rows:', data.length)

// Find every header row (Code/Size/Description) and every section title (dotted)
console.log('\nHEADER ROWS (Code/Size/Description):')
for (let r = 0; r < data.length; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const c0 = trim(row[0]).toLowerCase()
  const c1 = trim(row[1]).toLowerCase()
  const c2 = trim(row[2]).toLowerCase()
  if (c0 === 'code' && (c1.includes('size') || c1.includes('description'))) {
    const labels = row
      .slice(3, 40)
      .map((c, i) => (trim(c) ? `[${i + 3}]=${trim(c).slice(0, 30)}` : null))
      .filter(Boolean)
    console.log(`  R${r}:`, c0, '|', c1, '|', c2, '|', labels.slice(0, 8).join(' '))
  }
}

console.log('\nSECTION TITLES (rows with cells containing "…"):')
for (let r = 0; r < data.length; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const joined = row.map((c) => trim(c)).join(' | ')
  if (joined.includes('…')) {
    const cells = row
      .map((c, i) => (trim(c) ? `[${i}]=${trim(c).slice(0, 45)}` : null))
      .filter(Boolean)
      .slice(0, 5)
    console.log(`  R${r}: ${cells.join(' ')}`)
  }
}

console.log('\nFirst 5 rows that look like data (non-empty col 0 with a code-like value):')
let shown = 0
for (let r = 0; r < data.length && shown < 60; r++) {
  const row = data[r]
  if (!Array.isArray(row)) continue
  const code = trim(row[0])
  if (!code) continue
  if (/^code$/i.test(code)) continue
  if (!/^[A-Z0-9][A-Z0-9./\-]*$/i.test(code)) continue
  if (code.length > 30) continue
  const cells = row
    .slice(0, 25)
    .map((c, i) => (trim(c) ? `[${i}]=${trim(c).slice(0, 22)}` : null))
    .filter(Boolean)
    .slice(0, 8)
  console.log(`  R${r}: ${cells.join(' ')}`)
  shown += 1
}
