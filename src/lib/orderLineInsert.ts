import { supabase } from '@/lib/supabase'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { recalcOrderTotals } from '@/lib/orders'
import type { AssemblyWithLines, ProductRow } from '@/types/database'

export function productSnapshotFromRow(product: ProductRow) {
  return {
    name: product.name,
    description: product.description,
    sku: product.sku,
    image_url: product.image_url,
  }
}

export async function insertProductOrderLines(params: {
  orderId: string
  lines: { product: ProductRow; quantity: number }[]
  customerUserId?: string | null
  repriceCustomer?: boolean
}): Promise<void> {
  const { orderId, lines, customerUserId, repriceCustomer = true } = params
  if (lines.length === 0) return

  const rows = lines.map(({ product, quantity }) => ({
    order_id: orderId,
    product_id: product.id,
    product_snapshot: productSnapshotFromRow(product),
    quantity,
    unit_price: product.unit_price,
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
  const inserts = assemblyLines.flatMap((line) => {
    const product = line.product as ProductRow | undefined
    if (!product) return []
    return {
      order_id: orderId,
      product_id: product.id,
      product_snapshot: productSnapshotFromRow(product),
      quantity: line.quantity * quantity,
      unit_price: product.unit_price,
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
