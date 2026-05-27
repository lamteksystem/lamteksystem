/**
 * Import UFORM spec products from generated JSON into Supabase.
 *
 *   npm run catalogue:parse-uform-specs
 *   node --env-file=.env scripts/import-uform-spec-products.mjs --yes
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const JSON_PATH = join(root, 'Pricelists and Specifications', 'generated', 'uform-spec-products.json')
const CHUNK = 200

const TEALBURY_RANGES = [
  'Oakham Soft Matte',
  'Oakham Gloss',
  'Dawson',
  'Knightsbridge Std',
  'Knightsbridge Prm',
  'Norwood',
  'Papplewick',
]

function slugify(s) {
  return (
    s
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'general'
  )
}

function inferPartType(p) {
  if (p.kind === 'door') return 'door'
  if (/plinth/i.test(p.section)) return 'other'
  return 'other'
}

async function ensureDoorRangeCategory(supabase, name, cache) {
  if (cache.has(name)) return cache.get(name)
  const slug = slugify(name).slice(0, 80)
  const { data: existing } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (existing?.id) {
    cache.set(name, existing.id)
    return existing.id
  }
  const { data: ins, error } = await supabase
    .from('categories')
    .insert({ name, slug, sort_order: 100, category_kind: 'door_range' })
    .select('id')
    .single()
  if (error) throw error
  cache.set(name, ins.id)
  return ins.id
}

async function purgeUformProducts(supabase) {
  const ids = []
  let from = 0
  while (true) {
    const { data: page, error } = await supabase
      .from('products')
      .select('id, sku')
      .eq('catalog_program', 'tealbury')
      .like('sku', 'UF-%')
      .range(from, from + 999)
    if (error) throw error
    if (!page?.length) break
    ids.push(...page.map((r) => r.id))
    if (page.length < 1000) break
    from += 1000
  }
  if (!ids.length) return
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    await supabase.from('assembly_lines').delete().in('product_id', part)
    await supabase.from('products').delete().in('id', part)
  }
  console.log(`  removed ${ids.length} prior UF-* product(s).`)
}

async function main() {
  const yes = process.argv.includes('--yes')
  const dry = process.argv.includes('--dry-run')
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Missing ${JSON_PATH} — run: npm run catalogue:parse-uform-specs`)
    process.exit(1)
  }
  const bundle = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
  const products = bundle.products ?? []
  console.log(`Loaded ${products.length} UFORM spec product(s) from JSON.`)

  if (dry) {
    console.log('Dry run — sample:', products.slice(0, 3))
    return
  }
  if (!yes) {
    console.error('Re-run with --yes to import.')
    process.exit(1)
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  for (const name of TEALBURY_RANGES) {
    const cache = new Map()
    await ensureDoorRangeCategory(supabase, name, cache)
  }

  await purgeUformProducts(supabase)

  const catCache = new Map()
  const payloads = []
  for (const p of products) {
    const category_id = await ensureDoorRangeCategory(supabase, p.door_range, catCache)
    payloads.push({
      category_id,
      name: p.name.slice(0, 255),
      description: (p.description || '').slice(0, 4500),
      sku: p.sku,
      unit_price: 0,
      cost_price: null,
      part_type: inferPartType(p),
      active: true,
      is_stock: true,
      sort_order: 0,
      stock_quantity: 0,
      catalog_program: 'tealbury',
      options: {
        uform_spec: true,
        height_mm: p.height_mm,
        width_mm: p.width_mm,
        depth_mm: p.depth_mm,
        uform_section: p.section,
      },
    })
  }

  for (let i = 0; i < payloads.length; i += CHUNK) {
    const { error } = await supabase.from('products').insert(payloads.slice(i, i + CHUNK))
    if (error) throw error
    process.stdout.write(`  inserted ${Math.min(i + CHUNK, payloads.length)} / ${payloads.length}\r`)
  }
  console.log(`\nImported ${payloads.length} UFORM spec product(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
