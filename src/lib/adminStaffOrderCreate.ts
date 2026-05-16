import { supabase } from '@/lib/supabase'
import type { OrderLinkReason, OrderRow } from '@/types/database'

export type StaffOrderCreateStatus = 'draft' | 'quotation'

export interface StaffOrderCreateParams {
  userId: string
  staffProfileId: string
  status: StaffOrderCreateStatus
  reference?: string | null
  parentOrder?: OrderRow | null
  parentOrderId?: string
  linkReason?: OrderLinkReason | null
}

export function buildStaffOrderInsertPayload(params: StaffOrderCreateParams): Record<string, unknown> {
  const insertPayload: Record<string, unknown> = {
    user_id: params.userId,
    status: params.status,
    total_ex_vat: 0,
    total_inc_vat: 0,
    created_by_staff_id: params.staffProfileId,
  }

  const ref = params.reference?.trim()
  if (ref) insertPayload.reference = ref

  const parent = params.parentOrder
  const parentId = params.parentOrderId?.trim()
  if (parentId && parent && parent.user_id === params.userId) {
    insertPayload.parent_order_id = parentId
    if (params.linkReason) insertPayload.link_reason = params.linkReason
    insertPayload.fulfillment_method = parent.fulfillment_method ?? 'delivery'
    insertPayload.collection_location_id = parent.collection_location_id ?? null
    insertPayload.collection_notes = parent.collection_notes ?? null
    insertPayload.delivery_same_as_billing = parent.delivery_same_as_billing ?? true
    insertPayload.delivery_address = parent.delivery_address ?? null
    insertPayload.delivery_postcode = parent.delivery_postcode ?? null
    insertPayload.delivery_notes = parent.delivery_notes ?? null
    insertPayload.delivery_contact_name = parent.delivery_contact_name ?? null
    insertPayload.delivery_contact_phone = parent.delivery_contact_phone ?? null
    insertPayload.delivery_contact_email = parent.delivery_contact_email ?? null
    insertPayload.delivery_contact_notes = parent.delivery_contact_notes ?? null
    insertPayload.delivery_window_id = null
    insertPayload.delivery_scheduled_date = null
    insertPayload.collection_ready_at = null
    insertPayload.collection_must_collect_by = null
  }

  return insertPayload
}

export async function insertStaffOrder(params: StaffOrderCreateParams) {
  const payload = buildStaffOrderInsertPayload(params)
  return supabase.from('orders').insert(payload).select('id').single()
}
