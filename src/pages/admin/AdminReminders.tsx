import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderEventRow, OrderRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'
import { useStaff } from '@/hooks/useStaff'
import { insertOrderEvent } from '@/lib/orderEvents'

type ReminderRow = {
  order_id: string
  reference: string
  customer: string
  status: OrderRow['status']
  last_status_change_at: string
  last_status: string
  flagged_at: string | null
  last_note: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export default function AdminReminders() {
  const { staffProfile } = useStaff()
  const { allowed: canViewOrders } = usePermission('admin.orders', 'view')
  const { allowed: canEditOrders } = usePermission('admin.orders', 'edit')
  const [loading, setLoading] = useState(true)
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<OrderEventRow[]>([])
  const [scopeDays, setScopeDays] = useState(14)

  async function load() {
    if (!canViewOrders) return
    setLoading(true)
    setError(null)
    const since = new Date(Date.now() - scopeDays * 24 * 60 * 60 * 1000).toISOString()

    const [ordersRes, eventsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, user_id, status, reference, updated_at, is_archived')
        .eq('is_archived', false)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(400),
      supabase
        .from('order_events')
        .select('*')
        .gte('created_at', since)
        .in('event_type', ['status_change', 'customer_notified', 'customer_not_notified'])
        .order('created_at', { ascending: false })
        .limit(2000),
    ])

    const list = ((ordersRes.data ?? []) as OrderRow[]).filter((o) => o.is_archived !== true)
    setOrders(list)
    setEvents((eventsRes.data as OrderEventRow[]) ?? [])

    const userIds = [...new Set(list.map((o) => o.user_id))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, company_name')
        .in('user_id', userIds)
      const map: Record<string, string> = {}
      ;(profiles ?? []).forEach((p) => { map[p.user_id] = p.company_name ?? p.user_id.slice(0, 8) })
      setCustomerMap(map)
    } else {
      setCustomerMap({})
    }

    if (ordersRes.error) setError(ordersRes.error.message)
    else if (eventsRes.error) setError(eventsRes.error.message)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewOrders, scopeDays])

  const reminders = useMemo((): ReminderRow[] => {
    const orderById = new Map<string, OrderRow>()
    for (const o of orders) orderById.set(o.id, o)

    const eventsByOrder = new Map<string, OrderEventRow[]>()
    for (const ev of events) {
      const arr = eventsByOrder.get(ev.order_id) ?? []
      arr.push(ev)
      eventsByOrder.set(ev.order_id, arr)
    }

    const rows: ReminderRow[] = []
    for (const [orderId, o] of orderById.entries()) {
      const evs = eventsByOrder.get(orderId) ?? []
      const lastStatus = evs.find((e) => e.event_type === 'status_change' && e.to_status)
      if (!lastStatus?.to_status) continue

      const since = new Date(lastStatus.created_at).getTime()
      const lastTo = lastStatus.to_status

      const hasNotify = evs.some((e) =>
        e.event_type === 'customer_notified' &&
        e.to_status === lastTo &&
        new Date(e.created_at).getTime() >= since
      )
      const hasExplicitNo = evs.some((e) =>
        e.event_type === 'customer_not_notified' &&
        e.to_status === lastTo &&
        new Date(e.created_at).getTime() >= since
      )

      if (!hasExplicitNo || hasNotify) continue

      rows.push({
        order_id: orderId,
        reference: o.reference || orderId.slice(0, 8),
        customer: customerMap[o.user_id] ?? o.user_id.slice(0, 8),
        status: o.status,
        last_status_change_at: lastStatus.created_at,
        last_status: lastTo,
        flagged_at: lastStatus.created_at,
        last_note: lastStatus.note,
      })
    }

    return rows.sort((a, b) => new Date(b.last_status_change_at).getTime() - new Date(a.last_status_change_at).getTime())
  }, [orders, events, customerMap])

  async function markNotified(orderId: string, status: string) {
    if (!canEditOrders) return
    if (savingOrderId) return
    setSavingOrderId(orderId)
    setError(null)
    try {
      await insertOrderEvent({
        orderId,
        actorUserId: staffProfile?.user_id ?? null,
        eventType: 'customer_notified',
        toStatus: status,
        note: 'Marked as notified from reminders dashboard',
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark as notified.')
    }
    setSavingOrderId(null)
  }

  if (!canViewOrders) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <h2>Reminders</h2>
          <p className="admin-muted">You don’t have permission to view order reminders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Order reminders</span>
        <div className="admin-page-header-actions">
          <Link to="/admin/orders" className="btn btn-outline btn-small">Orders</Link>
        </div>
      </div>

      <div className="card admin-card">
        <h2>Customers not notified</h2>
        <p className="admin-muted">
          Orders where staff explicitly chose “Not now” after the last status change. This helps keep communication consistent.
        </p>

        <div className="admin-filters admin-filters--wrap" style={{ marginTop: '0.75rem' }}>
          <label>
            Lookback{' '}
            <select value={String(scopeDays)} onChange={(e) => setScopeDays(Number(e.target.value) || 14)}>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <button type="button" className="btn btn-small btn-outline" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        {error && (
          <div className="admin-confirm-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="admin-loading-state">
            <div className="admin-loading-spinner" aria-hidden />
            <p>Loading reminders…</p>
          </div>
        ) : reminders.length === 0 ? (
          <p className="admin-muted">No reminders found.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Last status change</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.order_id}>
                    <td>
                      <Link to={`/admin/orders/${r.order_id}`} className="admin-link">
                        {r.reference}
                      </Link>
                    </td>
                    <td>{r.customer}</td>
                    <td>
                      <span className={`admin-status-badge admin-status-badge--${r.status}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td title={`Last status: ${r.last_status}`}>
                      {new Date(r.last_status_change_at).toLocaleString()}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <Link to={`/admin/orders/${r.order_id}`} className="btn btn-small">Open</Link>
                        <button
                          type="button"
                          className="btn btn-small btn-outline"
                          onClick={() => markNotified(r.order_id, r.last_status)}
                          disabled={!canEditOrders || savingOrderId === r.order_id}
                          title="Marks the customer as notified for the last status change."
                        >
                          {savingOrderId === r.order_id ? 'Saving…' : 'Mark notified'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

