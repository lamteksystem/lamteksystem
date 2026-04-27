/**
 * Import products from a UK KBB pricelist PDF (template derived from industry pricelists).
 * Extracts "Description" / "Price £" tables and section headers (Boston, Balmoral, Handles, etc.),
 * ensures categories exist, then upserts products: inserts new SKUs, updates existing ones (name, description, price)
 * so the full pricelist and brochure are reflected in inventory.
 *
 * Usage:
 *   npm run import-pricelist
 *     → If no path given: reads the Pricelist PDF from Supabase (uploaded in Admin → Brochure & Pricelist).
 *     → Requires: DATABASE_URL, VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY in .env.
 *   npm run import-pricelist -- [path-to-pricelist.pdf]
 *     → Use a local PDF file instead.
 *   DRY_RUN=1 npm run import-pricelist   (parse only, no DB writes)
 *
 * To get a full inventory: 1) npm run supabase:push (migrations), 2) npm run seed (base categories/products),
 * 3) Upload pricelist PDF in Admin → Brochure & Pricelist, 4) npm run import-pricelist.
 */

import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Default path if you place the PDF in project root (fallback when no Supabase upload)
const DEFAULT_PDF = join(__dirname, '..', 'UK_TM_Pricelist_Jun_2025_V3.pdf')

// Section names that start a product table (door ranges + other categories)
const DOOR_RANGES = [
  'Boston', 'Balmoral', 'Buckingham', 'Rivington', 'Larissa', 'Vogue', 'Fenton',
  'Albany', 'Hadfield', 'Malham', 'Overmantle',
]
const OTHER_SECTIONS = [
  'Handles', 'Storage Solutions', 'Accessories', 'Cabinets', 'Gola',
  'Simplex Drawer Boxes', 'Vertex Drawer Boxes', 'Vertex Accessories',
  'Bedroom Accessories', 'Fixtures & Fittings', 'Lighting Solutions',
  'Glass Splashbacks', 'Aluminium Framed Doors', 'Edging Tape',
  'Mouldings', 'Vinyl Accessories', 'Components',
  'Worktops', 'End Panels', 'Fillers', 'Drawer Boxes', 'Trims', 'Beading',
  'Sinks', 'Taps', 'Plinth', 'Cornice', 'Pelmets', 'Lighting',
  'Complete Units', 'Base Units', 'Wall Units', 'Tall Units',
  'Door Ranges', 'Internal', 'Shelving', 'Baskets', 'Wirework',
]
const SECTION_NAMES = [...DOOR_RANGES, ...OTHER_SECTIONS]

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'other'
}

function toSku(sectionSlug, description) {
  const base = sectionSlug.toUpperCase().replace(/-/g, '_').slice(0, 12)
  const hash = description
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 30)
  return `${base}-${hash}`.replace(/-+/g, '-')
}

/**
 * Parse extracted PDF text into { section, description, price }[].
 * If reportOrphans, also return { products, orphans } where orphans are product-shaped lines dropped (no recognised section).
 */
function parsePricelistText(text, reportOrphans = false) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const products = []
  const orphans = [] // { line, prevLine } for product-shaped lines with no section
  let currentSection = null
  let prevLine = ''
  const priceLineRe = /^(.+?)\s+([\d,]+\.\d{2})\s*$/  // description then price (e.g. "Door 715 x 395mm    53.94")
  const skipWords = new Set(['Description', 'Price', 'Gloss', 'Matt', 'Hole', 'Centres', 'Qty', 'each', 'Part'])

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Page marker
    if (/^--\s*\d+\s+of\s+\d+\s*--/.test(line)) continue
    // Section header: single word or known name
    const asSection = SECTION_NAMES.find((s) => {
      if (line === s) return true
      if (line.startsWith(s + '\t') || line.startsWith(s + ' ')) return true
      if (new RegExp('^' + s + '\\s', 'i').test(line)) return true
      return false
    })
    if (asSection) {
      currentSection = asSection
      prevLine = line
      continue
    }
    // Product line: ends with price (two decimals, optional comma)
    const match = line.match(priceLineRe)
    if (match) {
      let desc = match[1].trim()
      let priceStr = match[2].replace(/,/g, '')
      const price = parseFloat(priceStr)
      const validPrice = !isNaN(price) && price > 0 && price <= 100000
      const skip = skipWords.has(desc) || desc.length < 3 || (desc.includes('Description') && desc.length < 25)
      if (currentSection && validPrice && !skip) {
        products.push({ section: currentSection, description: desc, price })
      } else if (reportOrphans && validPrice && !skip && desc.length >= 3) {
        orphans.push({ line: line.slice(0, 60), prevLine })
      }
    }
    prevLine = line
  }

  if (reportOrphans) return { products, orphans }
  return products
}

/** Load PDF buffer: from local path or from Supabase Storage (document with role = pricelist). */
async function loadPricelistBuffer(pdfPath, client) {
  if (pdfPath && existsSync(pdfPath)) {
    return readFileSync(pdfPath)
  }
  if (!client) return null
  const { data: doc, error: docError } = await client
    .from('documents')
    .select('file_path')
    .eq('role', 'pricelist')
    .limit(1)
    .maybeSingle()
  if (docError || !doc?.file_path) return null
  const { data: blob, error: downError } = await client.storage.from('documents').download(doc.file_path)
  if (downError || !blob) return null
  return Buffer.from(await blob.arrayBuffer())
}

