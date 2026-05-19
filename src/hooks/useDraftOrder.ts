import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderEventRow, OrderRow } from '@/types/database'
import {
  buildBasketDisplayLabels,
  getBasketDisplayLabel,
  sanitizeBasketReferenceForDisplay,
} from '@/lib/orderDisplayName'
import { fetchBasketActivityByOrderIds, logBasketActivity } from '@/lib/basketActivity'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'

const PREF_ACTIVE_DRAFT_ORDER_ID = 'active_draft_order_id'

export function useDraftOrder() {
  const effectiveUserId = useEffectiveUserId()
  const [draftOrders, setDraftOrders] = useState<OrderRow[]>([])
  const [draftOrder, setDraftOrder] = useState<OrderRow | null>(null)
  const [basketActivityByOrderId, setBasketActivityByOrderId] = useState<Map<string, OrderEventRow[]>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)

  const basketDisplayLabels = useMemo(() => buildBasketDisplayLabels(draftOrders), [draftOrders])

  const refresh = useCallback(async () => {
    if (!effectiveUserId) {
      setDraftOrders([])
      setDraftOrder(null)
      setBasketActivityByOrderId(new Map())
      setLoading(false)
      return
    }
    const [prefActiveId, ordersRes] = await Promise.all([
      getUserPreference(PREF_ACTIVE_DRAFT_ORDER_ID),
      supabase
        .from('orders')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(25),
    ])

    const list = (ordersRes.data ?? []) as OrderRow[]
    setDraftOrders(list)

    const activity = await fetchBasketActivityByOrderIds(list.map((o) => o.id))
    setBasketActivityByOrderId(activity)

    const activeId = (prefActiveId ?? '').trim() || null
    const picked = activeId ? list.find((o) => o.id === activeId) : null
    const fallback = list[0] ?? null
    setDraftOrder(picked ?? fallback)
    setLoading(false)
  }, [effectiveUserId])

  const setActiveDraftOrder = useCallback(
    async (orderId: string | null) => {
      await setUserPreference(PREF_ACTIVE_DRAFT_ORDER_ID, (orderId ?? '').trim())
      await refresh()
    },
    [refresh],
  )

  const ensureDraftOrder = useCallback(async (): Promise<string> => {
    if (draftOrder?.id) return draftOrder.id
    if (!effectiveUserId) throw new Error('Not logged in')
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: effectiveUserId,
        status: 'draft',
        total_ex_vat: 0,
        total_inc_vat: 0,
        reference: null,
      })
      .select('id')
      .single()
    if (error) throw error
    await logBasketActivity({ orderId: data.id, eventType: 'basket_created' })
    await setActiveDraftOrder(data.id)
    return data.id
  }, [effectiveUserId, draftOrder?.id, setActiveDraftOrder])

  const createDraftOrder = useCallback(
    async (name?: string) => {
      if (!effectiveUserId) throw new Error('Not logged in')
      const reference = name?.trim() ? name.trim() : null
      const { data, error } = await supabase
        .from('orders')
        .insert({ user_id: effectiveUserId, status: 'draft', total_ex_vat: 0, total_inc_vat: 0, reference })
        .select('*')
        .single()
      if (error) throw error
      const order = data as OrderRow
      await logBasketActivity({
        orderId: order.id,
        eventType: 'basket_created',
        note: reference ?? undefined,
      })
      await setActiveDraftOrder(order.id)
      return order
    },
    [effectiveUserId, setActiveDraftOrder],
  )

  const renameDraftOrder = useCallback(
    async (orderId: string, name: string) => {
      if (!effectiveUserId) return
      const previous = draftOrders.find((o) => o.id === orderId)
      const previousLabel = previous
        ? getBasketDisplayLabel(previous, basketDisplayLabels)
        : null
      const nextRef = name.trim() || null
      await supabase
        .from('orders')
        .update({ reference: nextRef, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('user_id', effectiveUserId)
      const nextLabel =
        nextRef && sanitizeBasketReferenceForDisplay(nextRef)
          ? sanitizeBasketReferenceForDisplay(nextRef)
          : 'Unnamed basket'
      await logBasketActivity({
        orderId,
        eventType: 'basket_renamed',
        note:
          previousLabel && previousLabel !== nextLabel
            ? `${previousLabel} → ${nextLabel}`
            : nextLabel ?? undefined,
      })
      await refresh()
    },
    [effectiveUserId, refresh, draftOrders, basketDisplayLabels],
  )

  const duplicateDraftOrder = useCallback(
    async (fromOrderId: string) => {
      if (!effectiveUserId) throw new Error('Not logged in')
      const { data: from } = await supabase
        .from('orders')
        .select('*')
        .eq('id', fromOrderId)
        .eq('user_id', effectiveUserId)
        .maybeSingle()
      if (!from) throw new Error('Draft not found')

      const sourceLabel = getBasketDisplayLabel(from as OrderRow, buildBasketDisplayLabels([from as OrderRow]))
      const sourceReference = sanitizeBasketReferenceForDisplay(from.reference)

      const { data: lines } = await supabase
        .from('order_lines')
        .select('product_id, product_snapshot, quantity, unit_price, options')
        .eq('order_id', fromOrderId)

      const { data: newOrder, error: newErr } = await supabase
        .from('orders')
        .insert({
          user_id: effectiveUserId,
          status: 'draft',
          total_ex_vat: 0,
          total_inc_vat: 0,
          reference: sourceReference,
        })
        .select('id')
        .single()
      if (newErr) throw newErr

      const inserts = (lines ?? []).map((l: { product_id: string; product_snapshot: unknown; quantity: number; unit_price: number; options?: unknown }) => ({
        order_id: newOrder.id,
        product_id: l.product_id,
        product_snapshot: l.product_snapshot,
        quantity: l.quantity,
        unit_price: l.unit_price,
        options: l.options ?? {},
      }))
      if (inserts.length > 0) {
        const { error: lineErr } = await supabase.from('order_lines').insert(inserts)
        if (lineErr) throw lineErr
      }

      await logBasketActivity({
        orderId: newOrder.id,
        eventType: 'basket_duplicated',
        note: `From ${sourceLabel}`,
      })

      await setActiveDraftOrder(newOrder.id)
      return newOrder.id as string
    },
    [effectiveUserId, setActiveDraftOrder],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const draftOrderLabel = useMemo(() => {
    if (!draftOrder) return null
    return getBasketDisplayLabel(draftOrder, basketDisplayLabels)
  }, [draftOrder, basketDisplayLabels])

  return {
    draftOrders,
    draftOrder,
    draftOrderLabel,
    basketDisplayLabels,
    basketActivityByOrderId,
    loading,
    refresh,
    ensureDraftOrder,
    setActiveDraftOrder,
    createDraftOrder,
    renameDraftOrder,
    duplicateDraftOrder,
  }
}
