/**
 * Purge legacy Trade Mouldings catalogue and import Lamtek kitchen + bedroom pricelists (XLSX).
 *
 * - Empties Supabase `product-images` bucket (service role).
 * - Deletes warehouse picks, assemblies, stock movements, order lines, products, categories; clears marketing carousel.
 * - Parses tabular sections: kitchen (Code / Size / Description / finish prices), bedroom (Code / Description + finishes).
 *
 *   DRY_RUN=1 node --env-file=.env scripts/import-lamtek-trade-pricelists.js
 *   CONFIRM_PURGE=LamtekReplaceCatalog node --env-file=.env scripts/import-lamtek-trade-pricelists.js --kitchen "path" --bedroom "path"
 *
 * Requires DATABASE_URL or DATABASE_POOLER_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL
 */

import pg from 'pg'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const DEFAULT_KITCHEN = String.raw`C:\Users\info\AppData\Local\Temp\Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx`
const DEFAULT_BEDROOM = String.raw`C:\Users\info\AppData\Local\Temp\Lamtek Trade Bedroom Price List.xlsx`
const COST_FACTOR = 0.75
const PURGE_TOKEN = 'LamtekReplaceCatalog'

function argPath(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}

function slugify(name) {
  if (!name || typeof name !== 'string') return 'lamtek-general'
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/…+|\.{3,}/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'lamtek-general'
  )
}

function trimCell(v) {
  if (v == null || v === '') return ''
  return String(v).replace(/\u00a0/g, ' ').trim()
}

function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.round(v * 100) / 100
  const n = parseFloat(String(v).replace(/,/g, '').replace(/£/g, '').trim())
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}

function looksLikeKitchenHeader(row) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  const c2 = trimCell(row[2]).toLowerCase()
  return c0 === 'code' && c1.includes('size') && (c2 === 'description' || c2.includes('escription'))
}

function looksLikeBedroomHeader(row) {
  const c0 = trimCell(row[0]).toLowerCase()
  const c1 = trimCell(row[1]).toLowerCase()
  return c0 === 'code' && c1.includes('description')
}

function looksLikeTocSectionKitchen(row) {
  const c0 = trimCell(row[0])
  const c1 = trimCell(row[1])
  const c2 = trimCell(row[2])
  return !c0 && !c1 && c2.includes('…') && c2.length > 12
}

function looksLikeTocSectionBedroom(row) {
  const c4 = trimCell(row[4] || '')
  return c4.includes('…') && c4.length > 15 && !trimCell(row[0])
}

function isLikelySku(s) {
  if (!s || s.length > 48) return false
  if (/^code$/i.test(s)) return false
  return /^[A-Z0-9][A-Z0-9./\-]*$/i.test(s)
}

function buildKitchenTableFromHeader(row) {
  const finishCols = []
  for (let c = 3; c < Math.min(row.length, 48); c++) {
    const lab = trimCell(row[c])
    if (!lab || lab.length > 60) continue
    if (/^[\d.£]+$/.test(lab)) continue
    if (!/[a-z]/i.test(lab)) continue
    finishCols.push({ label: lab, col: c })
  }
  return { code: 0, size: 1, desc: 2, finishCols }
}

