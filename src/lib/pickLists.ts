import { supabase } from '@/lib/supabase'
import { insertOrderEvent } from '@/lib/orderEvents'
import type { PickListRow } from '@/types/database'

interface CreatePickListOpts {
  orderId: string
  locationId?: string | null
  shipmentId?: string | null
  actorUserId?: string | null
}

export async function createPickListFromOrder(opts: CreatePickListOpts): Promise<{ pickListId: string }> {
  const { data: existing } = await supabase
    .from('pick_lists')
    .select('id, status')
    .eq('order_id', opts.orderId)
    .eq('is_archived', false)
    .in('status', ['generated', 'picking'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return { pickListId: existing.id }

  const { data: lines, error: linesError } = await supabase
    .from('order_lines')
    .select('id, product_id, quantity')
    .eq('order_id', opts.orderId)

  if (linesError) throw new Error(linesError.message || 'Could not load order lines for pick list.')
  if (!lines || lines.length === 0) throw new Error('Cannot generate pick list: order has no lines.')

  const { data: created, error: createError } = await supabase
    .from('pick_lists')
    .insert({
      order_id: opts.orderId,
      shipment_id: opts.shipmentId ?? null,
      location_id: opts.locationId ?? null,
      status: 'generated',
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (createError || !created?.id) {
    if (createError?.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('pick_lists')
        .select('id')
        .eq('order_id', opts.orderId)
        .eq('is_archived', false)
        .in('status', ['generated', 'picking'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (raceExisting?.id) return { pickListId: raceExisting.id }
    }
    throw new Error(createError?.message || 'Could not create pick list.')
  }

  const items = lines.map((line) => ({
    pick_list_id: created.id,
    order_line_id: line.id,
    product_id: line.product_id,
    required_qty: line.quantity,
    picked_qty: 0,
  }))
  const { error: itemsError } = await supabase.from('pick_list_items').insert(items)
  if (itemsError) throw new Error(itemsError.message || 'Could not create pick list items.')

  insertOrderEvent({
    orderId: opts.orderId,
    actorUserId: opts.actorUserId ?? null,
    eventType: 'pick_list_generated',
    note: `Pick list ${created.id.slice(0, 8)} generated`,
  }).catch(() => {})

  return { pickListId: created.id }
}

export type SetPickListStatusOptions = {
  /** Allow status picked when some lines are not fully picked (supervisor override). */
  forceComplete?: boolean
}

export async function isPickListFullyPicked(pickListId: string): Promise<boolean> {
  const { data: rows, error } = await supabase.from('pick_list_items').select('required_qty, picked_qty').eq('pick_list_id', pickListId)
  if (error) throw new Error(error.message || 'Could not validate pick lines.')
  const list = rows ?? []
  if (list.length === 0) return false
  return list.every((r) => Number(r.picked_qty) === Number(r.required_qty))
}

export async function setPickListStatus(
  pickList: PickListRow,
  status: PickListRow['status'],
  options?: SetPickListStatusOptions,
) {
  if (status === 'picked') {
    const complete = await isPickListFullyPicked(pickList.id)
    if (!complete && !options?.forceComplete) {
      throw new Error(
        'All lines must be picked before marking complete (use override if authorised).',
      )
    }
  }

  const now = new Date().toISOString()
  const updates: Partial<PickListRow> = { status, updated_at: now }
  if (status === 'picking' && !pickList.started_at) updates.started_at = now
  if (status === 'picked') updates.completed_at = now
  if (status === 'cancelled') updates.cancelled_at = now
  const { error } = await supabase.from('pick_lists').update(updates).eq('id', pickList.id)
  if (error) throw new Error(error.message || 'Could not update pick list status.')

  if (status === 'picked') {
    insertOrderEvent({
      orderId: pickList.order_id,
      actorUserId: null,
      eventType: 'pick_list_completed',
      note: `Pick list ${pickList.id.slice(0, 8)} marked picked${options?.forceComplete ? ' (override)' : ''}`,
    }).catch(() => {})
  }
}

export async function setPickListArchived(pickListId: string, isArchived: boolean): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('pick_lists')
    .update({ is_archived: isArchived, updated_at: now })
    .eq('id', pickListId)
  if (error) throw new Error(error.message || 'Could not update pick list archive state.')
}

export async function deletePickList(pickListId: string): Promise<void> {
  const { data: row, error: loadErr } = await supabase
    .from('pick_lists')
    .select('id, order_id, status')
    .eq('id', pickListId)
    .maybeSingle()
  if (loadErr) throw new Error(loadErr.message || 'Could not load pick list.')
  if (!row) throw new Error('Pick list not found.')

  const { error } = await supabase.from('pick_lists').delete().eq('id', pickListId)
  if (error) throw new Error(error.message || 'Could not delete pick list.')

  insertOrderEvent({
    orderId: row.order_id as string,
    actorUserId: null,
    eventType: 'pick_list_deleted',
    note: `Pick list ${pickListId.slice(0, 8)} deleted (was ${row.status})`,
  }).catch(() => {})
}
