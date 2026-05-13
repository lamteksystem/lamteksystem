/**
 * Remove every row from public.products (and dependent catalogue rows) so you can re-import.
 *
 * Does: clear marketing carousel product ids, delete assembly_lines + assemblies, delete all products.
 * Preserves: categories, orders (order_lines.product_id → null), return lines, pick list item refs.
 *
 * Connection: same as scripts/push-migrations.mjs (DATABASE_URL / DATABASE_POOLER_URL / SUPABASE_DB_URL / .secrets/database_url).
 *
 * Usage:
 *   node --env-file=.env scripts/clear-all-products.mjs --dry-run
 *   node --env-file=.env scripts/clear-all-products.mjs --yes
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(root, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[k] = v
    }
  } catch {
    /* missing */
  }
  return env
}

function tryReadDbUrlFile() {
  const p = join(root, '.secrets', 'database_url')
  if (!existsSync(p)) return null
  const raw = readFileSync(p, 'utf8').trim()
  const line = raw.split(/\r?\n/).find((l) => {
    const t = l.trim()
    return t && !t.startsWith('#')
  })
  return line?.trim() || null
}

const e = { ...process.env, ...loadEnv() }
const dbUrl = e.DATABASE_URL || e.DATABASE_POOLER_URL || e.SUPABASE_DB_URL || tryReadDbUrlFile()

const dry = process.argv.includes('--dry-run')
const yes = process.argv.includes('--yes')

if (!dbUrl) {
  console.error(
    'Missing database URL. Set DATABASE_URL (or DATABASE_POOLER_URL / SUPABASE_DB_URL) in .env, or .secrets/database_url.'
  )
  process.exit(1)
}

if (!dry && !yes) {
  console.error('Refusing to run without --yes (or use --dry-run to count rows only).')
  process.exit(1)
}

const sql = `
begin;

update public.marketing_site_settings
set carousel_product_ids = '{}', updated_at = now()
where id = 'default';

delete from public.assembly_lines;
delete from public.assemblies;

delete from public.products;

commit;
`

const countSql = `
select
  (select count(*)::int from public.products) as products,
  (select count(*)::int from public.assembly_lines) as assembly_lines,
  (select count(*)::int from public.assemblies) as assemblies;
`

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  const { rows } = await client.query(countSql)
  const c = rows[0]
  console.log('Current counts:', c)
  if (dry) {
    console.log('Dry run: no changes made.')
    process.exit(0)
  }
  await client.query(sql)
  const { rows: after } = await client.query(countSql)
  console.log('After purge:', after[0])
  console.log('Done.')
} finally {
  await client.end()
}