function parseKitchenWorkbook(filepath) {
  const buf = fs.readFileSync(filepath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets.Pricelist || wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const bySku = new Map()
  let section = 'Lamtek kitchen'
  /** @type {null | { code: number; size: number; desc: number; finishCols: { label: string; col: number }[] }} */
  let table = null

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionKitchen(row)) {
      section = trimCell(row[2])
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      table = null
      continue
    }

    if (looksLikeKitchenHeader(row)) {
      table = buildKitchenTableFromHeader(row)
      continue
    }

    if (!table) continue

    if (!trimCell(row[table.code]) && trimCell(row[table.desc]).includes('…') && trimCell(row[table.desc]).length > 18) {
      section = trimCell(row[table.desc])
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      table = null
      continue
    }

    const code = trimCell(row[table.code])
    if (!code || !isLikelySku(code)) continue

    const size = trimCell(row[table.size])
    const desc = trimCell(row[table.desc])
    const finishPrices = {}
    for (const f of table.finishCols) {
      const p = parsePrice(row[f.col])
      if (p != null && p > 0) finishPrices[f.label] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const prices = Object.values(finishPrices)
    const unitPrice = Math.min(...prices)
    const name = [code, size || null, desc ? desc.slice(0, 120) : null].filter(Boolean).join(' — ').slice(0, 300)
    const description = [`Section: ${section}`, desc ? `Specification: ${desc}` : null, size ? `Size: ${size}` : null]
      .filter(Boolean)
      .join('\n')

    if (bySku.has(code)) {
      const prev = bySku.get(code)
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      prev.options.lamtek_finish_prices_gbp = { ...prev.options.lamtek_finish_prices_gbp, ...finishPrices }
      prev.options.lamtek_sections = [...new Set([...(prev.options.lamtek_sections || []), section])]
      if (size) prev.options.lamtek_sizes = [...new Set([...(prev.options.lamtek_sizes || []), size])]
    } else {
      bySku.set(code, {
        sku: code,
        name,
        description,
        categoryName: section,
        unitPrice,
        options: {
          lamtek_sheet: 'kitchen',
          lamtek_sections: [section],
          lamtek_finish_prices_gbp: finishPrices,
          lamtek_sizes: size ? [size] : [],
        },
      })
    }
  }

  return [...bySku.values()].map((p) => ({
    ...p,
    cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100,
  }))
}

function parseBedroomWorkbook(filepath) {
  const buf = fs.readFileSync(filepath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets.Sheet1 || wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const bySku = new Map()
  let section = 'Lamtek bedroom'
  /** @type {null | { labels: string[]; cols: number[] }} */
  let hdr = null

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    if (!Array.isArray(row)) continue

    if (looksLikeTocSectionBedroom(row)) {
      section = trimCell(row[4])
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      hdr = null
      continue
    }

    const cD = trimCell(row[4] || '')
    if (!trimCell(row[0]) && cD.includes('…') && cD.length > 22) {
      section = cD
        .replace(/…+/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 200)
        .trim()
      hdr = null
      continue
    }

    if (looksLikeBedroomHeader(row)) {
      const sample = data[r + 1]
      /** @type {number[]} */
      const cols = []
      /** @type {string[]} */
      const labels = []
      for (let c = 2; c < row.length; c++) {
        const h = trimCell(row[c])
        if (!h || h.length > 140) continue
        const low = h.toLowerCase()
        if (low === 'code' || low === 'description') continue
        if (!Array.isArray(sample) || parsePrice(sample[c]) == null) continue
        cols.push(c)
        labels.push(h)
      }
      hdr = { cols, labels }
      continue
    }

    if (!hdr || !hdr.cols.length) continue

    const code = trimCell(row[0])
    const desc = trimCell(row[1])
    if (!code || !isLikelySku(code)) continue

    /** @type {Record<string, number>} */
    const finishPrices = {}
    for (let i = 0; i < hdr.cols.length; i++) {
      const col = hdr.cols[i]
      const lab = hdr.labels[i] || `Finish ${col}`
      const p = parsePrice(row[col])
      if (typeof p === 'number' && p > 0) finishPrices[lab] = p
    }
    if (!Object.keys(finishPrices).length) continue

    const unitPrice = Math.min(...Object.values(finishPrices))
    const name = [code, desc ? desc.slice(0, 200) : null].filter(Boolean).join(' — ').slice(0, 300)
    const description = [`Section: ${section}`, desc ? `Specification: ${desc}` : null].filter(Boolean).join('\n')

    if (bySku.has(code)) {
      const prev = bySku.get(code)
      prev.description = `${prev.description}\n---\n${description}`
      prev.unitPrice = Math.min(prev.unitPrice, unitPrice)
      prev.options.lamtek_finish_prices_gbp = { ...prev.options.lamtek_finish_prices_gbp, ...finishPrices }
      prev.options.lamtek_sections = [...new Set([...(prev.options.lamtek_sections || []), section])]
    } else {
      bySku.set(code, {
        sku: code,
        name,
        description,
        categoryName: section,
        unitPrice,
        options: {
          lamtek_sheet: 'bedroom',
          lamtek_sections: [section],
          lamtek_finish_prices_gbp: finishPrices,
        },
      })
    }
  }

  return [...bySku.values()].map((p) => ({
    ...p,
    cost_price: Math.round(p.unitPrice * COST_FACTOR * 100) / 100,
  }))
}

