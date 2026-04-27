/**
 * One-off: inspect Napwood Construction Price List Excel file – list sheets and sample rows.
 * Run: node scripts/inspect-napwood-xlsx.js "path\to\file.xlsx"
 */
import * as XLSX from 'xlsx'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const filePath = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Desktop', 'Napwood Construction Price List From Trade Mouldings.xlsx')

console.log('Reading:', filePath)
let wb
try {
  const buf = readFileSync(filePath)
  wb = XLSX.read(buf, { type: 'buffer' })
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
}

console.log('\n=== WORKBOOK ===')
console.log('Sheet names:', wb.SheetNames.length)
console.log(wb.SheetNames.join('\n'))

wb.SheetNames.forEach((name, i) => {
  const ws = wb.Sheets[name]
  const ref = ws['!ref']
  if (!ref) {
    console.log('\n--- Sheet', i + 1, ':', name, '(empty) ---')
    return
  }
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  const rows = data.length
  const cols = data[0] ? data[0].length : 0
  console.log('\n--- Sheet', i + 1, ':', name, '---')
  console.log('Dimensions:', rows, 'rows x', cols, 'cols')
  console.log('First 6 rows:')
  data.slice(0, 6).forEach((row, r) => {
    console.log('  Row', r + 1, ':', JSON.stringify(row))
  })
  if (rows > 6) console.log('  ...')
})
