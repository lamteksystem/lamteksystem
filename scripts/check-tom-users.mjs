/**
 * One-off: check which of the expected admin / demo / dummy users exist in
 * the live Supabase project, and whether their staff_profiles / customer_profiles
 * rows are in place.
 * Run: node --env-file=.env scripts/check-tom-users.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

const TARGETS = [
  { email: 'lamteksystem@gmail.com', kind: 'admin' },
  { email: 'demo@lamtek.co.uk', kind: 'customer' },
  { email: 'staff1@Lamtek.com', kind: 'staff' },
  { email: 'staff2@Lamtek.com', kind: 'staff' },
  { email: 'customer1@example.com', kind: 'customer' },
  { email: 'customer2@example.com', kind: 'customer' },
  { email: 'customer3@example.com', kind: 'customer' },
]

async function listAll() {
  const users = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const chunk = data?.users || []
    users.push(...chunk)
    if (chunk.length < 200) break
    page += 1
  }
  return users
}

async function main() {
  const all = await listAll()
  const byEmail = new Map(all.map((u) => [String(u.email || '').toLowerCase(), u]))

  const staffIds = new Set(
    (await supabase.from('staff_profiles').select('user_id, role')).data?.map((r) => r.user_id) || [],
  )
  const customerIds = new Set(
    (await supabase.from('customer_profiles').select('user_id')).data?.map((r) => r.user_id) || [],
  )

  for (const t of TARGETS) {
    const u = byEmail.get(t.email.toLowerCase())
    if (!u) {
      console.log(`MISSING  ${t.email}  (expected ${t.kind})`)
      continue
    }
    let profileOk = false
    if (t.kind === 'admin' || t.kind === 'staff') profileOk = staffIds.has(u.id)
    else profileOk = customerIds.has(u.id)
    const confirmed = !!u.email_confirmed_at
    console.log(
      `OK       ${t.email.padEnd(28)}  kind=${t.kind.padEnd(8)}  profile=${profileOk ? 'yes' : 'NO'}  confirmed=${confirmed ? 'yes' : 'NO'}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
