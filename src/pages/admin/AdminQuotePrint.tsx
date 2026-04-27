import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import InvoicePrintView, { type InvoicePrintVariant } from '@/components/InvoicePrintView'
import type { OrderRow } from '@/types/database'

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
  cost_price?: number | null
}

const QUOTE_STATUSES: OrderRow['status'][] = ['draft', 'quotation', 'placed']

export default function AdminQuotePrint() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [companyName, setCompanyName] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const mode = searchParams.get('mode')
  const variant: InvoicePrintVariant = useMemo(
    () => (mode === 'no-pricing' ? 'quote_no_pricing' : 'quote'),
    [mode],
  )
  const internalMode = mode === 'internal'

  useEffect(() => {
    if (!orderId) return
    ;(async () => {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (!orderData) {
        setLoading(false)
        return
      }
      setOrder(orderData as OrderRow)
      const { data: linesData } = await supabase
        .from('order_lines')
        .select('id, product_snapshot, quantity, unit_price, product:products(cost_price)')
        .eq('order_id', orderId)
      const mapped = ((linesData ?? []) as Array<LineRow & { product?: { cost_price?: number | null } | { cost_price?: number | null }[] | null }>)
        .map((l) => ({
          ...l,
          cost_price: Array.isArray(l.product) ? (l.product[0]?.cost_price ?? null) : (l.product?.cost_price ?? null),
        }))
      setLines(mapped)
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('company_name, payment_terms')
        .eq('user_id', (orderData as OrderRow).user_id)
        .maybeSingle()
      setCompanyName(profile?.company_name ?? '')
      setPaymentTerms(profile?.payment_terms ?? null)
      setLoading(false)
    })()
  }, [orderId])

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p>Loading…</p>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="admin-page">
        <p>Order not found.</p>
        <Link to="/admin/orders">Back to orders</Link>
      </div>
    )
  }
  if (!QUOTE_STATUSES.includes(order.status)) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <span className="admin-breadcrumb">
            <Link to="/admin/orders">Orders</Link> / <Link to={`/admin/orders/${orderId}`}>Order</Link> / Quote
          </span>
        </div>
        <p>Quotations can only be printed for draft, quotation, or placed orders.</p>
        <Link to={`/admin/orders/${orderId}`}>Back to order</Link>
      </div>
    )
  }

  const label = internalMode ? 'Internal quote' : (variant === 'quote_no_pricing' ? 'Quotation (no pricing)' : 'Quotation')
  const internalTotals = lines.reduce((acc, l) => {
    const qty = Number(l.quantity || 0)
    const sell = qty * Number(l.unit_price || 0)
    const cost = qty * Number(l.cost_price || 0)
    return {
      sell: acc.sell + sell,
      cost: acc.cost + cost,
      margin: acc.margin + (sell - cost),
    }
  }, { sell: 0, cost: 0, margin: 0 })

  return (
    <div className="admin-page invoice-print-page">
      <div className="no-print">
        <div className="admin-page-header">
          <span className="admin-breadcrumb">
            <Link to="/admin/orders">Orders</Link> / <Link to={`/admin/orders/${orderId}`}>Order</Link> / {label}
          </span>
          <div className="admin-page-header-actions">
            <button type="button" className="btn btn-small" onClick={handlePrint}>
              Print {label.toLowerCase()}
            </button>
            <Link to={`/admin/orders/${orderId}/quote?mode=no-pricing`} className="btn btn-outline btn-small">
              No-pricing
            </Link>
            <Link to={`/admin/orders/${orderId}/quote`} className="btn btn-outline btn-small">
              With pricing
            </Link>
            <Link to={`/admin/orders/${orderId}/quote?mode=internal`} className="btn btn-outline btn-small">
              Internal (cost/margin)
            </Link>
            <Link to={`/admin/orders/${orderId}`} className="btn btn-outline btn-small">
              Back to order
            </Link>
          </div>
        </div>
      </div>
      {internalMode ? (
        <div className="invoice-print-view">
          <header className="invoice-print-header">
            <h1>Internal quote (cost + margin)</h1>
            <p className="invoice-print-date">Date: {new Date(order.created_at).toLocaleDateString()}</p>
            <p><strong>Customer</strong> {companyName || order.user_id}</p>
          </header>
          <table className="invoice-print-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Sell unit</th>
                <th>Cost unit</th>
                <th>Line margin</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const qty = Number(l.quantity || 0)
                const sellUnit = Number(l.unit_price || 0)
                const costUnit = Number(l.cost_price || 0)
                const margin = qty * (sellUnit - costUnit)
                return (
                  <tr key={l.id}>
                    <td>{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</td>
                    <td>{qty}</td>
                    <td>£{sellUnit.toFixed(2)}</td>
                    <td>£{costUnit.toFixed(2)}</td>
                    <td>£{margin.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="invoice-print-totals">
            <p><strong>Total sell</strong> £{internalTotals.sell.toFixed(2)}</p>
            <p><strong>Total cost</strong> £{internalTotals.cost.toFixed(2)}</p>
            <p><strong>Total margin</strong> £{internalTotals.margin.toFixed(2)}</p>
          </div>
        </div>
      ) : (
        <InvoicePrintView
          order={order}
          lines={lines}
          companyName={companyName}
          paymentTerms={paymentTerms}
          variant={variant}
        />
      )}
    </div>
  )
}
