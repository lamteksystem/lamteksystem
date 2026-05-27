/**
 * Merge UFORM spec products into catalogue workbench draft (not live products).
 *
 *   npm run catalogue:parse-uform-specs
 *   node --env-file=.env scripts/import-uform-spec-products.mjs --yes
 */
import fs from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  createSupabaseAdmin,
  fetchCategories,
  loadWorkbenchDraft,
  saveWorkbenchDraft,
  uformToWorkbenchRow,
} from './lib/workbench-draft.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const JSON_PATH = join(root, 'Pricelists and Specifications', 'generated', 'uform-spec-products.json')

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
    console.error('Re-run with --yes to merge into workbench draft.')
    process.exit(1)
  }

  const supabase = await createSupabaseAdmin()
  const categories = await fetchCategories(supabase)
  const existing = await loadWorkbenchDraft(supabase)
  let draftRows = Array.isArray(existing.rows) ? existing.rows.filter((r) => r.source !== 'uform') : []
  draftRows.push(...products.map((p) => uformToWorkbenchRow(p, categories)))
  await saveWorkbenchDraft(supabase, draftRows, existing.warnings ?? [])
  console.log(`Workbench draft: ${draftRows.length} row(s) (${products.length} UFORM). Open Pricelist workbench to review.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
