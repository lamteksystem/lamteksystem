/**
 * Create the first admin (staff) user for Trade Mouldings.
 * This is a NODE.JS script — do NOT paste this into the Supabase SQL Editor.
 * Run in your terminal:  npm run create-admin
 * (with SUPABASE_SERVICE_ROLE_KEY and optionally ADMIN_EMAIL, ADMIN_PASSWORD set)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'trademouldingsltd@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMeAdmin1!'
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Trade Mouldings Admin'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and optionally ADMIN_EMAIL, ADMIN_PASSWORD).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  console.log('Creating admin user...')
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true
  })

  if (userError) {
    if (userError.message?.includes('already been registered')) {
      console.log('  User already exists. Ensuring staff_profiles row...')
      const { data: existing } = await supabase.auth.admin.listUsers()
      const user = existing?.users?.find((u) => u.email === ADMIN_EMAIL)
      if (user) {
        const { error: profileErr } = await supabase.from('staff_profiles').upsert(
          { user_id: user.id, role: 'admin', display_name: ADMIN_DISPLAY_NAME, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        if (profileErr) console.error('  staff_profiles upsert failed:', profileErr.message)
        else console.log('  staff_profiles updated for existing user.')
        return
      }
    } else {
      console.error('  Create user failed:', userError.message)
      process.exit(1)
    }
  }

  const userId = userData?.user?.id
  if (!userId) {
    console.error('  No user id returned.')
    process.exit(1)
  }

  const { error: profileError } = await supabase.from('staff_profiles').insert({
    user_id: userId,
    role: 'admin',
    display_name: ADMIN_DISPLAY_NAME
  })

  if (profileError) {
    if (profileError.code === '23505') {
      console.log('  staff_profiles row already exists for this user.')
    } else {
      console.error('  staff_profiles insert failed:', profileError.message)
      process.exit(1)
    }
  } else {
    console.log('  staff_profiles row created (admin).')
  }

  console.log('\nAdmin created:')
  console.log('  Email:', ADMIN_EMAIL)
  console.log('  Password:', ADMIN_PASSWORD)
  console.log('  Display name:', ADMIN_DISPLAY_NAME)
  console.log('\nSign in at /login then go to /admin (Staff backend).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
