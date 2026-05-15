/**
 * One-off: peek at the two pricelist XLSX files (sheet names, sample rows)
 * so we know what we're importing.
 * Run: node scripts/inspect-import-sources.mjs
 */
import XLSX from 'xlsx'
import fs from 'fs'

const FILES = [
  String.raw`C:\Users\info\Desktop\Tealbury Pricelist Customer Copy - Draft.xlsx`,
  String.raw`C:\Users\info\Desktop\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`,
]

function preview(row) {
  return row
    .map((c) => (c === '' || c == null ? '' : String(c).trim().slice(0, 40)))
    .reduce((acc, cell, i) => {
      if (cell) acc.push(`[${i}]=${cell}`)
      return acc
    }, [])
    .slice(0, 12)
    .join(' ')
}

for (const f of FILES) {
  console.log('\n=================================================================')
  console.log('FILE:', f)
  console.log('=================================================================')
  if (!fs.existsSync(f)) {
    console.log('NOT FOUND')
    continue
  }
  const buf = fs.readFileSync(f)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  console.log('Sheets:', wb.SheetNames.length, '→', wb.SheetNames.map((n) => `"${n}"`).join(', '))

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const nonEmpty = data.filter((r) => Array.isArray(r) && r.some((c) => c !== '' && c != null))
    console.log(`\n--- Sheet "${sheetName}": ${nonEmpty.length} non-empty rows of ${data.length} ---`)
    let printed = 0
    for (let r = 0; r < Math.min(data.length, 30) && printed < 12; r++) {
      const row = data[r]
      if (!Array.isArray(row)) continue
      const line = preview(row)
      if (!line) continue
      console.log(`  R${r}: ${line}`)
      printed += 1
    }
  }

  // Also look for cell-level data validation lists (which provide the dropdown values).
  // xlsx library has limited support; parse the raw XML to find <dataValidations>.
  try {
    const zip = (await import('node:zlib')).default
    const unzipper = await import('node:stream')
    console.log('\n(skipping dataValidations XML parse — not strictly needed; we read each range sheet directly)')
  } catch {}
}
