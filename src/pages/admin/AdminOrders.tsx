import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi, formatAdminDate } from '@/contexts/AdminUiContext'
import { KanbanBoard, type KanbanColumn } from '@/components/shared/KanbanBoard'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import type { OrderRow } from '@/types/database'
import type { CustomerProfileRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

const ORDER_TABLE_COLUMNS = [
  { id: 'select', label: 'Select' },
  { id: 'date', label: 'Date' },
  { id: 'customer', label: 'Customer' },
  { id: 'reference', label: 'Reference' },
  { id: 'status', label: 'Status' },
  { id: 'total_ex_vat', label: 'Total ex VAT' },
  { id: 'total_inc_vat', label: 'Total inc VAT' },
  { id: 'actions', label: 'Actions' },
]

type OrdersViewType = 'table' | 'grid' | 'cards' | 'kanban'
type OrdersSort = 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc' | 'reference_asc' | 'status_asc'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  quotation: '#3b82f6',
  placed: '#8b5cf6',
  invoiced: '#f59e0b',
  paid: '#22c55e',
  cancelled: '#64748b',
}

const ORDER_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'draft', label: 'Draft', color: STATUS_COLORS.draft },
  { id: 'quotation', label: 'Quotation', color: STATUS_COLORS.quotation },
  { id: 'placed', label: 'Placed', color: STATUS_COLORS.placed },
  { id: 'invoiced', label: 'Invoiced', color: STATUS_COLORS.invoiced },
  { id: 'paid', label: 'Paid', color: STATUS_COLORS.paid },
  { id: 'cancelled', label: 'Cancelled', color: STATUS_COLORS.cancelled },
]

