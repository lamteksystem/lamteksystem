/**
 * Create dummy staff and dummy customers for testing.
 * Uses Supabase Auth Admin + staff_profiles / customer_profiles.
 * Run: npm run seed-dummy-users
 * (with SUPABASE_SERVICE_ROLE_KEY in .env)
 * All dummy users use password: Test123!
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TEST_PASSWORD = process.env.DUMMY_PASSWORD || 'Test123!'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const DUMMY_STAFF = [
  { email: 'staff1@trademouldings.com', display_name: 'Staff One', role: 'staff' },
  { email: 'staff2@trademouldings.com', display_name: 'Staff Two', role: 'staff' },
]

const DUMMY_CUSTOMERS = [
  { email: 'customer1@example.com', company_name: 'Example Kitchen Co', contact_name: 'Alice Smith' },
  { email: 'customer2@example.com', company_name: 'Build Right Ltd', contact_name: 'Bob Jones' },
  { email: 'customer3@example.com', company_name: 'Home Fit Out', contact_name: 'Carol Brown' },
]

async function ensureUser(email, options = {}) {
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) return { user: found, created: false }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: options.password ?? TEST_PASSWORD,
    email_confirm: true
  })
  if (error) throw new Error(`create user ${email}: ${error.message}`)
  return { user: data.user, created: true }
}

async function main() {
  console.log('Creating dummy staff and customers (password for all: ' + TEST_PASSWORD + ')\n')

  for (const s of DUMMY_STAFF) {
    const { user, created } = await ensureUser(s.email)
    if (created) console.log('  Created staff user:', s.email)
    const { error } = await supabase.from('staff_profiles').upsert(
      { user_id: user.id, role: s.role, display_name: s.display_name, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error && error.code !== '23505') throw new Error(`staff_profiles ${s.email}: ${error.message}`)
    if (!created) console.log('  Staff profile OK:', s.email)
  }
  console.log('')

  for (const c of DUMMY_CUSTOMERS) {
    const { user, created } = await ensureUser(c.email)
    if (created) console.log('  Created customer:', c.email)
    const { error } = await supabase.from('customer_profiles').upsert(
      { user_id: user.id, company_name: c.company_name, contact_name: c.contact_name, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error && error.code !== '23505') throw new Error(`customer_profiles ${c.email}: ${error.message}`)
    if (!created) console.log('  Customer profile OK:', c.email)
  }

  console.log('\nDone. Sign in with any of the above emails and password:', TEST_PASSWORD)
  console.log('Staff can use /admin; customers see the normal portal.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
