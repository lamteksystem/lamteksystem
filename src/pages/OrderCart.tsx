import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { getOrderProject, type OrderProject } from '@/lib/orderProject'
import {
  buildOrderChecklist,
  loadOrderChecklistCompleted,
  saveOrderChecklistCompleted,
  type ChecklistGroup,
  type ChecklistGroupId,
} from '@/lib/orderChecklist'
import OrderBuildChecklist from '@/components/order/OrderBuildChecklist'
import CartOrderLineItem from '@/components/order/CartOrderLineItem'
import type {
  CategoryRow,
  ProductRow,
  CustomerProfileRow,
  OrderRow,
  LocationRow,
  CustomerDeliveryAddressRow,
} from '@/types/database'
import type { DeliveryWindowWithDays } from '@/lib/deliveryWindows'
import {
  fetchDeliveryWindowsWithDays,
  formatDeliveryWindowLabel,
  londonYmd,
  validateDeliverySelection,
} from '@/lib/deliveryWindows'
import BasketSelect from '@/components/BasketSelect'
import { sanitizeBasketReferenceForDisplay } from '@/lib/orderDisplayName'
import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import { preserveLineOrder } from '@/lib/orderLineOrder'
import { recalcOrderTotals } from '@/lib/orders'
import { VAT_RATE } from '@/lib/tax'

interface LineWithDetails {
  id: string
  quantity: number
  unit_price: number
  product_snapshot: { name?: string; description?: string; sku?: string; image_url?: string }
  product_id?: string | null
  options?: Record<string, unknown>
  product?: Pick<ProductRow, 'name' | 'sku' | 'category_id'> | null
}

