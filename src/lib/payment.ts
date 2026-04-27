import { supabase } from '@/lib/supabase'

/**
 * Create a Stripe Checkout Session for the order and redirect to Stripe.
 * amount_inc_vat is in pounds (e.g. 120.50); we convert to pence for Stripe.
 */
export async function redirectToCheckout(orderId: string, amountIncVat: number): Promise<{ error?: string }> {
  const origin = window.location.origin
  const successUrl = `${origin}/account/orders/${orderId}?payment=success`
  const cancelUrl = `${origin}/account/orders/${orderId}?payment=cancelled`
  const amountPence = Math.round(amountIncVat * 100)
  if (amountPence < 50) {
    return { error: 'Amount must be at least £0.50' }
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { order_id: orderId, amount_pence: amountPence, success_url: successUrl, cancel_url: cancelUrl },
  })

  if (error) {
    return { error: error.message || 'Failed to start payment' }
  }
  const url = (data as { url?: string })?.url
  if (!url) {
    return { error: (data as { error?: string })?.error || 'No payment URL returned' }
  }
  window.location.href = url
  return {}
}

/**
 * Verify a Stripe Checkout Session (after redirect) and mark order as paid.
 */
export async function verifyCheckoutSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
    body: { session_id: sessionId },
  })

  if (error) {
    return { success: false, error: error.message }
  }
  const result = data as { success?: boolean; error?: string }
  if (result.error) {
    return { success: false, error: result.error }
  }
  return { success: true }
}
