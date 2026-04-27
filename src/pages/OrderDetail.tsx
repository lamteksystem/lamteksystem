import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { redirectToCheckout, verifyCheckoutSession } from '@/lib/payment'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow, LocationRow } from '@/types/database'
import { trackingUrl } from '@/lib/tracking'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { recalcOrderTotals } from '@/lib/orders'
import { formatDeliveryWindowLabel } from '@/lib/deliveryWindows'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

interface LineRow {
  id: string
  product_id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const effectiveUserId = useEffectiveUserId()
  const { ensureDraftOrder } = useDraftOrder()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [collectLocation, setCollectLocation] = useState<LocationRow | null>(null)
  const [deliveryWindowLabel, setDeliveryWindowLabel] = useState<string | null>(null)
  const [paymentMessage, setPaymentMessage] = useState<'success' | 'cancelled' | 'error' | null>(null)
  const [, setVerifying] = useState(false)
  const verifiedSessionRef = useRef<string | null>(null)
  const location = useLocation()
  const justPlaced = (location.state as { justPlaced?: boolean })?.justPlaced

  async function loadOrder() {
    if (!orderId || !effectiveUserId) return
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', effectiveUserId)
      .single()
    if (!orderData) {
      setOrder(null)
      setLoading(false)
      return
    }
    setOrder(orderData as OrderRow)
    const { data: linesData } = await supabase
      .from('order_lines')
      .select('id, product_id, product_snapshot, quantity, unit_price')
      .eq('order_id', orderId)
    setLines((linesData as LineRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadOrder()
  }, [orderId, effectiveUserId])

  useEffect(() => {
    if (!order?.collection_location_id) {
      setCollectLocation(null)
      return
    }
    let cancelled = false
    supabase
      .from('locations')
      .select('*')
      .eq('id', order.collection_location_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCollectLocation((data as LocationRow) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [order?.collection_location_id])

  useEffect(() => {
    if (!order?.delivery_window_id) {
      setDeliveryWindowLabel(null)
      return
    }
    let cancelled = false
    supabase
      .from('delivery_windows')
      .select('name, start_time, end_time')
      .eq('id', order.delivery_window_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) setDeliveryWindowLabel(formatDeliveryWindowLabel(data as { name: string; start_time: string; end_time: string }))
        else setDeliveryWindowLabel(null)
      })
    return () => {
      cancelled = true
    }
  }, [order?.delivery_window_id])

  // After redirect from Stripe: verify session and show message (once per session_id)
  useEffect(() => {
    const payment = searchParams.get('payment')
    const sessionId = searchParams.get('session_id')
    if (payment === 'cancelled') {
      setPaymentMessage('cancelled')
      setSearchParams({}, { replace: true })
      return
    }
    if (payment === 'success' && sessionId && orderId && verifiedSessionRef.current !== sessionId) {
      verifiedSessionRef.current = sessionId
      setVerifying(true)
      verifyCheckoutSession(sessionId)
        .then(({ success }) => {
          if (success) {
            setPaymentMessage('success')
            loadOrder()
          } else {
            setPaymentMessage('error')
          }
        })
        .finally(() => {
          setVerifying(false)
          setSearchParams({}, { replace: true })
        })
    }
  }, [orderId, searchParams])

  async function handlePay() {
    if (!order || paying) return
    setPaying(true)
    setPaymentMessage(null)
    const { error } = await redirectToCheckout(order.id, Number(order.total_inc_vat))
    if (error) {
      setPaymentMessage('error')
    }
    setPaying(false)
  }

  async function handleReorder() {
    if (reordering || lines.length === 0) return
    setReordering(true)
    try {
      const draftId = await ensureDraftOrder()
      await supabase.from('order_lines').delete().eq('order_id', draftId)
      await supabase.from('order_lines').insert(
        lines.map((l) => ({
          order_id: draftId,
          product_id: l.product_id,
          product_snapshot: l.product_snapshot,
          quantity: l.quantity,
          unit_price: l.unit_price,
          options: {},
        }))
      )
      await recalcOrderTotals(draftId)
      navigate('/ordering/cart')
    } catch (_) {
      // swallow; user can retry
    }
    setReordering(false)
  }

  const canPay =
    order &&
    (order.status === 'placed' || order.status === 'invoiced') &&
    order.payment_status !== 'succeeded' &&
    Number(order.total_inc_vat) >= 0.5

  if (loading) {
    return (
      <div className="account-page">
        <p>Loading order…</p>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="account-page">
        <PageNav backTo="/account" backLabel="My account" />
        <div className="card">
          <p>Order not found.</p>
        </div>
      </div>
    )
  }

  const orderLabel = order.reference || `Order ${order.id.slice(0, 8)}`

  return (
    <div className="account-page order-detail-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { label: orderLabel }]} />

      {paymentMessage === 'success' && (
        <div className="order-payment-banner order-payment-banner--success">
          Payment successful. This order is now marked as paid.
        </div>
      )}
      {paymentMessage === 'cancelled' && (
        <div className="order-payment-banner order-payment-banner--info">
          Payment was cancelled. You can try again below when ready.
        </div>
      )}
      {paymentMessage === 'error' && (
        <div className="order-payment-banner order-payment-banner--error">
          Something went wrong. Please try again or contact us.
        </div>
      )}

      {justPlaced && !paymentMessage && (
        <div className="order-payment-banner order-payment-banner--info">
          Order placed. You can pay now below.
        </div>
      )}

      <div className="card order-detail-card">
        <h1>Order {order.reference || order.id.slice(0, 8)}</h1>
        <p className="order-detail-meta">
          <span className={`order-status order-status-${order.status}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          {order.invoice_number && <span>Invoice {order.invoice_number}</span>}
          {order.payment_status === 'succeeded' && (
            <span className="order-payment-badge">Paid</span>
          )}
          <span>Created {new Date(order.created_at).toLocaleDateString()}</span>
        </p>

        <div className="order-detail-totals">
          <p><strong>Total ex VAT</strong> £{Number(order.total_ex_vat).toFixed(2)}</p>
          <p><strong>Total inc VAT</strong> £{Number(order.total_inc_vat).toFixed(2)}</p>
        </div>

        <div className="order-detail-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={handleReorder} disabled={reordering || lines.length === 0}>
            {reordering ? 'Building cart…' : 'Reorder to cart'}
          </button>
          <Link
            to={`/account/support?type=issue&orderId=${orderId}`}
            className="btn btn-outline btn-small"
          >
            Report issue
          </Link>
          <Link
            to={`/account/support?type=returns&orderId=${orderId}`}
            className="btn btn-outline btn-small"
          >
            Request return
          </Link>
        </div>

        {order.invoice_number && ['invoiced', 'paid'].includes(order.status) && (
          <p className="order-detail-invoice-link">
            <Link to={`/account/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
              View / print invoice
            </Link>
          </p>
        )}

        {['draft', 'quotation', 'placed'].includes(order.status) && (
          <p className="order-detail-invoice-link">
            <Link to={`/account/orders/${orderId}/quote`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
              View / print quotation
            </Link>
            <Link
              to={`/account/orders/${orderId}/quote?mode=no-pricing`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-small"
              style={{ marginLeft: '0.5rem' }}
            >
              Quotation (no pricing)
            </Link>
          </p>
        )}

        {(order.parent_order_id || order.link_reason) && (
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {order.parent_order_id && (
              <>
                <strong>Linked to</strong>{' '}
                <Link to={`/account/orders/${order.parent_order_id}`}>parent order</Link>
                {order.link_reason ? ` · ${order.link_reason}` : ''}
              </>
            )}
            {!order.parent_order_id && order.link_reason && (
              <>
                <strong>Link reason:</strong> {order.link_reason}
              </>
            )}
          </p>
        )}

        {canPay && (
          <div className="order-detail-pay">
            <button
              type="button"
              className="btn btn-success"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? 'Redirecting to payment…' : 'Pay now'}
            </button>
            <p className="order-detail-pay-hint">You’ll be redirected to our secure payment page.</p>
          </div>
        )}

        {order.fulfillment_method === 'collect' && (
          <div className="order-detail-delivery">
            <h2>Click &amp; collect</h2>
            {collectLocation ? (
              <p className="order-detail-address">
                <strong>{[collectLocation.code, collectLocation.name].filter(Boolean).join(' — ')}</strong>
                {collectLocation.address ? (
                  <>
                    <br />
                    {collectLocation.address}
                  </>
                ) : null}
                {collectLocation.phone ? (
                  <>
                    <br />
                    <strong>Phone</strong> {collectLocation.phone}
                  </>
                ) : null}
                {collectLocation.opening_hours ? (
                  <>
                    <br />
                    <strong>Opening hours</strong> {collectLocation.opening_hours}
                  </>
                ) : null}
              </p>
            ) : order.collection_location_id ? (
              <p className="muted">Collection depot (loading…)</p>
            ) : (
              <p className="muted">No depot selected on this order.</p>
            )}
            {order.collection_ready_at && (
              <p>
                <strong>Ready from</strong> {new Date(order.collection_ready_at).toLocaleString()}
              </p>
            )}
            {order.collection_must_collect_by && (
              <p>
                <strong>Collect by</strong> {new Date(order.collection_must_collect_by).toLocaleString()}
              </p>
            )}
            {order.collection_notes && (
              <p>
                <strong>Collection notes</strong> {order.collection_notes}
              </p>
            )}
            {(order.delivery_contact_name ||
              order.delivery_contact_phone ||
              order.delivery_contact_email ||
              order.delivery_contact_notes ||
              order.delivery_notes) && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ marginBottom: '0.25rem' }}><strong>Contact &amp; notes</strong></p>
                {order.delivery_contact_name && <p style={{ marginTop: 0 }}><strong>Name</strong> {order.delivery_contact_name}</p>}
                {order.delivery_contact_phone && <p style={{ marginTop: 0 }}><strong>Phone</strong> {order.delivery_contact_phone}</p>}
                {order.delivery_contact_email && <p style={{ marginTop: 0 }}><strong>Email</strong> {order.delivery_contact_email}</p>}
                {order.delivery_contact_notes && <p style={{ marginTop: 0 }}><strong>Contact notes</strong> {order.delivery_contact_notes}</p>}
                {order.delivery_notes && <p style={{ marginTop: 0 }}><strong>Order notes</strong> {order.delivery_notes}</p>}
              </div>
            )}
          </div>
        )}