async function main() {
  const explicitPath = process.env.PRICELIST_PDF || process.argv[2]
  const pdfPath = explicitPath || DEFAULT_PDF

  // Prefer pooler URL (direct db.xxx.supabase.co often fails with ENOTFOUND from some networks)
  const DATABASE_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL (or DATABASE_POOLER_URL) in .env')
    process.exit(1)
  }

  let PDFParse
  try {
    const mod = await import('pdf-parse')
    PDFParse = mod.PDFParse || mod.default
  } catch (e) {
    console.error('Install pdf-parse: npm install pdf-parse --save-dev')
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

  let dataBuffer
  if (explicitPath && existsSync(explicitPath)) {
    console.log('Reading PDF from file:', explicitPath)
    dataBuffer = readFileSync(explicitPath)
  } else if (pdfPath && existsSync(pdfPath)) {
    console.log('Reading PDF from file:', pdfPath)
    dataBuffer = readFileSync(pdfPath)
  } else if (supabase) {
    console.log('Fetching Pricelist PDF from Supabase (Admin upload)...')
    dataBuffer = await loadPricelistBuffer(null, supabase)
    if (!dataBuffer) {
      console.error('No pricelist found in Supabase. Upload it in Admin → Brochure & Pricelist, or pass a file path:')
      console.error('  npm run import-pricelist -- "C:\\path\\to\\pricelist.pdf"')
      process.exit(1)
    }
  } else {
    console.error('PDF not found:', pdfPath)
    console.error('Either upload the Pricelist in Admin → Brochure & Pricelist (and set VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env),')
    console.error('or pass a path: npm run import-pricelist -- "path\\to\\pricelist.pdf"')
    process.exit(1)
  }

  const parser = new PDFParse({ data: dataBuffer })
  const result = await parser.getText()
  const text = result.text
  const numpages = result.total || result.pages?.length || 0
  await parser.destroy()
  console.log('Extracted text from', numpages, 'pages, length', text.length)

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  const parseResult = parsePricelistText(text, dryRun)
  const products = Array.isArray(parseResult) ? parseResult : parseResult.products
  const orphans = !Array.isArray(parseResult) ? parseResult.orphans || [] : []

  console.log('Parsed', products.length, 'product lines')

  if (dryRun) {
    const bySection = {}
    for (const p of products) {
      bySection[p.section] = (bySection[p.section] || 0) + 1
    }
    console.log('Sections:', Object.entries(bySection).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(', '))
    if (orphans.length > 0) {
      const byPrev = {}
      for (const o of orphans) {
        const key = (o.prevLine || '(start of document)').slice(0, 50)
        byPrev[key] = (byPrev[key] || 0) + 1
      }
      console.log('Orphan lines (no recognised section):', orphans.length)
      console.log('Candidate section names to add to parser:', Object.entries(byPrev).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `  "${k}" (${v} lines)`).join('\n'))
    } else {
      console.log('No orphan lines – all product-shaped lines are under recognised sections.')
    }
    console.log('DRY_RUN: no database writes.')
    process.exit(0)
  }

  if (products.length === 0) {
    console.log('No products parsed. Check PDF format (Description / Price £ tables).')
    process.exit(0)
  }

  const client = new pg.Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
  } catch (connectErr) {
    if (connectErr.code === 'ENOTFOUND' && !process.env.DATABASE_POOLER_URL) {
      console.error('Database host could not be resolved (direct connection often fails).')
      console.error('Use the Session pooler URI from Supabase Dashboard:')
      console.error('  Project Settings → Database → Connection string → Session (or Transaction) mode')
      console.error('  Copy the URI (host like aws-0-XX.pooler.supabase.com) and set in .env:')
      console.error('  DATABASE_POOLER_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres')
      console.error('  (or replace DATABASE_URL with that URI)')
    }
    throw connectErr
  }
  try {

    const sectionSlugs = [...new Set(products.map((p) => slugify(p.section)))]
    const categoryIds = {}

    for (const slug of sectionSlugs) {
      const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      await client.query(
        `insert into public.categories (name, slug, sort_order) values ($1, $2, 0)
         on conflict (slug) do update set name = excluded.name`,
        [name, slug]
      )
      const r = await client.query('select id from public.categories where slug = $1', [slug])
      categoryIds[slug] = r.rows[0].id
    }

    let inserted = 0
    let updated = 0
    const BATCH = 100
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH)
      for (const p of batch) {
        const slug = slugify(p.section)
        const catId = categoryIds[slug]
        const sku = toSku(slug, p.description)
        const name = p.description.length > 120 ? p.description.slice(0, 117) + '…' : p.description
        const desc = p.description.length <= 200 ? p.description : p.description.slice(0, 200)
        const exists = await client.query('select id from public.products where sku = $1 limit 1', [sku])
        if (exists.rows.length > 0) {
          await client.query(
            `update public.products set category_id = $1, name = $2, description = $3, unit_price = $4, active = true where id = $5`,
            [catId, name, desc, p.price, exists.rows[0].id]
          )
          updated++
        } else {
          await client.query(
            `insert into public.products (category_id, name, description, sku, unit_price, sort_order, active)
             values ($1, $2, $3, $4, $5, $6, true)`,
            [catId, name, desc, sku, p.price, i]
          )
          inserted++
        }
      }
      console.log('  Inserted', inserted, 'updated', updated, 'after', Math.min(i + BATCH, products.length), 'rows')
    }

    console.log('\nDone. Inserted', inserted, 'products, updated', updated, '(all pricelist lines now in inventory)')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