async function purgeProductImages(supabase) {
  console.log('Deleting objects in bucket product-images...')
  let removed = 0

  /** @param {string} prefix */
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from('product-images').list(prefix || '', { limit: 1000 })
    if (error) return
    const entries = data || []
    if (!entries.length) return

    /** @type {string[]} */
    const filePaths = []
    for (const item of entries) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name
      const isFile =
        typeof item.id === 'string' ||
        item.metadata != null ||
        /\.[a-z0-9]{2,6}$/i.test(String(item.name || ''))
      if (isFile) {
        filePaths.push(rel)
      } else {
        await walk(rel)
      }
    }
    if (filePaths.length) {
      const rm = await supabase.storage.from('product-images').remove(filePaths)
      if (!rm.error) removed += filePaths.length
    }
  }

  for (let pass = 0; pass < 12; pass++) {
    await walk('')
  }
  console.log('Removed ~', removed, 'storage object(s) (multiple root passes).')
}

async function purgeCatalogue(client) {
  console.log('Purging catalogue (DB)...')
  const steps = [
    `delete from public.customer_price_rules where scope_type = 'product'`,
    `delete from public.cost_price_rules where scope_type = 'product'`,
    `delete from public.pick_list_items`,
    `delete from public.package_labels`,
    `delete from public.pick_lists`,
    `delete from public.assembly_lines`,
    `delete from public.assemblies`,
    `delete from public.collection_products`,
    `delete from public.stock_movements`,
    `delete from public.product_stock`,
    `delete from public.order_lines`,
    `update public.marketing_site_settings set carousel_product_ids = '{}'::uuid[], updated_at = now() where id = 'default'`,
    `delete from public.products`,
    `delete from public.categories`,
  ]
  for (const sql of steps) {
    try {
      const res = await client.query(sql)
      console.log('  ok:', sql.slice(0, 88), res.rowCount != null ? `(${res.rowCount})` : '')
    } catch (e) {
      console.warn('  step failed:', sql.slice(0, 60), e.message)
      if (/does not exist|relation .* does not exist/i.test(String(e.message))) continue
      throw e
    }
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  const confirm = process.env.CONFIRM_PURGE === PURGE_TOKEN
  const kitchenPath = argPath('--kitchen', DEFAULT_KITCHEN)
  const bedroomPath = argPath('--bedroom', DEFAULT_BEDROOM)

  for (const p of [kitchenPath, bedroomPath]) {
    if (!fs.existsSync(p)) {
      console.error('File not found:', p)
      process.exit(1)
    }
  }

  console.log('Kitchen:', kitchenPath)
  console.log('Bedroom:', bedroomPath)

  const kitchenProducts = parseKitchenWorkbook(kitchenPath)
  const bedroomProducts = parseBedroomWorkbook(bedroomPath)
  const merged = [...kitchenProducts]

  const skuSet = new Set(kitchenProducts.map((p) => p.sku))
  for (const b of bedroomProducts) {
    if (skuSet.has(b.sku)) {
      console.warn('Duplicate SKU (kitchen + bedroom merged into one product):', b.sku)
      const k = merged.find((x) => x.sku === b.sku)
      if (k) {
        k.description = `${k.description}\n---\n${b.description}`
        k.unitPrice = Math.min(k.unitPrice, b.unitPrice)
        k.options.lamtek_finish_prices_gbp = {
          ...(k.options.lamtek_finish_prices_gbp || {}),
          ...b.options.lamtek_finish_prices_gbp,
        }
        k.options.lamtek_sections = [...new Set([...(k.options.lamtek_sections || []), ...(b.options.lamtek_sections || [])])]
        k.options.lamtek_sheet_merged_from = [...new Set([k.options.lamtek_sheet || 'kitchen', 'bedroom'])]
        k.cost_price = Math.round(k.unitPrice * COST_FACTOR * 100) / 100
      }
      continue
    }
    skuSet.add(b.sku)
    merged.push(b)
  }

  console.log('Parsed:', kitchenProducts.length, 'kitchen,', bedroomProducts.length, 'bedroom,', merged.length, 'distinct SKUs.')

  if (dryRun) {
    console.log('DRY_RUN: sample (10):')
    merged.slice(0, 10).forEach((p) => console.log(' ', p.sku, '|', p.name.slice(0, 72), '| £' + p.unitPrice))
    process.exit(0)
  }

  if (!confirm) {
    console.error(`Refusing purge without CONFIRM_PURGE=${PURGE_TOKEN}`)
    process.exit(1)
  }

  const DATABASE_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const origin = process.env.VITE_SUPABASE_URL
  if (!DATABASE_URL || !svc || !origin) {
    console.error('Set DATABASE_URL (or DATABASE_POOLER_URL), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL in .env')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const supabase = createClient(origin, svc, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    if (process.env.SKIP_PRODUCT_IMAGE_PURGE !== '1' && process.env.SKIP_PRODUCT_IMAGE_PURGE !== 'true') {
      await purgeProductImages(supabase)
    } else {
      console.log('SKIP_PRODUCT_IMAGE_PURGE: leaving storage bucket untouched.')
    }
    await purgeCatalogue(client)

    const categorySlugs = [...new Set(merged.map((p) => slugify(p.categoryName)))]
    const categoryIds = {}
    for (const slug of categorySlugs) {
      const nameSrc = merged.find((p) => slugify(p.categoryName) === slug)?.categoryName || slug.replace(/-/g, ' ')
      await client.query(
        `insert into public.categories (name, slug, sort_order) values ($1, $2, 0)
         on conflict (slug) do update set name = excluded.name`,
        [String(nameSrc).slice(0, 200), slug],
      )
      const { rows } = await client.query('select id from public.categories where slug = $1 limit 1', [slug])
      categoryIds[slug] = rows[0].id
    }
    console.log('Categories:', categorySlugs.length)

    let inserted = 0
    const BATCH = 150
    for (let i = 0; i < merged.length; i += BATCH) {
      const batch = merged.slice(i, i + BATCH)
      await client.query('BEGIN')
      try {
        for (const [j, p] of batch.entries()) {
          const slugCat = slugify(p.categoryName)
          const cid = categoryIds[slugCat]
          await client.query(
            `insert into public.products (
              category_id, name, description, sku, unit_price, cost_price, stock_quantity, is_stock,
              active, sort_order, options, image_url, image_alt
            ) values ($1,$2,$3,$4,$5,$6,0,true,true,$7,$8::jsonb,null,null)`,
            [
              cid,
              p.name,
              (p.description || '').slice(0, 4500),
              p.sku,
              p.unitPrice,
              p.cost_price,
              i + j,
              JSON.stringify({
                ...(p.options || {}),
                lamtek_default_price_basis: 'lowest_finish_gbp_ex_vat',
              }),
            ],
          )
          inserted++
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
      console.log(`  inserted ${Math.min(i + BATCH, merged.length)} / ${merged.length}`)
    }

    console.log('Done. Products inserted:', inserted)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
