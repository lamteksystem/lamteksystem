import { supabase } from '@/lib/supabase'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { recalcOrderTotals } from '@/lib/orders'
import { effectiveBaseUnitPrice } from '@/lib/finishPricing'
import type { AssemblyWithLines, ProductRow } from '@/types/database'

export function productSnapshotFromRow(product: ProductRow) {
  return {
    name: product.name,
    description: product.description,
    sku: product.sku,
    image_url: product.image_url,
  }
}

/** The order's chosen door/range finish (drives finish-aware base pricing). */
async function getOrderDoorFinish(orderId: string): Promise<string | null> {
  const { data } = await supabase.from('orders').select('door_finish').eq('id', orderId).maybeSingle()
  return ((data?.door_finish as string | null) ?? null) || null
}

export async function insertProductOrderLines(params: {
  orderId: string
  lines: { product: ProductRow; quantity: number }[]
  customerUserId?: string | null
  repriceCustomer?: boolean
}): Promise<void> {
  const { orderId, lines, customerUserId, repriceCustomer = true } = params
  if (lines.length === 0) return

  const doorFinish = await getOrderDoorFinish(orderId)
  const rows = lines.map(({ product, quantity }) => ({
    order_id: orderId,
    product_id: product.id,
    product_snapshot: productSnapshotFromRow(product),
    quantity,
    unit_price: effectiveBaseUnitPrice(product, doorFinish),
    options: product.options ?? {},
  }))

  const { error } = await supabase.from('order_lines').insert(rows)
  if (error) throw error

  if (repriceCustomer && customerUserId) {
    await repriceDraftOrderLinesForCustomer({ orderId, customerUserId })
  } else {
    await recalcOrderTotals(orderId)
  }
}

export async function insertAssemblyOrderLines(params: {
  orderId: string
  assembly: AssemblyWithLines
  quantity: number
  customerUserId?: string | null
  repriceCustomer?: boolean
}): Promise<void> {
  const { orderId, assembly, quantity, customerUserId, repriceCustomer = true } = params
  const assemblyLines = assembly.assembly_lines ?? []
  const doorFinish = await getOrderDoorFinish(orderId)
  const inserts = assemblyLines.flatMap((line) => {
    const product = line.product as ProductRow | undefined
    if (!product) return []
    // Door/range-finished components (e.g. the doors) price from the chosen
    // finish; carcass, legs and fittings have no finish matrix so keep unit_price.
    return {
      order_id: orderId,
      product_id: product.id,
      product_snapshot: productSnapshotFromRow(product),
      quantity: line.quantity * quantity,
      unit_price: effectiveBaseUnitPrice(product, doorFinish),
      options: product.options ?? {},
    }
  })
  if (inserts.length === 0) return
  const { error } = await supabase.from('order_lines').insert(inserts)
  if (error) throw error
  if (repriceCustomer && customerUserId) {
    await repriceDraftOrderLinesForCustomer({ orderId, customerUserId })
  } else {
    await recalcOrderTotals(orderId)
  }
}
