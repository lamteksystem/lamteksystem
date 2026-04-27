// Staff-only: notify customer about an order status change.
// Channels:
// - portal: inserts into public.user_notifications (customer inbox)
// - email: sends via Resend (optional) + records user_notifications
// - sms: optional Twilio send + records user_notifications
//
// Requires Edge Function secrets:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY (to look up auth user email)
// Optional:
// - RESEND_API_KEY
// - RESEND_FROM_EMAIL (e.g. "Lamtek <no-reply@lamtek.co.uk>")
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_FROM_NUMBER

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  order_id: string
  to_status: string
  title?: string
  message?: string
  send_portal?: boolean
  send_email?: boolean
  send_sms?: boolean
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json(500, { error: 'Server not configured' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Unauthorized' })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  if (!body.order_id || !body.to_status) return json(400, { error: 'Missing order_id or to_status' })

  const sendPortal = body.send_portal !== false
  const sendEmail = body.send_email === true
  const sendSms = body.send_sms === true
  if (!sendPortal && !sendEmail && !sendSms) return json(400, { error: 'No channels selected' })

  // Caller auth (RLS enforced for reads via anon key + Authorization header)
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await supabaseAuth.auth.getUser()
  if (!caller) return json(401, { error: 'Unauthorized' })

  const { data: staffRow } = await supabaseAuth
    .from('staff_profiles')
    .select('id')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (!staffRow) return json(403, { error: 'Staff only' })

  const { data: order, error: orderError } = await supabaseAuth
    .from('orders')
    .select('id, user_id, status, reference')
    .eq('id', body.order_id)
    .single()
  if (orderError || !order) return json(404, { error: 'Order not found' })

  const customerUserId = order.user_id as string

  // Prefer CRM override email if present.
  const { data: profile } = await supabaseAuth
    .from('customer_profiles')
    .select('email_override, phone')
    .eq('user_id', customerUserId)
    .maybeSingle()

  const title = (body.title || `Order ${order.reference || order.id.slice(0, 8)} update`).trim()
  const message = (body.message || `Your order status is now: ${body.to_status}`).trim()
  const link = `/account/orders/${order.id}`

  const delivered = { portal: false, email: false, sms: false }

  // Portal notification (inbox)
  if (sendPortal) {
    const { error } = await supabaseAuth.from('user_notifications').insert({
      user_id: customerUserId,
      order_id: order.id,
      title,
      body: message,
      link,
      channel: 'portal',
      sent_at: new Date().toISOString(),
    })
    if (error) return json(400, { error: error.message })
    delivered.portal = true
  }

  // Email via Resend (optional)
  if (sendEmail) {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')
    if (!resendKey || !resendFrom) return json(500, { error: 'Email provider not configured' })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(customerUserId)
    if (userErr || !userRes?.user?.email) return json(400, { error: 'Customer email not available' })
    const toEmail = (profile as { email_override?: string | null } | null)?.email_override || userRes.user.email

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [toEmail],
        subject: title,
        text: message,
      }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return json(502, { error: `Email send failed (${resp.status})`, details: txt })
    }
    delivered.email = true

    await supabaseAuth.from('user_notifications').insert({
      user_id: customerUserId,
      order_id: order.id,
      title,
      body: message,
      link,
      channel: 'email',
      sent_at: new Date().toISOString(),
    })
  }

  // SMS via Twilio (optional)
  if (sendSms) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')
    const from = Deno.env.get('TWILIO_FROM_NUMBER')
    const to = (profile as { phone?: string | null } | null)?.phone
    if (!sid || !token || !from) return json(500, { error: 'SMS provider not configured' })
    if (!to) return json(400, { error: 'Customer phone not available' })

    const form = new URLSearchParams()
    form.set('From', from)
    form.set('To', to)
    form.set('Body', `${title}\n\n${message}`)

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return json(502, { error: `SMS send failed (${resp.status})`, details: txt })
    }
    delivered.sms = true

    await supabaseAuth.from('user_notifications').insert({
      user_id: customerUserId,
      order_id: order.id,
      title,
      body: message,
      link,
      channel: 'sms',
      sent_at: new Date().toISOString(),
    })
  }

  return json(200, { ok: true, delivered })
})

