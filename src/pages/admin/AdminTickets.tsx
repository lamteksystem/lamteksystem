import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { TicketRow, CustomerProfileRow, StaffProfileRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

export default function AdminTickets() {
  const [searchParams] = useSearchParams()
  const customerFromUrl = searchParams.get('customer') ?? ''
  const { allowed: canView } = usePermission('tickets.view', 'view')
  const { allowed: canManage } = usePermission('tickets.manage', 'edit')

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [customers, setCustomers] = useState<Map<string, CustomerProfileRow>>(new Map())
  const [staff, setStaff] = useState<Map<string, StaffProfileRow>>(new Map())
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [typeFilter, setTypeFilter] = useState<'all' | TicketRow['type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TicketRow['status']>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'fresh' | 'stale' | 'waiting'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all')
  const [highPriorityOnly, setHighPriorityOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'updated_desc' | 'updated_asc' | 'priority_desc' | 'priority_asc'>('updated_desc')
  const [query, setQuery] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  function hoursSince(iso: string): number {
    const diffMs = Date.now() - new Date(iso).getTime()
    return Math.max(0, diffMs / (1000 * 60 * 60))
  }

  function queueHealth(t: TicketRow): 'fresh' | 'stale' | 'waiting' {
    const h = hoursSince(t.updated_at)
    if (t.status === 'waiting_customer') return 'waiting'
    if (t.status === 'resolved') return 'fresh'
    // Open/in_progress tickets stale after 24h without update.
    return h > 24 ? 'stale' : 'fresh'
  }

  function ageLabel(iso: string): string {
    const h = Math.floor(hoursSince(iso))
    const d = Math.floor(h / 24)
    const rem = h % 24
    if (d > 0) return `${d}d ${rem}h`
    return `${h}h`
  }

  async function load() {
    setLoading(true)
    const [tRes, cRes, sRes] = await Promise.all([
      supabase.from('tickets').select('*').order('updated_at', { ascending: false }).limit(500),
      supabase.from('customer_profiles').select('*').order('company_name'),
      supabase.from('staff_profiles').select('*'),
    ])
    setTickets((tRes.data ?? []) as TicketRow[])
    const cMap = new Map<string, CustomerProfileRow>()
    ;(cRes.data ?? []).forEach((c) => cMap.set((c as CustomerProfileRow).user_id, c as CustomerProfileRow))
    setCustomers(cMap)
    const sMap = new Map<string, StaffProfileRow>()
    ;(sRes.data ?? []).forEach((s) => sMap.set((s as StaffProfileRow).id, s as StaffProfileRow))
    setStaff(sMap)
    setLoading(false)
  }

  useEffect(() => {
    if (!canView) return
    load()
     
  }, [canView])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = tickets.filter((t) => {
      if (customerFromUrl && t.customer_user_id !== customerFromUrl) return false
      if (filter === 'open' && t.status === 'resolved') return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (healthFilter !== 'all' && queueHealth(t) !== healthFilter) return false
      if (priorityFilter !== 'all' && String(t.priority) !== priorityFilter) return false
      if (highPriorityOnly && Number(t.priority || 0) < 4) return false
      if (!q) return true
      const customerName = customers.get(t.customer_user_id)?.company_name ?? ''
      const haystack = `${t.subject} ${t.type} ${t.status} ${customerName}`.toLowerCase()
      return haystack.includes(q)
    })
    return [...list].sort((a, b) => {
      if (sortBy === 'updated_desc') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (sortBy === 'updated_asc') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      if (sortBy === 'priority_desc') return Number(b.priority || 0) - Number(a.priority || 0)
      return Number(a.priority || 0) - Number(b.priority || 0)
    })
  }, [tickets, filter, typeFilter, statusFilter, healthFilter, priorityFilter, query, customers, sortBy, customerFromUrl])

  const queueMetrics = useMemo(() => {
    const open = tickets.filter((t) => t.status !== 'resolved').length
    const waiting = tickets.filter((t) => t.status === 'waiting_customer').length
    const stale = tickets.filter((t) => t.status !== 'resolved' && queueHealth(t) === 'stale').length
    const highPriority = tickets.filter((t) => Number(t.priority || 0) >= 4 && t.status !== 'resolved').length
    return { open, waiting, stale, highPriority }
  }, [tickets])

  if (!canView) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <h2>No access</h2>
          <p>You don&apos;t have permission to view tickets.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading tickets…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Tickets</span>
        <div className="admin-page-header-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={load}>Refresh queue</button>
        </div>
      </div>
      <p className="page-intro">Use quick filters to triage tickets fast. Open a ticket to reply, assign, and resolve.</p>

      <div className="admin-orders-quick-filters">
        <button type="button" className={`btn btn-small ${filter === 'open' ? 'active' : 'btn-outline'}`} onClick={() => setFilter('open')}>
          Open only
        </button>
        <button type="button" className={`btn btn-small ${healthFilter === 'stale' ? 'active' : 'btn-outline'}`} onClick={() => setHealthFilter('stale')}>
          Stale (&gt;24h)
        </button>
        <button type="button" className={`btn btn-small ${healthFilter === 'waiting' ? 'active' : 'btn-outline'}`} onClick={() => setHealthFilter('waiting')}>
          Waiting customer
        </button>
        <button
          type="button"
          className={`btn btn-small ${highPriorityOnly ? 'active' : 'btn-outline'}`}
          onClick={() => setHighPriorityOnly((v) => !v)}
        >
          High priority
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject or customer…"
          className="admin-filter-input"
          style={{ minWidth: 260 }}
        />
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
        <div className="admin-filters admin-filters--wrap" style={{ marginBottom: '0.75rem' }}>
          <label>
            View{' '}
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="open">Open only</option>
              <option value="all">All</option>
            </select>
          </label>
          <label>
            Type{' '}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
              <option value="all">All</option>
              <option value="returns">Returns</option>
              <option value="issue">Issue</option>
              <option value="question">Question</option>
            </select>
          </label>
          <label>
            Status{' '}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">All</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="waiting_customer">waiting_customer</option>
              <option value="resolved">resolved</option>
            </select>
          </label>
          <label>
            Queue health{' '}
            <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)}>
              <option value="all">All</option>
              <option value="fresh">Fresh</option>
              <option value="stale">Stale</option>
              <option value="waiting">Waiting customer</option>
            </select>
          </label>
          <label>
            Priority{' '}
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}>
              <option value="all">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label>
            Sort{' '}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="updated_desc">Updated (newest)</option>
              <option value="updated_asc">Updated (oldest)</option>
              <option value="priority_desc">Priority (high-low)</option>
              <option value="priority_asc">Priority (low-high)</option>
            </select>
          </label>
        </div>
      )}

      {customerFromUrl ? (
        <div className="admin-message-ok" style={{ marginBottom: '1rem' }}>
          Showing tickets for{' '}
          <strong>{customers.get(customerFromUrl)?.company_name ?? customerFromUrl.slice(0, 8)}</strong>.{' '}
          <Link to="/admin/tickets" className="admin-link">
            Clear filter
          </Link>
        </div>
      ) : null}

      <div className="admin-detail-grid" style={{ marginBottom: '1rem' }}>
        <div className="card admin-card">
          <h3 style={{ marginTop: 0 }}>Open queue</h3>
          <div className="admin-report-metric-value">{queueMetrics.open}</div>
        </div>
        <div className="card admin-card">
          <h3 style={{ marginTop: 0 }}>Waiting customer</h3>
          <div className="admin-report-metric-value">{queueMetrics.waiting}</div>
        </div>
        <div className="card admin-card">
          <h3 style={{ marginTop: 0 }}>Stale (&gt;24h)</h3>
          <div className="admin-report-metric-value">{queueMetrics.stale}</div>
        </div>
        <div className="card admin-card">
          <h3 style={{ marginTop: 0 }}>High priority (4-5)</h3>
          <div className="admin-report-metric-value">{queueMetrics.highPriority}</div>
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-workflow-section-head">
          <h2>Queue</h2>
          <span className="admin-muted">{visible.length} ticket(s)</span>
        </div>
        {visible.length === 0 ? (
          <p className="admin-muted">No tickets match this queue/filter right now.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Queue health</th>
                  <th>Age</th>
                  <th>Customer</th>
                  <th>Assigned</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/admin/tickets/${t.id}`}>{t.subject}</Link></td>
                    <td>{t.type}</td>
                    <td>{t.status}</td>
                    <td>{t.priority}</td>
                    <td>{queueHealth(t)}</td>
                    <td>{ageLabel(t.updated_at)}</td>
                    <td>{customers.get(t.customer_user_id)?.company_name ?? t.customer_user_id.slice(0, 8)}</td>
                    <td>{t.assigned_staff_id ? (staff.get(t.assigned_staff_id)?.display_name ?? t.assigned_staff_id.slice(0, 8)) : '—'}</td>
                    <td>{new Date(t.updated_at).toLocaleDateString()}</td>
                    <td>{canManage ? <Link className="btn btn-small btn-outline" to={`/admin/tickets/${t.id}`}>Open</Link> : <Link to={`/admin/tickets/${t.id}`}>View</Link>}</td>
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

