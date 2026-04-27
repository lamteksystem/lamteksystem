/**
 * Create a single demo customer user for testing and "View as customer".
 * Run: npm run create-demo-customer
 * (with SUPABASE_SERVICE_ROLE_KEY in .env)
 *
 * Default: demo@lamtek.co.uk / Demo123!
 * Set DEMO_CUSTOMER_EMAIL and DEMO_CUSTOMER_PASSWORD in .env to override.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || 'demo@lamtek.co.uk'
const DEMO_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD || 'Demo123!'
const DEMO_COMPANY = process.env.DEMO_CUSTOMER_COMPANY || 'Demo Customer Ltd'
const DEMO_CONTACT = process.env.DEMO_CUSTOMER_CONTACT || 'Demo User'
const DEMO_ALLOW_VIEW_AS = (process.env.DEMO_CUSTOMER_ALLOW_VIEW_AS ?? 'true') !== 'false'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  console.log('Creating demo customer for "View as customer"...\n')

  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())

  let userId
  if (found) {
    console.log('  Auth user already exists:', DEMO_EMAIL)
    userId = found.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error('  Create user failed:', error.message)
      process.exit(1)
    }
    userId = data.user.id
    console.log('  Created auth user:', DEMO_EMAIL)
  }

  const { error: profileErr } = await supabase.from('customer_profiles').upsert(
    {
      user_id: userId,
      company_name: DEMO_COMPANY,
      contact_name: DEMO_CONTACT,
      updated_at: new Date().toISOString(),
      staff_portal_access_consent_at: DEMO_ALLOW_VIEW_AS ? new Date().toISOString() : null,
      staff_portal_access_consent_version: DEMO_ALLOW_VIEW_AS ? '2026-04-01' : null,
    },
    { onConflict: 'user_id' }
  )
  if (profileErr) {
    console.error('  Customer profile failed:', profileErr.message)
    process.exit(1)
  }
  console.log('  Customer profile OK:', DEMO_CONTACT, '·', DEMO_COMPANY)

  console.log('\nDone. Demo customer:')
  console.log('  Email:', DEMO_EMAIL)
  console.log('  Password:', DEMO_PASSWORD)
  console.log('\nFrom Admin: use "View as customer" and select "' + DEMO_CONTACT + ' · ' + DEMO_COMPANY + '" to view the portal as this user.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
