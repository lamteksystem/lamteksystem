/**
 * Extra demo customers + orders (draft, quotation, placed, cancelled) for CRM / open orders.
 * Run after catalogue seed and create-demo-orders if you want the main demo user too.
 *
 *   npm run seed-rich-demo
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const VAT = 1.2
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EXTRA = [
  { email: 'demo-north@lamtek.co.uk', password: 'Demo123!', company: 'Demo North Kitchens Ltd', contact: 'Sam North' },
  { email: 'demo-south@lamtek.co.uk', password: 'Demo123!', company: 'Demo South Joinery', contact: 'Jo South' },
  { email: 'demo-west@lamtek.co.uk', password: 'Demo123!', company: 'Demo West Trade Counter', contact: 'Pat West' },
]

async function getOrCreateUser({ email, password, company, contact }) {
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  let userId = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log('Created user', email)
  }
  await supabase.from('customer_profiles').upsert(
    {
      user_id: userId,
      company_name: company,
      contact_name: contact,
      billing_address: 'Demo Industrial Park',
      billing_city: 'Manchester',
      billing_postcode: 'M1 1AA',
      phone: '0161 000 0000',
      email_override: email,
      staff_portal_access_consent_at: new Date().toISOString(),
      staff_portal_access_consent_version: '2026-04-01',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  return userId
}

async function getProducts() {
  const { data, error } = await supabase.from('products').select('id, name, sku, unit_price, description, image_url, options').limit(8)
  if (error) throw error
  return data ?? []
}

function lineFromProduct(p, qty = 1) {
  return {
    product_id: p.id,
    product_snapshot: {
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      description: p.description,
      options: p.options ?? {},
    },
    quantity: qty,
    unit_price: Number(p.unit_price),
    options: p.options ?? {},
  }
}

function totals(lines) {
  const ex = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  const inc = ex * VAT
  return { total_ex_vat: ex.toFixed(2), total_inc_vat: inc.toFixed(2) }
}

async function insertOrder(userId, { reference, status, lines, isArchived = false }) {
  const t = totals(lines)
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status,
      reference,
      total_ex_vat: t.total_ex_vat,
      total_inc_vat: t.total_inc_vat,
      is_archived: isArchived,
      processed_at: ['placed', 'invoiced', 'paid'].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  if (lines.length) {
    await supabase.from('order_lines').insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        product_snapshot: l.product_snapshot,
        quantity: l.quantity,
        unit_price: l.unit_price,
        options: l.options,
      })),
    )
  }
  return order.id
}

async function main() {
  const products = await getProducts()
  if (products.length < 2) {
    console.error('Need at least 2 products in DB.')
    process.exit(1)
  }
  const [a, b] = products

  for (const row of EXTRA) {
    const userId = await getOrCreateUser({ ...row, company: row.company, contact: row.contact })
    await insertOrder(userId, {
      reference: `RICH-DRAFT-${row.email.split('@')[0].toUpperCase()}`,
      status: 'draft',
      lines: [lineFromProduct(a, 2), lineFromProduct(b, 1)],
    })
    await insertOrder(userId, {
      reference: `RICH-QUOTE-${row.email.split('@')[0].toUpperCase()}`,
      status: 'quotation',
      lines: [lineFromProduct(a, 1)],
    })
    await insertOrder(userId, {
      reference: `RICH-PLACED-${row.email.split('@')[0].toUpperCase()}`,
      status: 'placed',
      lines: [lineFromProduct(b, 3)],
    })
    await insertOrder(userId, {
      reference: `RICH-VOID-${row.email.split('@')[0].toUpperCase()}`,
      status: 'cancelled',
      lines: [],
    })
    console.log('Seeded orders for', row.email)
  }
  console.log('Rich demo seed complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
