import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useMtoCartRefresh } from '@/components/MtoLayout'
import { recalcOrderTotals } from '@/lib/orders'

export interface MtoSnapshot {
  name: string
  description?: string
  sku?: string
}

export function useAddMtoLine() {
  const { ensureDraftOrder } = useDraftOrder()
  const refreshCart = useMtoCartRefresh()

  const addMtoLine = useCallback(
    async (
      snapshot: MtoSnapshot,
      options: Record<string, unknown>,
      unitPrice: number,
      quantity: number
    ) => {
      const orderId = await ensureDraftOrder()
      const { error } = await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: null,
        product_snapshot: snapshot,
        quantity,
        unit_price: unitPrice,
        options,
      })
      if (error) throw error
      await recalcOrderTotals(orderId)
      refreshCart()
    },
    [ensureDraftOrder, refreshCart]
  )

  return { addMtoLine }
}
