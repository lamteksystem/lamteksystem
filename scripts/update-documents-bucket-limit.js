/**
 * Increase the documents bucket file size limit so large PDFs (pricelist, brochure) can be uploaded.
 * Run: node --env-file=.env scripts/update-documents-bucket-limit.js
 * Requires: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// 50 MB (Supabase free plan max per file)
const FIFTY_MB = 50 * 1024 * 1024

async function main() {
  const { data, error } = await supabase.storage.updateBucket('documents', {
    fileSizeLimit: FIFTY_MB,
  })
  if (error) {
    console.error('Failed to update bucket:', error.message)
    process.exit(1)
  }
  console.log('Updated "documents" bucket: file size limit set to 50 MB.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
