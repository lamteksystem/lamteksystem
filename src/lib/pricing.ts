/**
 * Customer and cost price resolution using segment-based rules, optional per-account discount %, and promotions.
 * Use resolveCustomerPrice when showing prices or creating order lines.
 * Use resolveCostPrice for staff-only cost display and margin calculations.
 */

import { supabase } from '@/lib/supabase'
import type {
  CustomerPriceRuleRow,
  CostPriceRuleRow,
  CustomerPriceRuleType,
  CostPriceRuleType,
} from '@/types/database'

export interface CustomerSegmentIds {
  customer_group_id: string | null
  customer_location_id: string | null
  trade_type_id: string | null
  company_type_id: string | null
}

/** Extra % off applied after segment rules; null if absent or not positive. */
export function normalizeAccountDiscountPercent(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(100, Math.max(0, n))
}

/** Fetch active customer price rules that could apply, ordered by priority desc. */
export async function fetchApplicableCustomerPriceRules(segment: CustomerSegmentIds): Promise<CustomerPriceRuleRow[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('customer_price_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })
  if (error) return []
  const rows = (data ?? []) as CustomerPriceRuleRow[]
  return rows.filter((r) => {
    if (r.customer_group_id != null && r.customer_group_id !== segment.customer_group_id) return false
    if (r.customer_location_id != null && r.customer_location_id !== segment.customer_location_id) return false
    if (r.trade_type_id != null && r.trade_type_id !== segment.trade_type_id) return false
    if (r.company_type_id != null && r.company_type_id !== segment.company_type_id) return false
    if (r.valid_from && r.valid_from > now) return false
    if (r.valid_to && r.valid_to < now) return false
    return true
  })
}

/** Check if a rule applies to this product/category/collection. */
async function ruleAppliesToProduct(
  rule: CustomerPriceRuleRow,
  productId: string,
  categoryId: string,
  orderTotalExVat: number,
  productIdsInCollection?: Set<string>
): Promise<boolean> {
  if (rule.min_order_total_ex_vat != null && orderTotalExVat < Number(rule.min_order_total_ex_vat)) return false
  switch (rule.scope_type) {
    case 'all':
      return true
    case 'product':
      return rule.scope_product_id === productId
    case 'category':
      return rule.scope_category_id === categoryId
    case 'collection':
      return rule.scope_collection_id != null && (productIdsInCollection?.has(productId) ?? false)
    default:
      return false
  }
}

/** Apply a single customer price rule to a running price. */
function applyCustomerRule(price: number, rule: CustomerPriceRuleRow): number {
  const v = Number(rule.value)
  switch (rule.rule_type as CustomerPriceRuleType) {
    case 'percentage_discount':
      return Math.max(0, price * (1 - v / 100))
    case 'percentage_markup':
      return price * (1 + v / 100)
    case 'fixed_price_override':
      return Math.max(0, v)
    default:
      return price
  }
}

/**
 * Resolve effective customer unit price for a product given customer segment and order context.
 * Returns base product price with all applicable rules applied in priority order, then optional per-account discount %.
 */
export async function resolveCustomerPrice(params: {
  productId: string
  categoryId: string
  baseUnitPrice: number
  segment: CustomerSegmentIds
  orderTotalExVat: number
  collectionIds?: string[]
  /** Applied after all matching customer_price_rules (0–100). Null/omit = none. */
  accountDiscountPercent?: number | null
}): Promise<number> {
  const { productId, categoryId, baseUnitPrice, segment, orderTotalExVat, collectionIds, accountDiscountPercent } =
    params
  let price = baseUnitPrice
  const rules = await fetchApplicableCustomerPriceRules(segment)
  let productIdsInCollection: Set<string> | undefined
  if (collectionIds?.length) {
    const { data } = await supabase
      .from('collection_products')
      .select('product_id')
      .in('collection_id', collectionIds)
    const set = new Set((data ?? []).map((r: { product_id: string }) => r.product_id))
    productIdsInCollection = set
  }
  for (const rule of rules) {
    const applies = await ruleAppliesToProduct(
      rule,
      productId,
      categoryId,
      orderTotalExVat,
      productIdsInCollection
    )
    if (applies) price = applyCustomerRule(price, rule)
  }
  const acct = normalizeAccountDiscountPercent(accountDiscountPercent)
  if (acct != null) {
    price = Math.max(0, price * (1 - acct / 100))
  }
  return Math.round(price * 100) / 100
}

/** Fetch active cost price rules, optionally filtered by supplier, ordered by priority desc. */
export async function fetchApplicableCostPriceRules(supplierId?: string | null): Promise<CostPriceRuleRow[]> {
  const { data, error } = await supabase
    .from('cost_price_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })
  if (error) return []
  let rows = (data ?? []) as CostPriceRuleRow[]
  const now = new Date().toISOString()
  rows = rows.filter((r) => {
    if (r.supplier_id != null && supplierId != null && r.supplier_id !== supplierId) return false
    if (r.valid_from && r.valid_from > now) return false
    if (r.valid_to && r.valid_to < now) return false
    return true
  })
  return rows
}

function costRuleAppliesToProduct(rule: CostPriceRuleRow, productId: string, categoryId: string): boolean {
  switch (rule.scope_type) {
    case 'all':
      return true
    case 'product':
      return rule.scope_product_id === productId
    case 'category':
      return rule.scope_category_id === categoryId
    default:
      return false
  }
}

function applyCostRule(cost: number, sellPrice: number, rule: CostPriceRuleRow): number {
  const v = Number(rule.value)
  switch (rule.rule_type as CostPriceRuleType) {
    case 'fixed_cost':
      return Math.max(0, v)
    case 'percentage_of_sell':
      return Math.max(0, sellPrice * (v / 100))
    case 'markup_on_cost':
      return Math.max(0, cost * (1 + v / 100))
    default:
      return cost
  }
}

/**
 * Resolve effective cost price for a product. Optional supplierId for supplier-specific rules.
 * If product has no base cost_price, returns null unless a rule sets fixed_cost.
 */
export async function resolveCostPrice(params: {
  productId: string
  categoryId: string
  baseCostPrice: number | null
  sellPrice: number
  supplierId?: string | null
}): Promise<number | null> {
  const { productId, categoryId, baseCostPrice, sellPrice, supplierId } = params
  const rules = await fetchApplicableCostPriceRules(supplierId)
  let cost: number | null = baseCostPrice != null ? Number(baseCostPrice) : null
  for (const rule of rules) {
    if (!costRuleAppliesToProduct(rule, productId, categoryId)) continue
    if (rule.rule_type === 'fixed_cost') {
      cost = applyCostRule(cost ?? 0, sellPrice, rule)
    } else {
      cost = applyCostRule(cost ?? 0, sellPrice, rule)
    }
  }
  return cost != null ? Math.round(cost * 100) / 100 : null
}
