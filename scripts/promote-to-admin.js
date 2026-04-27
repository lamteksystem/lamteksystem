/**
 * Promote an existing user to admin by adding/updating their staff_profiles row.
 * Use this to make trademouldingsltd@gmail.com (or any existing account) an admin.
 * Run: npm run promote-to-admin
 * (with SUPABASE_SERVICE_ROLE_KEY and PROMOTE_EMAIL set in .env)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PROMOTE_EMAIL = process.env.PROMOTE_EMAIL || 'trademouldingsltd@gmail.com'
const DISPLAY_NAME = process.env.PROMOTE_DISPLAY_NAME || 'Trade Mouldings Admin'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Looking up user by email:', PROMOTE_EMAIL)
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const user = list?.users?.find((u) => u.email?.toLowerCase() === PROMOTE_EMAIL.toLowerCase())
  if (!user) {
    console.error('No user found with that email. Create the account first (e.g. sign up) or use create-admin to create a new admin.')
    process.exit(1)
  }

  const { error } = await supabase.from('staff_profiles').upsert(
    { user_id: user.id, role: 'admin', display_name: DISPLAY_NAME, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) {
    console.error('staff_profiles upsert failed:', error.message)
    process.exit(1)
  }
  console.log('Done. User', PROMOTE_EMAIL, 'is now an admin. Sign in at /login and you’ll be redirected to /admin.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
