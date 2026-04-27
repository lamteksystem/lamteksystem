import { supabase } from '@/lib/supabase'

export async function insertOrderEvent(params: {
  orderId: string
  actorUserId: string | null
  eventType: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
}): Promise<void> {
  const { error } = await supabase.from('order_events').insert({
    order_id: params.orderId,
    actor_user_id: params.actorUserId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    note: params.note ?? null,
  })
  if (error) throw error
}
