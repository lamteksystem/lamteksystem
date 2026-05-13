/**
 * Ensure Lamtek admin/demo users exist and remove non-Lamtek legacy accounts.
 * Run: node --env-file=.env scripts/setup-lamtek-admin.js
 * Requires: SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const LAMTEK_ADMIN_EMAIL = process.env.LAMTEK_ADMIN_EMAIL || 'lamteksystem@gmail.com'
const LAMTEK_ADMIN_PASSWORD = process.env.LAMTEK_ADMIN_PASSWORD || 'LamtekSystem26'
const LAMTEK_ADMIN_DISPLAY = process.env.LAMTEK_ADMIN_DISPLAY || 'Lamtek Admin'

const LAMTEK_DEMO_EMAIL = process.env.LAMTEK_DEMO_EMAIL || 'demo@lamtek.co.uk'
const LAMTEK_DEMO_PASSWORD = process.env.LAMTEK_DEMO_PASSWORD || 'Demo123!'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const LEGACY_EMAILS = (process.env.LEGACY_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function matchesLegacy(email) {
  const e = String(email || '').toLowerCase()
  if (!e) return false
  if (LEGACY_EMAILS.includes(e)) return true
  return e.endsWith('@gmail.com') && e !== LAMTEK_ADMIN_EMAIL.toLowerCase()
}

async function listAllUsers() {
  const users = []
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`list users failed on page ${page}: ${error.message}`)
    const chunk = data?.users || []
    users.push(...chunk)
    if (chunk.length < perPage) break
    page += 1
  }
  return users
}

async function ensureUser(email, password) {
  const all = await listAllUsers()
  const existing = all.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
  if (existing) {
    const { error: upErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    })
    if (upErr) throw new Error(`update user ${email} failed: ${upErr.message}`)
    return { user: existing, created: false }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data?.user) throw new Error(`create user ${email} failed: ${error?.message || 'unknown error'}`)
  return { user: data.user, created: true }
}

async function removeLegacyUsers() {
  const all = await listAllUsers()
  const legacy = all.filter((u) => matchesLegacy(u.email))
  if (legacy.length === 0) {
    console.log('No removable legacy users found.')
    return
  }
  console.log(`Removing ${legacy.length} legacy user(s)...`)
  for (const user of legacy) {
    const email = user.email || user.id
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`  Failed to delete ${email}: ${error.message}`)
    } else {
      console.log(`  Deleted legacy user: ${email}`)
    }
  }
}

async function ensureAdminProfile(userId) {
  const { error } = await supabase.from('staff_profiles').upsert(
    {
      user_id: userId,
      role: 'admin',
      display_name: LAMTEK_ADMIN_DISPLAY,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`staff_profiles upsert failed: ${error.message}`)
}

async function ensureDemoProfile(userId) {
  const { error } = await supabase.from('customer_profiles').upsert(
    {
      user_id: userId,
      company_name: 'Lamtek Demo Account',
      contact_name: 'Lamtek Demo',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`customer_profiles upsert failed: ${error.message}`)
}

async function main() {
  console.log('Configuring Lamtek admin and demo users...')
  const admin = await ensureUser(LAMTEK_ADMIN_EMAIL, LAMTEK_ADMIN_PASSWORD)
  await ensureAdminProfile(admin.user.id)
  console.log(`Admin ${admin.created ? 'created' : 'updated'}: ${LAMTEK_ADMIN_EMAIL}`)

  const demo = await ensureUser(LAMTEK_DEMO_EMAIL, LAMTEK_DEMO_PASSWORD)
  await ensureDemoProfile(demo.user.id)
  console.log(`Demo ${demo.created ? 'created' : 'updated'}: ${LAMTEK_DEMO_EMAIL}`)

  await removeLegacyUsers()

  console.log('Done.')
  console.log(`Admin login: ${LAMTEK_ADMIN_EMAIL} / ${LAMTEK_ADMIN_PASSWORD}`)
  console.log(`Demo login:  ${LAMTEK_DEMO_EMAIL} / ${LAMTEK_DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
