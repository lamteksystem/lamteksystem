/**
 * Parse Napwood Construction Price List Excel (sheet 010626) in the browser.
 * Same layout as scripts/import-napwood-pricelist-xlsx.js: Code, Name, Product Group Desc., Standard Price, 01-06-25.
 */

import * as XLSX from 'xlsx'

const MASTER_SHEET = '010626'
const CODE_COL = 0
const NAME_COL = 1
const PRODUCT_GROUP_COL = 2
const STANDARD_PRICE_COL = 3
const DATE_OR_PRICE_COL = 4

export const COST_PRICE_MARGIN = 0.75 // test: cost = price * 0.75

function slugify(name: string): string {
  if (!name || typeof name !== 'string') return 'other'
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

function parsePrice(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

export interface NapwoodProduct {
  code: string
  name: string
  productGroup: string
  unitPrice: number
}

export interface NapwoodCategory {
  slug: string
  name: string
}

export interface NapwoodParseResult {
  categories: NapwoodCategory[]
  products: NapwoodProduct[]
}

export function parseNapwoodXlsxFile(file: File): Promise<NapwoodParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        if (!wb.SheetNames.includes(MASTER_SHEET)) {
          reject(new Error(`Sheet "${MASTER_SHEET}" not found. Available: ${wb.SheetNames.join(', ')}`))
          return
        }
        const ws = wb.Sheets[MASTER_SHEET]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]
        if (!rows.length) {
          resolve({ categories: [], products: [] })
          return
        }
        const products: NapwoodProduct[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!Array.isArray(row)) continue
          const code = String(row[CODE_COL] ?? '').trim()
          const name = String(row[NAME_COL] ?? '').trim()
          const productGroup = String(row[PRODUCT_GROUP_COL] ?? '').trim() || 'Other'
          if (!code || !name) continue
          const standardPrice = parsePrice(row[STANDARD_PRICE_COL])
          const altPrice = parsePrice(row[DATE_OR_PRICE_COL])
          const unitPrice = standardPrice ?? altPrice
          if (unitPrice == null || unitPrice < 0) continue
          products.push({
            code,
            name: name.length > 300 ? name.slice(0, 297) + '…' : name,
            productGroup,
            unitPrice,
          })
        }
        const slugToName = new Map<string, string>()
        for (const p of products) {
          const slug = slugify(p.productGroup)
          if (!slugToName.has(slug)) slugToName.set(slug, p.productGroup)
        }
        const categories: NapwoodCategory[] = Array.from(slugToName.entries()).map(([slug, name]) => ({
          slug,
          name: name.length > 200 ? name.slice(0, 197) + '…' : name,
        }))
        resolve({ categories, products })
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