export default function AdminOrders() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customerFilter = searchParams.get('customer') ?? ''
  const statusFromUrl = searchParams.get('status') ?? ''
  const archiveFromUrl = searchParams.get('archive') ?? ''
  const adminUi = useAdminUi()
  const { tableDensity, setTableDensity, rowsPerPage, defaultOrderStatusFilter } = adminUi
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, { company_name: string; contact_name?: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(statusFromUrl || defaultOrderStatusFilter)
  const [referenceSearch, setReferenceSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [limit, setLimit] = useState(Math.max(rowsPerPage, 100))
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [viewType, setViewType] = useState<OrdersViewType>('table')
  const [sortBy, setSortBy] = useState<OrdersSort>('date_desc')
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>(
    archiveFromUrl === 'archived' ? 'archived' : archiveFromUrl === 'all' ? 'all' : 'active'
  )
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatusValue, setBulkStatusValue] = useState<OrderRow['status'] | ''>('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [archivingOrderId, setArchivingOrderId] = useState<string | null>(null)
  const [duplicatingOrderId, setDuplicatingOrderId] = useState<string | null>(null)
  const { allowed: canEditOrders } = usePermission('admin.orders', 'edit')
  const { columnDefs, visibleIds, setColumnVisible, setColumnOrder, resetToDefault, isVisible, initialised, order } = useColumnVisibility('admin_orders', ORDER_TABLE_COLUMNS)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === sortedOrders.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(sortedOrders.map((o) => o.id)))
  }

  async function bulkUpdateStatus(newStatus: OrderRow['status']) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkUpdating(true)
    const updates: Partial<OrderRow> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'placed' || newStatus === 'invoiced') updates.processed_at = new Date().toISOString()
    if (newStatus === 'cancelled') {
      updates.payment_status = null
      updates.payment_intent_id = null
    }
    await supabase.from('orders').update(updates).in('id', ids)
    setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, ...updates } : o)))
    setSelectedIds(new Set())
    setBulkStatusValue('')
    setBulkUpdating(false)
  }

  async function updateOrderStatus(orderId: string, newStatus: OrderRow['status']) {
    if (!canEditOrders) return
    setUpdatingOrderId(orderId)
    const updates: Partial<OrderRow> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'placed' || newStatus === 'invoiced') {
      updates.processed_at = new Date().toISOString()
    }
    if (newStatus === 'cancelled') {
      updates.payment_status = null
      updates.payment_intent_id = null
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)))
    }
    setUpdatingOrderId(null)
  }

  async function updateOrderArchive(orderId: string, isArchived: boolean) {
    if (!canEditOrders) return
    setArchivingOrderId(orderId)
    const updates: Partial<OrderRow> = {
      is_archived: isArchived,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)))
    }
    setArchivingOrderId(null)
  }

  async function duplicateOrder(orderId: string) {
    if (!canEditOrders) return
    setDuplicatingOrderId(orderId)
    try {
      const original = orders.find((o) => o.id === orderId)
      if (!original) return

      const { data: newOrder, error: newOrderError } = await supabase
        .from('orders')
        .insert({
          user_id: original.user_id,
          status: 'draft',
          reference: original.reference ? `${original.reference} (Copy)` : null,
          delivery_address: original.delivery_address ?? null,
          delivery_postcode: original.delivery_postcode ?? null,
          delivery_notes: original.delivery_notes ?? null,
          courier: original.courier ?? null,
          delivery_expected_date: original.delivery_expected_date ?? null,
          delivery_tracking: null,
          is_archived: false,
          total_ex_vat: 0,
          total_inc_vat: 0,
        })
        .select('id')
        .single()
      if (newOrderError || !newOrder?.id) return

      const { data: lines } = await supabase
        .from('order_lines')
        .select('product_id, product_snapshot, quantity, unit_price, options')
        .eq('order_id', orderId)

      if ((lines ?? []).length > 0) {
        const copiedLines = (lines ?? []).map((line) => ({
          order_id: newOrder.id,
          product_id: line.product_id,
          product_snapshot: line.product_snapshot,
          quantity: line.quantity,
          unit_price: line.unit_price,
          options: line.options ?? {},
        }))
        await supabase.from('order_lines').insert(copiedLines)
      }

      navigate(`/admin/orders/${newOrder.id}`)
    } finally {
      setDuplicatingOrderId(null)
    }
  }

  useEffect(() => {
    if (statusFromUrl) setStatusFilter(statusFromUrl)
    else setStatusFilter(defaultOrderStatusFilter)
  }, [defaultOrderStatusFilter, statusFromUrl])

  useEffect(() => {
    if (archiveFromUrl === 'archived') setArchiveFilter('archived')
    else if (archiveFromUrl === 'all') setArchiveFilter('all')
    else setArchiveFilter('active')
  }, [archiveFromUrl])

  useEffect(() => {
    async function load() {
      let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
      if (customerFilter) q = q.eq('user_id', customerFilter)
      if (statusFilter && viewType !== 'kanban') q = q.eq('status', statusFilter)
      if (archiveFilter === 'active') q = q.eq('is_archived', false)
      if (archiveFilter === 'archived') q = q.eq('is_archived', true)
      if (referenceSearch.trim()) q = q.ilike('reference', `%${referenceSearch.trim()}%`)
      if (dateFrom) q = q.gte('created_at', dateFrom + 'T00:00:00Z')
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59.999Z')
      const { data: orderData } = await q
      const orderList = orderData ?? []
      setOrders(orderList)

      const userIds = [...new Set(orderList.map((o) => o.user_id))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('user_id, company_name, contact_name')
          .in('user_id', userIds)
        const map: Record<string, { company_name: string; contact_name?: string | null }> = {}
        for (const p of profiles ?? []) {
          const row = p as CustomerProfileRow & { user_id: string }
          map[row.user_id] = { company_name: row.company_name, contact_name: row.contact_name }
        }
        setCustomerMap(map)
      } else {
        setCustomerMap({})
      }
      setLoading(false)
    }
    load()
  }, [archiveFilter, customerFilter, statusFilter, limit, referenceSearch, dateFrom, dateTo, viewType])

  const getCustomerDisplay = (userId: string) => {
    const c = customerMap[userId]
    if (c?.company_name) return c.company_name
    if (c?.contact_name) return c.contact_name
    return 'Customer'
  }

  const sortedOrders = useMemo(() => {
    const list = [...orders]
    switch (sortBy) {
      case 'date_desc':
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      case 'date_asc':
        return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'total_desc':
        return list.sort((a, b) => Number(b.total_ex_vat) - Number(a.total_ex_vat))
      case 'total_asc':
        return list.sort((a, b) => Number(a.total_ex_vat) - Number(b.total_ex_vat))
      case 'reference_asc':
        return list.sort((a, b) => (a.reference ?? '').localeCompare(b.reference ?? ''))
      case 'status_asc':
        return list.sort((a, b) => (STATUS_LABELS[a.status] ?? a.status).localeCompare(STATUS_LABELS[b.status] ?? b.status))
      default:
        return list
    }
  }, [orders, sortBy])

  const quickFilters = [
    {
      id: 'processing',
      label: 'Needs processing',
      active: statusFilter === 'placed' && archiveFilter === 'active',
      apply: () => {
        setStatusFilter('placed')
        setArchiveFilter('active')
      },
    },
    {
      id: 'quotes',
      label: 'Open quotes',
      active: statusFilter === 'quotation' && archiveFilter === 'active',
      apply: () => {
        setStatusFilter('quotation')
        setArchiveFilter('active')
      },
    },
    {
      id: 'paid',
      label: 'Paid',
      active: statusFilter === 'paid' && archiveFilter === 'active',
      apply: () => {
        setStatusFilter('paid')
        setArchiveFilter('active')
      },
    },
    {
      id: 'archived',
      label: 'Archived',
      active: archiveFilter === 'archived',
      apply: () => {
        setStatusFilter('')
        setArchiveFilter('archived')
      },
    },
  ]

  return (
    <div className="admin-page">
      <div className="admin-orders-header">
        <h1 className="admin-page-title">Orders &amp; quotes</h1>
        <p className="page-intro">
          Quotations and placed orders live here. Create a quote for pricing only, then convert to an order when the customer confirms.
          Process status, lines, delivery, and invoicing from one place.
        </p>
        <div className="admin-page-header-actions admin-orders-quick-create">
          <Link to="/admin/create-quote" className="btn btn-small">
            Quick quote
          </Link>
          <Link to="/admin/create-order" className="btn btn-outline btn-small">
            Quick order
          </Link>
          <Link to="/admin/orders/processing" className="btn btn-outline btn-small">
            Process orders
          </Link>
          <Link to="/admin/orders?archive=archived" className="btn btn-outline btn-small">
            Archived orders
          </Link>
        </div>
      </div>

      <div className="admin-orders-quick-filters">
        {quickFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn btn-small ${f.active ? 'active' : 'btn-outline'}`}
            onClick={f.apply}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-small ${showAdvancedFilters ? 'active' : 'btn-outline'}`}
          onClick={() => setShowAdvancedFilters((v) => !v)}
          aria-expanded={showAdvancedFilters}
        >
          {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
        </button>
      </div>

      {showAdvancedFilters && (
      <div className="admin-filters admin-filters--wrap">
        <label>
          Status{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Archive{' '}
          <select value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value as 'active' | 'archived' | 'all')}>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Reference{' '}
          <input
            type="search"
            placeholder="Search reference…"
            value={referenceSearch}
            onChange={(e) => setReferenceSearch(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          From{' '}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="admin-filter-input"
          />
        </label>
        <label>
          Show{' '}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="admin-filter-input"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </label>
        <label>
          Sort{' '}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as OrdersSort)} className="admin-filter-input">
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
            <option value="total_desc">Total (high–low)</option>
            <option value="total_asc">Total (low–high)</option>
            <option value="reference_asc">Reference A–Z</option>
            <option value="status_asc">Status A–Z</option>
          </select>
        </label>
        <div className="admin-orders-view-toggle" role="group" aria-label="View type">
          <button type="button" className={viewType === 'table' ? 'active' : ''} onClick={() => setViewType('table')} title="Table">☰</button>
          <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} title="Grid">◫</button>
          <button type="button" className={viewType === 'cards' ? 'active' : ''} onClick={() => setViewType('cards')} title="Cards">▦</button>
          <button type="button" className={viewType === 'kanban' ? 'active' : ''} onClick={() => setViewType('kanban')} title="Kanban">▤</button>
        </div>
        <label className="admin-orders-density">
          Table density
          <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')} className="admin-filter-input">
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        {customerFilter && (
          <span className="filter-tag">Customer: {customerFilter.slice(0, 8)}…</span>
        )}
      </div>
      )}

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading orders…</p>
        </div>
      ) : (
        <div className="card admin-card">
          <div className="admin-card-heading-row">
            <p className="admin-muted" style={{ marginBottom: 0 }}>{sortedOrders.length} order(s)</p>
            {viewType === 'table' && initialised && (
              <ColumnSettings
                columnDefs={columnDefs}
                visibleIds={visibleIds}
                setColumnVisible={setColumnVisible}
                order={order}
                setColumnOrder={setColumnOrder}
                resetToDefault={resetToDefault}
                tooltip="Column settings – click here to edit columns"
              />
            )}
          </div>
          {selectedIds.size > 0 && viewType === 'table' && (
            <div className="admin-bulk-actions no-print">
              <span className="admin-bulk-actions-count">{selectedIds.size} selected</span>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => bulkUpdateStatus('invoiced')}
                disabled={bulkUpdating}
              >
                {bulkUpdating ? 'Updating…' : 'Mark as Invoiced'}
              </button>
              <select
                value={bulkStatusValue}
                onChange={(e) => {
                  const v = e.target.value as OrderRow['status'] | ''
                  if (v) bulkUpdateStatus(v)
                }}
                disabled={bulkUpdating}
                className="admin-filter-input"
              >
                <option value="">Set status to…</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button type="button" className="btn btn-outline btn-small" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </button>
            </div>
          )}
          {viewType === 'table' && (
          <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table orders-table">
              <thead>
                <tr>
                  {columnDefs.filter((c) => isVisible(c.id)).map((col) => (
                    <th key={col.id} className={col.id === 'select' ? 'admin-orders-th-checkbox' : ''}>
                      {col.id === 'select' ? (
                        <input
                          type="checkbox"
                          checked={sortedOrders.length > 0 && selectedIds.size === sortedOrders.length}
                          onChange={toggleSelectAll}
                          aria-label="Select all orders"
                        />
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(visibleIds.length, 1)} className="admin-table-empty">
                      No orders match these filters. Try a quick filter above, clear advanced filters, or{' '}
                      <Link to="/admin/create-order">create an order</Link>.
                    </td>
                  </tr>
                ) : (
                  sortedOrders.map((o) => (
                    <tr key={o.id}>
                      {columnDefs.filter((c) => isVisible(c.id)).map((col) => {
                        if (col.id === 'select') return <td key={col.id} className="admin-orders-td-checkbox"><input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} aria-label={`Select order ${o.reference ?? o.id}`} /></td>
                        if (col.id === 'date') return <td key={col.id}><Link to={`/admin/orders/${o.id}`} className="admin-table-link">{formatAdminDate(adminUi, o.created_at)}</Link></td>
                        if (col.id === 'customer') return <td key={col.id}><Link to={`/admin/customers/${o.user_id}`} className="admin-table-link">{getCustomerDisplay(o.user_id)}</Link></td>
                        if (col.id === 'reference') return <td key={col.id}><Link to={`/admin/orders/${o.id}`} className="admin-table-link">{o.reference ?? '—'}</Link></td>
                        if (col.id === 'status') return <td key={col.id}><span className="admin-orders-status-cell"><select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderRow['status'])} disabled={updatingOrderId === o.id || !canEditOrders} className={`admin-orders-status-select admin-orders-status-select--${o.status}`} aria-label={`Change status for order ${o.reference ?? o.id}`}>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{o.is_archived && <span className="admin-table-paid-badge">Archived</span>}{updatingOrderId === o.id && <span className="admin-orders-status-updating" aria-hidden>…</span>}{o.payment_status === 'succeeded' && <span className="admin-table-paid-badge">Paid</span>}</span></td>
                        if (col.id === 'total_ex_vat') return <td key={col.id}><Link to={`/admin/orders/${o.id}`} className="admin-table-link">£{Number(o.total_ex_vat).toFixed(2)}</Link></td>
                        if (col.id === 'total_inc_vat') return <td key={col.id}><Link to={`/admin/orders/${o.id}`} className="admin-table-link">£{Number(o.total_inc_vat).toFixed(2)}</Link></td>
                        if (col.id === 'actions') return <td key={col.id}><div className="admin-table-actions"><Link to={`/admin/orders/${o.id}`} className="btn btn-small">Edit order</Link><button type="button" className="btn btn-small btn-outline" onClick={() => updateOrderArchive(o.id, !(o.is_archived === true))} disabled={!canEditOrders || archivingOrderId === o.id}>{o.is_archived ? 'Reopen' : 'Archive'}</button><button type="button" className="btn btn-small btn-outline" onClick={() => duplicateOrder(o.id)} disabled={!canEditOrders || duplicatingOrderId === o.id}>{duplicatingOrderId === o.id ? 'Duplicating…' : 'Duplicate'}</button></div></td>
                        return <td key={col.id}>—</td>
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
          {(viewType === 'grid' || viewType === 'cards') && (
            <div className={`admin-orders-grid admin-orders-view--${viewType}`}>
              {sortedOrders.length === 0 ? (
                <p className="admin-muted">
                  No orders match. <Link to="/admin/create-order">Create an order</Link>.
                </p>
              ) : (
                sortedOrders.map((o) => (
                  <div key={o.id} className="admin-orders-card card">
                    <div className="admin-orders-card-head">
                      <Link to={`/admin/orders/${o.id}`} className="admin-orders-card-ref">
                        {o.reference ?? o.id.slice(0, 8)}
                      </Link>
                      <span className="admin-orders-card-date">{formatAdminDate(adminUi, o.created_at)}</span>
                    </div>
                    <Link to={`/admin/customers/${o.user_id}`} className="admin-orders-card-customer">
                      {getCustomerDisplay(o.user_id)}
                    </Link>
                    <div className="admin-orders-card-status">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderRow['status'])}
                        disabled={updatingOrderId === o.id || !canEditOrders}
                        className={`admin-orders-status-select admin-orders-status-select--${o.status}`}
                        aria-label={`Change status`}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      {o.payment_status === 'succeeded' && <span className="admin-table-paid-badge">Paid</span>}
                      {o.is_archived && <span className="admin-table-paid-badge">Archived</span>}
                      {updatingOrderId === o.id && <span className="admin-orders-status-updating">…</span>}
                    </div>
                    <div className="admin-orders-card-totals">
                      <span>£{Number(o.total_ex_vat).toFixed(2)} ex VAT</span>
                      <span>£{Number(o.total_inc_vat).toFixed(2)} inc VAT</span>
                    </div>
                    <Link to={`/admin/orders/${o.id}`} className="btn btn-small">
                      Edit order
                    </Link>
                    <div className="admin-table-actions">
                      <button type="button" className="btn btn-small btn-outline" onClick={() => updateOrderArchive(o.id, !(o.is_archived === true))} disabled={!canEditOrders || archivingOrderId === o.id}>
                        {o.is_archived ? 'Reopen' : 'Archive'}
                      </button>
                      <button type="button" className="btn btn-small btn-outline" onClick={() => duplicateOrder(o.id)} disabled={!canEditOrders || duplicatingOrderId === o.id}>
                        {duplicatingOrderId === o.id ? 'Duplicating…' : 'Duplicate'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {viewType === 'kanban' && (
            <KanbanBoard<OrderRow>
              columns={ORDER_KANBAN_COLUMNS}
              items={orders}
              getItemId={(o) => o.id}
              getColumnId={(o) => o.status}
              onMove={(itemId, toColumnId) => updateOrderStatus(itemId, toColumnId as OrderRow['status'])}
              getCardColor={(o) => STATUS_COLORS[o.status]}
              emptyMessage="No orders"
              className="admin-orders-kanban"
              renderCard={(o, { isDragging }) => (
                <Link to={`/admin/orders/${o.id}`} className="kanban-card-inner" onClick={(e) => isDragging && e.preventDefault()}>
                  <div className="kanban-card-title">{o.reference ?? o.id.slice(0, 8)}</div>
                  <div className="kanban-card-detail">{getCustomerDisplay(o.user_id)}</div>
                  <div className="kanban-card-meta">
                    <span>{formatAdminDate(adminUi, o.created_at)}</span>
                    <span>£{Number(o.total_inc_vat).toFixed(2)} inc VAT</span>
                    {o.payment_status === 'succeeded' && <span className="admin-table-paid-badge">Paid</span>}
                  </div>
                  <div className="kanban-card-actions">
                    <span className="kanban-card-action-link">Edit order →</span>
                  </div>
                </Link>
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}