export default function OrderCart() {
  const navigate = useNavigate()
  const {
    draftOrder,
    draftOrders,
    basketActivityByOrderId,
    setActiveDraftOrder,
    createDraftOrder,
    duplicateDraftOrder,
    renameDraftOrder,
    refresh,
  } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const [lines, setLines] = useState<LineWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'save' | 'place' | 'clear' | 'cancel' | null>(null)
  const [pricingApplied, setPricingApplied] = useState(false)
  const [project, setProject] = useState<OrderProject | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [profile, setProfile] = useState<CustomerProfileRow | null>(null)
  const [deliverySameAsBilling, setDeliverySameAsBilling] = useState(true)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryPostcode, setDeliveryPostcode] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [savedDeliveryAddresses, setSavedDeliveryAddresses] = useState<CustomerDeliveryAddressRow[]>([])
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('')
  const [deliveryContactName, setDeliveryContactName] = useState('')
  const [deliveryContactPhone, setDeliveryContactPhone] = useState('')
  const [deliveryContactEmail, setDeliveryContactEmail] = useState('')
  const [deliveryContactNotes, setDeliveryContactNotes] = useState('')
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'delivery' | 'collect'>('delivery')
  const [collectionLocationId, setCollectionLocationId] = useState<string>('')
  const [collectionNotes, setCollectionNotes] = useState('')
  const [deliveryWindows, setDeliveryWindows] = useState<DeliveryWindowWithDays[]>([])
  const [deliveryWindowId, setDeliveryWindowId] = useState('')
  const [deliveryScheduledDate, setDeliveryScheduledDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const fulfillmentCardRef = useRef<HTMLDivElement | null>(null)
  const cartLinesOrderIdRef = useRef<string | null>(null)
  const [qtyDraftByLineId, setQtyDraftByLineId] = useState<Record<string, string>>({})
  const [checklistCompletedIds, setChecklistCompletedIds] = useState<ChecklistGroupId[]>([])
  const [renamingBasket, setRenamingBasket] = useState(false)
  const [basketNameDraft, setBasketNameDraft] = useState('')
  const continueShoppingHref = '/ordering?type=stock&clearRange=1'

  useEffect(() => {
    setPricingApplied(false)
    setFormError(null)
    if (!draftOrder?.id) {
      cartLinesOrderIdRef.current = null
      setLines([])
      setLoading(false)
      setProject(null)
      return
    }
    const orderId = draftOrder.id
    supabase
      .from('order_lines')
      .select('id, quantity, unit_price, product_snapshot, product_id, options, product:products(name, sku, category_id)')
      .eq('order_id', orderId)
      .then(({ data }) => {
        const list = ((data ?? []) as any[]).map((r) => ({
          ...r,
          product: Array.isArray(r.product) ? (r.product[0] ?? null) : (r.product ?? null),
        })) as LineWithDetails[]
        setLines((prev) => {
          const preserve = cartLinesOrderIdRef.current === orderId && prev.length > 0
          return preserve ? preserveLineOrder(prev, list) : list
        })
        cartLinesOrderIdRef.current = orderId
        setQtyDraftByLineId(Object.fromEntries(list.map((l) => [l.id, String(l.quantity)])))
        setLoading(false)
      })
  }, [draftOrder?.id])

  useEffect(() => {
    if (!draftOrder?.id) {
      setProject(null)
      return
    }
    getOrderProject(draftOrder.id).then(setProject).catch(() => setProject(null))
  }, [draftOrder?.id])

  useEffect(() => {
    if (!draftOrder?.id) {
      setChecklistCompletedIds([])
      return
    }
    let cancelled = false
    void loadOrderChecklistCompleted(draftOrder.id).then((ids) => {
      if (!cancelled) setChecklistCompletedIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [draftOrder?.id])

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').order('name').then(({ data }) => {
      setCategories((data ?? []) as CategoryRow[])
    })
  }, [])

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => setLocations((data ?? []) as LocationRow[]))
  }, [])

  useEffect(() => {
    fetchDeliveryWindowsWithDays()
      .then(setDeliveryWindows)
      .catch(() => setDeliveryWindows([]))
  }, [])

  const collectionLocations = useMemo(() => lamtekPortalLocations(locations), [locations])

  useEffect(() => {
    if (!draftOrder?.id) return
    if (!collectionLocationId) return
    if (collectionLocations.some((l) => l.id === collectionLocationId)) return
    setCollectionLocationId('')
    void supabase
      .from('orders')
      .update({ collection_location_id: null, updated_at: new Date().toISOString() })
      .eq('id', draftOrder.id)
  }, [collectionLocations, collectionLocationId, draftOrder?.id])

  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('customer_profiles')
      .select('company_name, contact_name, phone, email_override, billing_address, billing_city, billing_postcode')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => setProfile((data ?? null) as CustomerProfileRow | null))
  }, [effectiveUserId])

  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('customer_delivery_addresses')
      .select('*')
      .eq('customer_user_id', effectiveUserId)
      .order('is_default', { ascending: false })
      .order('created_at')
      .then(({ data }) => setSavedDeliveryAddresses((data ?? []) as CustomerDeliveryAddressRow[]))
  }, [effectiveUserId])

  useEffect(() => {
    if (!draftOrder?.id) return
    supabase
      .from('orders')
      .select(
        'delivery_same_as_billing, delivery_address, delivery_postcode, delivery_notes, delivery_contact_name, delivery_contact_phone, delivery_contact_email, delivery_contact_notes, fulfillment_method, collection_location_id, collection_notes, delivery_window_id, delivery_scheduled_date',
      )
      .eq('id', draftOrder.id)
      .maybeSingle()
      .then(({ data }) => {
        const o = (data ?? null) as Partial<OrderRow> | null
        if (!o) return
        setDeliverySameAsBilling(o.delivery_same_as_billing ?? true)
        setDeliveryAddress(o.delivery_address ?? '')
        setDeliveryPostcode(o.delivery_postcode ?? '')
        setDeliveryNotes(o.delivery_notes ?? '')
        setDeliveryContactName(o.delivery_contact_name ?? '')
        setDeliveryContactPhone(o.delivery_contact_phone ?? '')
        setDeliveryContactEmail(o.delivery_contact_email ?? '')
        setDeliveryContactNotes(o.delivery_contact_notes ?? '')
        const fm = o.fulfillment_method === 'collect' ? 'collect' : 'delivery'
        setFulfillmentMethod(fm)
        setCollectionLocationId(o.collection_location_id ?? '')
        setCollectionNotes(o.collection_notes ?? '')
        setDeliveryWindowId(o.delivery_window_id ?? '')
        setDeliveryScheduledDate(
          o.delivery_scheduled_date && typeof o.delivery_scheduled_date === 'string'
            ? o.delivery_scheduled_date.slice(0, 10)
            : '',
        )
      })
  }, [draftOrder?.id])

  async function persistDeliveryPatch(patch: Partial<OrderRow>) {
    if (!draftOrder?.id) return
    await supabase
      .from('orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', draftOrder.id)
  }

  const needsDeliveryWindow = fulfillmentMethod === 'delivery' && deliveryWindows.length > 0

  const canSubmit = useMemo(() => {
    if (!draftOrder?.id) return false
    if (lines.length === 0) return false
    if (fulfillmentMethod === 'collect') return Boolean(collectionLocationId)
    if (needsDeliveryWindow) return Boolean(deliveryScheduledDate && deliveryWindowId)
    return true
  }, [
    draftOrder?.id,
    lines.length,
    fulfillmentMethod,
    collectionLocationId,
    needsDeliveryWindow,
    deliveryScheduledDate,
    deliveryWindowId,
  ])

  const readinessChecks = useMemo(() => {
    const itemsOk = lines.length > 0
    const fulfillmentOk =
      fulfillmentMethod === 'collect'
        ? Boolean(collectionLocationId)
        : needsDeliveryWindow
          ? Boolean(deliveryScheduledDate && deliveryWindowId)
          : true
    const contactProvided = Boolean(
      deliveryContactName.trim() || deliveryContactPhone.trim() || deliveryContactEmail.trim(),
    )
    return {
      itemsOk,
      fulfillmentOk,
      contactProvided,
    }
  }, [
    lines.length,
    fulfillmentMethod,
    collectionLocationId,
    needsDeliveryWindow,
    deliveryScheduledDate,
    deliveryWindowId,
    deliveryContactName,
    deliveryContactPhone,
    deliveryContactEmail,
  ])

  function validateBeforeSubmit(): boolean {
    if (!draftOrder?.id || lines.length === 0) return false
    if (fulfillmentMethod === 'collect' && !collectionLocationId) {
      setFormError('Choose a collection point to continue.')
      fulfillmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return false
    }
    if (fulfillmentMethod === 'delivery' && deliveryWindows.length > 0) {
      if (!deliveryScheduledDate || !deliveryWindowId) {
        setFormError('Choose a delivery date and time window.')
        fulfillmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return false
      }
      const slot = validateDeliverySelection({
        scheduledDate: deliveryScheduledDate,
        windowId: deliveryWindowId,
        windows: deliveryWindows,
      })
      if (!slot.ok) {
        setFormError(slot.message)
        fulfillmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return false
      }
    }
    setFormError(null)
    return true
  }

  useEffect(() => {
    if (!draftOrder?.id) return
    if (!profile) return
    if (!deliverySameAsBilling) return
    if (fulfillmentMethod !== 'delivery') return
    const billingAddr = [profile.billing_address, profile.billing_city, profile.billing_postcode].filter(Boolean).join(', ')
    const billingPostcode = profile.billing_postcode ?? ''
    const name = profile.contact_name ?? profile.company_name ?? ''
    const phone = profile.phone ?? ''
    const email = profile.email_override ?? ''
    setDeliveryAddress((prev) => prev || billingAddr)
    setDeliveryPostcode((prev) => prev || billingPostcode)
    setDeliveryContactName((prev) => prev || name)
    setDeliveryContactPhone((prev) => prev || phone)
    setDeliveryContactEmail((prev) => prev || email)
    // Best-effort persist defaults (doesn't overwrite user edits if already set).
    persistDeliveryPatch({
      delivery_same_as_billing: true,
      delivery_address: billingAddr || null,
      delivery_postcode: billingPostcode || null,
      delivery_contact_name: name || null,
      delivery_contact_phone: phone || null,
      delivery_contact_email: email || null,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliverySameAsBilling, fulfillmentMethod, profile?.billing_address, profile?.billing_city, profile?.billing_postcode, profile?.contact_name, profile?.company_name, profile?.phone, profile?.email_override, draftOrder?.id])

  function applyOptimisticLineQuantity(lineId: string, qty: number) {
    setQtyDraftByLineId((prev) => {
      if (qty === 0) {
        const { [lineId]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [lineId]: String(qty) }
    })
    if (qty === 0) {
      setLines((prev) => prev.filter((l) => l.id !== lineId))
    } else {
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l)))
    }
  }

  async function reloadCartLinesFromServer() {
    if (!draftOrder?.id) return
    const { data } = await supabase
      .from('order_lines')
      .select('id, quantity, unit_price, product_snapshot, product_id, options, product:products(name, sku, category_id)')
      .eq('order_id', draftOrder.id)
    const list = ((data ?? []) as any[]).map((r) => ({
      ...r,
      product: Array.isArray(r.product) ? (r.product[0] ?? null) : (r.product ?? null),
    })) as LineWithDetails[]
    const orderId = draftOrder.id
    setLines((prev) => {
      const preserve = cartLinesOrderIdRef.current === orderId && prev.length > 0
      return preserve ? preserveLineOrder(prev, list) : list
    })
    cartLinesOrderIdRef.current = orderId
    setQtyDraftByLineId(Object.fromEntries(list.map((l) => [l.id, String(l.quantity)])))
  }

  /** Full repricing + sync — use before submit / clear cart / initial pricing pass. */
  async function recalcTotals() {
    if (!draftOrder?.id || !effectiveUserId) return
    await repriceDraftOrderLinesForCustomer({ orderId: draftOrder.id, customerUserId: effectiveUserId })
    await refresh()
    await reloadCartLinesFromServer()
  }

  /** Quantity change: instant UI, persist qty + order totals quickly; repricing runs in background (tier rules may adjust unit prices). */
  async function finalizeQuantityChangeAfterPersist() {
    if (!draftOrder?.id || !effectiveUserId) return
    await recalcOrderTotals(draftOrder.id)
    void refresh()
    void (async () => {
      try {
        await repriceDraftOrderLinesForCustomer({ orderId: draftOrder.id, customerUserId: effectiveUserId })
        await refresh()
        await reloadCartLinesFromServer()
      } catch {
        await reloadCartLinesFromServer()
      }
    })()
  }

  async function updateQuantity(lineId: string, delta: number) {
    const line = lines.find((l) => l.id === lineId)
    if (!line || !draftOrder) return
    const draftStr = qtyDraftByLineId[lineId]
    const parsedDraft = draftStr !== undefined && /^\d+$/.test(draftStr) ? Number(draftStr) : null
    const baseQty = parsedDraft !== null ? parsedDraft : line.quantity
    const newQty = Math.max(0, baseQty + delta)
    applyOptimisticLineQuantity(lineId, newQty)
    try {
      if (newQty === 0) {
        await supabase.from('order_lines').delete().eq('id', lineId)
      } else {
        await supabase.from('order_lines').update({ quantity: newQty }).eq('id', lineId)
      }
      await finalizeQuantityChangeAfterPersist()
    } catch {
      await reloadCartLinesFromServer()
    }
  }

  async function setExactQuantity(lineId: string, nextQty: number) {
    const qty = Math.max(0, Math.floor(nextQty))
    applyOptimisticLineQuantity(lineId, qty)
    try {
      if (qty === 0) {
        await supabase.from('order_lines').delete().eq('id', lineId)
      } else {
        await supabase.from('order_lines').update({ quantity: qty }).eq('id', lineId)
      }
      await finalizeQuantityChangeAfterPersist()
    } catch {
      await reloadCartLinesFromServer()
    }
  }

  async function removeLine(lineId: string) {
    await setExactQuantity(lineId, 0)
  }

  async function saveQuotation() {
    if (!draftOrder?.id || lines.length === 0) return
    if (!validateBeforeSubmit()) return
    setAction('save')
    try {
      await recalcTotals()
      await supabase.from('orders').update({ status: 'quotation', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      navigate('/account')
    } finally {
      setAction(null)
    }
  }

  async function placeOrder() {
    if (!draftOrder?.id || lines.length === 0) return
    if (!validateBeforeSubmit()) return
    setAction('place')
    try {
      await recalcTotals()
      await supabase.from('orders').update({ status: 'placed', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      navigate(`/account/orders/${draftOrder.id}`, { state: { justPlaced: true } })
    } finally {
      setAction(null)
    }
  }

  async function clearCart() {
    if (!draftOrder?.id) return
    if (!confirm('Remove all items from the cart? You can add more items from Create order.')) return
    setAction('clear')
    try {
      await supabase.from('order_lines').delete().eq('order_id', draftOrder.id)
      await recalcTotals()
      await refresh()
    } finally {
      setAction(null)
    }
  }

  async function cancelOrder() {
    if (!draftOrder?.id) return
    if (!confirm('Cancel this draft? The order will be marked cancelled and you’ll start fresh from Create order.')) return
    setAction('cancel')
    try {
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', draftOrder.id)
      await refresh()
      setAction(null)
      navigate('/ordering')
    } finally {
      setAction(null)
    }
  }

  // Apply pricing rules once for a loaded draft order, so totals/line unit prices are correct.
  useEffect(() => {
    if (!draftOrder?.id || !effectiveUserId) return
    if (pricingApplied) return
    if (lines.length === 0) return
    // Fire and forget; UI remains responsive with the existing loading states.
    recalcTotals()
      .then(() => { setPricingApplied(true) })
      .catch(() => { /* swallow; user can still proceed */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOrder?.id, effectiveUserId])

  const totalExVat = useMemo(() => {
    if (lines.length > 0) {
      return lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0)
    }
    return draftOrder ? Number(draftOrder.total_ex_vat) : 0
  }, [lines, draftOrder])

  const totalIncVat = useMemo(() => totalExVat * VAT_RATE, [totalExVat])

  const toggleChecklistGroup = useCallback(
    (groupId: ChecklistGroupId) => {
      if (!draftOrder?.id) return
      setChecklistCompletedIds((prev) => {
        const next = prev.includes(groupId)
          ? prev.filter((id) => id !== groupId)
          : [...prev, groupId]
        void saveOrderChecklistCompleted(draftOrder.id, next)
        return next
      })
    },
    [draftOrder?.id],
  )

  const checklist: ChecklistGroup[] = useMemo(
    () =>
      draftOrder?.id
        ? buildOrderChecklist({
            project,
            categories,
            completedIds: checklistCompletedIds,
            lines: lines.map((l) => ({
              product: (l.product ?? null) as any,
              snapshotName: (l.product_snapshot as any)?.name ?? null,
              snapshotSku: (l.product_snapshot as any)?.sku ?? null,
            })),
          })
        : [],
    [draftOrder?.id, project, categories, checklistCompletedIds, lines],
  )

  if (!draftOrder && !loading) {
    return (
      <div className="order-cart-page">
        <PageNav backTo="/ordering/start" backLabel="Create order" />
        <div className="cart-empty-state card">
          <h1>Your cart is empty</h1>
          <p>Add products from Create order to build an estimate or place an order.</p>
          <Link to="/ordering/start" className="btn">Go to Create order</Link>
        </div>
      </div>
    )
  }

  const busy = !!action

  function checklistAddHref(group: ChecklistGroup): string {
    const q = (group.suggested_search_terms[0] ?? group.title ?? '').trim()
    const suggestions = group.suggested_search_terms.filter(Boolean).slice(0, 5)
    const params = new URLSearchParams()
    params.set('mode', 'component')
    params.set('checklist', group.id)
    if (suggestions.length > 0) params.set('suggestions', suggestions.join('|'))
    params.set('suggestionIndex', '0')
    if (q) params.set('search', q)
    return `/ordering?${params.toString()}`
  }

  function checklistUnitsHref(group: ChecklistGroup): string {
    const q = (group.suggested_search_terms[0] ?? group.title ?? '').trim()
    const suggestions = group.suggested_search_terms.filter(Boolean).slice(0, 5)
    const params = new URLSearchParams()
    params.set('mode', 'complete')
    params.set('checklist', group.id)
    if (suggestions.length > 0) params.set('suggestions', suggestions.join('|'))
    params.set('suggestionIndex', '0')
    if (q) params.set('assemblySearch', q)
    return `/ordering?${params.toString()}`
  }

  return (
    <div className="order-cart-page">
      <PageNav backTo="/ordering/start" backLabel="Create order" />
      <div className="cart-page-header">
        <h1>Order cart</h1>
        <p className="page-intro">Review your items, then save as a quotation or place your order.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
          <Link to={continueShoppingHref} className="btn btn-outline btn-small">
            ← Continue shopping
          </Link>
          <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            <span className="admin-muted" style={{ fontSize: '0.9rem' }}>Basket</span>
            <BasketSelect
              draftOrders={draftOrders}
              value={draftOrder?.id ?? ''}
              onChange={setActiveDraftOrder}
              activityByOrderId={basketActivityByOrderId}
            />
          </label>
          {draftOrder?.id && !renamingBasket && (
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={() => {
                setBasketNameDraft(sanitizeBasketReferenceForDisplay(draftOrder.reference) ?? '')
                setRenamingBasket(true)
              }}
            >
              Rename basket
            </button>
          )}
          {draftOrder?.id && renamingBasket && (
            <form
              className="cart-basket-rename-form"
              onSubmit={(e) => {
                e.preventDefault()
                void renameDraftOrder(draftOrder.id, basketNameDraft).then(() => setRenamingBasket(false))
              }}
            >
              <input
                type="text"
                value={basketNameDraft}
                onChange={(e) => setBasketNameDraft(e.target.value)}
                placeholder="Basket name"
                aria-label="Basket name"
                autoFocus
                maxLength={120}
              />
              <button type="submit" className="btn btn-small">
                Save
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setRenamingBasket(false)}
              >
                Cancel
              </button>
            </form>
          )}
          <button type="button" className="btn btn-outline btn-small" onClick={() => createDraftOrder()}>
            New basket
          </button>
          {draftOrder?.id && (
            <button type="button" className="btn btn-outline btn-small" onClick={() => duplicateDraftOrder(draftOrder.id)}>
              Duplicate
            </button>
          )}
          <Link to="/ordering/baskets" className="btn btn-outline btn-small">
            Manage baskets
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="cart-loading">
          <p>Loading cart…</p>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-main">
            <div className="card cart-list-card">
              <h2 className="cart-list-title">1) Items ({lines.length})</h2>
              {lines.length === 0 ? (
                <p className="cart-no-items">No items yet. <Link to="/ordering/start">Add products</Link> from Create order.</p>
              ) : (
                <ul className="cart-lines">
                  {lines.map((line) => (
                    <CartOrderLineItem
                      key={line.id}
                      line={{
                        id: line.id,
                        quantity: line.quantity,
                        unit_price: line.unit_price,
                        product_id: line.product_id,
                        product_snapshot: line.product_snapshot,
                        options: line.options ?? {},
                      }}
                      qtyDraft={qtyDraftByLineId[line.id] ?? String(line.quantity)}
                      onQtyDraftChange={(value) =>
                        setQtyDraftByLineId((prev) => ({ ...prev, [line.id]: value }))
                      }
                      onQtyBlur={() => {
                        const raw = qtyDraftByLineId[line.id] ?? String(line.quantity)
                        const parsed = raw.trim() === '' ? 0 : Number(raw)
                        const next = Number.isFinite(parsed) ? parsed : line.quantity
                        void setExactQuantity(line.id, next)
                      }}
                      onDecrease={() => void updateQuantity(line.id, -1)}
                      onIncrease={() => void updateQuantity(line.id, 1)}
                      onRemove={() => void removeLine(line.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="cart-secondary-actions">
                <button type="button" className="btn btn-outline" onClick={clearCart} disabled={busy}>
                  Clear cart
                </button>
                <button type="button" className="btn btn-outline btn-danger-outline" onClick={cancelOrder} disabled={busy}>
                  Cancel order
                </button>
              </div>
            )}

            {lines.length > 0 && (
              <div className="card" style={{ marginTop: '0.75rem' }} ref={fulfillmentCardRef}>
                <h2 style={{ marginTop: 0 }}>2) Delivery or collection</h2>
                <p className="admin-muted" style={{ marginTop: 0 }}>
                  {fulfillmentMethod === 'collect'
                    ? 'Choose where to collect (Lamtek Group collection points — from your configured sites). Add a contact for order updates.'
                    : 'Delivery to your address or site. Add a delivery contact if it differs from the billing/company contact.'}
                </p>
                {formError && (
                  <div className="order-payment-banner order-payment-banner--error" style={{ marginBottom: '0.75rem' }}>
                    {formError}
                  </div>
                )}
                <div role="radiogroup" aria-label="Fulfillment method" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <label className="admin-checkbox-label">
                    <input
                      type="radio"
                      name="fulfillment"
                      checked={fulfillmentMethod === 'delivery'}
                      onChange={async () => {
                        setFulfillmentMethod('delivery')
                        if (!draftOrder?.id) return
                        await persistDeliveryPatch({
                          fulfillment_method: 'delivery',
                          collection_location_id: null,
                        })
                      }}
                    />
                    Delivery
                  </label>
                  <label className="admin-checkbox-label">
                    <input
                      type="radio"
                      name="fulfillment"
                      checked={fulfillmentMethod === 'collect'}
                      onChange={async () => {
                        setFulfillmentMethod('collect')
                        setDeliveryWindowId('')
                        setDeliveryScheduledDate('')
                        if (!draftOrder?.id) return
                        await persistDeliveryPatch({
                          fulfillment_method: 'collect',
                          delivery_window_id: null,
                          delivery_scheduled_date: null,
                        })
                      }}
                    />
                    Click &amp; collect
                  </label>
                </div>

                {fulfillmentMethod === 'collect' && (
                  <>
                    <label>Collection point</label>
                    <select
                      value={collectionLocationId}
                      onChange={async (e) => {
                        const v = e.target.value
                        setCollectionLocationId(v)
                        setFormError(null)
                        await persistDeliveryPatch({ collection_location_id: v || null })
                      }}
                      aria-label="Collection point"
                    >
                      <option value="">— Select collection point —</option>
                      {collectionLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code ? `${l.code} — ` : ''}{l.name}
                        </option>
                      ))}
                    </select>
                    <label>Collection notes (optional)</label>
                    <textarea
                      value={collectionNotes}
                      onChange={(e) => setCollectionNotes(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ collection_notes: collectionNotes.trim() || null })}
                      rows={2}
                      placeholder="e.g. vehicle type, who will collect"
                    />
                  </>
                )}

                {fulfillmentMethod === 'delivery' && (
                  <>
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={deliverySameAsBilling}
                        onChange={async (e) => {
                          const v = e.target.checked
                          setDeliverySameAsBilling(v)
                          await persistDeliveryPatch({ delivery_same_as_billing: v })
                        }}
                      />
                      Use billing/account details
                    </label>

                    {!deliverySameAsBilling && (
                      <>
                        {savedDeliveryAddresses.length > 0 && (
                          <>
                            <label>Saved addresses</label>
                            <select
                              value={selectedSavedAddressId}
                              onChange={async (e) => {
                                const id = e.target.value
                                setSelectedSavedAddressId(id)
                                if (!id) return
                                const selected = savedDeliveryAddresses.find((a) => a.id === id)
                                if (!selected) return
                                const addr = selected.address ?? ''
                                const pc = selected.postcode ?? ''
                                const notes = selected.notes ?? ''
                                setDeliveryAddress(addr)
                                setDeliveryPostcode(pc)
                                if (notes) setDeliveryNotes(notes)
                                await persistDeliveryPatch({
                                  delivery_address: addr || null,
                                  delivery_postcode: pc || null,
                                  delivery_notes: notes || null,
                                })
                              }}
                            >
                              <option value="">— Choose a saved address —</option>
                              {savedDeliveryAddresses.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}{a.is_default ? ' (default)' : ''}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        <label>Delivery address</label>
                        <textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          onBlur={() => persistDeliveryPatch({ delivery_address: deliveryAddress.trim() || null })}
                          rows={2}
                          placeholder="Delivery address"
                        />
                        <label>Delivery postcode</label>
                        <input
                          value={deliveryPostcode}
                          onChange={(e) => setDeliveryPostcode(e.target.value)}
                          onBlur={() => persistDeliveryPatch({ delivery_postcode: deliveryPostcode.trim() || null })}
                          placeholder="Postcode"
                        />
                      </>
                    )}

                    {deliveryWindows.length > 0 && (
                      <>
                        <h3 style={{ margin: '0.75rem 0 0.25rem' }}>Delivery date &amp; window</h3>
                        <p className="admin-muted" style={{ marginTop: 0 }}>
                          Choose when you want delivery. Options depend on the day of week and cut-off times.
                        </p>
                        <label>Preferred delivery date</label>
                        <input
                          type="date"
                          min={londonYmd()}
                          value={deliveryScheduledDate}
                          onChange={async (e) => {
                            const v = e.target.value
                            setDeliveryScheduledDate(v)
                            setFormError(null)
                            await persistDeliveryPatch({ delivery_scheduled_date: v || null })
                          }}
                        />
                        <label>Time window</label>
                        <select
                          value={deliveryWindowId}
                          onChange={async (e) => {
                            const v = e.target.value
                            setDeliveryWindowId(v)
                            setFormError(null)
                            await persistDeliveryPatch({ delivery_window_id: v || null })
                          }}
                          aria-label="Delivery time window"
                        >
                          <option value="">— Select window —</option>
                          {deliveryWindows.map((w) => (
                            <option key={w.id} value={w.id}>
                              {formatDeliveryWindowLabel(w)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}

                <h3 className="cart-delivery-contact-heading">{fulfillmentMethod === 'collect' ? 'Contact' : 'Delivery contact'}</h3>
                <div className="cart-delivery-contact-grid">
                  <label className="cart-delivery-field">
                    Name
                    <input
                      value={deliveryContactName}
                      onChange={(e) => setDeliveryContactName(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ delivery_contact_name: deliveryContactName.trim() || null })}
                      placeholder="Contact name"
                    />
                  </label>
                  <label className="cart-delivery-field">
                    Phone
                    <input
                      value={deliveryContactPhone}
                      onChange={(e) => setDeliveryContactPhone(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ delivery_contact_phone: deliveryContactPhone.trim() || null })}
                      placeholder="Contact phone"
                    />
                  </label>
                  <label className="cart-delivery-field">
                    Email
                    <input
                      value={deliveryContactEmail}
                      onChange={(e) => setDeliveryContactEmail(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ delivery_contact_email: deliveryContactEmail.trim() || null })}
                      placeholder="Contact email"
                    />
                  </label>
                </div>
                <div className="cart-delivery-textareas-grid">
                  <label className="cart-delivery-textarea-wrap">
                    Contact notes
                    <textarea
                      value={deliveryContactNotes}
                      onChange={(e) => setDeliveryContactNotes(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ delivery_contact_notes: deliveryContactNotes.trim() || null })}
                      rows={3}
                      placeholder="e.g. call before delivery, access notes"
                    />
                  </label>
                  <label className="cart-delivery-textarea-wrap">
                    {fulfillmentMethod === 'collect' ? 'Notes for your order' : 'Delivery notes'}
                    <textarea
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      onBlur={() => persistDeliveryPatch({ delivery_notes: deliveryNotes.trim() || null })}
                      rows={3}
                      placeholder={fulfillmentMethod === 'collect' ? 'Any notes for staff' : 'Notes for delivery'}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <aside className="cart-summary-card card">
              <h2 className="cart-summary-title">3) Place or save</h2>
              <div className="cart-summary-rows">
                <div className="cart-summary-row">
                  <span>Subtotal (ex VAT)</span>
                  <span>£{totalExVat.toFixed(2)}</span>
                </div>
                <div className="cart-summary-row">
                  <span>VAT (20%)</span>
                  <span>£{(totalIncVat - totalExVat).toFixed(2)}</span>
                </div>
                <div className="cart-summary-row cart-summary-total">
                  <span>Total (inc VAT)</span>
                  <span>£{totalIncVat.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <h3 style={{ margin: '0 0 0.25rem' }}>Ready to place</h3>
                <ul className="admin-report-list" style={{ marginTop: '0.25rem' }}>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">{readinessChecks.itemsOk ? '✓' : '•'} Items added</span>
                    <span className="admin-report-list-value">{lines.length}</span>
                  </li>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">
                      {readinessChecks.fulfillmentOk ? '✓' : '•'}{' '}
                      {fulfillmentMethod === 'collect'
                        ? 'Collection point selected'
                        : needsDeliveryWindow
                          ? 'Delivery date & window'
                          : 'Delivery / collection chosen'}
                    </span>
                    <span className="admin-report-list-value">
                      {fulfillmentMethod === 'collect'
                        ? (collectionLocationId ? 'Selected' : 'Required')
                        : needsDeliveryWindow
                          ? deliveryScheduledDate && deliveryWindowId
                            ? 'Selected'
                            : 'Required'
                          : 'OK'}
                    </span>
                  </li>
                  <li className="admin-report-list-item">
                    <span className="admin-report-list-label">{readinessChecks.contactProvided ? '✓' : '•'} Contact details (recommended)</span>
                    <span className="admin-report-list-value">{readinessChecks.contactProvided ? 'Added' : 'Optional'}</span>
                  </li>
                </ul>
              </div>

              <OrderBuildChecklist
                groups={checklist}
                componentHref={checklistAddHref}
                unitsHref={checklistUnitsHref}
                onToggleComplete={toggleChecklistGroup}
              />

              <div className="cart-summary-actions">
                <button type="button" className="btn btn-block btn-primary" onClick={placeOrder} disabled={busy || !canSubmit}>
                  {action === 'place' ? 'Placing…' : 'Place order'}
                </button>
                <p className="cart-action-hint">Order will be placed and you can pay from your account.</p>
                <button type="button" className="btn btn-block btn-outline" onClick={saveQuotation} disabled={busy || !canSubmit}>
                  {action === 'save' ? 'Saving…' : 'Save as quotation'}
                </button>
                <p className="cart-action-hint">Request a formal quote without committing.</p>
                {!canSubmit && fulfillmentMethod === 'collect' && (
                  <p className="cart-action-hint" style={{ color: 'var(--danger, #b00020)' }}>
                    Choose a collection point to continue.
                  </p>
                )}
                {!canSubmit && fulfillmentMethod === 'delivery' && needsDeliveryWindow && (
                  <p className="cart-action-hint" style={{ color: 'var(--danger, #b00020)' }}>
                    Choose a delivery date and time window to continue.
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
