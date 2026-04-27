/**
 * Import products and categories from the Napwood Construction Price List Excel file.
 *
 * Uses sheet "010626" (master list): Code, Name, Product Group Desc., Standard Price, 01-06-25.
 * Creates categories from "Product Group Desc." and upserts products by Code (SKU).
 *
 * Pricing (Napwood spreadsheet = your customer prices from Trade Mouldings):
 *   - unit_price = spreadsheet price (customer/sell price in the app).
 *   - cost_price = spreadsheet price × 0.75 (25% off) for TEST only – real cost would come from TM.
 *
 * Usage:
 *   npm run import-napwood-xlsx -- "C:\path\to\Napwood Construction Price List From Trade Mouldings.xlsx"
 *   DRY_RUN=1 npm run import-napwood-xlsx   (parse only, no DB writes)
 *   CLEAN_BEFORE_IMPORT=1 npm run import-napwood-xlsx   (delete existing products/categories then import – avoids duplicates)
 *
 * Requires: DATABASE_URL (or DATABASE_POOLER_URL) in .env
 */

import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MASTER_SHEET = '010626'
const CODE_COL = 0
const NAME_COL = 1
const PRODUCT_GROUP_COL = 2
const STANDARD_PRICE_COL = 3
const DATE_OR_PRICE_COL = 4
/** For test env: cost = customer price × (1 - 0.25). Real cost would come from Trade Mouldings. */
const COST_PRICE_MARGIN = 0.75

function slugify(name) {
  if (!name || typeof name !== 'string') return 'other'
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

/**
 * Parse sheet 010626 into { code, name, productGroup, unitPrice }[]
 */
function parseMasterSheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  if (!data.length) return []
  const header = data[0]
  const isHeader = (row) => {
    const code = String(row[CODE_COL] ?? '').trim()
    const name = String(row[NAME_COL] ?? '').trim()
    return code.toLowerCase() === 'code' || !code || !name
  }
  const rows = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!Array.isArray(row)) continue
    const code = String(row[CODE_COL] ?? '').trim()
    const name = String(row[NAME_COL] ?? '').trim()
    const productGroup = String(row[PRODUCT_GROUP_COL] ?? '').trim()
    if (!code || !name) continue
    const standardPrice = parsePrice(row[STANDARD_PRICE_COL])
    const altPrice = parsePrice(row[DATE_OR_PRICE_COL])
    const unitPrice = standardPrice ?? altPrice
    if (unitPrice == null || unitPrice < 0) continue
    rows.push({
      code,
      name: name.length > 300 ? name.slice(0, 297) + '…' : name,
      productGroup: productGroup || 'Other',
      unitPrice,
    })
  }
  return rows
}

