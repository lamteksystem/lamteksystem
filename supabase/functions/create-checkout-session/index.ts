// Create a Stripe Checkout Session for an order. Call from frontend with order_id and return URL.
// Requires: STRIPE_SECRET_KEY in Supabase Edge Function secrets.
// Verifies the request is from the order owner via Supabase RLS.

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
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!stripeKey || !supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { order_id, amount_pence, success_url, cancel_url } = await req.json()
    if (!order_id || amount_pence == null || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id, amount_pence, success_url or cancel_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    })
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total_inc_vat, status')
      .eq('id', order_id)
      .single()
    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (order.status === 'paid' || order.status === 'cancelled' || order.status === 'draft') {
      return new Response(
        JSON.stringify({ error: 'Order cannot be paid in its current state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(amount_pence),
            product_data: {
              name: `Order ${order_id.slice(0, 8)}`,
              description: 'Lamtek order payment',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { order_id },
      success_url,
      cancel_url,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Failed to create session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
