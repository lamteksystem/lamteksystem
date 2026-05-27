/**
 * Full catalogue rebuild into workbench only (clears live products + import categories, loads sources).
 *
 *   node --env-file=.env scripts/catalogue-rebuild-workbench.mjs --yes
 */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createSupabaseAdmin } from './lib/workbench-draft.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--env-file=.env', script, ...args], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))))
  })
}

async function clearProducts() {
  await runNode('scripts/clear-all-products.mjs', ['--yes'])
}

async function pruneCategories(supabase) {
  const { data, error } = await supabase.rpc('prune_imported_categories')
  if (error) throw error
  console.log('Pruned categories:', data)
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Re-run with --yes to clear live products, prune categories, and load workbench draft.')
    process.exit(1)
  }

  const lamtek = 'Pricelists and Specifications/Lamtek Trade Kitchen Pricelist - 1-49 Titus Hinges.xlsx'
  const tealbury = 'Pricelists and Specifications/Tealbury Pricelist Customer Draft.xlsx'

  console.log('1/5 Clearing live products…')
  await clearProducts()

  console.log('2/5 Pruning import-generated categories…')
  const supabase = await createSupabaseAdmin()
  await pruneCategories(supabase)

  console.log('3/5 Loading Lamtek + Tealbury into workbench…')
  await runNode('scripts/import-pricelists.mjs', ['--yes', '--lamtek', lamtek, '--tealbury', tealbury])

  console.log('4/5 Parsing UFORM spec PDFs…')
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'catalogue:parse-uform-specs'], { cwd: root, stdio: 'inherit', shell: true })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('parse-uform-specs failed'))))
  })

  console.log('5/5 Merging UFORM into workbench…')
  await runNode('scripts/import-uform-spec-products.mjs', ['--yes'])

  console.log('\nDone. Review at /admin/catalogue-tools/pricelist-workbench then Publish.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
