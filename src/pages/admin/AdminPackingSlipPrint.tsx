import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderRow, LocationRow } from '@/types/database'

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
}

export default function AdminPackingSlipPrint() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [companyName, setCompanyName] = useState('')
  const [collectionLocation, setCollectionLocation] = useState<LocationRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return
    ;(async () => {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (!orderData) {
        setLoading(false)
        return
      }
      const ord = orderData as OrderRow
      setOrder(ord)
      const [{ data: linesData }, { data: profile }] = await Promise.all([
        supabase.from('order_lines').select('id, product_snapshot, quantity').eq('order_id', orderId),
        supabase.from('customer_profiles').select('company_name').eq('user_id', ord.user_id).maybeSingle(),
      ])
      setLines((linesData as LineRow[]) ?? [])
      setCompanyName(profile?.company_name ?? '')
      if (ord.collection_location_id) {
        const { data: loc } = await supabase.from('locations').select('*').eq('id', ord.collection_location_id).maybeSingle()
        setCollectionLocation((loc ?? null) as LocationRow | null)
      } else {
        setCollectionLocation(null)
      }
      setLoading(false)
    })()
  }, [orderId])

  function handlePrint() {
    window.print()
  }

  if (loading) return <div className="admin-page"><p>Loading…</p></div>
  if (!order) return <div className="admin-page"><p>Order not found.</p><Link to="/admin/orders">Back to orders</Link></div>

  return (
    <div className="admin-page invoice-print-page">
      <div className="no-print">
        <div className="admin-page-header">
          <span className="admin-breadcrumb"><Link to="/admin/orders">Orders</Link> / <Link to={`/admin/orders/${orderId}`}>Order</Link> / Packing slip</span>
          <div className="admin-page-header-actions">
            <button type="button" className="btn btn-small" onClick={handlePrint}>Print packing slip</button>
            <Link to={`/admin/orders/${orderId}`} className="btn btn-outline btn-small">Back to order</Link>
          </div>
        </div>
      </div>

      <div className="invoice-print-view">
        <header className="invoice-print-header">
          <h1>Packing slip</h1>
          <p className="invoice-print-date">Date: {new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>Order</strong> {order.reference || order.id.slice(0, 8)}</p>
        </header>

        <div className="invoice-print-meta">
          <div className="invoice-print-block">
            <strong>Customer</strong>
            <p>{companyName || order.user_id}</p>
            {order.fulfillment_method === 'collect' ? (
              <>
                <strong>Collection</strong>
                <p>
                  {collectionLocation
                    ? [collectionLocation.code, collectionLocation.name].filter(Boolean).join(' — ')
                    : 'Click & collect'}
                </p>
              </>
            ) : (
              <>
                <strong>Delivery address</strong>
                <p>{[order.delivery_address, order.delivery_postcode].filter(Boolean).join(', ') || '—'}</p>
              </>
            )}
          </div>
          <div className="invoice-print-block">
            {order.delivery_contact_name && <p><strong>Contact</strong> {order.delivery_contact_name}</p>}
            {order.delivery_contact_phone && <p><strong>Phone</strong> {order.delivery_contact_phone}</p>}
            {order.delivery_notes && <p><strong>Notes</strong> {order.delivery_notes}</p>}
          </div>
        </div>

        <table className="invoice-print-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>SKU</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{(l.product_snapshot as { name?: string })?.name ?? 'Product'}</td>
                <td>{(l.product_snapshot as { sku?: string })?.sku ?? '—'}</td>
                <td>{l.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
