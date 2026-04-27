import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { PageNav } from '@/components/PageNav'
import InvoicePrintView from '@/components/InvoicePrintView'
import type { OrderRow } from '@/types/database'

interface LineRow {
  id: string
  product_snapshot: { name?: string; sku?: string }
  quantity: number
  unit_price: number
}

export default function InvoicePrint() {
  const { orderId } = useParams<{ orderId: string }>()
  const effectiveUserId = useEffectiveUserId()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [companyName, setCompanyName] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId || !effectiveUserId) return
    (async () => {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', effectiveUserId)
        .single()
      if (!orderData) {
        setLoading(false)
        return
      }
      setOrder(orderData as OrderRow)
      const { data: linesData } = await supabase.from('order_lines').select('id, product_snapshot, quantity, unit_price').eq('order_id', orderId)
      setLines((linesData as LineRow[]) ?? [])
      const { data: profile } = await supabase.from('customer_profiles').select('company_name, payment_terms').eq('user_id', effectiveUserId).maybeSingle()
      setCompanyName(profile?.company_name ?? '')
      setPaymentTerms(profile?.payment_terms ?? null)
      setLoading(false)
    })()
  }, [orderId, effectiveUserId])

  function handlePrint() {
    window.print()
  }

  if (loading) return <div className="account-page"><p>Loading…</p></div>
  if (!order) return <div className="account-page"><p>Order not found.</p><Link to="/account">Back to account</Link></div>
  if (!order.invoice_number || !['invoiced', 'paid'].includes(order.status)) {
    return (
      <div className="account-page">
        <PageNav backTo={`/account/orders/${orderId}`} backLabel="Order" />
        <p>This order does not have an invoice yet.</p>
        <Link to="/account">Back to account</Link>
      </div>
    )
  }

  return (
    <div className="account-page invoice-print-page">
      <div className="no-print">
        <PageNav backTo={`/account/orders/${orderId}`} backLabel="Order" />
        <p className="invoice-print-actions">
          <button type="button" className="btn" onClick={handlePrint}>Print invoice</button>
          <Link to={`/account/orders/${orderId}`} className="btn btn-outline">Back to order</Link>
        </p>
      </div>
      <InvoicePrintView order={order} lines={lines} companyName={companyName} paymentTerms={paymentTerms} />
    </div>
  )
}
