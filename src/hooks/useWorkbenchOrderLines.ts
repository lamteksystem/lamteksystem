import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WorkbenchOrderLine {
  id: string
  quantity: number
  unit_price: number
  product_id: string | null
  product_snapshot: {
    name?: string
    description?: string
    sku?: string
    image_url?: string
  }
  options: Record<string, unknown>
}

export function useWorkbenchOrderLines(orderId: string | null | undefined, refreshToken = 0) {
  const [lines, setLines] = useState<WorkbenchOrderLine[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!orderId) {
      setLines([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('order_lines')
      .select('id, quantity, unit_price, product_id, product_snapshot, options')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    setLines(
      (data ?? []).map((row) => ({
        id: row.id,
        quantity: row.quantity,
        unit_price: Number(row.unit_price),
        product_id: row.product_id,
        product_snapshot: (row.product_snapshot ?? {}) as WorkbenchOrderLine['product_snapshot'],
        options:
          row.options && typeof row.options === 'object' && !Array.isArray(row.options)
            ? (row.options as Record<string, unknown>)
            : {},
      })),
    )
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    void reload()
  }, [reload, refreshToken])

  return { lines, loading, reload }
}
