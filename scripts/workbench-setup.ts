/**
 * Run pricelist workbench setup steps against the saved draft (no UI):
 *   1. Ensure Accessories categories
 *   2. Infer part types / sold-as on all rows
 *   3. Compute draft BOM for all Tealbury complete units
 *
 *   npm run catalogue:workbench-setup
 */
import { createClient } from '@supabase/supabase-js'

const DRAFT_ID = 'global'

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function main() {
  const { bootstrapTealburyCatalogueCategories, enrichWorkbenchRowsMetadata } = await import(
    '../src/lib/tealburyCatalogueBuild.ts'
  )
  const { bulkComputeDraftBom, mergeWorkbenchRowPatch } = await import('../src/lib/workbenchBom.ts')
  const { normalizeProductDisplayName } = await import('../src/lib/titleCase.ts')
  type PricelistWorkbenchRow = import('../src/lib/pricelistWorkbench.ts').PricelistWorkbenchRow

  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('catalogue_workbench_drafts')
    .select('rows, warnings')
    .eq('id', DRAFT_ID)
    .maybeSingle()
  if (error) throw error
  if (!data?.rows || !Array.isArray(data.rows)) {
    console.error('No workbench draft found (id=global). Import pricelists first.')
    process.exit(1)
  }

  let rows = data.rows as PricelistWorkbenchRow[]
  const warnings = Array.isArray(data.warnings) ? data.warnings : []
  console.log(`Loaded ${rows.length} draft row(s).`)

  console.log('\n→ Ensure Accessories categories…')
  try {
    const catRes = await bootstrapTealburyCatalogueCategories()
    console.log(`  created: ${catRes.created.length ? catRes.created.join(', ') : '(none)'}`)
    console.log(`  existing: ${catRes.existing.length ? catRes.existing.join(', ') : '(none)'}`)
    if (catRes.errors.length) console.warn('  errors:', catRes.errors.join('; '))
  } catch (e) {
    console.warn('  skipped (use Admin button if needed):', e instanceof Error ? e.message : e)
  }

  console.log('\n→ Title Case all product names…')
  rows = rows.map((r) => {
    const name = r.name?.trim()
    if (!name) return r
    return { ...r, name: normalizeProductDisplayName(name) }
  })

  console.log('\n→ Clone UFORM door sizes to missing door ranges…')
  const { cloneUformSizesToMissingRanges } = await import('../src/lib/uformRangeClone.ts')
  const cloneRes = cloneUformSizesToMissingRanges(rows)
  rows = cloneRes.rows
  console.log(`  ${cloneRes.notes.join(' ')}`)
  if (cloneRes.added === 0) console.log('  (skipped — nothing to add)')

  console.log('\n→ Infer part types / sold-as on all rows…')
  rows = enrichWorkbenchRowsMetadata(rows)
  const kindCounts = new Map<string, number>()
  for (const r of rows) {
    const k = r.item_kind || 'other'
    kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1)
  }
  console.log('  kinds:', [...kindCounts.entries()].map(([k, n]) => `${k}: ${n}`).join(', '))

  const completes = rows.filter((r) => r.source === 'tealbury' && r.item_kind === 'complete')
  console.log(`\n→ Compute draft BOM for ${completes.length} Tealbury complete unit(s)…`)
  const bomRes = bulkComputeDraftBom(completes, rows, 'titus')
  rows = rows.map((r) => {
    const patch = bomRes.patches.get(r.id)
    return patch ? mergeWorkbenchRowPatch(r, patch) : r
  })
  console.log(`  BOM stored: ${bomRes.ok} ok, ${bomRes.failed} failed`)
  if (bomRes.notes.length) {
    console.log('  sample notes (first 15):')
    for (const n of bomRes.notes.slice(0, 15)) console.log(`    ${n}`)
    if (bomRes.notes.length > 15) console.log(`    … and ${bomRes.notes.length - 15} more`)
  }

  const { error: saveErr } = await supabase.from('catalogue_workbench_drafts').upsert({
    id: DRAFT_ID,
    rows,
    warnings,
    updated_at: new Date().toISOString(),
  })
  if (saveErr) throw saveErr

  const withBom = rows.filter((r) => {
    const bom = r.options?.workbench_bom
    return (
      bom &&
      typeof bom === 'object' &&
      !Array.isArray(bom) &&
      Array.isArray((bom as { lines?: unknown }).lines) &&
      (bom as { lines: unknown[] }).lines.length > 0
    )
  }).length
  console.log(`\nDone. Draft saved. Rows with workbench_bom: ${withBom}.`)
  console.log('Next: review in Admin → Pricelist workbench, then Publish when ready.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
