import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import InvoicePrintView from '@/components/InvoicePrintView'
import type { OrderRow } from '@/types/database'

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

export default function AdminInvoicePrint() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [companyName, setCompanyName] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return
    (async () => {
      const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (!orderData) {
        setLoading(false)
        return
      }
      setOrder(orderData as OrderRow)
      const { data: linesData } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
      setLines((linesData as LineRow[]) ?? [])
      const { data: profile } = await supabase.from('customer_profiles').select('company_name, payment_terms').eq('user_id', (orderData as OrderRow).user_id).maybeSingle()
      setCompanyName(profile?.company_name ?? '')
      setPaymentTerms(profile?.payment_terms ?? null)
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
          <span className="admin-breadcrumb"><Link to="/admin/orders">Orders</Link> / <Link to={`/admin/orders/${orderId}`}>Order</Link> / Invoice</span>
          <div className="admin-page-header-actions">
            <button type="button" className="btn btn-small" onClick={handlePrint}>Print invoice</button>
            <Link to={`/admin/orders/${orderId}`} className="btn btn-outline btn-small">Back to order</Link>
          </div>
        </div>
      </div>
      <InvoicePrintView order={order} lines={lines} companyName={companyName} paymentTerms={paymentTerms} />
    </div>
  )
}
