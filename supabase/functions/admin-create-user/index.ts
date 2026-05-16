// Admin-only: create users (customer, staff, admin, supplier). Call with staff JWT.
// Requires: SUPABASE_SERVICE_ROLE_KEY in Supabase Edge Function secrets.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type UserType = 'customer' | 'staff' | 'admin' | 'supplier'

interface CreateUserBody {
  email: string
  password: string
  type: UserType
  company_name?: string
  contact_name?: string
  display_name?: string
  customer_group_id?: string
  customer_location_id?: string
  trade_type_id?: string
  company_type_id?: string
  account_discount_percent?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user: caller } } = await supabaseAuth.auth.getUser()
  if (!caller) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: staffRow } = await supabaseAuth
    .from('staff_profiles')
    .select('id')
    .eq('user_id', caller.id)
    .maybeSingle()

  if (!staffRow) {
    return new Response(
      JSON.stringify({ error: 'Staff only' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: CreateUserBody
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { email, password, type, company_name, contact_name, display_name, customer_group_id, customer_location_id, trade_type_id, company_type_id, account_discount_percent } = body
  if (!email || !password || !type) {
    return new Response(
      JSON.stringify({ error: 'Missing email, password or type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const validTypes: UserType[] = ['customer', 'staff', 'admin', 'supplier']
  if (!validTypes.includes(type)) {
    return new Response(
      JSON.stringify({ error: 'Invalid type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (createError) {
    return new Response(
      JSON.stringify({ error: createError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const userId = newUser?.user?.id
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User not created' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let accountDiscountInsert: number | null = null
  if (typeof account_discount_percent === 'number' && Number.isFinite(account_discount_percent)) {
    const rounded = Math.min(100, Math.max(0, account_discount_percent))
    accountDiscountInsert = rounded > 0 ? rounded : null
  }

  if (type === 'customer') {
    const { error: profileError } = await supabaseAdmin
      .from('customer_profiles')
      .insert({
        user_id: userId,
        company_name: (company_name || email).trim(),
        contact_name: (contact_name || '').trim() || null,
        customer_group_id: customer_group_id || null,
        customer_location_id: customer_location_id || null,
        trade_type_id: trade_type_id || null,
        company_type_id: company_type_id || null,
        account_discount_percent: accountDiscountInsert,
      })
    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Customer profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  if (type === 'staff' || type === 'admin') {
    const { error: profileError } = await supabaseAdmin
      .from('staff_profiles')
      .insert({
        user_id: userId,
        role: type,
        display_name: (display_name || '').trim() || null,
      })
    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Staff profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  if (type === 'supplier') {
    const { error: supplierError } = await supabaseAdmin
      .from('suppliers')
      .insert({
        user_id: userId,
        company_name: (company_name || email).trim(),
        contact_name: (contact_name || '').trim() || null,
        email: email.trim(),
      })
    if (supplierError) {
      return new Response(
        JSON.stringify({ error: `Supplier: ${supplierError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response(
    JSON.stringify({ id: userId, email: newUser.user?.email, type }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
