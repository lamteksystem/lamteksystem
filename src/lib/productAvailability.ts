import type { ProductRow } from '@/types/database'

export interface ProductAvailabilityMeta {
  label: string
  detail?: string
}

function parseLeadTimeDays(options: ProductRow['options']): number | null {
  if (!options || typeof options !== 'object') return null
  const record = options as Record<string, unknown>
  const raw =
    record.lead_time_days ??
    record.leadTimeDays ??
    record.lead_time ??
    record.leadTime
  if (raw == null) return null
  const parsed =
    typeof raw === 'number'
      ? raw
      : Number.parseInt(String(raw).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getProductAvailabilityMeta(product: ProductRow): ProductAvailabilityMeta {
  const leadDays = parseLeadTimeDays(product.options)
  if (product.is_stock === false) {
    return leadDays
      ? { label: `Lead time: ${leadDays} day${leadDays === 1 ? '' : 's'}` }
      : { label: 'Made to order' }
  }

  const qty = Number(product.stock_quantity || 0)
  if (qty <= 0) return { label: 'Out of stock' }
  if (qty <= 5) return { label: `Low stock: ${qty}` }
  return { label: 'In stock', detail: `Qty: ${qty}` }
}
