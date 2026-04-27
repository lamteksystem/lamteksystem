/**
 * Run seed SQL files against the linked Supabase remote database.
 * Requires DATABASE_URL in .env (Supabase Dashboard → Project Settings → Database → Connection string → URI).
 * Usage: npm run seed   (or: node --env-file=.env scripts/run-seed.js)
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const supabase = join(root, 'supabase')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL.')
  console.error('Add it to .env from: Supabase Dashboard → Project Settings → Database → Connection string → URI')
  process.exit(1)
}

const seedFiles = [
  join(supabase, 'seed_sample.sql'),
  join(supabase, 'seed_components_and_assemblies.sql'),
  join(supabase, 'seed_extended_catalogue.sql'),
]

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    console.log('Connected to database.\n')
    for (const file of seedFiles) {
      const sql = readFileSync(file, 'utf8')
      const name = file.split(/[/\\]/).pop()
      console.log(`Running ${name}...`)
      await client.query(sql)
      console.log(`  Done.\n`)
    }
    console.log('Seeding complete.')
  } catch (err) {
    console.error('Seed failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
