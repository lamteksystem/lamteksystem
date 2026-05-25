import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderRow, LocationRow, PickListRow } from '@/types/database'
import { allocateStockForOrderShipmentAtomic } from '@/lib/stock'
import { insertOrderEvent } from '@/lib/orderEvents'
import { useStaff } from '@/hooks/useStaff'
import { usePermission } from '@/hooks/usePermission'
import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import { createPickListFromOrder } from '@/lib/pickLists'

const STATUS_LABELS: Record<string, string> = {
  placed: 'Placed',
  invoiced: 'Invoiced',
}

export default function AdminOrderProcessing() {
  const { staffProfile } = useStaff()
  const { allowed: canEditOrders } = usePermission('admin.orders', 'edit')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'placed' | 'invoiced' | 'both'>('placed')
  const [search, setSearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [shippingId, setShippingId] = useState<string | null>(null)
  const [pickListMap, setPickListMap] = useState<Record<string, PickListRow>>({})
  const [pickListBusyId, setPickListBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setActionError(null)
    const { data: locData } = await supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('name')
    setLocations((locData ?? []) as LocationRow[])

    const statuses = filter === 'both' ? ['placed', 'invoiced'] : [filter]
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .in('status', statuses)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(200)
    const list = (orderData ?? []) as OrderRow[]
    setOrders(list)

    if (list.length > 0) {
      const orderIds = list.map((o) => o.id)
      const { data: pickLists } = await supabase
        .from('pick_lists')
        .select('*')
        .in('order_id', orderIds)
        .eq('is_archived', false)
        .in('status', ['generated', 'picking', 'picked'])
        .order('created_at', { ascending: false })
      const byOrder: Record<string, PickListRow> = {}
      ;((pickLists ?? []) as PickListRow[]).forEach((pickList) => {
        if (!byOrder[pickList.order_id]) byOrder[pickList.order_id] = pickList
      })
      setPickListMap(byOrder)
    } else {
      setPickListMap({})
    }

    const userIds = [...new Set(list.map((o) => o.user_id))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('user_id, company_name')
        .in('user_id', userIds)
      const map: Record<string, string> = {}
      ;(profiles ?? []).forEach((p) => { map[p.user_id] = p.company_name ?? p.user_id.slice(0, 8) })
      setCustomerMap(map)
    }
    setLoading(false)
  }

  async function ensurePickList(orderId: string, locationId?: string | null) {
    if (!canEditOrders || pickListBusyId) return
    setActionError(null)
    setPickListBusyId(orderId)
    try {
      const { pickListId } = await createPickListFromOrder({
        orderId,
        locationId: locationId ?? shipFromLocations[0]?.id ?? null,
        actorUserId: staffProfile?.user_id ?? null,
      })
      await load()
      window.open(`/admin/pick-lists/${pickListId}`, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not generate pick list.')
    } finally {
      setPickListBusyId(null)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  const shipFromLocations = useMemo(() => lamtekPortalLocations(locations), [locations])

  const filteredOrders = orders.filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const customer = (customerMap[o.user_id] ?? '').toLowerCase()
    const reference = (o.reference ?? '').toLowerCase()
    return customer.includes(q) || reference.includes(q) || o.id.slice(0, 8).toLowerCase().includes(q)
  })

  async function setStatus(orderId: string, status: OrderRow['status']) {
    if (!canEditOrders) return
    setUpdatingId(orderId)
    const updates: Partial<OrderRow> = {
      status,
      updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    }
    await supabase.from('orders').update(updates).eq('id', orderId)
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)))
    setUpdatingId(null)
  }

  async function shipFromQueue(orderId: string) {
    if (!canEditOrders) return
    if (shippingId) return
    const locationId = shipFromLocations[0]?.id
    if (!locationId) return
    setShippingId(orderId)
    const order = orders.find((o) => o.id === orderId)
    try {
      await allocateStockForOrderShipmentAtomic({ orderId, locationId, reason: 'shipment' })
      await supabase.from('shipments').insert({
        order_id: orderId,
        location_id: locationId,
        courier: order?.courier ?? null,
        tracking: order?.delivery_tracking ?? null,
      })
      try {
        await insertOrderEvent({
          orderId,
          actorUserId: staffProfile?.user_id ?? null,
          eventType: 'shipment_created',
          note: [order?.courier, order?.delivery_tracking].filter(Boolean).join(' · ') || 'Shipment created',
        })
      } catch (_) { /* best-effort audit */ }
      await load()
    } catch (_) {
      // swallow; admin can retry
    }
    setShippingId(null)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading orders…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Order processing</span>
        <div className="admin-page-header-actions">
          <Link to="/admin/pick-lists" className="btn btn-outline btn-small">Pick lists</Link>
          <Link to="/admin/orders" className="btn btn-outline btn-small">All orders</Link>
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-workflow-section-head">
          <h2>Orders to process</h2>
          <span className="admin-muted">{filteredOrders.length} in queue</span>
        </div>
        <p className="page-intro">Use this queue for daily operations: invoice placed orders, then ship invoiced orders.</p>
        {actionError && (
          <div className="admin-confirm-box" role="alert">
            <p>{actionError}</p>
          </div>
        )}

        <div className="admin-orders-quick-filters">
          <button type="button" className={`btn btn-small ${filter === 'placed' ? 'active' : 'btn-outline'}`} onClick={() => setFilter('placed')}>
            Placed (needs invoicing)
          </button>
          <button type="button" className={`btn btn-small ${filter === 'invoiced' ? 'active' : 'btn-outline'}`} onClick={() => setFilter('invoiced')}>
            Invoiced (ready to despatch)
          </button>
          <button type="button" className={`btn btn-small ${filter === 'both' ? 'active' : 'btn-outline'}`} onClick={() => setFilter('both')}>
            Both
          </button>
          <button type="button" className={`btn btn-small ${showAdvanced ? 'active' : 'btn-outline'}`} onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>
          <input
            type="search"
            className="admin-filter-input"
            placeholder="Search reference or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
        </div>

        {showAdvanced && (
          <div className="admin-order-processing-filters">
            <p className="admin-muted" style={{ margin: 0 }}>
              Tip: Use <strong>Both</strong> to quickly step through invoicing and shipping from one list.
            </p>
          </div>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Invoice #</th>
                <th>Expected delivery</th>
                <th>Pick list</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-muted">No orders match this queue/filter right now.</td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/admin/orders/${o.id}`} className="admin-link">
                        {o.reference || o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{customerMap[o.user_id] ?? o.user_id.slice(0, 8)}</td>
                    <td>£{Number(o.total_inc_vat).toFixed(2)}</td>
                    <td>
                      <span className={`admin-status-badge admin-status-badge--${o.status}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td>{o.invoice_number ?? '—'}</td>
                    <td>{o.delivery_expected_date ? new Date(o.delivery_expected_date).toLocaleDateString() : '—'}</td>
                    <td>
                      {pickListMap[o.id] ? (
                        <Link to={`/admin/pick-lists/${pickListMap[o.id].id}`} className="admin-link">
                          {pickListMap[o.id].status}
                        </Link>
                      ) : (
                        <span className="admin-muted">None</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-order-processing-actions">
                        <Link to={`/admin/orders/${o.id}`} className="btn btn-small">Open</Link>
                        <button
                          type="button"
                          className="btn btn-small btn-outline"
                          onClick={() => ensurePickList(o.id)}
                          disabled={!!pickListBusyId}
                        >
                          {pickListBusyId === o.id ? 'Generating…' : pickListMap[o.id] ? 'Open pick list' : 'Generate pick list'}
                        </button>
                        {o.status === 'placed' && (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => setStatus(o.id, 'invoiced')}
                            disabled={!!updatingId}
                          >
                            {updatingId === o.id ? '…' : 'Mark invoiced'}
                          </button>
                        )}
                        {o.status === 'invoiced' && (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            onClick={() => shipFromQueue(o.id)}
                            disabled={!!shippingId}
                            title={shipFromLocations[0]?.name ? `Ships from ${shipFromLocations[0].name}` : 'Ships from first Lamtek group location'}
                          >
                            {shippingId === o.id ? 'Shipping…' : 'Ship + allocate stock'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
