/**
 * Finish-aware pricing for kitchen products.
 *
 * Tealbury/Lamtek pricelist rows carry a per-finish price matrix in
 * `products.options.tealbury_finish_prices_gbp` (and the `lamtek_` variant),
 * keyed by the finish/range label, e.g. `{ "Oakham Soft Matte": 142.5 }`.
 *
 * `products.unit_price` is set at import time to the CHEAPEST finish, so a quote
 * must look up the price for the finish the customer actually chose
 * (`orders.door_finish`). This module does that lookup. When a product has no
 * finish matrix (e.g. a carcass, leg kit or fittings pack) the lookup returns
 * null and callers fall back to `products.unit_price`.
 */
import type { ProductRow } from '@/types/database'

const FINISH_PRICE_KEYS = ['tealbury_finish_prices_gbp', 'lamtek_finish_prices_gbp'] as const

const NO_FINISH_LABEL = '— none recorded —'

/** The product's finish→price map (numbers only), or null when it isn't finish-priced. */
export function getFinishPriceMap(product: Pick<ProductRow, 'options'>): Record<string, number> | null {
  const opts = product.options
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return null
  const bag = opts as Record<string, unknown>
  for (const key of FINISH_PRICE_KEYS) {
    const src = bag[key]
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      const map: Record<string, number> = {}
      for (const [label, value] of Object.entries(src as Record<string, unknown>)) {
        const n = Number(value)
        if (Number.isFinite(n)) map[label] = n
      }
      if (Object.keys(map).length) return map
    }
  }
  return null
}

/**
 * List price for the chosen door/range finish, or null when the product isn't
 * finish-priced or the chosen finish isn't one of its finishes (so the caller
 * keeps the product's base `unit_price`).
 */
export function resolveFinishBasePrice(
  product: Pick<ProductRow, 'options'>,
  doorFinishLabel: string | null | undefined,
): number | null {
  const target = (doorFinishLabel ?? '').trim().toLowerCase()
  if (!target || target === NO_FINISH_LABEL) return null
  const map = getFinishPriceMap(product)
  if (!map) return null
  for (const [label, price] of Object.entries(map)) {
    if (label.trim().toLowerCase() === target) return price
  }
  return null
}

/**
 * Convenience: the effective base list price for a product given the order's
 * chosen finish — the finish price when available, else the product's unit_price.
 */
export function effectiveBaseUnitPrice(
  product: Pick<ProductRow, 'options' | 'unit_price'>,
  doorFinishLabel: string | null | undefined,
): number {
  const finish = resolveFinishBasePrice(product, doorFinishLabel)
  return finish ?? Number(product.unit_price)
}
