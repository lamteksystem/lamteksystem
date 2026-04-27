/**
 * One-time setup: create storage buckets and a test user.
 * This is a NODE.JS script — do NOT paste this into the Supabase SQL Editor.
 * Run in your terminal:  npm run setup:supabase
 * (with SUPABASE_SERVICE_ROLE_KEY set). Then run 002_storage_policies.sql in SQL Editor.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'customer@example.com'
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TradeMouldings1!'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Set them in the environment or in a .env file (use dotenv or export).')
  console.error('Get the service role key from: Supabase Dashboard → Project Settings → API → service_role (secret)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Creating storage buckets...')

  const buckets = [
    { name: 'documents', public: true },  // public so View/Download links work for brochures, pricelist, door finder
    { name: 'product-images', public: true }
  ]

  for (const { name, public: isPublic } of buckets) {
    const { data, error } = await supabase.storage.createBucket(name, {
      public: isPublic,
      fileSizeLimit: isPublic ? 5242880 : 52428800 // 5MB product images / 50MB documents (pricelist PDFs)
    })
    if (error) {
      if (error.message?.includes('already exists') || error.message?.includes('Bucket already exists')) {
        console.log(`  Bucket "${name}" already exists, skipping.`)
      } else {
        console.error(`  Failed to create bucket "${name}":`, error.message)
      }
    } else {
      console.log(`  Created bucket: ${name} (public: ${isPublic})`)
    }
  }

  console.log('\nCreating test user...')
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true
  })

  if (userError) {
    if (userError.message?.includes('already been registered')) {
      console.log('  Test user already exists. Use that email/password to sign in.')
    } else {
      console.error('  Failed to create user:', userError.message)
    }
  } else {
    console.log(`  Created user: ${TEST_USER_EMAIL}`)
    console.log(`  Password: ${TEST_USER_PASSWORD}`)
    console.log('  (Change the password after first login if needed.)')
  }

  console.log('\nDone. Next: run supabase/migrations/002_storage_policies.sql in the Supabase SQL Editor.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
