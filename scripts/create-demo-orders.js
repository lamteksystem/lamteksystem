/**
 * Create/update demo orders in Supabase so the Vercel demo has a working flow:
 * - 1x active "placed" order (shows up in /admin/orders/processing queue)
 * - 1x active "invoiced" order (shows up in queue ready to ship)
 * - 1x archived order (shows up in "Archived orders" list)
 *
 * Usage:
 *   npm run create-demo-orders
 * or:
 *   node --env-file=.env scripts/create-demo-orders.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).')
  process.exit(1)
}

const VAT_RATE = 1.2

const DEMO_CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || 'demo@lamtek.co.uk'
const DEMO_CUSTOMER_COMPANY = process.env.DEMO_CUSTOMER_COMPANY || 'Demo Customer Ltd'
const DEMO_CUSTOMER_CONTACT = process.env.DEMO_CUSTOMER_CONTACT || 'Demo User'
const DEMO_CUSTOMER_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD || 'Demo123!'

const REF_PLACED = process.env.DEMO_ORDER_PLACED_REF || 'DEMO-PLACED-001'
const REF_INVOICED = process.env.DEMO_ORDER_INVOICED_REF || 'DEMO-INVOICED-001'
const REF_ARCHIVED = process.env.DEMO_ORDER_ARCHIVED_REF || 'DEMO-ARCHIVED-001'

// representative product SKUs seeded in seed_components_and_assemblies.sql
const LINE_SKUS = ['HF-715-296', 'CARC-BASE-300', 'HINGE-90-SC', 'LEG-PACK-1', 'FIT-PACK-1']

const DEMO_CUSTOMER_BILLING = process.env.DEMO_CUSTOMER_BILLING || 'Unit 12, Example Industrial Estate'
const DEMO_CUSTOMER_BILLING_CITY = process.env.DEMO_CUSTOMER_BILLING_CITY || 'Kirkby-in-Ashfield'
const DEMO_CUSTOMER_BILLING_POSTCODE = process.env.DEMO_CUSTOMER_BILLING_POSTCODE || 'NG17 7JR'
const DEMO_CUSTOMER_DELIVERY = process.env.DEMO_CUSTOMER_DELIVERY || 'Trade counter deliveries, Bay 3'
const DEMO_CUSTOMER_DELIVERY_CITY = process.env.DEMO_CUSTOMER_DELIVERY_CITY || 'Manchester'
const DEMO_CUSTOMER_DELIVERY_POSTCODE = process.env.DEMO_CUSTOMER_DELIVERY_POSTCODE || 'M1 1AE'
const DEMO_CUSTOMER_PHONE = process.env.DEMO_CUSTOMER_PHONE || '01623 759856'
const DEMO_CUSTOMER_EMAIL_OVERRIDE = process.env.DEMO_CUSTOMER_EMAIL_OVERRIDE || DEMO_CUSTOMER_EMAIL
const DEMO_CUSTOMER_WEBSITE = process.env.DEMO_CUSTOMER_WEBSITE || 'https://example-customer.co.uk'
const DEMO_CUSTOMER_CREDIT_LIMIT = Number(process.env.DEMO_CUSTOMER_CREDIT_LIMIT || 5000)

const DEMO_ORDER_DELIVERY_ADDRESS = process.env.DEMO_ORDER_DELIVERY_ADDRESS || 'Site: Plot 7, Demo New Build, Access via Gate B'
const DEMO_ORDER_DELIVERY_POSTCODE = process.env.DEMO_ORDER_DELIVERY_POSTCODE || 'M2 2BB'
const DEMO_ORDER_DELIVERY_NOTES = process.env.DEMO_ORDER_DELIVERY_NOTES || 'Call 30 minutes before arrival. Forklift on site.'
const DEMO_ORDER_COURIER = process.env.DEMO_ORDER_COURIER || 'DPD'
const DEMO_ORDER_TRACKING = process.env.DEMO_ORDER_TRACKING || 'DPD-DEMO-TRACK-12345'

const ORDER_EVENTS = {
  statusChange: (from, to) => ({
    event_type: 'status_change',
    from_status: from,
    to_status: to,
    note: `Status changed: ${from} → ${to}`,
  }),
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function dec2String(n) {
  return round2(n).toFixed(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function getOrCreateDemoCustomer() {
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === DEMO_CUSTOMER_EMAIL.toLowerCase())
  let userId = found?.id

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_CUSTOMER_EMAIL,
      password: DEMO_CUSTOMER_PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log('Created auth user:', DEMO_CUSTOMER_EMAIL)
  }

  const { error: profileErr } = await supabase.from('customer_profiles').upsert(
    {
      user_id: userId,
      company_name: DEMO_CUSTOMER_COMPANY,
      contact_name: DEMO_CUSTOMER_CONTACT,
      billing_address: DEMO_CUSTOMER_BILLING,
      billing_city: DEMO_CUSTOMER_BILLING_CITY,
      billing_postcode: DEMO_CUSTOMER_BILLING_POSTCODE,
      delivery_address: DEMO_CUSTOMER_DELIVERY,
      delivery_city: DEMO_CUSTOMER_DELIVERY_CITY,
      delivery_postcode: DEMO_CUSTOMER_DELIVERY_POSTCODE,
      phone: DEMO_CUSTOMER_PHONE,
      email_override: DEMO_CUSTOMER_EMAIL_OVERRIDE,
      website: DEMO_CUSTOMER_WEBSITE,
      credit_limit: DEMO_CUSTOMER_CREDIT_LIMIT,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (profileErr) throw profileErr

  return userId
}

async function getProductsBySkus(skus) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, unit_price, image_url, description, options')
    .in('sku', skus)
  if (error) throw error
  const list = (data ?? []).filter((p) => p.sku)
  const map = Object.fromEntries(list.map((p) => [p.sku, p]))
  return map
}

function buildOrderLines(products, skuList) {
  return skuList.map((sku, idx) => {
    const p = products[sku]
    if (!p) throw new Error(`Missing product for sku ${sku}`)
    return {
      product_id: p.id,
      product_snapshot: {
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        description: p.description,
        options: p.options ?? {},
      },
      quantity: 1,
      unit_price: Number(p.unit_price),
      options: p.options ?? {},
      sort_order: idx,
    }
  })
}

function computeTotals(lines) {
  const ex = lines.reduce((sum, l) => sum + Number(l.unit_price) * Number(l.quantity), 0)
  const inc = ex * VAT_RATE
  return { total_ex_vat: dec2String(ex), total_inc_vat: dec2String(inc) }
}

async function insertOrderWithLines({ userId, status, isArchived, reference, lines }) {
  const totals = computeTotals(lines)
  const expected = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    user_id: userId,
    status,
    reference,
    total_ex_vat: totals.total_ex_vat,
    total_inc_vat: totals.total_inc_vat,
    is_archived: isArchived,
    processed_at: status === 'placed' || status === 'invoiced' ? new Date().toISOString() : null,
    delivery_address: DEMO_ORDER_DELIVERY_ADDRESS,
    delivery_postcode: DEMO_ORDER_DELIVERY_POSTCODE,
    delivery_notes: DEMO_ORDER_DELIVERY_NOTES,
    courier: DEMO_ORDER_COURIER,
    delivery_tracking: DEMO_ORDER_TRACKING,
    delivery_expected_date: expected,
    updated_at: new Date().toISOString(),
  }).select('id').single()

  if (orderErr) throw orderErr

  const orderId = order.id
  const toInsert = lines.map((l) => ({
    order_id: orderId,
    product_id: l.product_id,
    product_snapshot: l.product_snapshot,
    quantity: l.quantity,
    unit_price: l.unit_price,
    options: l.options,
  }))

  const { error: linesErr } = await supabase.from('order_lines').insert(toInsert)
  if (linesErr) throw linesErr

  return orderId
}

async function insertOrderEvent(orderId, event) {
  const { error } = await supabase.from('order_events').insert({
    order_id: orderId,
    actor_user_id: null,
    ...event,
  })
  if (error) throw error
}

async function setProductStockForLocation({ productIds, locationId, quantity }) {
  const upserts = productIds.map((product_id) => ({
    product_id,
    location_id: locationId,
    quantity,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('product_stock')
    .upsert(upserts, { onConflict: 'product_id,location_id' })
  if (error) throw error
}

async function main() {
  const userId = await getOrCreateDemoCustomer()
  const products = await getProductsBySkus(LINE_SKUS)

  // Choose products for orders (must match ones inserted in seed scripts)
  const placedSkus = ['HF-715-296', 'HINGE-90-SC']
  const invoicedSkus = ['CARC-BASE-300', 'LEG-PACK-1']
  const archivedSkus = ['HF-715-296', 'FIT-PACK-1']

  // 1) Placed order: update existing order if reference matches, else create
  const { data: placedExisting } = await supabase.from('orders').select('id').eq('reference', REF_PLACED).maybeSingle()
  const placedLines = buildOrderLines(products, placedSkus)

  let placedOrderId = placedExisting?.id
  if (placedOrderId) {
    await supabase.from('order_lines').delete().eq('order_id', placedOrderId)
    await supabase.from('orders').update({
      status: 'placed',
      is_archived: false,
      processed_at: new Date().toISOString(),
      delivery_address: DEMO_ORDER_DELIVERY_ADDRESS,
      delivery_postcode: DEMO_ORDER_DELIVERY_POSTCODE,
      delivery_notes: DEMO_ORDER_DELIVERY_NOTES,
      courier: DEMO_ORDER_COURIER,
      delivery_tracking: DEMO_ORDER_TRACKING,
      delivery_expected_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq('id', placedOrderId)
  } else {
    placedOrderId = await insertOrderWithLines({
      userId,
      status: 'placed',
      isArchived: false,
      reference: REF_PLACED,
      lines: placedLines,
    })
  }
  // ensure lines exist (either after update or create)
  await supabase.from('order_lines').insert(
    placedLines.map((l) => ({
      order_id: placedOrderId,
      product_id: l.product_id,
      product_snapshot: l.product_snapshot,
      quantity: l.quantity,
      unit_price: l.unit_price,
      options: l.options,
    })),
  )
  await supabase.from('order_events').delete().eq('order_id', placedOrderId)
  await insertOrderEvent(placedOrderId, ORDER_EVENTS.statusChange('draft', 'placed'))

  // 2) Invoiced order: create if missing
  const { data: invoicedExisting } = await supabase.from('orders').select('id').eq('reference', REF_INVOICED).maybeSingle()
  const invoicedLines = buildOrderLines(products, invoicedSkus)

  let invoicedOrderId = invoicedExisting?.id
  if (!invoicedOrderId) {
    invoicedOrderId = await insertOrderWithLines({
      userId,
      status: 'placed',
      isArchived: false,
      reference: REF_INVOICED,
      lines: invoicedLines,
    })
  }

  // update to invoiced (so invoice_number trigger fires)
  await supabase.from('order_lines').delete().eq('order_id', invoicedOrderId)
  await supabase.from('order_lines').insert(
    invoicedLines.map((l) => ({
      order_id: invoicedOrderId,
      product_id: l.product_id,
      product_snapshot: l.product_snapshot,
      quantity: l.quantity,
      unit_price: l.unit_price,
      options: l.options,
    })),
  )

  await supabase.from('orders').update({
    status: 'invoiced',
    processed_at: new Date().toISOString(),
    delivery_address: DEMO_ORDER_DELIVERY_ADDRESS,
    delivery_postcode: DEMO_ORDER_DELIVERY_POSTCODE,
    delivery_notes: DEMO_ORDER_DELIVERY_NOTES,
    courier: DEMO_ORDER_COURIER,
    delivery_tracking: DEMO_ORDER_TRACKING,
    delivery_expected_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
    // payment_status is irrelevant for processing queue; keep null
  }).eq('id', invoicedOrderId)

  await supabase.from('order_events').delete().eq('order_id', invoicedOrderId)
  await insertOrderEvent(invoicedOrderId, ORDER_EVENTS.statusChange('draft', 'placed'))
  await insertOrderEvent(invoicedOrderId, ORDER_EVENTS.statusChange('placed', 'invoiced'))

  // Ensure accounting statement shows an invoice for demo realism.
  const { data: invOrderRow } = await supabase.from('orders').select('id, user_id, total_inc_vat, invoice_number').eq('id', invoicedOrderId).single()
  if (invOrderRow) {
    await supabase.from('account_transactions').upsert({
      customer_user_id: invOrderRow.user_id,
      type: 'invoice',
      order_id: invOrderRow.id,
      amount: Number(invOrderRow.total_inc_vat || 0),
      reference: invOrderRow.invoice_number || REF_INVOICED,
      note: 'Demo invoice',
      created_by_staff_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id,type' })
  }

  // 3) Archived order: update or create
  const { data: archivedExisting } = await supabase.from('orders').select('id').eq('reference', REF_ARCHIVED).maybeSingle()
  const archivedLines = buildOrderLines(products, archivedSkus)

  let archivedOrderId = archivedExisting?.id
  if (archivedOrderId) {
    await supabase.from('order_lines').delete().eq('order_id', archivedOrderId)
    await supabase.from('orders').update({
      status: 'placed',
      is_archived: true,
      processed_at: new Date().toISOString(),
      delivery_address: DEMO_ORDER_DELIVERY_ADDRESS,
      delivery_postcode: DEMO_ORDER_DELIVERY_POSTCODE,
      delivery_notes: DEMO_ORDER_DELIVERY_NOTES,
      courier: DEMO_ORDER_COURIER,
      delivery_tracking: DEMO_ORDER_TRACKING,
      delivery_expected_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }).eq('id', archivedOrderId)
  } else {
    archivedOrderId = await insertOrderWithLines({
      userId,
      status: 'placed',
      isArchived: true,
      reference: REF_ARCHIVED,
      lines: archivedLines,
    })
  }
  await supabase.from('order_lines').insert(
    archivedLines.map((l) => ({
      order_id: archivedOrderId,
      product_id: l.product_id,
      product_snapshot: l.product_snapshot,
      quantity: l.quantity,
      unit_price: l.unit_price,
      options: l.options,
    })),
  )
  await supabase.from('order_events').delete().eq('order_id', archivedOrderId)
  await insertOrderEvent(archivedOrderId, ORDER_EVENTS.statusChange('draft', 'placed'))

  // 4) Stock: ensure invoiced items can be shipped if someone clicks the action
  const { data: activeLocations } = await supabase
    .from('locations')
    .select('id')
    .eq('active', true)
    .order('sort_order')
    .order('name')
    .limit(1)
  const locationId = activeLocations?.[0]?.id
  if (locationId) {
    const productIds = invoicedLines.map((l) => l.product_id)
    await setProductStockForLocation({ productIds, locationId, quantity: 50 })
  }

  await supabase
    .from('customer_profiles')
    .update({
      staff_portal_access_consent_at: new Date().toISOString(),
      staff_portal_access_consent_version: '2026-04-01',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  console.log('Demo orders ready:')
  console.log(' - Placed:', REF_PLACED, '=>', placedOrderId)
  console.log(' - Invoiced:', REF_INVOICED, '=>', invoicedOrderId)
  console.log(' - Archived:', REF_ARCHIVED, '=>', archivedOrderId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

