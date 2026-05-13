import type { OrderRow } from '@/types/database'

/** Locale for customer-facing dates/times (UK). */
const LOCALE = 'en-GB'

function fallbackStamp(d: Date): string {
  return d.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "29 Apr 2026, 14:32" — for disambiguation without UUIDs */
export function formatOrderTimestampLabel(iso: string): string {
  return fallbackStamp(new Date(iso))
}

/**
 * Labels a basket or order when no custom reference is stored.
 * Avoids opaque UUID prefixes in the UI.
 */
export function formatOrderReferenceOrFallback(order: Pick<OrderRow, 'id' | 'reference' | 'created_at' | 'status'>): string {
  const ref = order.reference?.trim()
  if (ref) return ref
  const when = formatOrderTimestampLabel(order.created_at)
  return order.status === 'draft' ? `Basket · ${when}` : `Order · ${when}`
}

/** Default `reference` for new drafts (friendly and unique enough for typical use). */
export function defaultNewDraftBasketReference(): string {
  return `Basket · ${fallbackStamp(new Date())}`
}
