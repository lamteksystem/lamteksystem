import XLSX from 'xlsx'
import fs from 'fs'

function trimPreview(row, max = 40) {
  const a = [...row.slice(0, max)]
    .map((c) =>
      typeof c === 'number' ? c : String(c ?? '').trim().slice(0, 60))
  const first = a.findIndex((x) => x !== '' && x !== null)
  const last = a.reduce((hi, x, i) => (x !== '' && x != null ? i : hi), -1)
  if (last < first) return []
  return a.slice(first, last + 1)
}

const files = [
  String.raw`C:\Users\info\AppData\Local\Temp\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`,
  String.raw`C:\Users\info\AppData\Local\Temp\Lamtek Trade Bedroom Price List.xlsx`,
]

for (const f of files) {
  console.log('\n===', f, '===')
  if (!fs.existsSync(f)) {
    console.log('MISSING')
    continue
  }
  const buf = fs.readFileSync(f)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const name = wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const j = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  let shown = 0
  const markers = /\b(Ref|SKU|Part|Price|Code|£|EUR)\b/i
  for (let r = 0; r < j.length && shown < 40; r++) {
    const row = j[r]
    if (!Array.isArray(row)) continue
    const cells = trimPreview(row, 120)
    if (cells.length < 2) continue
    const joined = cells.join(' | ')
    const hasPriceLike = /\d+[.,]\d{2}|£|\b\d{4,}\b/.test(joined)
    const hasLongText = cells.some((c) => String(c).length > 35)
    if (markers.test(joined) || (hasPriceLike && cells.length >= 2 && hasLongText)) {
      console.log('R' + r, cells.slice(0, 25))
      shown++
    }
  }

  console.log('\nScan for SKU-like /^[A-Z]{2,}-\d|^LT[A-Z]/i...')
  let skuShown = 0
  const skuRe =
    /\b[A-Z]{1,6}-[A-Z0-9]+\b|\bLT[A-Z0-9_-]+\b|\b\d{6,}\b/
  for (let r = 0; r < j.length && skuShown < 25; r++) {
    const row = j[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      const s = String(v ?? '').trim()
      if (skuRe.test(s) && /[a-z]/i.test(s)) {
        console.log(
          'R' + r + 'C' + c,
          s,
          '| around:',
          trimPreview(row, 120).slice(0, 8).join(' || ')
        )
        skuShown++
        break
      }
    }
  }
}
