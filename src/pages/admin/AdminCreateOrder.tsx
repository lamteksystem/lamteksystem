import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import type { CustomerProfileRow, OrderRow, OrderLinkReason } from '@/types/database'
import { ORDER_LINK_REASONS } from '@/types/database'

const PARENT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLinkReason(raw: string | null): OrderLinkReason | null {
  if (!raw) return null
  return ORDER_LINK_REASONS.includes(raw as OrderLinkReason) ? (raw as OrderLinkReason) : null
}

export default function AdminCreateOrder() {
  const [searchParams] = useSearchParams()
  const preselectedCustomer = searchParams.get('customer') ?? ''
  const parentOrderParam = searchParams.get('parentOrder') ?? ''
  const linkReasonParam = parseLinkReason(searchParams.get('linkReason'))
  const navigate = useNavigate()
  const { staffProfile } = useStaff()
  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [selectedUserId, setSelectedUserId] = useState(preselectedCustomer)
  const [parentOrder, setParentOrder] = useState<OrderRow | null>(null)
  const [parentLoadError, setParentLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const parentOrderId = useMemo(() => {
    const t = parentOrderParam.trim()
    return PARENT_UUID.test(t) ? t : ''
  }, [parentOrderParam])

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase.from('customer_profiles').select('*').order('company_name')
      setCustomers(profiles ?? [])
      if (preselectedCustomer) setSelectedUserId(preselectedCustomer)
    }
    load()
  }, [preselectedCustomer])

  useEffect(() => {
    if (!parentOrderId) {
      setParentOrder(null)
      setParentLoadError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error: qErr } = await supabase.from('orders').select('*').eq('id', parentOrderId).maybeSingle()
      if (cancelled) return
      if (qErr || !data) {
        setParentOrder(null)
        setParentLoadError(qErr?.message ?? 'Parent order not found.')
        return
      }
      setParentLoadError(null)
      setParentOrder(data as OrderRow)
      if (preselectedCustomer && (data as OrderRow).user_id !== preselectedCustomer) {
        setParentLoadError('Parent order belongs to a different customer than the selected account.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [parentOrderId, preselectedCustomer])

  async function createOrder() {
    if (!selectedUserId || !staffProfile) {
      setError('Select a customer and ensure you are logged in as staff.')
      return
    }
    if (parentOrderId && parentLoadError) {
      setError(parentLoadError)
      return
    }
    if (parentOrderId && parentOrder && parentOrder.user_id !== selectedUserId) {
      setError('Selected customer must match the parent order account.')
      return
    }
    setError('')
    setCreating(true)

    const insertPayload: Record<string, unknown> = {
      user_id: selectedUserId,
      status: 'draft',
      total_ex_vat: 0,
      total_inc_vat: 0,
      created_by_staff_id: staffProfile.id,
    }

    if (parentOrderId && parentOrder && parentOrder.user_id === selectedUserId) {
      insertPayload.parent_order_id = parentOrderId
      if (linkReasonParam) insertPayload.link_reason = linkReasonParam
      insertPayload.fulfillment_method = parentOrder.fulfillment_method ?? 'delivery'
      insertPayload.collection_location_id = parentOrder.collection_location_id ?? null
      insertPayload.collection_notes = parentOrder.collection_notes ?? null
      insertPayload.delivery_same_as_billing = parentOrder.delivery_same_as_billing ?? true
      insertPayload.delivery_address = parentOrder.delivery_address ?? null
      insertPayload.delivery_postcode = parentOrder.delivery_postcode ?? null
      insertPayload.delivery_notes = parentOrder.delivery_notes ?? null
      insertPayload.delivery_contact_name = parentOrder.delivery_contact_name ?? null
      insertPayload.delivery_contact_phone = parentOrder.delivery_contact_phone ?? null
      insertPayload.delivery_contact_email = parentOrder.delivery_contact_email ?? null
      insertPayload.delivery_contact_notes = parentOrder.delivery_contact_notes ?? null
      insertPayload.delivery_window_id = null
      insertPayload.delivery_scheduled_date = null
      insertPayload.collection_ready_at = null
      insertPayload.collection_must_collect_by = null
    }

    const { data: order, error: err } = await supabase.from('orders').insert(insertPayload).select('id').single()
    setCreating(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/admin/orders/${order.id}`)
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Create order</span>
      </div>
      <p className="page-intro">
        One step: pick the account that will own the order. You'll go straight to order detail to add lines, pricing, delivery or collection, then save or progress status.
      </p>

      {parentOrderId && parentOrder && !parentLoadError && (
        <div className="card admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--lamtek-gold, #b8860b)' }}>
          <p style={{ margin: 0 }}>
            <strong>Follow-up order</strong> — linked to parent{' '}
            <Link to={`/admin/orders/${parentOrderId}`}>
              {parentOrder.reference?.trim() || parentOrderId.slice(0, 8)}
            </Link>
            {linkReasonParam ? ` · reason: ${linkReasonParam}` : ''}. Delivery details are copied from the parent; clear or adjust on the order page if needed.
          </p>
        </div>
      )}
      {parentOrderId && parentLoadError && (
        <div className="card admin-card" style={{ marginBottom: '1rem' }}>
          <p className="admin-error" style={{ margin: 0 }}>{parentLoadError}</p>
        </div>
      )}

      <div className="card admin-card admin-create-order-card">
        <h2 style={{ marginTop: 0 }}>Who is this order for?</h2>
        <label className="admin-create-order-label">
          <span className="admin-settings-label">Select customer</span>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="admin-select-customer"
          >
            <option value="">— Select customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.user_id}>
                {c.company_name} {c.contact_name ? `(${c.contact_name})` : ''}
              </option>
            ))}
          </select>
        </label>
        {customers.length === 0 && (
          <p className="admin-muted">No customer profiles found. Create profiles in the Customers section or ensure customers have signed up and have a profile.</p>
        )}
        {error && <p className="admin-error">{error}</p>}
        <button
          type="button"
          className="btn"
          onClick={createOrder}
          disabled={!selectedUserId || creating || (!!parentOrderId && !!parentLoadError)}
        >
          {creating ? 'Creating…' : 'Create draft order'}
        </button>
        <p className="admin-muted" style={{ marginTop: '1rem' }}>After creating, you'll be taken to the order to add lines, set delivery details, and process it.</p>
      </div>
    </div>
  )
}