        {order.fulfillment_method !== 'collect' &&
          (order.delivery_address ||
            order.delivery_postcode ||
            order.delivery_notes ||
            order.delivery_tracking ||
            order.courier ||
            order.delivery_expected_date ||
            order.delivery_scheduled_date ||
            order.delivery_window_id) && (
          <div className="order-detail-delivery">
            <h2>Delivery</h2>
            {(order.delivery_address || order.delivery_postcode) && (
              <p className="order-detail-address">
                {[order.delivery_address, order.delivery_postcode].filter(Boolean).join(', ')}
              </p>
            )}
            {(order.delivery_contact_name || order.delivery_contact_phone || order.delivery_contact_email || order.delivery_contact_notes) && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ marginBottom: '0.25rem' }}><strong>Delivery contact</strong></p>
                {order.delivery_contact_name && <p style={{ marginTop: 0 }}><strong>Name</strong> {order.delivery_contact_name}</p>}
                {order.delivery_contact_phone && <p style={{ marginTop: 0 }}><strong>Phone</strong> {order.delivery_contact_phone}</p>}
                {order.delivery_contact_email && <p style={{ marginTop: 0 }}><strong>Email</strong> {order.delivery_contact_email}</p>}
                {order.delivery_contact_notes && <p style={{ marginTop: 0 }}><strong>Contact notes</strong> {order.delivery_contact_notes}</p>}
              </div>
            )}
            {order.delivery_scheduled_date && (
              <p>
                <strong>Requested delivery date</strong>{' '}
                {String(order.delivery_scheduled_date).slice(0, 10)}
              </p>
            )}
            {deliveryWindowLabel && (
              <p>
                <strong>Delivery window</strong> {deliveryWindowLabel}
              </p>
            )}
            {order.courier && <p><strong>Courier</strong> {order.courier}</p>}
            {order.delivery_expected_date && (
              <p><strong>Expected delivery</strong> {new Date(order.delivery_expected_date).toLocaleDateString()}</p>
            )}
            {order.delivery_notes && <p><strong>Notes</strong> {order.delivery_notes}</p>}
            {order.delivery_tracking && (
              <p><strong>Tracking</strong>{' '}
                <a href={trackingUrl(order.courier, order.delivery_tracking)} target="_blank" rel="noopener noreferrer">
                  {order.delivery_tracking}
                </a>
              </p>
            )}
          </div>
        )}

        <h2>Order lines</h2>
        <ul className="order-detail-lines">
          {lines.map((l) => (
            <li key={l.id} className="order-detail-line">
              <span className="line-name">{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</span>
              <span className="line-qty">{l.quantity} × £{Number(l.unit_price).toFixed(2)}</span>
              <span className="line-total">£{(l.quantity * Number(l.unit_price)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {lines.length === 0 && <p className="muted">No lines on this order.</p>}
      </div>
    </div>
  )
}
