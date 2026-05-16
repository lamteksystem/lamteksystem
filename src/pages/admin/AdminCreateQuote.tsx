import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { insertStaffOrder } from '@/lib/adminStaffOrderCreate'
import { useStaff } from '@/hooks/useStaff'
import type { CustomerProfileRow, OrderRow, OrderLinkReason } from '@/types/database'
import { ORDER_LINK_REASONS } from '@/types/database'

const PARENT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLinkReason(raw: string | null): OrderLinkReason | null {
  if (!raw) return null
  return ORDER_LINK_REASONS.includes(raw as OrderLinkReason) ? (raw as OrderLinkReason) : null
}

export default function AdminCreateQuote() {
  const [searchParams] = useSearchParams()
  const preselectedCustomer = searchParams.get('customer') ?? ''
  const parentOrderParam = searchParams.get('parentOrder') ?? ''
  const linkReasonParam = parseLinkReason(searchParams.get('linkReason'))
  const navigate = useNavigate()
  const { staffProfile } = useStaff()
  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [selectedUserId, setSelectedUserId] = useState(preselectedCustomer)
  const [quoteReference, setQuoteReference] = useState('')
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

  async function createQuote() {
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

    const { data: order, error: err } = await insertStaffOrder({
      userId: selectedUserId,
      staffProfileId: staffProfile.id,
      status: 'quotation',
      reference: quoteReference.trim() || null,
      parentOrderId: parentOrderId || undefined,
      parentOrder: parentOrderId && parentOrder ? parentOrder : null,
      linkReason: linkReasonParam,
    })

    setCreating(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/admin/orders/${order.id}`)
  }

  return (
    <div className="admin-page admin-create-quote-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Create quote</span>
      </div>
      <p className="page-intro">
        Build a quotation for a customer: add lines and pricing on the next screen, print or send the quote, then convert to a placed order when they confirm.
      </p>

      {parentOrderId && parentOrder && !parentLoadError && (
        <div className="card admin-card admin-create-quote-linked" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Linked quote</strong> — related to{' '}
            <Link to={`/admin/orders/${parentOrderId}`}>
              {parentOrder.reference?.trim() || parentOrderId.slice(0, 8)}
            </Link>
            {linkReasonParam ? ` · ${linkReasonParam}` : ''}. Delivery details are copied from the parent where applicable.
          </p>
        </div>
      )}
      {parentOrderId && parentLoadError && (
        <div className="card admin-card" style={{ marginBottom: '1rem' }}>
          <p className="admin-error" style={{ margin: 0 }}>{parentLoadError}</p>
        </div>
      )}

      <div className="card admin-card admin-create-order-card">
        <h2 style={{ marginTop: 0 }}>Quote for which customer?</h2>
        <label className="admin-create-order-label">
          <span className="admin-settings-label">Customer account</span>
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
        <label className="admin-create-order-label" style={{ marginTop: '1rem' }}>
          <span className="admin-settings-label">Quote reference (optional)</span>
          <input
            type="text"
            className="admin-filter-input"
            value={quoteReference}
            onChange={(e) => setQuoteReference(e.target.value)}
            placeholder="e.g. Kitchen ref ABC-12, March 2026"
            maxLength={120}
          />
          <p className="admin-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            Shown on the quote printout and order list. Leave blank to use the system reference.
          </p>
        </label>
        {customers.length === 0 && (
          <p className="admin-muted">No customer profiles found. Add customers before creating quotes.</p>
        )}
        {error && <p className="admin-error">{error}</p>}
        <div className="admin-create-quote-actions" style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={createQuote}
            disabled={!selectedUserId || creating || (!!parentOrderId && !!parentLoadError)}
          >
            {creating ? 'Creating…' : 'Create quote'}
          </button>
          <Link to="/admin/create-order" className="btn btn-outline">
            Create order instead
          </Link>
        </div>
        <p className="admin-muted" style={{ marginTop: '1rem' }}>
          After creating, add products on the quote detail page. Use <strong>Print quote</strong> for the customer.
          When they accept, use <strong>Convert to order</strong> to move the quote to a placed order.
        </p>
      </div>
    </div>
  )
}
