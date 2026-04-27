/**
 * Apply local supabase/migrations to the database in VITE project.
 * Requires DATABASE_URL in .env (Supabase → Project Settings → Database → URI, with password).
 * Run: node --env-file=.env scripts/push-migrations.mjs
 */
import { readFileSync } from 'node:fs'
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

const e = { ...process.env, ...loadEnv() }
const dbUrl = e.DATABASE_URL
if (!dbUrl) {
  console.error('Missing DATABASE_URL in .env. See docs/SETUP_GITHUB_AND_SUPABASE.md')
  process.exit(1)
}

const r = spawnSync('npx', ['supabase', 'db', 'push', '--db-url', dbUrl], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: e,
})
process.exit(r.status ?? 1)
