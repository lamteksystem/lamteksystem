import { supabase } from '@/lib/supabase'

/**
 * Carcass finish options shown in the order-start wizard.
 *
 * Free text in the database (`orders.carcass_finish`) but a small,
 * marketing-blessed enum in the UI so we don't accidentally fragment the
 * data across "white", "WHITE", "White " etc. If you want to add a new
 * option, do it here AND on any reporting query that pivots on the value.
 */
export const CARCASS_FINISH_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'light-oak', label: 'Light Oak' },
  { value: 'grey', label: 'Grey' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'other', label: 'Other / custom' },
] as const

export type CarcassFinishCode = (typeof CARCASS_FINISH_OPTIONS)[number]['value']

export function carcassFinishLabel(code: string | null | undefined): string | null {
  if (!code) return null
  const found = CARCASS_FINISH_OPTIONS.find((o) => o.value === code)
  return found ? found.label : code
}

export interface OrderRangeFinishSelection {
  kitchen_range_id: string | null
  door_finish: string | null
  carcass_finish: string | null
}

/**
 * Persist the wizard's three selections onto the draft order row.
 *
 * Returns an `error` string when the database rejects the update so the
 * caller can surface it in the wizard footer; on success returns the
 * updated `OrderRangeFinishSelection`. We deliberately do NOT clear other
 * order columns here — the wizard only owns these three fields.
 */
export async function saveOrderRangeFinish(
  orderId: string,
  selection: OrderRangeFinishSelection,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orders')
    .update({
      kitchen_range_id: selection.kitchen_range_id,
      door_finish: selection.door_finish,
      carcass_finish: selection.carcass_finish,
    })
    .eq('id', orderId)
  return { error: error?.message ?? null }
}
