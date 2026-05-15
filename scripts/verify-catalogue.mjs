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

const lamtekCount = await countByProgram('lamtek')
const tealburyCount = await countByProgram('tealbury')
const lamtekCats = await categoriesFor('lamtek-')
const tealburyCats = await categoriesFor('tealbury-')
const ranges = await doorRangesForTealbury()
const anonVisible = await sampleVisibilityAsAnon()

console.log('--- Catalogue summary ---')
console.log('Lamtek products:   ', lamtekCount)
console.log('Tealbury products: ', tealburyCount)
console.log('Total active rows visible to anon (RLS allowing): ', anonVisible)
console.log('\nLamtek categories:', lamtekCats.length)
lamtekCats.slice(0, 12).forEach((c) => console.log('  -', c.name, `[${c.slug}]`))
console.log('\nTealbury categories:', tealburyCats.length)
tealburyCats.slice(0, 12).forEach((c) => console.log('  -', c.name, `[${c.slug}]`))
console.log('\nTealbury door ranges (from options.tealbury_door_range):')
const sorted = [...ranges.entries()].sort((a, b) => b[1] - a[1])
for (const [name, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${name}`)
console.log('  (', sorted.length, 'distinct ranges,', sorted.reduce((a, b) => a + b[1], 0), 'products with a range tag )')
