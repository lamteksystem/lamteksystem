import { supabase } from '@/lib/supabase'
import { insertOrderEvent } from '@/lib/orderEvents'
import { formatOrderTimestampLabel } from '@/lib/orderDisplayName'
import type { OrderEventRow } from '@/types/database'

export type BasketActivityType =
  | 'basket_created'
  | 'basket_renamed'
  | 'basket_duplicated'
  | 'basket_deleted'

const BASKET_EVENT_TYPES: BasketActivityType[] = [
  'basket_created',
  'basket_renamed',
  'basket_duplicated',
  'basket_deleted',
]

export async function logBasketActivity(params: {
  orderId: string
  eventType: BasketActivityType
  note?: string | null
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  try {
    await insertOrderEvent({
      orderId: params.orderId,
      actorUserId: user?.id ?? null,
      eventType: params.eventType,
      note: params.note ?? null,
    })
  } catch {
    // Activity logging is best-effort until RLS policies are applied.
  }
}

export async function fetchBasketActivityByOrderIds(
  orderIds: string[],
): Promise<Map<string, OrderEventRow[]>> {
  const map = new Map<string, OrderEventRow[]>()
  if (orderIds.length === 0) return map

  const { data, error } = await supabase
    .from('order_events')
    .select('*')
    .in('order_id', orderIds)
    .in('event_type', BASKET_EVENT_TYPES)
    .order('created_at', { ascending: false })

  if (error || !data) return map

  for (const row of data as OrderEventRow[]) {
    const list = map.get(row.order_id) ?? []
    list.push(row)
    map.set(row.order_id, list)
  }
  return map
}

/** Short label for basket dropdowns (no dates). */
export function formatBasketActivityShort(eventType: string): string | null {
  switch (eventType) {
    case 'basket_created':
      return 'Created'
    case 'basket_renamed':
      return 'Renamed'
    case 'basket_duplicated':
      return 'Duplicate'
    case 'basket_deleted':
      return 'Deleted'
    default:
      return null
  }
}

/** Full line for basket management / history (includes timestamp). */
export function formatBasketActivityLine(event: OrderEventRow): string {
  const when = formatOrderTimestampLabel(event.created_at)
  const action = formatBasketActivityShort(event.event_type) ?? event.event_type
  if (event.note?.trim()) return `${action} · ${event.note.trim()} · ${when}`
  return `${action} · ${when}`
}

export function getLatestBasketActivity(
  events: OrderEventRow[] | undefined,
): OrderEventRow | null {
  if (!events?.length) return null
  return events[0] ?? null
}
