import { supabase } from '@/lib/supabase'
import { recalcOrderTotals } from '@/lib/orders'
import { resolveCustomerPrice, normalizeAccountDiscountPercent, type CustomerSegmentIds } from '@/lib/pricing'
import { effectiveBaseUnitPrice } from '@/lib/finishPricing'
import type { OrderLineRow, ProductRow } from '@/types/database'

async function getCustomerPricingContext(customerUserId: string): Promise<{
  segment: CustomerSegmentIds
  accountDiscountPercent: number | null
}> {
  const { data } = await supabase
    .from('customer_profiles')
    .select('customer_group_id, customer_location_id, trade_type_id, company_type_id, account_discount_percent')
    .eq('user_id', customerUserId)
    .maybeSingle()

  const raw = data?.account_discount_percent

  return {
    segment: {
      customer_group_id: data?.customer_group_id ?? null,
      customer_location_id: data?.customer_location_id ?? null,
      trade_type_id: data?.trade_type_id ?? null,
      company_type_id: data?.company_type_id ?? null,
    },
    accountDiscountPercent: normalizeAccountDiscountPercent(raw),
  }
}

async function getProductsMap(productIds: string[]): Promise<Map<string, ProductRow>> {
  const { data } = await supabase
    .from('products')
    .select('id, unit_price, category_id, options')
    .in('id', productIds)

  const map = new Map<string, ProductRow>()
  ;(data ?? []).forEach((p) => map.set((p as ProductRow).id, p as ProductRow))
  return map
}

/**
 * Reprice draft order lines using `customer_price_rules` and optional `account_discount_percent` on the customer profile.
 * - Runs two passes to reduce dependency issues when promotions use `min_order_total_ex_vat`.
 * - Updates `order_lines.unit_price` and then recalculates order totals.
 */
export async function repriceDraftOrderLinesForCustomer(params: {
  orderId: string
  customerUserId: string
  collectionIds?: string[]
}): Promise<void> {
  const { orderId, customerUserId, collectionIds } = params

  const [{ segment, accountDiscountPercent }, orderRes, linesRes] = await Promise.all([
    getCustomerPricingContext(customerUserId),
    supabase.from('orders').select('total_ex_vat, door_finish').eq('id', orderId).maybeSingle(),
    supabase.from('order_lines').select('id, product_id, quantity').eq('order_id', orderId),
  ])
  const doorFinish = (orderRes.data?.door_finish as string | null) ?? null

  const lines = (linesRes.data ?? []) as Array<Pick<OrderLineRow, 'id' | 'product_id' | 'quantity'>>
  if (lines.length === 0) return

  const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean))]
  const productsById = await getProductsMap(productIds)

  // Two passes: apply rules using current totals, recalc totals, then apply again.
  let currentOrderTotalExVat = Number(orderRes.data?.total_ex_vat ?? 0)
  for (let pass = 0; pass < 2; pass += 1) {

    const resolvedByProductId = new Map<string, number>()
    for (const productId of productIds) {
      const p = productsById.get(productId)
      if (!p) continue
      const resolved = await resolveCustomerPrice({
        productId,
        categoryId: p.category_id ?? '',
        baseUnitPrice: effectiveBaseUnitPrice(p, doorFinish),
        segment,
        orderTotalExVat: currentOrderTotalExVat,
        collectionIds,
        accountDiscountPercent,
      })
      resolvedByProductId.set(productId, resolved)
    }

    await Promise.all(
      lines.map(async (l) => {
        const resolved = resolvedByProductId.get(l.product_id)
        if (resolved == null) return
        const { error } = await supabase
          .from('order_lines')
          .update({ unit_price: resolved })
          .eq('id', l.id)
        if (error) throw error
      })
    )

    // Update order totals for the next pass.
    await recalcOrderTotals(orderId)
    const { data: nextOrder } = await supabase.from('orders').select('total_ex_vat').eq('id', orderId).maybeSingle()
    currentOrderTotalExVat = Number(nextOrder?.total_ex_vat ?? 0)
  }
}