async function main() {
  const filePath = process.argv[2] || join(process.env.USERPROFILE || '', 'Desktop', 'Napwood Construction Price List From Trade Mouldings.xlsx')
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

  if (!existsSync(filePath)) {
    console.error('File not found:', filePath)
    console.error('Usage: npm run import-napwood-xlsx -- "path\\to\\Napwood Construction Price List From Trade Mouldings.xlsx"')
    process.exit(1)
  }

  console.log('Reading:', filePath)
  const buf = readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer' })

  if (!wb.SheetNames.includes(MASTER_SHEET)) {
    console.error('Sheet "' + MASTER_SHEET + '" not found. Available:', wb.SheetNames.join(', '))
    process.exit(1)
  }

  const ws = wb.Sheets[MASTER_SHEET]
  const products = parseMasterSheet(ws)
  console.log('Parsed', products.length, 'products from sheet', MASTER_SHEET)

  const groupCounts = {}
  for (const p of products) {
    const slug = slugify(p.productGroup)
    groupCounts[slug] = (groupCounts[slug] || 0) + 1
  }
  const categoriesCount = Object.keys(groupCounts).length
  console.log('Unique categories (product groups):', categoriesCount)
  if (dryRun) {
    console.log('Top 15 product groups by count:')
    Object.entries(groupCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([slug, count]) => console.log('  ', slug, count))
    console.log('DRY_RUN: no database writes.')
    process.exit(0)
  }

  const DATABASE_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('Set DATABASE_URL or DATABASE_POOLER_URL in .env')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
  } catch (e) {
    console.error('Database connection failed:', e.message)
    process.exit(1)
  }

  const cleanBeforeImport = process.env.CLEAN_BEFORE_IMPORT === '1' || process.env.CLEAN_BEFORE_IMPORT === 'true'
  if (cleanBeforeImport) {
    console.log('CLEAN_BEFORE_IMPORT=1: removing existing catalogue (collection_products, assembly_lines, product_stock, order_lines, products, categories)...')
    try {
      await client.query('delete from public.collection_products')
      await client.query('delete from public.assembly_lines')
      await client.query('delete from public.product_stock')
      await client.query('delete from public.order_lines')
      const prodRes = await client.query('delete from public.products returning id')
      const catRes = await client.query('delete from public.categories returning id')
      console.log('  Deleted', prodRes.rowCount, 'products and', catRes.rowCount, 'categories.')
    } catch (e) {
      console.error('Clean failed:', e.message)
      await client.end()
      process.exit(1)
    }
  }

  try {
    const categorySlugs = [...new Set(products.map((p) => slugify(p.productGroup)))]
    const categoryIds = {}

    for (const slug of categorySlugs) {
      const name = products.find((p) => slugify(p.productGroup) === slug)?.productGroup ?? slug.replace(/-/g, ' ')
      await client.query(
        `insert into public.categories (name, slug, sort_order) values ($1, $2, 0)
         on conflict (slug) do update set name = excluded.name`,
        [name.length > 200 ? name.slice(0, 197) + '…' : name, slug]
      )
      const r = await client.query('select id from public.categories where slug = $1', [slug])
      categoryIds[slug] = r.rows[0].id
    }
    console.log('Upserted', categorySlugs.length, 'categories')

    let inserted = 0
    let updated = 0
    const BATCH = 200
    const total = products.length
    const barWidth = 32
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH)
      for (const p of batch) {
        const slug = slugify(p.productGroup)
        const categoryId = categoryIds[slug]
        const description = p.name.length > 500 ? p.name.slice(0, 497) + '…' : (p.name.length > 200 ? p.name : null)
        const name = p.name.length > 300 ? p.name.slice(0, 297) + '…' : p.name

        const costPrice = Math.round(p.unitPrice * COST_PRICE_MARGIN * 100) / 100
        const existing = await client.query('select id from public.products where sku = $1 limit 1', [p.code])
        if (existing.rows.length > 0) {
          await client.query(
            `update public.products set category_id = $1, name = $2, description = $3, unit_price = $4, cost_price = $5, active = true where id = $6`,
            [categoryId, name, description, p.unitPrice, costPrice, existing.rows[0].id]
          )
          updated++
        } else {
          await client.query(
            `insert into public.products (category_id, name, description, sku, unit_price, cost_price, sort_order, active)
             values ($1, $2, $3, $4, $5, $6, $7, true)`,
            [categoryId, name, description, p.code, p.unitPrice, costPrice, i]
          )
          inserted++
        }
      }
      const done = Math.min(i + BATCH, total)
      const pct = total ? Math.round((100 * done) / total) : 100
      const filled = Math.round((barWidth * done) / total)
      const bar = '[' + '='.repeat(filled) + '>'.repeat(filled < barWidth ? 1 : 0) + ' '.repeat(barWidth - filled - (filled < barWidth ? 1 : 0)) + ']'
      process.stdout.write(`\r  ${bar} ${String(pct).padStart(3)}% (${done} / ${total})  inserted: ${inserted}  updated: ${updated}   `)
    }
    process.stdout.write('\n')
    console.log('Done. Inserted', inserted, 'products, updated', updated)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
