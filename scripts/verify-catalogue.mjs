/**
 * Quick sanity check on the imported catalogue.
 * Run: node --env-file=.env scripts/verify-catalogue.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SVC) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SVC, { auth: { persistSession: false } })

async function countByProgram(program) {
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('catalog_program', program)
  return count
}

async function categoriesFor(slugPrefix) {
  const { data } = await supabase.from('categories').select('id, name, slug').like('slug', `${slugPrefix}%`).order('name')
  return data || []
}

async function doorRangesForTealbury() {
  // Distinct door ranges (from options.tealbury_door_range)
  const ranges = new Map()
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('options')
      .eq('catalog_program', 'tealbury')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const row of data || []) {
      const r = row.options?.tealbury_door_range
      if (r) ranges.set(r, (ranges.get(r) || 0) + 1)
    }
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return ranges
}

async function sampleVisibilityAsAnon() {
  const anon = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SVC, { auth: { persistSession: false } })
  const { count } = await anon.from('products').select('*', { count: 'exact', head: true }).eq('active', true)
  return count
}

/** Product counts per Lamtek category name (joined from categories). */
async function lamtekCountsByCategoryName() {
  const { data: products, error } = await supabase.from('products').select('category_id').eq('catalog_program', 'lamtek')
  if (error) throw error
  const ids = [...new Set((products || []).map((p) => p.category_id).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data: cats, error: cErr } = await supabase.from('categories').select('id, name').in('id', ids)
  if (cErr) throw cErr
  const byId = new Map((cats || []).map((c) => [c.id, c.name]))
  const counts = new Map()
  for (const p of products || []) {
    const n = byId.get(p.category_id) || '?'
    counts.set(n, (counts.get(n) || 0) + 1)
  }
  return counts
}

const lamtekCount = await countByProgram('lamtek')
const tealburyCount = await countByProgram('tealbury')
const lamtekCats = await categoriesFor('lamtek-')
const tealburyCats = await categoriesFor('tealbury-')
const ranges = await doorRangesForTealbury()
const anonVisible = await sampleVisibilityAsAnon()
const lamtekByCat = await lamtekCountsByCategoryName()

console.log('--- Catalogue summary ---')
console.log('Lamtek products:   ', lamtekCount)
console.log('Tealbury products: ', tealburyCount)
console.log('Total active rows visible to anon (RLS allowing): ', anonVisible)
console.log('\nLamtek categories:', lamtekCats.length)
lamtekCats.slice(0, 12).forEach((c) => console.log('  -', c.name, `[${c.slug}]`))
if (lamtekCats.length > 12) console.log(`  … and ${lamtekCats.length - 12} more`)

console.log('\nLamtek products by category (top 20 by count):')
const lamtekSorted = [...lamtekByCat.entries()].sort((a, b) => b[1] - a[1])
lamtekSorted.slice(0, 20).forEach(([name, n]) => console.log(`  ${String(n).padStart(4)}  ${name}`))
if (lamtekSorted.length > 20) console.log(`  … and ${lamtekSorted.length - 20} more category rows`)
console.log('\nTealbury categories:', tealburyCats.length)
tealburyCats.slice(0, 12).forEach((c) => console.log('  -', c.name, `[${c.slug}]`))
console.log('\nTealbury door ranges (from options.tealbury_door_range):')
const sorted = [...ranges.entries()].sort((a, b) => b[1] - a[1])
for (const [name, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${name}`)
console.log('  (', sorted.length, 'distinct ranges,', sorted.reduce((a, b) => a + b[1], 0), 'products with a range tag )')
