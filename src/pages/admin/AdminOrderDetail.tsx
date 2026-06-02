import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  type OrderRow,
  type OrderEventRow,
  type ShipmentRow,
  type LocationRow,
  type NotificationRuleSettingsRow,
  type PickListRow,
  COURIER_OPTIONS,
  ORDER_LINK_REASONS,
} from '@/types/database'
import type { DeliveryWindowWithDays } from '@/lib/deliveryWindows'
import { fetchDeliveryWindowsWithDays, formatDeliveryWindowLabel } from '@/lib/deliveryWindows'
import { trackingUrl } from '@/lib/tracking'
import {
  COURIER_TIME_SLOTS,
  getCourierAddOnLabel,
  getCourierConfig,
  getCourierServiceLabel,
  getCourierTimeSlotLabel,
} from '@/lib/courierServices'
import { recalcOrderTotals } from '@/lib/orders'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { insertOrderEvent } from '@/lib/orderEvents'
import { useStaff } from '@/hooks/useStaff'
import { allocateStockForOrderShipmentAtomic } from '@/lib/stock'
import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import { usePermission } from '@/hooks/usePermission'
import { createPickListFromOrder } from '@/lib/pickLists'
import { useAdminUi, type AdminOrderLinePricingMode } from '@/contexts/AdminUiContext'
import CatalogProductPickerModal from '@/components/catalog/CatalogProductPickerModal'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import { useCatalogWorkbenchData } from '@/hooks/useCatalogWorkbenchData'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { insertAssemblyOrderLines, insertProductOrderLines } from '@/lib/orderLineInsert'
import QuoteDocumentOptionsPanel from '@/components/admin/QuoteDocumentOptionsPanel'
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_ORDER: OrderRow['status'][] = ['draft', 'quotation', 'placed', 'invoiced', 'paid', 'cancelled']

function orderLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
  combination_label?: string | null
  composed_code?: string | null
}

type LinkedOrderPreview = Pick<OrderRow, 'id' | 'reference' | 'status' | 'created_at' | 'parent_order_id' | 'link_reason'>

/** Statuses we can move forward to from current */
function nextStatuses(current: OrderRow['status']): OrderRow['status'][] {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx < 0) return []
  const next: OrderRow['status'][] = []
  for (let i = idx + 1; i < STATUS_ORDER.length; i++) {
    if (STATUS_ORDER[i] !== 'cancelled') next.push(STATUS_ORDER[i])
  }
  next.push('cancelled')
  return next
}

/** Statuses we can reopen to (move backward) */
function reopenStatuses(current: OrderRow['status']): OrderRow['status'][] {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx <= 0) return []
  const prev: OrderRow['status'][] = []
  for (let i = idx - 1; i >= 0; i--) {
    prev.push(STATUS_ORDER[i])
  }
  return prev
}

const EDITABLE_STATUSES: OrderRow['status'][] = ['draft', 'quotation', 'placed', 'invoiced']
const canEditLines = (status: OrderRow['status']) => EDITABLE_STATUSES.includes(status)

function statusToNotificationEventKey(status: OrderRow['status']): string {
  switch (status) {
    case 'invoiced':
      return 'order_invoiced'
    case 'paid':
      return 'order_paid'
    case 'placed':
      return 'order_placed'
    default:
      return 'order_status_change'
  }
}

