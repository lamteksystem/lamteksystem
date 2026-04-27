// Verify a Stripe Checkout Session and mark the order as paid. Call after redirect from Stripe.
// Requires: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY (or use RPC from client with auth).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { session_id } = await req.json()
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' })
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Payment not completed', paid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orderId = session.metadata?.order_id
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'No order in session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: order, error: orderFetchErr } = await supabase
      .from('orders')
      .select('id, user_id, total_inc_vat, invoice_number')
      .eq('id', orderId)
      .single()
    if (orderFetchErr || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_intent_id: session.id,
        payment_status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Best-effort: create statement line (if accounting migration is installed, triggers may also handle this).
    try {
      await supabase.from('account_transactions').insert({
        customer_user_id: order.user_id,
        type: 'payment',
        order_id: order.id,
        amount: -Number(order.total_inc_vat || 0),
        reference: session.id,
        note: 'Stripe payment',
        created_by_staff_id: null,
      })
    } catch (_) {
      // ignore; unique constraint may already exist
    }

    return new Response(
      JSON.stringify({ success: true, order_id: orderId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
