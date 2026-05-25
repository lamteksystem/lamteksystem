import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import type { CustomerProfileRow, OrderRow } from '@/types/database'

const BOARD_COLUMNS: { status: OrderRow['status']; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'quotation', label: 'Quotation' },
  { status: 'placed', label: 'Placed' },
  { status: 'invoiced', label: 'Invoiced' },
  { status: 'paid', label: 'Paid' },
]

type OrderCard = OrderRow & { company_name?: string }

export default function AdminCrmSalesBoard() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [orders, setOrders] = useState<OrderCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    void (async () => {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, reference, status, total_inc_vat, created_at, updated_at, user_id')
        .eq('is_archived', false)
        .in('status', BOARD_COLUMNS.map((c) => c.status))
        .order('updated_at', { ascending: false })
        .limit(500)
      const rows = (orderData ?? []) as OrderCard[]
      const userIds = [...new Set(rows.map((o) => o.user_id))]
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, company_name')
        .in('user_id', userIds)
      const nameByUser = new Map(
        ((profiles ?? []) as Pick<CustomerProfileRow, 'user_id' | 'company_name'>[]).map((p) => [
          p.user_id,
          p.company_name,
        ]),
      )
      setOrders(rows.map((o) => ({ ...o, company_name: nameByUser.get(o.user_id) })))
      setLoading(false)
    })()
  }, [canView])

  const byStatus = useMemo(() => {
    const map = new Map<OrderRow['status'], OrderCard[]>()
    for (const col of BOARD_COLUMNS) map.set(col.status, [])
    for (const o of orders) {
      const list = map.get(o.status)
      if (list) list.push(o)
    }
    return map
  }, [orders])

  if (!canView) {
    return <p className="admin-muted">You do not have permission to view the sales board.</p>
  }

  if (loading) return <p className="admin-muted">Loading sales board…</p>

  return (
    <div className="admin-crm-sales-board">
      <p className="admin-muted admin-crm-sales-board-intro">
        Live quotes and orders by status — drag-free board for Lamtek sales follow-up. For deal stages
        and tasks, use <Link to="/admin/crm/pipeline">Sales pipeline</Link>.
      </p>
      <div className="admin-crm-kanban admin-crm-sales-kanban">
        {BOARD_COLUMNS.map((col) => {
          const cards = byStatus.get(col.status) ?? []
          const total = cards.reduce((s, o) => s + Number(o.total_inc_vat || 0), 0)
          return (
            <section key={col.status} className="admin-crm-kanban-col">
              <header className="admin-crm-kanban-col-head">
                <h3>{col.label}</h3>
                <span className="admin-muted">
                  {cards.length} · £{total.toFixed(0)}
                </span>
              </header>
              <ul className="admin-crm-kanban-cards">
                {cards.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/orders/${o.id}`} className="admin-crm-kanban-card">
                      <span className="admin-crm-kanban-card-title">
                        {o.reference || `#${o.id.slice(0, 8)}`}
                      </span>
                      <span className="admin-muted admin-crm-kanban-card-sub">
                        {o.company_name ?? 'Customer'}
                      </span>
                      <span className="admin-crm-kanban-card-value">
                        £{Number(o.total_inc_vat || 0).toFixed(2)}
                      </span>
                      <span className="admin-muted admin-crm-kanban-card-date">
                        {new Date(o.updated_at ?? o.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </Link>
                  </li>
                ))}
                {cards.length === 0 && <li className="admin-muted admin-crm-kanban-empty">None</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