export default function AdminOrderDetail() {
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId: string }>()
  const { staffProfile } = useStaff()
  const { allowed: canEditOrders } = usePermission('admin.orders', 'edit')
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [delivery, setDelivery] = useState({
    delivery_address: '',
    delivery_postcode: '',
    delivery_notes: '',
    delivery_contact_name: '',
    delivery_contact_phone: '',
    delivery_contact_email: '',
    delivery_contact_notes: '',
    delivery_same_as_billing: true,
    delivery_tracking: '',
    courier: '',
    delivery_expected_date: '',
    courier_service_code: '',
    courier_service_add_ons: [] as string[],
    courier_preferred_time_slot: '',
    courier_preferred_date: '',
    fulfillment_method: 'delivery' as 'delivery' | 'collect',
    collection_location_id: '',
    collection_ready_at: '',
    collection_must_collect_by: '',
    collection_notes: '',
    delivery_window_id: '',
    delivery_scheduled_date: '',
    parent_order_id: '',
    link_reason: '',
  })
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const catalogPrograms = useMemo(
    () => [CATALOG_PROGRAM.LAMTEK, CATALOG_PROGRAM.TEALBURY],
    [],
  )
  const {
    products: catalogProducts,
    categories: catalogCategories,
    assemblies: catalogAssemblies,
    loading: catalogPickerLoading,
  } = useCatalogWorkbenchData(catalogPickerOpen ? catalogPrograms : [])
  const [deliveryWindows, setDeliveryWindows] = useState<DeliveryWindowWithDays[]>([])
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [convertQuoteConfirm, setConvertQuoteConfirm] = useState(false)
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null)
  const [setStatusValue, setSetStatusValue] = useState<OrderRow['status'] | ''>('')
  const [setStatusConfirm, setSetStatusConfirm] = useState(false)
  const [reopenToValue, setReopenToValue] = useState<OrderRow['status'] | ''>('')
  const [reopenConfirm, setReopenConfirm] = useState(false)
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')
  const [customerPaymentTerms, setCustomerPaymentTerms] = useState<string | null>(null)
  const [customerRef, setCustomerRef] = useState<string | null>(null)
  const [customerProfile, setCustomerProfile] = useState<{
    company_name?: string | null
    contact_name?: string | null
    billing_address?: string | null
    billing_city?: string | null
    billing_postcode?: string | null
    delivery_address?: string | null
    delivery_city?: string | null
    delivery_postcode?: string | null
    phone?: string | null
    email_override?: string | null
    website?: string | null
    credit_limit?: number | null
  } | null>(null)
  const [editingCustomerField, setEditingCustomerField] = useState<null | {
    key: string
    value: string
    saving: boolean
  }>(null)
  const [orderEvents, setOrderEvents] = useState<OrderEventRow[]>([])
  const [historyTab, setHistoryTab] = useState<'status' | 'audit'>('status')
  const [locations, setLocations] = useState<LocationRow[]>([])
  /** Hide legacy TM-era depots while DB migrations catch up */
  const selectableLocations = useMemo(() => lamtekPortalLocations(locations), [locations])
  const [shipments, setShipments] = useState<ShipmentRow[]>([])
  const [pickLists, setPickLists] = useState<PickListRow[]>([])
  const [customerOrders, setCustomerOrders] = useState<LinkedOrderPreview[]>([])
  const [childLinkedOrders, setChildLinkedOrders] = useState<LinkedOrderPreview[]>([])
  const [notificationRules, setNotificationRules] = useState<NotificationRuleSettingsRow[]>([])
  const [shipForm, setShipForm] = useState({
    location_id: '',
    courier: '',
    tracking: '',
    note: '',
  })
  const [shipping, setShipping] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [notifyPrompt, setNotifyPrompt] = useState<null | { toStatus: OrderRow['status'] }>(null)
  const [notifySaving, setNotifySaving] = useState(false)
  const [processedPanelOpen, setProcessedPanelOpen] = useState(false)
  const [processedDateDraft, setProcessedDateDraft] = useState('')
  const [showAdvancedPanels, setShowAdvancedPanels] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [trackingEmailSending, setTrackingEmailSending] = useState(false)
  const [pickListBusy, setPickListBusy] = useState(false)
  const auditViewLoggedRef = useRef<string | null>(null)
  const { adminOrderLinePricingDefault } = useAdminUi()
  const [lineAddPricingChoice, setLineAddPricingChoice] = useState<'use_default' | AdminOrderLinePricingMode>('use_default')
  const [repricingBusy, setRepricingBusy] = useState(false)

  function dateInputToIso(d: string): string {
    // Use local noon to avoid timezone date shifting for date-only inputs.
    return new Date(`${d}T12:00:00`).toISOString()
  }

  function formatOrderOptionLabel(o: LinkedOrderPreview): string {
    const ref = o.reference?.trim() || `#${o.id.slice(0, 8)}`
    const status = STATUS_LABELS[o.status] ?? o.status
    const date = new Date(o.created_at).toLocaleDateString('en-GB')
    return `${ref} · ${date} · ${status}`
  }

  async function load() {
    if (!orderId) return
    const [orderRes, linesRes, eventsRes, locationsRes, shipmentsRes, notificationRulesRes, pickListsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price, combination_label, composed_code').eq('order_id', orderId),
      supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      supabase.from('locations').select('*').eq('active', true).order('sort_order').order('name'),
      supabase.from('shipments').select('*').eq('order_id', orderId).order('shipped_at', { ascending: false }),
      supabase.from('notification_rule_settings').select('*'),
      supabase.from('pick_lists').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    ])
    if (orderRes.data) {
      setOrder(orderRes.data as OrderRow)
      const userId = (orderRes.data as OrderRow).user_id
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('company_name, contact_name, payment_terms, customer_ref, billing_address, billing_city, billing_postcode, delivery_address, delivery_city, delivery_postcode, phone, email_override, website, credit_limit')
        .eq('user_id', userId)
        .maybeSingle()
      const [customerOrdersRes, childOrdersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, reference, status, created_at, parent_order_id, link_reason')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('orders')
          .select('id, reference, status, created_at, parent_order_id, link_reason')
          .eq('parent_order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(120),
      ])
      setCustomerPaymentTerms(profile?.payment_terms ?? null)
      setCustomerRef((profile as { customer_ref?: string | null } | null)?.customer_ref ?? null)
      setCustomerProfile(profile as unknown as typeof customerProfile)
      setCustomerOrders((customerOrdersRes.data ?? []) as LinkedOrderPreview[])
      setChildLinkedOrders((childOrdersRes.data ?? []) as LinkedOrderPreview[])
      setDelivery({
        delivery_address: orderRes.data.delivery_address ?? '',
        delivery_postcode: orderRes.data.delivery_postcode ?? '',
        delivery_notes: orderRes.data.delivery_notes ?? '',
        delivery_contact_name: orderRes.data.delivery_contact_name ?? '',
        delivery_contact_phone: orderRes.data.delivery_contact_phone ?? '',
        delivery_contact_email: orderRes.data.delivery_contact_email ?? '',
        delivery_contact_notes: orderRes.data.delivery_contact_notes ?? '',
        delivery_same_as_billing: orderRes.data.delivery_same_as_billing ?? true,
        delivery_tracking: orderRes.data.delivery_tracking ?? '',
        courier: orderRes.data.courier ?? '',
        delivery_expected_date: orderRes.data.delivery_expected_date ? orderRes.data.delivery_expected_date.slice(0, 10) : '',
        courier_service_code: orderRes.data.courier_service_code ?? '',
        courier_service_add_ons: Array.isArray(orderRes.data.courier_service_add_ons)
          ? (orderRes.data.courier_service_add_ons as string[])
          : [],
        courier_preferred_time_slot: orderRes.data.courier_preferred_time_slot ?? '',
        courier_preferred_date: orderRes.data.courier_preferred_date
          ? String(orderRes.data.courier_preferred_date).slice(0, 10)
          : '',
        fulfillment_method: orderRes.data.fulfillment_method === 'collect' ? 'collect' : 'delivery',
        collection_location_id: orderRes.data.collection_location_id ?? '',
        collection_ready_at: orderLocalDatetimeValue(orderRes.data.collection_ready_at),
        collection_must_collect_by: orderLocalDatetimeValue(orderRes.data.collection_must_collect_by),
        collection_notes: orderRes.data.collection_notes ?? '',
        delivery_window_id: orderRes.data.delivery_window_id ?? '',
        delivery_scheduled_date: orderRes.data.delivery_scheduled_date
          ? String(orderRes.data.delivery_scheduled_date).slice(0, 10)
          : '',
        parent_order_id: orderRes.data.parent_order_id ?? '',
        link_reason: orderRes.data.link_reason ?? '',
      })
      setSetStatusValue(orderRes.data.status)
      setReopenToValue('')
    } else {
      setCustomerOrders([])
      setChildLinkedOrders([])
    }
    setLines((linesRes.data as LineRow[]) ?? [])
    setOrderEvents((eventsRes.data as OrderEventRow[]) ?? [])
    const locs = (locationsRes.data ?? []) as LocationRow[]
    setLocations(locs)
    setShipments((shipmentsRes.data ?? []) as ShipmentRow[])
    setPickLists((pickListsRes.data ?? []) as PickListRow[])
    setNotificationRules((notificationRulesRes.data ?? []) as NotificationRuleSettingsRow[])
    setShipForm((f) => ({
      ...f,
      courier: f.courier || (orderRes.data?.courier ?? ''),
      tracking: f.tracking || (orderRes.data?.delivery_tracking ?? ''),
      location_id: f.location_id || (locs[0]?.id ?? ''),
    }))
    setLoading(false)
  }

  async function generatePickList() {
    if (!orderId || !canEditOrders || isArchived) return
    setPickListBusy(true)
    setActionError(null)
    try {
      const latestShipment = shipments[0] ?? null
      const { pickListId } = await createPickListFromOrder({
        orderId,
        shipmentId: latestShipment?.id ?? null,
        locationId: latestShipment?.location_id ?? shipForm.location_id ?? null,
        actorUserId: staffProfile?.user_id ?? null,
      })
      await load()
      navigate(`/admin/pick-lists/${pickListId}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate pick list.')
    } finally {
      setPickListBusy(false)
    }
  }

  const customerNotificationState = useMemo(() => {
    const lastStatusChange = orderEvents.find((e) => e.event_type === 'status_change')
    if (!lastStatusChange || !lastStatusChange.to_status) return { needsAttention: false, status: null as string | null }
    const since = new Date(lastStatusChange.created_at).getTime()
    const hasNotify = orderEvents.some((e) => {
      if (e.event_type !== 'customer_notified') return false
      if (e.to_status !== lastStatusChange.to_status) return false
      return new Date(e.created_at).getTime() >= since
    })
    const hasExplicitNo = orderEvents.some((e) => {
      if (e.event_type !== 'customer_not_notified') return false
      if (e.to_status !== lastStatusChange.to_status) return false
      return new Date(e.created_at).getTime() >= since
    })
    return { needsAttention: !hasNotify && hasExplicitNo, status: lastStatusChange.to_status as string }
  }, [orderEvents])

  const parentOrderOptions = useMemo(
    () => customerOrders.filter((o) => o.id !== orderId),
    [customerOrders, orderId],
  )

  const linkedOrderMenuOptions = useMemo(() => {
    const m = new Map<string, LinkedOrderPreview>()
    if (delivery.parent_order_id) {
      const parent =
        customerOrders.find((o) => o.id === delivery.parent_order_id) ??
        childLinkedOrders.find((o) => o.id === delivery.parent_order_id)
      if (parent) m.set(parent.id, parent)
    }
    childLinkedOrders.forEach((o) => m.set(o.id, o))
    return Array.from(m.values()).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }, [customerOrders, childLinkedOrders, delivery.parent_order_id])

  const selectedDeliveryWindow = useMemo(
    () => deliveryWindows.find((w) => w.id === delivery.delivery_window_id) ?? null,
    [deliveryWindows, delivery.delivery_window_id],
  )
  const courierConfig = useMemo(
    () => getCourierConfig(delivery.courier),
    [delivery.courier],
  )
  const selectedCourierServiceLabel = useMemo(
    () => getCourierServiceLabel(delivery.courier, delivery.courier_service_code),
    [delivery.courier, delivery.courier_service_code],
  )

  const trackingHref = useMemo(() => {
    if (!delivery.delivery_tracking) return ''
    return trackingUrl(delivery.courier, delivery.delivery_tracking)
  }, [delivery.courier, delivery.delivery_tracking])

  useEffect(() => {
    load()
  }, [orderId])

  useEffect(() => {
    setLineAddPricingChoice('use_default')
  }, [orderId])

  useEffect(() => {
    fetchDeliveryWindowsWithDays()
      .then(setDeliveryWindows)
      .catch(() => setDeliveryWindows([]))
  }, [])

  useEffect(() => {
    setDelivery((prev) => {
      const cfg = getCourierConfig(prev.courier)
      const validService = cfg.services.some((s) => s.code === prev.courier_service_code)
      const nextServiceCode = validService ? prev.courier_service_code : ''
      const nextAddOns = prev.courier_service_add_ons.filter((code) => cfg.addOns.some((a) => a.code === code))
      const nextTimeSlot = cfg.supportsTimeSlot ? prev.courier_preferred_time_slot : ''
      if (
        nextServiceCode === prev.courier_service_code
        && nextAddOns.length === prev.courier_service_add_ons.length
        && nextTimeSlot === prev.courier_preferred_time_slot
      ) return prev
      return {
        ...prev,
        courier_service_code: nextServiceCode,
        courier_service_add_ons: nextAddOns,
        courier_preferred_time_slot: nextTimeSlot,
      }
    })
  }, [delivery.courier])

  useEffect(() => {
    // Best-effort audit log that a staff member viewed this order.
    if (!orderId) return
    if (!staffProfile?.user_id) return
    if (auditViewLoggedRef.current === orderId) return
    auditViewLoggedRef.current = orderId
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile.user_id,
      eventType: 'order_viewed',
      note: 'Order opened in admin',
    }).catch(() => {})
  }, [orderId, staffProfile?.user_id])

  async function setStatus(status: OrderRow['status']) {
    if (!orderId || saving || !order || !canEditOrders) return
    if (order.is_archived === true) return
    const fromStatus = order.status
    setSaving(true)
    setActionError(null)
    const updates: Partial<OrderRow> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'placed' || status === 'invoiced') {
      updates.processed_at = new Date().toISOString()
    }
    if (status === 'cancelled') {
      updates.payment_status = null
      updates.payment_intent_id = null
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (error) {
      setActionError(error.message || 'Could not update order status.')
      setSaving(false)
      return
    }
    try {
      await insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'status_change',
        fromStatus,
        toStatus: status,
      })
    } catch (_) { /* best-effort audit */ }
    setOrder((o) => (o ? { ...o, ...updates } : null))
    setCancelConfirm(false)
    setSetStatusConfirm(false)
    setReopenConfirm(false)
    setReopenToValue('')
    setSaving(false)
    await applyNotificationRuleForStatus(status)
  }

  function resolveStatusRule(status: OrderRow['status']): NotificationRuleSettingsRow | null {
    const preferred = statusToNotificationEventKey(status)
    const exact = notificationRules.find((r) => r.event_key === preferred)
    if (exact) return exact
    return notificationRules.find((r) => r.event_key === 'order_status_change') ?? null
  }

  async function applyNotificationRuleForStatus(status: OrderRow['status']) {
    const rule = resolveStatusRule(status)
    if (!rule) {
      setNotifyPrompt({ toStatus: status })
      return
    }
    const shouldNotify = rule.portal_customer || rule.email_customer || rule.sms_customer
    if (!shouldNotify) {
      await setCustomerNotification({ notify: false, forStatus: status })
      return
    }
    await setCustomerNotification({
      notify: true,
      forStatus: status,
      channels: {
        portal: rule.portal_customer,
        email: rule.email_customer,
        sms: rule.sms_customer,
      },
      fallbackPromptOnError: true,
    })
  }

  async function markAsProcessed() {
    if (!orderId || saving || !canEditOrders || order?.is_archived === true) return
    setSaving(true)
    setActionError(null)
    const processed_at = processedDateDraft ? dateInputToIso(processedDateDraft) : new Date().toISOString()
    const { error } = await supabase.from('orders').update({ processed_at, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) {
      setActionError(error.message || 'Could not set processed date.')
      setSaving(false)
      return
    }
    try {
      await insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'processed_date_set',
        note: processedDateDraft ? `Processed date set to ${processedDateDraft}` : 'Processed date set',
      })
    } catch (_) { /* best-effort audit */ }
    // Refresh local events so Order history updates immediately.
    const { data: evs } = await supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
    setOrderEvents((evs as OrderEventRow[]) ?? [])
    setOrder((o) => (o ? { ...o, processed_at } : null))
    setProcessedPanelOpen(false)
    setSaving(false)
  }

  async function setCustomerNotification(opts: {
    notify: boolean
    forStatus: OrderRow['status']
    channels?: { portal: boolean; email: boolean; sms: boolean }
    fallbackPromptOnError?: boolean
  }) {
    if (!orderId || notifySaving) return
    setNotifySaving(true)
    setActionError(null)
    try {
      if (opts.notify) {
        const sendPortal = opts.channels?.portal ?? true
        const sendEmail = opts.channels?.email ?? true
        const sendSms = opts.channels?.sms ?? false
        // Attempt outbound delivery first. If email isn't configured, fall back to portal notification.
        const attempt = await supabase.functions.invoke('notify-order-status', {
          body: {
            order_id: orderId,
            to_status: opts.forStatus,
            send_portal: sendPortal,
            send_email: sendEmail,
            send_sms: sendSms,
          },
        })
        if (attempt.error) {
          // If email isn't configured, still deliver via portal.
          const msg = attempt.error.message || 'Failed to notify customer.'
          if (sendPortal && sendEmail && /not configured/i.test(msg)) {
            const portalOnly = await supabase.functions.invoke('notify-order-status', {
              body: {
                order_id: orderId,
                to_status: opts.forStatus,
                send_portal: true,
                send_email: false,
                send_sms: false,
              },
            })
            if (portalOnly.error) throw new Error(portalOnly.error.message)
          } else {
            throw new Error(msg)
          }
        }
      }

      await insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: opts.notify ? 'customer_notified' : 'customer_not_notified',
        toStatus: opts.forStatus,
        note: opts.notify
          ? `Customer notified about status: ${STATUS_LABELS[opts.forStatus] ?? opts.forStatus}`
          : `Customer not notified about status: ${STATUS_LABELS[opts.forStatus] ?? opts.forStatus}`,
      })
      // Refresh local events list so reminders/badges update immediately.
      const { data } = await supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
      setOrderEvents((data as OrderEventRow[]) ?? [])
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update notification status.')
      if (opts.fallbackPromptOnError) setNotifyPrompt({ toStatus: opts.forStatus })
    }
    setNotifyPrompt(null)
    setNotifySaving(false)
  }

  async function saveDelivery() {
    if (!orderId || saving || !canEditOrders || order?.is_archived === true) return
    const trimmedParent = delivery.parent_order_id.trim()
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (trimmedParent && !uuidRe.test(trimmedParent)) {
      setActionError('Parent order ID must be a valid UUID or left blank.')
      return
    }
    if (trimmedParent && trimmedParent === orderId) {
      setActionError('An order cannot be its own parent.')
      return
    }
    if (delivery.fulfillment_method === 'delivery' && delivery.courier && !delivery.courier_service_code) {
      setActionError('Select a courier service level (e.g. Next Day, Tracked 24) before saving.')
      return
    }
    const linkReason =
      delivery.link_reason && ORDER_LINK_REASONS.includes(delivery.link_reason as (typeof ORDER_LINK_REASONS)[number])
        ? delivery.link_reason
        : null
    setSaving(true)
    setActionError(null)
    const collectionReadyAt = delivery.collection_ready_at
      ? new Date(delivery.collection_ready_at).toISOString()
      : null
    const collectionMustBy = delivery.collection_must_collect_by
      ? new Date(delivery.collection_must_collect_by).toISOString()
      : null
    const deliveryWindowId =
      delivery.fulfillment_method === 'delivery' ? (delivery.delivery_window_id || null) : null
    const deliveryScheduledDate =
      delivery.fulfillment_method === 'delivery' && delivery.delivery_scheduled_date
        ? delivery.delivery_scheduled_date
        : null
    const courierServiceCode =
      delivery.fulfillment_method === 'delivery' ? (delivery.courier_service_code || null) : null
    const courierServiceAddOns =
      delivery.fulfillment_method === 'delivery' ? delivery.courier_service_add_ons : []
    const courierPreferredTimeSlot =
      delivery.fulfillment_method === 'delivery' ? (delivery.courier_preferred_time_slot || null) : null
    const courierPreferredDate =
      delivery.fulfillment_method === 'delivery' && delivery.courier_preferred_date
        ? delivery.courier_preferred_date
        : null
    await supabase.from('orders').update({
      delivery_address: delivery.delivery_address || null,
      delivery_postcode: delivery.delivery_postcode || null,
      delivery_notes: delivery.delivery_notes || null,
      delivery_contact_name: delivery.delivery_contact_name || null,
      delivery_contact_phone: delivery.delivery_contact_phone || null,
      delivery_contact_email: delivery.delivery_contact_email || null,
      delivery_contact_notes: delivery.delivery_contact_notes || null,
      delivery_same_as_billing: !!delivery.delivery_same_as_billing,
      delivery_tracking: delivery.delivery_tracking || null,
      courier: delivery.courier || null,
      delivery_expected_date: delivery.delivery_expected_date || null,
      fulfillment_method: delivery.fulfillment_method,
      collection_location_id: delivery.fulfillment_method === 'collect' ? (delivery.collection_location_id || null) : null,
      collection_ready_at: collectionReadyAt,
      collection_must_collect_by: collectionMustBy,
      collection_notes: delivery.collection_notes || null,
      delivery_window_id: deliveryWindowId,
      delivery_scheduled_date: deliveryScheduledDate,
      courier_service_code: courierServiceCode,
      courier_service_add_ons: courierServiceAddOns,
      courier_preferred_time_slot: courierPreferredTimeSlot,
      courier_preferred_date: courierPreferredDate,
      parent_order_id: trimmedParent || null,
      link_reason: linkReason as OrderRow['link_reason'],
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    setOrder((o) =>
      o
        ? {
            ...o,
            courier: delivery.courier || null,
            delivery_expected_date: delivery.delivery_expected_date || null,
            fulfillment_method: delivery.fulfillment_method,
            collection_location_id: delivery.fulfillment_method === 'collect' ? (delivery.collection_location_id || null) : null,
            collection_ready_at: collectionReadyAt,
            collection_must_collect_by: collectionMustBy,
            collection_notes: delivery.collection_notes || null,
            delivery_window_id: deliveryWindowId,
            delivery_scheduled_date: deliveryScheduledDate,
            courier_service_code: courierServiceCode,
            courier_service_add_ons: courierServiceAddOns,
            courier_preferred_time_slot: courierPreferredTimeSlot,
            courier_preferred_date: courierPreferredDate,
            parent_order_id: trimmedParent || null,
            link_reason: linkReason as OrderRow['link_reason'],
          }
        : null,
    )
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile?.user_id ?? null,
      eventType: 'delivery_updated',
      note: 'Delivery details updated',
    }).catch(() => {})
    setSaving(false)
  }

  async function sendCustomerTrackingEmail() {
    if (!orderId || !order || trackingEmailSending) return
    if (delivery.fulfillment_method !== 'delivery') {
      setActionError('Tracking updates are only available for delivery orders.')
      return
    }
    if (!delivery.courier.trim()) {
      setActionError('Select a courier before sending a tracking email.')
      return
    }
    if (!delivery.delivery_tracking.trim()) {
      setActionError('Add a tracking number/link before sending a tracking email.')
      return
    }

    const reference = order.reference?.trim() || `#${order.id.slice(0, 8)}`
    const dateBits: string[] = []
    if (selectedCourierServiceLabel) dateBits.push(`Service: ${selectedCourierServiceLabel}`)
    if (delivery.delivery_expected_date) dateBits.push(`Expected delivery date: ${new Date(dateInputToIso(delivery.delivery_expected_date)).toLocaleDateString('en-GB')}`)
    if (delivery.delivery_scheduled_date) dateBits.push(`Scheduled date: ${new Date(dateInputToIso(delivery.delivery_scheduled_date)).toLocaleDateString('en-GB')}`)
    if (delivery.courier_preferred_date) dateBits.push(`Preferred date requested: ${new Date(dateInputToIso(delivery.courier_preferred_date)).toLocaleDateString('en-GB')}`)
    if (delivery.courier_preferred_time_slot) {
      const slotLabel = getCourierTimeSlotLabel(delivery.courier_preferred_time_slot)
      if (slotLabel) dateBits.push(`Preferred slot: ${slotLabel}`)
    }
    if (delivery.courier_service_add_ons.length > 0) {
      const addOnLabels = delivery.courier_service_add_ons.map((code) => getCourierAddOnLabel(delivery.courier, code))
      dateBits.push(`Service options: ${addOnLabels.join(', ')}`)
    }
    if (selectedDeliveryWindow) dateBits.push(`Delivery window: ${formatDeliveryWindowLabel(selectedDeliveryWindow)}`)
    if (delivery.delivery_contact_name.trim()) dateBits.push(`Delivery contact: ${delivery.delivery_contact_name.trim()}`)
    if (delivery.delivery_contact_phone.trim()) dateBits.push(`Delivery phone: ${delivery.delivery_contact_phone.trim()}`)
    if (delivery.delivery_notes.trim()) dateBits.push(`Delivery notes: ${delivery.delivery_notes.trim()}`)
    const trackingLinkLine =
      trackingHref && trackingHref !== '#'
        ? `Track your order: ${trackingHref}`
        : `Tracking number: ${delivery.delivery_tracking.trim()}`
    const message = [
      `Your order ${reference} has a shipping update.`,
      '',
      `Courier: ${delivery.courier.trim()}`,
      `Tracking number: ${delivery.delivery_tracking.trim()}`,
      trackingLinkLine,
      ...dateBits,
      '',
      'If anything changes, our team will keep you updated.',
    ].join('\n')

    setTrackingEmailSending(true)
    setActionError(null)
    try {
      const attempt = await supabase.functions.invoke('notify-order-status', {
        body: {
          order_id: orderId,
          to_status: order.status,
          title: `Order ${reference} shipping update`,
          message,
          send_portal: true,
          send_email: true,
          send_sms: false,
        },
      })
      if (attempt.error) {
        const msg = attempt.error.message || 'Failed to send tracking email.'
        if (/not configured/i.test(msg)) {
          const portalOnly = await supabase.functions.invoke('notify-order-status', {
            body: {
              order_id: orderId,
              to_status: order.status,
              title: `Order ${reference} shipping update`,
              message,
              send_portal: true,
              send_email: false,
              send_sms: false,
            },
          })
          if (portalOnly.error) throw new Error(portalOnly.error.message)
        } else {
          throw new Error(msg)
        }
      }
      await insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'customer_tracking_email_sent',
        note: [delivery.courier, selectedCourierServiceLabel, delivery.delivery_tracking, delivery.delivery_expected_date].filter(Boolean).join(' · '),
      })
      const { data: refreshed } = await supabase
        .from('order_events')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
      setOrderEvents((refreshed as OrderEventRow[]) ?? [])
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not send tracking email update.')
    }
    setTrackingEmailSending(false)
  }

  async function saveInlineCustomerField(key: string, value: string) {
    if (!order?.user_id || !canEditOrders) return
    setEditingCustomerField((f) => (f ? { ...f, saving: true } : f))
    const trimmed = value.trim()
    let normalized: string | number | null = trimmed === '' ? null : trimmed
    if (key === 'credit_limit') {
      if (trimmed === '') {
        normalized = null
      } else {
        const n = Number(trimmed)
        if (!Number.isFinite(n) || n < 0) {
          setActionError('Credit limit must be a valid number greater than or equal to 0.')
          setEditingCustomerField((f) => (f ? { ...f, saving: false } : f))
          return
        }
        normalized = n
      }
    }
    if (key === 'website' && typeof normalized === 'string' && normalized) {
      const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
      const candidate = hasScheme ? normalized : `https://${normalized}`
      try {
        const url = new URL(candidate)
        if (!url.hostname || !url.hostname.includes('.')) throw new Error('Invalid hostname')
        normalized = url.toString()
      } catch {
        setActionError('Please enter a valid website URL (e.g. https://example.com).')
        setEditingCustomerField((f) => (f ? { ...f, saving: false } : f))
        return
      }
    }
    const { error } = await supabase
      .from('customer_profiles')
      .update({ [key]: normalized, updated_at: new Date().toISOString() })
      .eq('user_id', order.user_id)
    if (!error) {
      setCustomerProfile((p) => (p ? { ...p, [key]: normalized } : p))
      insertOrderEvent({
        orderId: order.id,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'customer_profile_updated',
        note: `Updated customer field: ${key.replace(/_/g, ' ')}`,
      }).catch(() => {})
    }
    setEditingCustomerField(null)
  }

  async function createShipmentAndAllocateStock() {
    if (!orderId || shipping || !canEditOrders || order?.is_archived === true) return
    if (!shipForm.location_id) return
    setShipping(true)
    try {
      await allocateStockForOrderShipmentAtomic({ orderId, locationId: shipForm.location_id, reason: 'shipment' })
      await supabase.from('shipments').insert({
        order_id: orderId,
        location_id: shipForm.location_id,
        courier: shipForm.courier || null,
        tracking: shipForm.tracking || null,
        note: shipForm.note || null,
      })
      if (shipForm.courier || shipForm.tracking) {
        await supabase
          .from('orders')
          .update({
            courier: shipForm.courier || null,
            delivery_tracking: shipForm.tracking || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)
      }
      try {
      await insertOrderEvent({
          orderId,
          actorUserId: staffProfile?.user_id ?? null,
          eventType: 'shipment_created',
        note: [shipForm.courier, shipForm.tracking].filter(Boolean).join(' · ') || shipForm.note || 'Delivery created',
        })
      } catch (_) { /* best-effort audit */ }
      const [shipmentsRes, eventsRes] = await Promise.all([
        supabase.from('shipments').select('*').eq('order_id', orderId).order('shipped_at', { ascending: false }),
        supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      ])
      setShipments((shipmentsRes.data ?? []) as ShipmentRow[])
      setOrderEvents((eventsRes.data ?? []) as OrderEventRow[])
      if (shipForm.courier || shipForm.tracking) {
        setOrder((prev) =>
          prev
            ? { ...prev, courier: shipForm.courier || null, delivery_tracking: shipForm.tracking || null }
            : prev,
        )
        setDelivery((prev) => ({
          ...prev,
          courier: shipForm.courier || prev.courier,
          delivery_tracking: shipForm.tracking || prev.delivery_tracking,
        }))
      }
      setShipForm((f) => ({ ...f, note: '' }))
    } catch (_) {
      // Swallow for now; RLS/constraints/errors will be visible in console.
    }
    setShipping(false)
  }

  async function commitCatalogFromPicker(payload: CatalogPickerCommitPayload) {
    if (!orderId || order?.is_archived === true) return
    setSaving(true)
    setActionError(null)
    const useCustomerPricing =
      effectiveLineAddPricingMode() === 'customer_rules' && Boolean(order?.user_id)
    try {
      if (payload.products.length > 0) {
        await insertProductOrderLines({
          orderId,
          lines: payload.products,
          customerUserId: order?.user_id ?? undefined,
          repriceCustomer: useCustomerPricing,
        })
      }
      for (const line of payload.assemblies) {
        await insertAssemblyOrderLines({
          orderId,
          assembly: line.assembly,
          quantity: line.quantity,
          customerUserId: order?.user_id ?? undefined,
          repriceCustomer: useCustomerPricing,
        })
      }
      if (!useCustomerPricing) {
        await recalcTotals()
      }
      if (effectiveLineAddPricingMode() === 'customer_rules' && !order?.user_id) {
        setActionError('This order has no customer — lines added at list price.')
      }
      const noteParts = [
        ...payload.products.map((l) => `${l.product.sku ?? ''} ${l.product.name} ×${l.quantity}`.trim()),
        ...payload.assemblies.map((l) => `${l.assembly.name} ×${l.quantity}`),
      ]
      insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'line_added',
        note: noteParts.slice(0, 3).join('; ') + (noteParts.length > 3 ? '…' : ''),
      }).catch(() => {})
      await reloadOrderLinesFromDb()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not add lines from product search.')
    } finally {
      setSaving(false)
    }
  }

  async function updateLineQty(lineId: string, delta: number) {
    if (order?.is_archived === true) return
    const line = lines.find((l) => l.id === lineId)
    if (!line || !orderId) return
    const newQty = Math.max(0, line.quantity + delta)
    if (newQty === 0) {
      await supabase.from('order_lines').delete().eq('id', lineId)
    } else {
      await supabase.from('order_lines').update({ quantity: newQty }).eq('id', lineId)
    }
    await recalcTotals()
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile?.user_id ?? null,
      eventType: 'line_quantity_changed',
      note: `${line.product_snapshot?.sku ? `${String(line.product_snapshot.sku)} — ` : ''}${String(line.product_snapshot?.name ?? 'Line')}: ${line.quantity} → ${newQty}`,
    }).catch(() => {})
    if (effectiveLineAddPricingMode() === 'customer_rules' && order?.user_id) {
      try {
        await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: order.user_id })
      } catch {
        /* keep recalc totals from above */
      }
    }
    await reloadOrderLinesFromDb()
  }

  async function updateLineCombination(lineId: string, label: string) {
    if (!orderId || order?.is_archived === true) return
    const trimmed = label.trim()
    setSaving(true)
    await supabase
      .from('order_lines')
      .update({ combination_label: trimmed || null })
      .eq('id', lineId)
    const { data } = await supabase
      .from('order_lines')
      .select('id, product_snapshot, quantity, unit_price, combination_label, composed_code')
      .eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    setSaving(false)
  }

  async function updateLinePrice(lineId: string, newPrice: number) {
    if (!orderId || newPrice < 0 || order?.is_archived === true) return
    setSaving(true)
    await supabase.from('order_lines').update({ unit_price: newPrice }).eq('id', lineId)
    await recalcTotals()
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile?.user_id ?? null,
      eventType: 'line_price_changed',
      note: `Line price updated to £${Number(newPrice).toFixed(2)}`,
    }).catch(() => {})
    const { data } = await supabase
      .from('order_lines')
      .select('id, product_snapshot, quantity, unit_price, combination_label, composed_code')
      .eq('order_id', orderId)
    setLines((data as LineRow[]) ?? [])
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
    setEditingPriceLineId(null)
    setEditingPriceValue('')
    setSaving(false)
  }

  async function deleteLine(lineId: string) {
    if (!orderId || order?.is_archived === true) return
    setDeletingLineId(lineId)
    await supabase.from('order_lines').delete().eq('id', lineId)
    await recalcTotals()
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile?.user_id ?? null,
      eventType: 'line_removed',
      note: 'Line removed',
    }).catch(() => {})
    if (effectiveLineAddPricingMode() === 'customer_rules' && order?.user_id) {
      try {
        await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: order.user_id })
      } catch {
        /* ignore */
      }
    }
    await reloadOrderLinesFromDb()
    setDeletingLineId(null)
  }

  async function recalcTotals() {
    if (!orderId) return
    await recalcOrderTotals(orderId)
    const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (o) setOrder(o as OrderRow)
  }

  function effectiveLineAddPricingMode(): AdminOrderLinePricingMode {
    return lineAddPricingChoice === 'use_default' ? adminOrderLinePricingDefault : lineAddPricingChoice
  }

  async function reloadOrderLinesFromDb() {
    if (!orderId) return
    const [{ data: lineData }, { data: orderData }] = await Promise.all([
      supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price, combination_label, composed_code').eq('order_id', orderId),
      supabase.from('orders').select('*').eq('id', orderId).single(),
    ])
    setLines((lineData as LineRow[]) ?? [])
    if (orderData) setOrder(orderData as OrderRow)
  }

  async function applyCustomerPricingToLines() {
    if (!orderId || !order?.user_id || repricingBusy) return
    setRepricingBusy(true)
    setActionError(null)
    try {
      await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: order.user_id })
      await reloadOrderLinesFromDb()
      insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'line_price_changed',
        note: 'Applied customer pricing (rules + account discount) to catalogue lines',
      }).catch(() => {})
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not apply customer pricing.')
    } finally {
      setRepricingBusy(false)
    }
  }

  async function setArchived(isArchived: boolean) {
    if (!orderId || !order || !canEditOrders) return
    setArchiving(true)
    const updates: Partial<OrderRow> = {
      is_archived: isArchived,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (!error) setOrder((o) => (o ? { ...o, ...updates } : null))
    insertOrderEvent({
      orderId,
      actorUserId: staffProfile?.user_id ?? null,
      eventType: isArchived ? 'order_archived' : 'order_reopened',
      note: isArchived ? 'Order archived' : 'Order reopened',
    }).catch(() => {})
    setArchiving(false)
  }

  async function duplicateOrder() {
    if (!orderId || !order || !canEditOrders) return
    setDuplicating(true)
    try {
      const { data: newOrder, error: newOrderError } = await supabase
        .from('orders')
        .insert({
          user_id: order.user_id,
          status: 'draft',
          reference: order.reference ? `${order.reference} (Copy)` : null,
          delivery_address: order.delivery_address ?? null,
          delivery_postcode: order.delivery_postcode ?? null,
          delivery_notes: order.delivery_notes ?? null,
          delivery_contact_name: order.delivery_contact_name ?? null,
          delivery_contact_phone: order.delivery_contact_phone ?? null,
          delivery_contact_email: order.delivery_contact_email ?? null,
          delivery_contact_notes: order.delivery_contact_notes ?? null,
          delivery_same_as_billing: order.delivery_same_as_billing ?? true,
          courier: order.courier ?? null,
          courier_service_code: order.courier_service_code ?? null,
          courier_service_add_ons: order.courier_service_add_ons ?? [],
          courier_preferred_time_slot: order.courier_preferred_time_slot ?? null,
          courier_preferred_date: order.courier_preferred_date ?? null,
          delivery_expected_date: order.delivery_expected_date ?? null,
          delivery_tracking: null,
          fulfillment_method: order.fulfillment_method ?? 'delivery',
          collection_location_id: order.collection_location_id ?? null,
          collection_notes: order.collection_notes ?? null,
          collection_ready_at: null,
          collection_must_collect_by: null,
          is_archived: false,
          total_ex_vat: 0,
          total_inc_vat: 0,
        })
        .select('id')
        .single()
      if (newOrderError || !newOrder?.id) return
      insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'order_duplicated',
        note: `Created copy: ${newOrder.id.slice(0, 8)}…`,
      }).catch(() => {})

      const { data: currentLines } = await supabase
        .from('order_lines')
        .select('product_id, product_snapshot, quantity, unit_price, options')
        .eq('order_id', orderId)

      if ((currentLines ?? []).length > 0) {
        const copiedLines = (currentLines ?? []).map((line) => ({
          order_id: newOrder.id,
          product_id: line.product_id,
          product_snapshot: line.product_snapshot,
          quantity: line.quantity,
          unit_price: line.unit_price,
          options: line.options ?? {},
        }))
        await supabase.from('order_lines').insert(copiedLines)
      }
      navigate(`/admin/orders/${newOrder.id}`)
    } finally {
      setDuplicating(false)
    }
  }

  if (!orderId || (order === null && !loading)) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Order not found.</p>
          <Link to="/admin/orders" className="btn btn-outline">← Back to orders</Link>
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading order…</p>
        </div>
      </div>
    )
  }

  const currentStatus = order!.status
  const isQuotation = currentStatus === 'quotation'
  const next = nextStatuses(currentStatus)
  const reopen = reopenStatuses(currentStatus)
  const isCancelled = currentStatus === 'cancelled'
  const isArchived = order!.is_archived === true
  const canProcess = !isArchived && !isCancelled && currentStatus !== 'draft'
  const canEdit = !isArchived && canEditLines(currentStatus)
  const hasTrackingCore = delivery.fulfillment_method === 'delivery' && !!delivery.courier && !!delivery.delivery_tracking
  const canSendTrackingUpdate = !saving && !trackingEmailSending && hasTrackingCore

  return (
    <div className="admin-page admin-order-detail-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/orders">Orders</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{isQuotation ? 'Quote' : 'Order'} {order!.reference || orderId!.slice(0, 8)}</span>
          {order!.parent_order_id ? (
            <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
              · Parent:{' '}
              <Link to={`/admin/orders/${order!.parent_order_id}`}>{order!.parent_order_id.slice(0, 8)}…</Link>
              {order!.link_reason ? ` (${order!.link_reason})` : ''}
            </span>
          ) : null}
          {linkedOrderMenuOptions.length > 0 && (
            <span className="admin-linked-order-jump">
              <label htmlFor="linked-order-jump">Linked orders</label>
              <select
                id="linked-order-jump"
                defaultValue=""
                onChange={(e) => {
                  const nextId = e.target.value
                  if (!nextId) return
                  navigate(`/admin/orders/${nextId}`)
                }}
              >
                <option value="">Open…</option>
                {linkedOrderMenuOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatOrderOptionLabel(o)}
                  </option>
                ))}
              </select>
            </span>
          )}
        </span>
        <div className="admin-page-header-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={sendCustomerTrackingEmail}
            disabled={!canSendTrackingUpdate}
            title={
              hasTrackingCore
                ? 'Send customer a delivery update with courier and tracking details'
                : 'Set fulfillment to Delivery, then add courier + tracking to enable this action'
            }
          >
            {trackingEmailSending ? 'Sending update…' : 'Send delivery/tracking update'}
          </button>
          {order!.invoice_number && (
            <Link to={`/admin/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">Print invoice</Link>
          )}
          <Link to={`/admin/orders/${orderId}/packing-slip`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">Packing slip</Link>
          {['draft', 'quotation', 'placed'].includes(order!.status) && (
            <>
              <Link to={`/admin/orders/${orderId}/quote`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">Print quote</Link>
              <Link to={`/admin/orders/${orderId}/quote?mode=no-pricing`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">Quote (no pricing)</Link>
            </>
          )}
          {isQuotation && canEditOrders && !isArchived && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setConvertQuoteConfirm(true)}
              disabled={saving}
            >
              Convert to order
            </button>
          )}
          <Link to={`/admin/customers/${order!.user_id}`} className="btn btn-outline btn-small">Customer</Link>
          {['quotation', 'placed', 'invoiced', 'paid'].includes(order!.status) && (
            <Link
              to={`/admin/create-order?customer=${order!.user_id}&parentOrder=${orderId}&linkReason=extras`}
              className="btn btn-outline btn-small"
            >
              Create extras order
            </Link>
          )}
          <Link to="/admin/orders" className="btn btn-outline btn-small">← Back to orders</Link>
        </div>
      </div>

          {isQuotation && (
        <div className="card admin-card admin-quote-workflow-card" role="note">
          <h2 style={{ marginTop: 0 }}>Quotation</h2>
          <p style={{ margin: '0 0 0.75rem' }}>
            This record is a quote, not a placed order. Add lines and pricing below, print or send the quote to the customer,
            then use <strong>Convert to order</strong> when they confirm. You can still edit lines while status is Quotation.
          </p>
          {canEditOrders && !isArchived && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <Link to={`/admin/orders/${orderId}/quote`} target="_blank" rel="noopener noreferrer" className="btn btn-small">
                Print quote
              </Link>
              <button type="button" className="btn btn-small" onClick={() => setConvertQuoteConfirm(true)} disabled={saving}>
                Convert to order
              </button>
            </div>
          )}
          {orderId && (
            <QuoteDocumentOptionsPanel orderId={orderId} basePath="/admin/orders" className="admin-quote-doc-options-wrap" />
          )}
        </div>
      )}

      {/* Order actions: reopen, process, set status, cancel */}
      <div className="card admin-card admin-order-actions-card">
        <h2>{isQuotation ? 'Quote actions' : 'Order actions'}</h2>
        {actionError && (
          <div className="admin-confirm-box" role="alert">
            <p>{actionError}</p>
          </div>
        )}
        <div className="admin-order-status-row">
          <div className="admin-order-current-status">
            <strong>Status:</strong>{' '}
            <span className={`admin-status-badge admin-status-badge--${currentStatus}`}>
              {STATUS_LABELS[currentStatus] ?? currentStatus}
            </span>
            {order!.invoice_number && (
              <span className="admin-status-meta">Invoice: {order!.invoice_number}</span>
            )}
            {order!.payment_status === 'succeeded' && (
              <span className="admin-payment-badge" title="Payment succeeded">Paid</span>
            )}
            {isArchived && (
              <span className="admin-payment-badge" title="This order is archived">Archived</span>
            )}
            {customerNotificationState.needsAttention && customerNotificationState.status && (
              <span
                className="admin-payment-badge"
                title="Customer was not notified after the last status change. Open the order timeline to record a notification when you contact them."
              >
                Customer not notified
              </span>
            )}
          </div>

          {/* Inline status changer (keeps the main actions area less cluttered) */}
          <div className="admin-order-inline-status">
            <span className="admin-muted" style={{ margin: 0 }}>Set status</span>
            <select
              value={setStatusValue}
              onChange={(e) => setSetStatusValue((e.target.value || '') as OrderRow['status'])}
              disabled={saving || isArchived}
              title={isArchived ? 'Reopen order to change status' : 'Set status to any workflow state'}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                if (setStatusValue && setStatusValue !== currentStatus) {
                  if (setStatusValue === 'cancelled') setCancelConfirm(true)
                  else if (isCancelled) {
                    setReopenToValue(setStatusValue)
                    setReopenConfirm(true)
                  } else setSetStatusConfirm(true)
                }
              }}
              disabled={!setStatusValue || setStatusValue === currentStatus || saving || isArchived}
              title={isArchived ? 'Reopen order to apply a new status' : 'Apply selected status'}
            >
              Apply
            </button>
          </div>
        </div>
        {isArchived && (
          <p className="admin-muted">This order is archived. Reopen it to progress, edit, or ship it again.</p>
        )}

        {order!.processed_at && (
          <p className="admin-muted" title="Internal timestamp used by staff to track when the order entered the processing workflow.">
            Processed: {new Date(order!.processed_at).toLocaleString()}
          </p>
        )}

        <div className="admin-order-actions-grid">
          <div className="admin-action-block">
            <h3>Customer updates</h3>
            <p className="admin-action-hint">
              Send a customer-facing shipping message with courier, tracking, and delivery timing details.
            </p>
            <div className="admin-status-buttons">
              <button
                type="button"
                className="btn btn-small"
                onClick={sendCustomerTrackingEmail}
                disabled={!canSendTrackingUpdate}
                title={
                  hasTrackingCore
                    ? 'Send customer shipping update now'
                    : 'Set fulfillment to Delivery and add courier + tracking first'
                }
              >
                {trackingEmailSending ? 'Sending update…' : 'Send delivery/tracking update'}
              </button>
            </div>
            {!hasTrackingCore && (
              <p className="admin-muted" style={{ marginTop: '0.45rem' }}>
                Add courier + tracking in Delivery details to enable this.
              </p>
            )}
          </div>

          <div className="admin-action-block">
            <h3>Archive</h3>
            <p className="admin-action-hint">Archive hides this order from active workflows. Reopen restores it.</p>
            <div className="admin-status-buttons">
              <button type="button" className="btn btn-small btn-outline" onClick={() => setArchived(!isArchived)} disabled={archiving || saving || !canEditOrders}>
                {archiving ? 'Saving…' : isArchived ? 'Reopen order' : 'Archive order'}
              </button>
              <button type="button" className="btn btn-small btn-outline" onClick={duplicateOrder} disabled={duplicating || saving || !canEditOrders}>
                {duplicating ? 'Duplicating…' : 'Duplicate order'}
              </button>
            </div>
          </div>

          {/* Reopen cancelled: only when status is cancelled */}
          {isCancelled && !isArchived && (
            <div className="admin-action-block">
              <h3>Reopen cancelled order</h3>
              <p className="admin-action-hint">Set the order back to Draft or Quotation so it can be edited and progressed again.</p>
              <select
                value={reopenToValue}
                onChange={(e) => setReopenToValue((e.target.value || '') as OrderRow['status'] | '')}
              >
                <option value="">Choose new status…</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
              </select>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => reopenToValue && setReopenConfirm(true)}
                disabled={!reopenToValue || saving}
              >
                Reopen order
              </button>
            </div>
          )}

          {/* Reopen (move backward): when not cancelled and not draft */}
          {!isCancelled && !isArchived && reopen.length > 0 && (
            <div className="admin-action-block">
              <h3>Reopen to earlier status</h3>
              <p className="admin-action-hint">Move the order back so you can edit lines or change details.</p>
              <div className="admin-status-buttons">
                {reopen.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn btn-small btn-outline"
                    onClick={() => setStatus(status)}
                    disabled={saving}
                  >
                    Reopen to {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move forward */}
          {!isArchived && next.length > 0 && (
            <div className="admin-action-block">
              <h3>Progress order</h3>
              <div className="admin-status-buttons">
                {next.filter((s) => s !== 'cancelled').map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn btn-small"
                    onClick={() => setStatus(status)}
                    disabled={saving}
                  >
                    Mark as {STATUS_LABELS[status]}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-small btn-danger-outline"
                  onClick={() => setCancelConfirm(true)}
                  disabled={saving || isCancelled || isArchived}
                >
                  Cancel order
                </button>
              </div>
            </div>
          )}

          {/* Manual process */}
          {canProcess && (
            <div className="admin-action-block">
              <h3>Processing</h3>
              <button
                type="button"
                className="btn btn-small btn-outline"
                onClick={() => {
                  setProcessedPanelOpen((v) => !v)
                  if (!processedDateDraft) setProcessedDateDraft(new Date().toISOString().slice(0, 10))
                }}
                disabled={saving}
                title="Sets the internal processed date (does not change status)."
              >
                Set processed date
              </button>
              {processedPanelOpen && (
                <div className="admin-confirm-inline" style={{ marginTop: '0.5rem' }}>
                  <label className="admin-muted" style={{ margin: 0 }}>
                    Date{' '}
                    <input
                      type="date"
                      value={processedDateDraft}
                      onChange={(e) => setProcessedDateDraft(e.target.value)}
                      className="admin-filter-input"
                      title="Internal processed date used for ops tracking."
                    />
                  </label>
                  <button type="button" className="btn btn-small" onClick={markAsProcessed} disabled={saving || !processedDateDraft}>
                    Save
                  </button>
                  <button type="button" className="btn btn-small btn-outline" onClick={() => setProcessedPanelOpen(false)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Status confirm UI stays here to keep layout stable */}
          {convertQuoteConfirm && (
            <div className="admin-confirm-box" role="dialog" aria-labelledby="convert-quote-title">
              <p id="convert-quote-title">
                <strong>Convert this quote to a placed order?</strong> Status will change from Quotation to Placed.
                Lines, pricing, and delivery details are kept. You can invoice and fulfil it like any other order.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={async () => {
                    setConvertQuoteConfirm(false)
                    await setStatus('placed')
                  }}
                  disabled={saving}
                >
                  Yes, convert to order
                </button>
                <button type="button" className="btn btn-outline btn-small" onClick={() => setConvertQuoteConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {setStatusConfirm && setStatusValue && setStatusValue !== 'cancelled' && (
            <div className="admin-action-block">
              <h3>Confirm status change</h3>
              <div className="admin-confirm-inline">
                <span>Set status to {STATUS_LABELS[setStatusValue]}?</span>
                <button type="button" className="btn btn-small" onClick={() => { setStatus(setStatusValue as OrderRow['status']); setSetStatusConfirm(false); }}>Confirm</button>
                <button type="button" className="btn btn-small btn-outline" onClick={() => setSetStatusConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {cancelConfirm && (
          <div className="admin-confirm-box">
            <p>Cancel this order? Status will be set to Cancelled.</p>
            <div className="admin-confirm-actions">
              <button type="button" className="btn btn-danger" onClick={() => setStatus('cancelled')} disabled={saving}>Yes, cancel order</button>
              <button type="button" className="btn btn-outline" onClick={() => setCancelConfirm(false)}>No, keep order</button>
            </div>
          </div>
        )}

        {reopenConfirm && reopenToValue && (
          <div className="admin-confirm-box">
            <p>Reopen this order and set status to {STATUS_LABELS[reopenToValue]}?</p>
            <div className="admin-confirm-actions">
              <button type="button" className="btn" onClick={() => { setStatus(reopenToValue as OrderRow['status']); setReopenConfirm(false); setReopenToValue(''); }} disabled={saving}>Yes, reopen</button>
              <button type="button" className="btn btn-outline" onClick={() => { setReopenConfirm(false); setReopenToValue(''); }}>No</button>
            </div>
          </div>
        )}

        {notifyPrompt && (
          <div className="admin-confirm-box">
            <p>
              Status updated to <strong>{STATUS_LABELS[notifyPrompt.toStatus] ?? notifyPrompt.toStatus}</strong>. Notify the customer?
            </p>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setCustomerNotification({ notify: true, forStatus: notifyPrompt.toStatus })}
                disabled={notifySaving}
                title="Records that the customer has been notified (we can wire this to email/SMS next)."
              >
                Yes, mark as notified
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCustomerNotification({ notify: false, forStatus: notifyPrompt.toStatus })}
                disabled={notifySaving}
                title="Records that the customer was not notified so staff can follow up."
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card admin-card">
        <div className="admin-workflow-section-head">
          <h2>Pick lists</h2>
          <span className="admin-muted">{pickLists.length} linked</span>
        </div>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Generate a warehouse pick list from this order, then track picked quantities.
        </p>
        <div className="admin-order-processing-actions" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-small"
            onClick={generatePickList}
            disabled={pickListBusy || isArchived}
          >
            {pickListBusy ? 'Generating…' : 'Generate pick list'}
          </button>
          {pickLists[0] && (
            <>
              <Link to={`/admin/pick-lists/${pickLists[0].id}`} className="btn btn-small btn-outline">Open latest pick list</Link>
              <Link to={`/admin/pick-lists/${pickLists[0].id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-small btn-outline">
                Print latest pick list
              </Link>
            </>
          )}
        </div>
        {pickLists.length === 0 ? (
          <p className="admin-muted" style={{ marginBottom: 0 }}>No pick lists generated yet.</p>
        ) : (
          <div className="admin-table-wrap admin-table-wrap--compact">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pick list</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pickLists.map((pickList) => (
                  <tr key={pickList.id}>
                    <td>{pickList.id.slice(0, 8)}</td>
                    <td>{pickList.status}</td>
                    <td>{new Date(pickList.generated_at).toLocaleString()}</td>
                    <td>
                      <div className="admin-order-processing-actions">
                        <Link to={`/admin/pick-lists/${pickList.id}`} className="btn btn-small btn-outline">Open</Link>
                        <Link to={`/admin/pick-lists/${pickList.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-small btn-outline">
                          Print
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card admin-card">
        <div className="admin-card-heading-row">
          <h2 style={{ marginBottom: 0 }}>Advanced order panels</h2>
          <button
            type="button"
            className={`btn btn-small ${showAdvancedPanels ? 'active' : 'btn-outline'}`}
            onClick={() => setShowAdvancedPanels((v) => !v)}
            aria-expanded={showAdvancedPanels}
          >
            {showAdvancedPanels ? 'Hide advanced panels' : 'Show advanced panels'}
          </button>
        </div>
        <p className="admin-muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          Includes customer profile edits, full order history, and shipment log.
        </p>
        {showAdvancedPanels && (
          <div className="admin-confirm-inline" style={{ marginTop: '0.75rem' }}>
            <p className="admin-muted" style={{ margin: 0 }}>
              Advanced modules loaded: Customer details, status/audit timeline, and deliveries.
            </p>
            <div className="admin-status-buttons" style={{ marginTop: '0.5rem' }}>
              <a className="btn btn-small btn-outline" href="#advanced-customer-details">Customer details</a>
              <a className="btn btn-small btn-outline" href="#advanced-order-history">Order history</a>
              <a className="btn btn-small btn-outline" href="#advanced-deliveries">Deliveries</a>
            </div>
          </div>
        )}
      </div>

      <div className="admin-order-grid admin-order-grid--stacked">
        <div className="card admin-card">
          <h2>Reference & customer</h2>
          <div className="admin-order-reference">
            <label>Reference</label>
            <input
              type="text"
              value={order!.reference ?? ''}
              onChange={async (e) => {
                const v = e.target.value
                await supabase.from('orders').update({ reference: v || null, updated_at: new Date().toISOString() }).eq('id', orderId)
                setOrder((o) => (o ? { ...o, reference: v || null } : null))
              }}
              placeholder="Order reference"
            />
          </div>
          <p className="admin-muted">
            <strong>Customer:</strong> {customerProfile?.company_name || customerProfile?.contact_name || '—'}
          </p>
          {customerPaymentTerms && <p className="admin-muted"><strong>Payment terms:</strong> {customerPaymentTerms}</p>}
          <p className="admin-muted" style={{ marginBottom: 0 }}>
            <strong>Customer ref:</strong> <code>{customerRef ?? '—'}</code> ·{' '}
            <span className="admin-muted">user_id: {order!.user_id.slice(0, 8)}…</span>
          </p>
        </div>

        <div className="card admin-card">
          <h2>Billing details</h2>
          <div className="admin-customer-detail-grid">
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Company</strong></p>
              <p className="admin-muted" style={{ marginTop: 0 }}>{customerProfile?.company_name || '—'}</p>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Contact</strong></p>
              <p className="admin-muted" style={{ marginTop: 0 }}>{customerProfile?.contact_name || '—'}</p>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Billing address</strong></p>
              <p className="admin-muted" style={{ marginTop: 0 }}>
                {[customerProfile?.billing_address, customerProfile?.billing_city, customerProfile?.billing_postcode].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Default delivery</strong></p>
              <p className="admin-muted" style={{ marginTop: 0 }}>
                {[customerProfile?.delivery_address, customerProfile?.delivery_city, customerProfile?.delivery_postcode].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>
          <p className="admin-muted" style={{ marginBottom: 0 }}>
            Need to edit billing/account defaults? <Link to={`/admin/customers/${order!.user_id}`}>Open customer profile</Link>.
          </p>
        </div>

        <div className="card admin-card admin-card--delivery">
          <h2>Delivery details</h2>
          <div style={{ marginBottom: '0.75rem' }}>
            <span className="admin-muted" style={{ marginRight: '0.75rem' }}>Fulfillment</span>
            <label style={{ marginRight: '1rem' }}>
              <input
                type="radio"
                name="admin_fulfillment"
                checked={delivery.fulfillment_method === 'delivery'}
                onChange={() =>
                  setDelivery((d) => ({
                    ...d,
                    fulfillment_method: 'delivery',
                    collection_location_id: '',
                  }))
                }
              />{' '}
              Delivery
            </label>
            <label>
              <input
                type="radio"
                name="admin_fulfillment"
                checked={delivery.fulfillment_method === 'collect'}
                onChange={() =>
                  setDelivery((d) => ({
                    ...d,
                    fulfillment_method: 'collect',
                    delivery_window_id: '',
                    delivery_scheduled_date: '',
                  }))
                }
              />{' '}
              Click &amp; collect
            </label>
          </div>

          {delivery.fulfillment_method === 'collect' && (
            <>
              <label>Collection point</label>
              <select
                value={delivery.collection_location_id}
                onChange={(e) => setDelivery((d) => ({ ...d, collection_location_id: e.target.value }))}
              >
                <option value="">— Select —</option>
                {selectableLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `${l.code} — ` : ''}{l.name}
                  </option>
                ))}
              </select>
              <label>Collection notes</label>
              <textarea
                value={delivery.collection_notes}
                onChange={(e) => setDelivery((d) => ({ ...d, collection_notes: e.target.value }))}
                rows={2}
                placeholder="Pickup instructions, vehicle, etc."
              />
              <label>Ready from</label>
              <input
                type="datetime-local"
                value={delivery.collection_ready_at}
                onChange={(e) => setDelivery((d) => ({ ...d, collection_ready_at: e.target.value }))}
              />
              <label>Must collect by</label>
              <input
                type="datetime-local"
                value={delivery.collection_must_collect_by}
                onChange={(e) => setDelivery((d) => ({ ...d, collection_must_collect_by: e.target.value }))}
              />
            </>
          )}

          <label className="admin-checkbox-label" style={{ marginTop: 0 }}>
            <input
              type="checkbox"
              checked={!!delivery.delivery_same_as_billing}
              onChange={(e) => setDelivery((d) => ({ ...d, delivery_same_as_billing: e.target.checked }))}
            />
            Use billing / account details as default
          </label>
          <label>Address</label>
          <textarea
            value={delivery.delivery_address}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_address: e.target.value }))}
            rows={2}
            placeholder="Delivery address"
          />
          <label>Postcode</label>
          <input
            type="text"
            value={delivery.delivery_postcode}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_postcode: e.target.value }))}
            placeholder="Postcode"
          />
          <h3 style={{ margin: '0.75rem 0 0.25rem' }}>Delivery contact</h3>
          <label>Contact name</label>
          <input
            type="text"
            value={delivery.delivery_contact_name}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_contact_name: e.target.value }))}
            placeholder="Name for delivery contact"
          />
          <label>Contact phone</label>
          <input
            type="tel"
            value={delivery.delivery_contact_phone}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_contact_phone: e.target.value }))}
            placeholder="Phone for delivery contact"
          />
          <label>Contact email</label>
          <input
            type="email"
            value={delivery.delivery_contact_email}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_contact_email: e.target.value }))}
            placeholder="Email for delivery contact"
          />
          <label>Contact notes</label>
          <textarea
            value={delivery.delivery_contact_notes}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_contact_notes: e.target.value }))}
            rows={2}
            placeholder="e.g. call before delivery, access codes, preferred times"
          />
          <label>Notes</label>
          <textarea
            value={delivery.delivery_notes}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_notes: e.target.value }))}
            rows={2}
            placeholder="Delivery notes"
          />

          {delivery.fulfillment_method === 'delivery' && deliveryWindows.length > 0 && (
            <>
              <label>Customer delivery window</label>
              <select
                value={delivery.delivery_window_id}
                onChange={(e) => setDelivery((d) => ({ ...d, delivery_window_id: e.target.value }))}
              >
                <option value="">— None —</option>
                {deliveryWindows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatDeliveryWindowLabel(w)}
                  </option>
                ))}
              </select>
              <label>Scheduled delivery date (window)</label>
              <input
                type="date"
                value={delivery.delivery_scheduled_date}
                onChange={(e) => setDelivery((d) => ({ ...d, delivery_scheduled_date: e.target.value }))}
              />
            </>
          )}

          <button type="button" className="btn btn-small" onClick={saveDelivery} disabled={saving}>
            Save delivery details
          </button>
        </div>

        <div className="card admin-card">
          <h2>Courier, schedule & tracking</h2>
          <label>Courier</label>
          <select
            value={delivery.courier}
            onChange={(e) => setDelivery((d) => ({ ...d, courier: e.target.value }))}
          >
            <option value="">— Select —</option>
            {COURIER_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label>Service level</label>
          <select
            value={delivery.courier_service_code}
            onChange={(e) => setDelivery((d) => ({ ...d, courier_service_code: e.target.value }))}
            disabled={!delivery.courier}
          >
            <option value="">{delivery.courier ? '— Select service —' : 'Select courier first'}</option>
            {courierConfig.services.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}{s.description ? ` — ${s.description}` : ''}
              </option>
            ))}
          </select>
          {courierConfig.supportsPreferredDate && (
            <>
              <label>Preferred delivery date</label>
              <input
                type="date"
                value={delivery.courier_preferred_date}
                onChange={(e) => setDelivery((d) => ({ ...d, courier_preferred_date: e.target.value }))}
              />
            </>
          )}
          {courierConfig.supportsTimeSlot && (
            <>
              <label>Preferred slot</label>
              <select
                value={delivery.courier_preferred_time_slot}
                onChange={(e) => setDelivery((d) => ({ ...d, courier_preferred_time_slot: e.target.value }))}
              >
                <option value="">— Any slot —</option>
                {COURIER_TIME_SLOTS.map((slot) => (
                  <option key={slot.code} value={slot.code}>{slot.label}</option>
                ))}
              </select>
            </>
          )}
          {courierConfig.addOns.length > 0 && (
            <>
              <label>Service options</label>
              <div className="admin-courier-options-grid">
                {courierConfig.addOns.map((opt) => {
                  const checked = delivery.courier_service_add_ons.includes(opt.code)
                  return (
                    <label key={opt.code} className="admin-checkbox-label admin-checkbox-label--courier-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setDelivery((d) => ({
                            ...d,
                            courier_service_add_ons: e.target.checked
                              ? [...d.courier_service_add_ons, opt.code]
                              : d.courier_service_add_ons.filter((v) => v !== opt.code),
                          }))
                        }}
                      />
                      {opt.label}
                    </label>
                  )
                })}
              </div>
            </>
          )}
          <label>Expected delivery date</label>
          <input
            type="date"
            value={delivery.delivery_expected_date}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_expected_date: e.target.value }))}
          />
          <label>Tracking number / link</label>
          <input
            type="text"
            value={delivery.delivery_tracking}
            onChange={(e) => setDelivery((d) => ({ ...d, delivery_tracking: e.target.value }))}
            placeholder="Tracking number or full URL"
          />
          <div className="admin-delivery-tools">
            {delivery.delivery_tracking && delivery.courier && (
              <p className="admin-muted" style={{ margin: 0 }}>
                <a href={trackingHref || '#'} target="_blank" rel="noopener noreferrer">
                  Open tracking →
                </a>
              </p>
            )}
            <button
              type="button"
              className="btn btn-small"
              onClick={sendCustomerTrackingEmail}
              disabled={!canSendTrackingUpdate}
              title="Emails customer with courier, tracking, and delivery timing details"
            >
              {trackingEmailSending ? 'Sending update…' : 'Send customer delivery/tracking update'}
            </button>
          </div>
          <p className="admin-muted" style={{ marginTop: '0.35rem' }}>
            Includes courier, tracking number/link, scheduled date, and selected delivery window.
          </p>
          {(selectedCourierServiceLabel || delivery.courier_service_add_ons.length > 0 || delivery.courier_preferred_time_slot || delivery.courier_preferred_date) && (
            <p className="admin-muted" style={{ marginTop: 0 }}>
              <strong>Service summary:</strong>{' '}
              {[
                selectedCourierServiceLabel ? `Service ${selectedCourierServiceLabel}` : null,
                delivery.courier_preferred_date ? `Preferred date ${delivery.courier_preferred_date}` : null,
                getCourierTimeSlotLabel(delivery.courier_preferred_time_slot)
                  ? `Slot ${getCourierTimeSlotLabel(delivery.courier_preferred_time_slot)}`
                  : null,
                delivery.courier_service_add_ons.length > 0
                  ? `Options ${delivery.courier_service_add_ons
                      .map((code) => getCourierAddOnLabel(delivery.courier, code))
                      .join(', ')}`
                  : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          <button type="button" className="btn btn-small" onClick={saveDelivery} disabled={saving}>
            Save courier & tracking
          </button>
        </div>

        <div className="card admin-card">
          <h2>Order linkage</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Link follow-up orders (extras, replacements, etc.) to a parent order for traceability.
          </p>
          <label>Parent order (same customer)</label>
          <select
            value={delivery.parent_order_id}
            onChange={(e) => setDelivery((d) => ({ ...d, parent_order_id: e.target.value }))}
          >
            <option value="">— None —</option>
            {parentOrderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {formatOrderOptionLabel(o)}
              </option>
            ))}
          </select>
          <label>Parent order ID (manual override)</label>
          <input
            type="text"
            value={delivery.parent_order_id}
            onChange={(e) => setDelivery((d) => ({ ...d, parent_order_id: e.target.value }))}
            placeholder="UUID of parent order"
            spellCheck={false}
          />
          <label>Link reason</label>
          <select
            value={delivery.link_reason}
            onChange={(e) => setDelivery((d) => ({ ...d, link_reason: e.target.value }))}
          >
            <option value="">— None —</option>
            {ORDER_LINK_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {linkedOrderMenuOptions.length > 0 && (
            <>
              <label>Open linked order</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return
                  navigate(`/admin/orders/${e.target.value}`)
                }}
              >
                <option value="">— Select linked order —</option>
                {linkedOrderMenuOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {formatOrderOptionLabel(o)}
                  </option>
                ))}
              </select>
            </>
          )}
          <button type="button" className="btn btn-small" onClick={saveDelivery} disabled={saving}>
            Save order linkage
          </button>
        </div>

        {showAdvancedPanels && (
          <>
        <div className="card admin-card" id="advanced-customer-details">
          <h2>Customer details</h2>
          <p className="admin-muted" style={{ marginTop: 0 }}>
            Double-click any value to edit inline. Changes update the main customer profile.
          </p>
          <div className="admin-customer-detail-grid">
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Company</strong></p>
              {editingCustomerField?.key === 'company_name' ? (
                <input
                  autoFocus
                  value={editingCustomerField.value}
                  onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                  onBlur={() => saveInlineCustomerField('company_name', editingCustomerField.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineCustomerField('company_name', editingCustomerField.value)
                    if (e.key === 'Escape') setEditingCustomerField(null)
                  }}
                />
              ) : (
                <p className="admin-muted" style={{ marginTop: 0 }} onDoubleClick={() => setEditingCustomerField({ key: 'company_name', value: customerProfile?.company_name ?? '', saving: false })}>
                  {customerProfile?.company_name || '—'}
                </p>
              )}
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Contact name</strong></p>
              {editingCustomerField?.key === 'contact_name' ? (
                <input
                  autoFocus
                  value={editingCustomerField.value}
                  onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                  onBlur={() => saveInlineCustomerField('contact_name', editingCustomerField.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineCustomerField('contact_name', editingCustomerField.value)
                    if (e.key === 'Escape') setEditingCustomerField(null)
                  }}
                />
              ) : (
                <p className="admin-muted" style={{ marginTop: 0 }} onDoubleClick={() => setEditingCustomerField({ key: 'contact_name', value: customerProfile?.contact_name ?? '', saving: false })}>
                  {customerProfile?.contact_name || '—'}
                </p>
              )}
            </div>
          </div>
          <div className="admin-customer-detail-grid">
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Billing address</strong></p>
              {editingCustomerField?.key === 'billing_address' ? (
                <textarea
                  autoFocus
                  value={editingCustomerField.value}
                  rows={2}
                  onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                  onBlur={() => saveInlineCustomerField('billing_address', editingCustomerField.value)}
                />
              ) : (
                <p className="admin-muted" style={{ marginTop: 0 }} onDoubleClick={() => setEditingCustomerField({ key: 'billing_address', value: customerProfile?.billing_address ?? '', saving: false })}>
                  {[customerProfile?.billing_address, customerProfile?.billing_city, customerProfile?.billing_postcode].filter(Boolean).join(', ') || '—'}
                </p>
              )}
              <div className="admin-inline-form" style={{ marginTop: '0.35rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ minWidth: 180, flex: 1 }}>
                  <span className="admin-muted">City</span>
                  {editingCustomerField?.key === 'billing_city' ? (
                    <input
                      autoFocus
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('billing_city', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('billing_city', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                    />
                  ) : (
                    <p className="admin-muted" style={{ margin: '0.2rem 0 0' }} onDoubleClick={() => setEditingCustomerField({ key: 'billing_city', value: customerProfile?.billing_city ?? '', saving: false })}>
                      {customerProfile?.billing_city || '—'}
                    </p>
                  )}
                </label>
                <label style={{ minWidth: 160 }}>
                  <span className="admin-muted">Postcode</span>
                  {editingCustomerField?.key === 'billing_postcode' ? (
                    <input
                      autoFocus
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('billing_postcode', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('billing_postcode', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                    />
                  ) : (
                    <p className="admin-muted" style={{ margin: '0.2rem 0 0' }} onDoubleClick={() => setEditingCustomerField({ key: 'billing_postcode', value: customerProfile?.billing_postcode ?? '', saving: false })}>
                      {customerProfile?.billing_postcode || '—'}
                    </p>
                  )}
                </label>
              </div>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Default delivery address</strong></p>
              {editingCustomerField?.key === 'delivery_address' ? (
                <textarea
                  autoFocus
                  value={editingCustomerField.value}
                  rows={2}
                  onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                  onBlur={() => saveInlineCustomerField('delivery_address', editingCustomerField.value)}
                />
              ) : (
                <p className="admin-muted" style={{ marginTop: 0 }} onDoubleClick={() => setEditingCustomerField({ key: 'delivery_address', value: customerProfile?.delivery_address ?? '', saving: false })}>
                  {[customerProfile?.delivery_address, customerProfile?.delivery_city, customerProfile?.delivery_postcode].filter(Boolean).join(', ') || '—'}
                </p>
              )}
              <div className="admin-inline-form" style={{ marginTop: '0.35rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ minWidth: 180, flex: 1 }}>
                  <span className="admin-muted">City</span>
                  {editingCustomerField?.key === 'delivery_city' ? (
                    <input
                      autoFocus
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('delivery_city', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('delivery_city', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                    />
                  ) : (
                    <p className="admin-muted" style={{ margin: '0.2rem 0 0' }} onDoubleClick={() => setEditingCustomerField({ key: 'delivery_city', value: customerProfile?.delivery_city ?? '', saving: false })}>
                      {customerProfile?.delivery_city || '—'}
                    </p>
                  )}
                </label>
                <label style={{ minWidth: 160 }}>
                  <span className="admin-muted">Postcode</span>
                  {editingCustomerField?.key === 'delivery_postcode' ? (
                    <input
                      autoFocus
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('delivery_postcode', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('delivery_postcode', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                    />
                  ) : (
                    <p className="admin-muted" style={{ margin: '0.2rem 0 0' }} onDoubleClick={() => setEditingCustomerField({ key: 'delivery_postcode', value: customerProfile?.delivery_postcode ?? '', saving: false })}>
                      {customerProfile?.delivery_postcode || '—'}
                    </p>
                  )}
                </label>
              </div>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Contact</strong></p>
              <div className="admin-customer-contact-lines">
                <div
                  className="admin-customer-contact-line"
                  onDoubleClick={() => setEditingCustomerField({ key: 'phone', value: customerProfile?.phone ?? '', saving: false })}
                >
                  <span className="admin-customer-contact-label admin-muted">Phone</span>
                  {editingCustomerField?.key === 'phone' ? (
                    <input
                      autoFocus
                      type="tel"
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('phone', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('phone', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                      className="admin-customer-contact-value"
                      style={{ width: '100%' }}
                      placeholder="—"
                    />
                  ) : (
                    <span className="admin-customer-contact-value">{customerProfile?.phone ?? '—'}</span>
                  )}
                </div>

                <div
                  className="admin-customer-contact-line admin-customer-contact-line--full"
                  onDoubleClick={() => setEditingCustomerField({ key: 'email_override', value: customerProfile?.email_override ?? '', saving: false })}
                >
                  <span className="admin-customer-contact-label admin-muted">Email</span>
                  {editingCustomerField?.key === 'email_override' ? (
                    <input
                      autoFocus
                      type="email"
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('email_override', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('email_override', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                      className="admin-customer-contact-value"
                      style={{ width: '100%' }}
                      placeholder="—"
                    />
                  ) : (
                    <span className="admin-customer-contact-value" style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span>{customerProfile?.email_override ?? '—'}</span>
                      {customerProfile?.email_override ? (
                        <a
                          href={`mailto:${customerProfile.email_override}`}
                          className="admin-muted"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.preventDefault()}
                          title="Open your email client"
                        >
                          Email
                        </a>
                      ) : null}
                    </span>
                  )}
                </div>

                <div
                  className="admin-customer-contact-line admin-customer-contact-line--full"
                  onDoubleClick={() => setEditingCustomerField({ key: 'website', value: customerProfile?.website ?? '', saving: false })}
                >
                  <span className="admin-customer-contact-label admin-muted">Website</span>
                  {editingCustomerField?.key === 'website' ? (
                    <input
                      autoFocus
                      type="url"
                      value={editingCustomerField.value}
                      onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                      onBlur={() => saveInlineCustomerField('website', editingCustomerField.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveInlineCustomerField('website', editingCustomerField.value)
                        if (e.key === 'Escape') setEditingCustomerField(null)
                      }}
                      className="admin-customer-contact-value"
                      style={{ width: '100%' }}
                      placeholder="https://"
                    />
                  ) : customerProfile?.website ? (
                    <span className="admin-customer-contact-value" style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span>{customerProfile.website}</span>
                      <a
                        href={customerProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-muted"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.preventDefault()}
                        title="Open website in a new tab"
                      >
                        Open
                      </a>
                    </span>
                  ) : (
                    <span className="admin-customer-contact-value">—</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <p className="admin-muted" style={{ marginTop: 0 }}><strong>Credit limit</strong></p>
              {editingCustomerField?.key === 'credit_limit' ? (
                <input
                  autoFocus
                  type="number"
                  min={0}
                  step="0.01"
                  value={editingCustomerField.value}
                  onChange={(e) => setEditingCustomerField((f) => (f ? { ...f, value: e.target.value } : f))}
                  onBlur={() => saveInlineCustomerField('credit_limit', editingCustomerField.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineCustomerField('credit_limit', editingCustomerField.value)
                    if (e.key === 'Escape') setEditingCustomerField(null)
                  }}
                  placeholder="e.g. 5000"
                  title="Maximum outstanding balance allowed for this customer."
                />
              ) : (
                <p
                  className="admin-muted"
                  style={{ marginTop: 0 }}
                  onDoubleClick={() => setEditingCustomerField({ key: 'credit_limit', value: customerProfile?.credit_limit != null ? String(customerProfile.credit_limit) : '', saving: false })}
                  title="Double-click to edit credit limit"
                >
                  {customerProfile?.credit_limit != null ? `£${Number(customerProfile.credit_limit).toFixed(2)}` : '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card admin-card" id="advanced-order-history">
          <h2>Order history</h2>
          <div className="admin-inline-form--stack" style={{ marginBottom: '0.5rem' }}>
            <div className="admin-order-history-tabs" role="tablist" aria-label="Order history tabs">
              <button
                type="button"
                className={`admin-tab ${historyTab === 'status' ? 'active' : ''}`}
                onClick={() => setHistoryTab('status')}
                aria-selected={historyTab === 'status'}
                role="tab"
                title="Shows the order status changes over time"
              >
                Status history
              </button>
              <button
                type="button"
                className={`admin-tab ${historyTab === 'audit' ? 'active' : ''}`}
                onClick={() => setHistoryTab('audit')}
                aria-selected={historyTab === 'audit'}
                role="tab"
                title="Shows internal staff activity (views, edits, shipping actions, notes)"
              >
                Audit log
              </button>
            </div>
            <span className="admin-muted">
              {historyTab === 'status'
                ? `${orderEvents.filter((e) => e.event_type === 'status_change').length} status change(s)`
                : `${orderEvents.filter((e) => e.event_type !== 'status_change').length} audit event(s)`}
            </span>
          </div>
          {orderEvents.length === 0 ? (
            <p className="admin-muted">No events yet.</p>
          ) : (
            <ul className="admin-order-events">
              {(historyTab === 'status'
                ? orderEvents.filter((e) => e.event_type === 'status_change')
                : orderEvents.filter((e) => e.event_type !== 'status_change')
              ).map((ev) => (
                <li key={ev.id} className="admin-order-event">
                  <span className="admin-order-event-time">{new Date(ev.created_at).toLocaleString()}</span>
                  <span className={`admin-event-badge admin-event-badge--${ev.event_type}`}>{ev.event_type.replace(/_/g, ' ')}</span>
                  {ev.event_type === 'status_change' && ev.from_status != null && ev.to_status != null ? (
                    <span>Status: {STATUS_LABELS[ev.from_status] ?? ev.from_status} → {STATUS_LABELS[ev.to_status] ?? ev.to_status}</span>
                  ) : (
                    <span>
                      {ev.event_type}
                      {ev.actor_user_id ? <span className="admin-muted"> (by {ev.actor_user_id.slice(0, 8)}…)</span> : <span className="admin-muted"> (system)</span>}
                      {ev.note ? `: ${ev.note}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card admin-card" id="advanced-deliveries">
          <h2>Deliveries</h2>
          {shipments.length === 0 ? (
            <p className="admin-muted">No deliveries yet.</p>
          ) : (
            <ul className="admin-order-events">
              {shipments.map((s) => (
                <li key={s.id} className="admin-order-event">
                  <span className="admin-order-event-time">{new Date(s.shipped_at).toLocaleString()}</span>
                  <span>
                    {s.courier ? `${s.courier} ` : ''}
                    {s.tracking ? (
                      <a href={trackingUrl(s.courier ?? '', s.tracking)} target="_blank" rel="noopener noreferrer">
                        {s.tracking}
                      </a>
                    ) : (
                      '—'
                    )}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
            <select value={shipForm.location_id} onChange={(e) => setShipForm((f) => ({ ...f, location_id: e.target.value }))}>
              {selectableLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ? `${l.code} — ` : ''}{l.name}
                </option>
              ))}
            </select>
            <select value={shipForm.courier} onChange={(e) => setShipForm((f) => ({ ...f, courier: e.target.value }))}>
              <option value="">— Courier —</option>
              {COURIER_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={shipForm.tracking}
              onChange={(e) => setShipForm((f) => ({ ...f, tracking: e.target.value }))}
              placeholder="Tracking # / link"
            />
            <input
              value={shipForm.note}
              onChange={(e) => setShipForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Delivery note"
            />
            <button
              type="button"
              className="btn btn-small"
              onClick={createShipmentAndAllocateStock}
              disabled={shipping || !shipForm.location_id}
              title="Creates a delivery record and decrements stock for the order lines"
            >
              {shipping ? 'Creating…' : 'Create delivery + allocate stock'}
            </button>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={sendCustomerTrackingEmail}
              disabled={!canSendTrackingUpdate}
              title="Send customer delivery/tracking update"
            >
              {trackingEmailSending ? 'Sending update…' : 'Message customer with delivery/tracking'}
            </button>
          </div>
          <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
            This will decrement stock at the selected location for each order line.
          </p>
        </div>
          </>
        )}
      </div>

      <div className="card admin-card admin-order-lines-card">
        <h2>Order lines</h2>
        <p className="admin-order-totals">
          <strong>Total ex VAT</strong> £{Number(order!.total_ex_vat).toFixed(2)} · <strong>Total inc VAT</strong> £{Number(order!.total_inc_vat).toFixed(2)}
        </p>
        <ul className="admin-order-lines">
          {lines.map((l) => (
            <li key={l.id} className="admin-order-line">
              {canEdit && (
                <label className="admin-order-line-combination">
                  <span className="admin-muted">Combination</span>
                  <input
                    type="text"
                    className="admin-inline-edit-input"
                    defaultValue={l.combination_label ?? ''}
                    placeholder="e.g. Kitchen main"
                    disabled={saving}
                    onBlur={(e) => void updateLineCombination(l.id, e.target.value)}
                  />
                </label>
              )}
              {!canEdit && l.combination_label && (
                <span className="admin-badge admin-order-line-combination-badge">{l.combination_label}</span>
              )}
              {l.composed_code && (
                <span className="admin-badge admin-order-line-code-badge" title="Configuration code">
                  {l.composed_code}
                </span>
              )}
              <span className="line-name">{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</span>
              <span className="line-price">
                {editingPriceLineId === l.id ? (
                  <span className="admin-edit-price-wrap">
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      value={editingPriceValue}
                      onChange={(e) => setEditingPriceValue(e.target.value)}
                      className="admin-edit-price-input"
                    />
                    <button type="button" className="btn btn-small" onClick={() => updateLinePrice(l.id, Number(editingPriceValue))} disabled={saving}>Save</button>
                    <button type="button" className="btn btn-small btn-outline" onClick={() => { setEditingPriceLineId(null); setEditingPriceValue(''); }}>Cancel</button>
                  </span>
                ) : (
                  <>
                    £{Number(l.unit_price).toFixed(2)} × {l.quantity} = £{(l.quantity * Number(l.unit_price)).toFixed(2)}
                    {canEdit && (
                      <button type="button" className="btn btn-small btn-ghost admin-edit-price-btn" onClick={() => { setEditingPriceLineId(l.id); setEditingPriceValue(String(l.unit_price)); }}>Edit price</button>
                    )}
                  </>
                )}
              </span>
              <span className="line-actions">
                {canEdit && (
                  <>
                    <button type="button" className="btn btn-icon" onClick={() => updateLineQty(l.id, -1)} aria-label="Decrease">−</button>
                    <span className="line-qty-value">{l.quantity}</span>
                    <button type="button" className="btn btn-icon" onClick={() => updateLineQty(l.id, 1)} aria-label="Increase">+</button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger-outline"
                      onClick={() => deleteLine(l.id)}
                      disabled={!!deletingLineId}
                      aria-label="Remove line"
                    >
                      Remove
                    </button>
                  </>
                )}
                {!canEdit && <span className="line-qty-value">{l.quantity}</span>}
              </span>
            </li>
          ))}
        </ul>

        {canEdit && (
          <div className="admin-add-line">
            <div className="admin-order-line-pricing-controls" style={{ marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--admin-border, #e5e7eb)' }}>
              <label style={{ display: 'block', maxWidth: 440, marginBottom: '0.5rem' }}>
                <span className="admin-muted" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                  When adding catalogue lines
                </span>
                <select
                  value={lineAddPricingChoice}
                  onChange={(e) =>
                    setLineAddPricingChoice(e.target.value as 'use_default' | AdminOrderLinePricingMode)
                  }
                  className="admin-select"
                  style={{ width: '100%', maxWidth: 440 }}
                  disabled={saving || repricingBusy}
                  title="Choose how unit prices are set when you add a product line. Manual edits to a line still work."
                >
                  <option value="use_default">
                    Use my default ({adminOrderLinePricingDefault === 'catalogue' ? 'list price' : 'customer pricing'})
                  </option>
                  <option value="catalogue">Catalogue list price</option>
                  <option value="customer_rules">Customer pricing (rules + account discount)</option>
                </select>
              </label>
              <p className="admin-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                Set your usual default under <Link to="/admin/settings">Settings → Advanced</Link>.
                If you pick customer pricing but this order has no customer account, lines stay at list price.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-small"
                disabled={
                  !order?.user_id ||
                  repricingBusy ||
                  saving ||
                  !canEditLines(order.status) ||
                  order.is_archived === true
                }
                title="Recalculate every catalogue line from rules + account discount for this order’s customer"
                onClick={() => applyCustomerPricingToLines()}
              >
                {repricingBusy ? 'Applying…' : 'Apply customer pricing to all lines'}
              </button>
            </div>
            <h3>Add lines</h3>
            <p className="admin-muted" style={{ marginTop: 0, maxWidth: '42rem' }}>
              Use the standard product search workbench — filters, details, customer pricing and a staging basket — for Lamtek and Tealbury catalogues.
            </p>
            <button
              type="button"
              className="btn"
              disabled={saving || !order || !canEditLines(order.status) || order.is_archived === true}
              onClick={() => setCatalogPickerOpen(true)}
            >
              Open product search
            </button>
          </div>
        )}

        {!canEdit && currentStatus !== 'cancelled' && !isArchived && (
          <p className="admin-muted">Lines are locked for paid orders. Reopen to an earlier status to edit.</p>
        )}
        {isArchived && (
          <p className="admin-muted">Order lines are locked while archived.</p>
        )}
      </div>

      <CatalogProductPickerModal
        open={catalogPickerOpen}
        title="Add products to order"
        products={catalogProducts}
        categories={catalogCategories}
        assemblies={catalogAssemblies}
        customerUserId={order?.user_id ?? null}
        preferencesScope={orderId ? `admin_order_${orderId}` : 'admin_order'}
        commitLabel="Add to order"
        cartLineCount={lines.length}
        linePersistence="immediate"
        onClose={() => setCatalogPickerOpen(false)}
        onCommit={commitCatalogFromPicker}
      />
      {catalogPickerOpen && catalogPickerLoading && catalogProducts.length === 0 && (
        <p className="admin-muted" style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10001 }}>
          Loading catalogues…
        </p>
      )}
    </div>
  )
}
