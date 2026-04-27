import { supabase } from '@/lib/supabase'
import { VAT_RATE } from '@/lib/tax'

/** Recalculate and persist order totals (ex/incl VAT) from its order_lines. */
export async function recalcOrderTotals(orderId: string): Promise<void> {
  const { data: lines, error } = await supabase
    .from('order_lines')
    .select('quantity, unit_price')
    .eq('order_id', orderId)
  if (error) throw error
  const totalExVat = (lines ?? []).reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unit_price),
    0
  )
  const totalIncVat = totalExVat * VAT_RATE
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      total_ex_vat: totalExVat,
      total_inc_vat: totalIncVat,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
  if (updateError) throw updateError
}

