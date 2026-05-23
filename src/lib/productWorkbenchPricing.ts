import { supabase } from '@/lib/supabase'
import { resolveCostPrice, resolveCustomerPrice, type CustomerSegmentIds } from '@/lib/pricing'
import { normalizeAccountDiscountPercent } from '@/lib/pricing'
import type { ProductRow } from '@/types/database'

export interface ProductPriceBreakdown {
  cataloguePrice: number
  costPrice: number | null
  sellPrice: number
  discountPercent: number | null
  marginPercent: number | null
}

async function loadCustomerPricingContext(customerUserId: string): Promise<{
  segment: CustomerSegmentIds
  accountDiscountPercent: number | null
}> {
  const { data } = await supabase
    .from('customer_profiles')
    .select(
      'customer_group_id, customer_location_id, trade_type_id, company_type_id, account_discount_percent',
    )
    .eq('user_id', customerUserId)
    .maybeSingle()

  return {
    segment: {
      customer_group_id: data?.customer_group_id ?? null,
      customer_location_id: data?.customer_location_id ?? null,
      trade_type_id: data?.trade_type_id ?? null,
      company_type_id: data?.company_type_id ?? null,
    },
    accountDiscountPercent: normalizeAccountDiscountPercent(data?.account_discount_percent),
  }
}

export async function resolveProductPriceBreakdown(params: {
  product: ProductRow
  customerUserId?: string | null
  orderTotalExVat?: number
}): Promise<ProductPriceBreakdown> {
  const { product, customerUserId, orderTotalExVat = 0 } = params
  const cataloguePrice = Number(product.unit_price)

  let sellPrice = cataloguePrice
  if (customerUserId) {
    const { segment, accountDiscountPercent } = await loadCustomerPricingContext(customerUserId)
    sellPrice = await resolveCustomerPrice({
      productId: product.id,
      categoryId: product.category_id ?? '',
      baseUnitPrice: cataloguePrice,
      segment,
      orderTotalExVat,
      accountDiscountPercent,
    })
  }

  const baseCost = product.cost_price != null ? Number(product.cost_price) : null
  const costPrice = await resolveCostPrice({
    productId: product.id,
    categoryId: product.category_id ?? '',
    baseCostPrice: baseCost,
    sellPrice,
    supplierId: null,
  })

  const discountPercent =
    cataloguePrice > 0 && sellPrice < cataloguePrice
      ? Math.round((1 - sellPrice / cataloguePrice) * 1000) / 10
      : null

  const marginPercent =
    costPrice != null && sellPrice > 0
      ? Math.round((1 - costPrice / sellPrice) * 1000) / 10
      : null

  return {
    cataloguePrice,
    costPrice,
    sellPrice,
    discountPercent,
    marginPercent,
  }
}
