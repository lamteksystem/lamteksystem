/**
 * Apply local supabase/migrations to the remote database.
 *
 * Connection (first match wins):
 * 1) Env: DATABASE_URL, DATABASE_POOLER_URL, or SUPABASE_DB_URL
 * 2) .env same keys
 * 3) File `.secrets/database_url` — single line, full postgres URI (gitignored; never commit)
 *
 * Run: npm run db:push:remote
 *   or: node --env-file=.env scripts/push-migrations.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

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
const rawDbUrl = e.DATABASE_URL || e.DATABASE_POOLER_URL || e.SUPABASE_DB_URL || tryReadDbUrlFile()

/** Transaction pooler (:6543) breaks `supabase db push` (prepared statement errors). Use session pooler. */
function dbUrlForMigrations(url) {
  if (!url) return url
  if (/:6543\//.test(url)) {
    const session = url.replace(/:6543\//, ':5432/')
    console.log('Using session pooler (:5432) for migrations (transaction pooler :6543 is unsupported).')
    return session
  }
  return url
}

const dbUrl = dbUrlForMigrations(rawDbUrl)
if (!dbUrl) {
  console.error(
    'Missing database URL. Add one of:\n' +
      '  • DATABASE_URL (or DATABASE_POOLER_URL / SUPABASE_DB_URL) in .env — Supabase → Project Settings → Database → URI\n' +
      '  • Or create .secrets/database_url with a single line (full postgresql://… URI). See .env.example\n'
  )
  process.exit(1)
}

const r = spawnSync('npx', ['supabase', 'db', 'push', '--db-url', dbUrl, '--yes'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: e,
})
process.exit(r.status ?? 1)
