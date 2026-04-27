import { supabase } from '@/lib/supabase'

interface AdjustStockParams {
  orderId: string
  locationId: string
  lines: { productId: string; quantity: number }[]
  reason: string
}

/** Decrement stock for an order from a given location, recording stock_movements and updating product_stock. */
export async function allocateStockForShipment(params: AdjustStockParams): Promise<void> {
  const { orderId, locationId, lines, reason } = params
  if (!lines.length) return

  const updates = lines.map((l) => ({
    product_id: l.productId,
    location_id: locationId,
    order_id: orderId,
    quantity_delta: -Math.abs(l.quantity),
    reason,
  }))

  const { error } = await supabase.from('stock_movements').insert(updates)
  if (error) throw error

  // Apply to product_stock; rely on DB trigger to keep products.stock_quantity in sync.
  // Note: this is not atomic; if you need strict accuracy under concurrency, move this into a single SQL function.
  for (const line of lines) {
    const { data, error: fetchError } = await supabase
      .from('product_stock')
      .select('quantity')
      .eq('product_id', line.productId)
      .eq('location_id', locationId)
      .maybeSingle()
    if (fetchError) throw fetchError
    const currentQty = data?.quantity ?? 0
    const nextQty = Math.max(0, currentQty - Math.abs(line.quantity))
    const { error: upsertError } = await supabase
      .from('product_stock')
      .upsert(
        { product_id: line.productId, location_id: locationId, quantity: nextQty },
        { onConflict: 'product_id,location_id' }
      )
    if (upsertError) throw upsertError
  }
}

/** Atomic server-side allocation using `allocate_stock_for_order_shipment` SQL function. */
export async function allocateStockForOrderShipmentAtomic(params: {
  orderId: string
  locationId: string
  reason?: string
}): Promise<void> {
  const { error } = await supabase.rpc('allocate_stock_for_order_shipment', {
    p_order_id: params.orderId,
    p_location_id: params.locationId,
    p_reason: params.reason ?? 'shipment',
  })
  if (error) throw error
}

