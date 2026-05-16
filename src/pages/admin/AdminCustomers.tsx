import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import type { CustomerProfileRow } from '@/types/database'

const CUSTOMER_COLUMNS = [
  { id: 'company', label: 'Company' },
  { id: 'contact', label: 'Contact' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'balance', label: 'Balance outstanding' },
  { id: 'credit_limit', label: 'Credit limit' },
  { id: 'website', label: 'Website' },
  { id: 'actions', label: 'Actions' },
]

export default function AdminCustomers() {
  const { tableDensity, rowsPerPage } = useAdminUi()
  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<'all' | 'outstanding' | 'credit' | 'consent-missing'>('all')
  const { columnDefs, visibleIds, setColumnVisible, setColumnOrder, resetToDefault, isVisible, initialised, order } = useColumnVisibility('admin_customers', CUSTOMER_COLUMNS)

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('company_name')
        .limit(rowsPerPage)
      setCustomers(profiles ?? [])
      setLoading(false)
    }
    load()
  }, [rowsPerPage])

  const colSpan = Math.max(visibleIds.length, 1)
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (quickFilter === 'outstanding' && Number(c.balance_outstanding || 0) <= 0) return false
      if (quickFilter === 'credit' && !(c.credit_limit != null && Number(c.credit_limit) > 0)) return false
      if (quickFilter === 'consent-missing' && c.staff_portal_access_consent_at) return false
      if (!q) return true
      const haystack = [
        c.company_name,
        c.contact_name,
        (c as { email?: string }).email,
        c.email_override,
        c.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [customers, quickFilter, search])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <p className="page-intro">Find customers quickly, review account health, and jump straight to orders.</p>
        <div className="admin-page-header-actions">
          <Link to="/admin/orders" className="btn btn-outline btn-small">All orders</Link>
          <Link to="/admin/create-quote" className="btn btn-small">Create quote</Link>
          <Link to="/admin/create-order" className="btn btn-small btn-outline">Create order</Link>
        </div>
      </div>

      <div className="admin-orders-quick-filters">
        <button type="button" className={`btn btn-small ${quickFilter === 'all' ? 'active' : 'btn-outline'}`} onClick={() => setQuickFilter('all')}>All</button>
        <button type="button" className={`btn btn-small ${quickFilter === 'outstanding' ? 'active' : 'btn-outline'}`} onClick={() => setQuickFilter('outstanding')}>Outstanding balance</button>
        <button type="button" className={`btn btn-small ${quickFilter === 'credit' ? 'active' : 'btn-outline'}`} onClick={() => setQuickFilter('credit')}>Has credit limit</button>
        <button type="button" className={`btn btn-small ${quickFilter === 'consent-missing' ? 'active' : 'btn-outline'}`} onClick={() => setQuickFilter('consent-missing')}>Consent missing</button>
        <input
          type="search"
          className="admin-filter-input"
          placeholder="Search company, contact, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 280 }}
        />
      </div>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading customers…</p>
        </div>
      ) : (
        <div className="card admin-card">
          <div className="admin-workflow-section-head">
            <h2 className="admin-card-title">Customers</h2>
            <span className="admin-muted">{filteredCustomers.length} shown</span>
            {initialised && (
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
          <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  {columnDefs.filter((c) => isVisible(c.id)).map((col) => (
                    <th key={col.id}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="admin-table-empty">
                      No customers match these filters. Try clearing quick filters or update the search.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id}>
                      {columnDefs.filter((col) => isVisible(col.id)).map((col) => {
                        if (col.id === 'company') return <td key={col.id}><Link to={`/admin/customers/${c.user_id}`} className="admin-table-link">{c.company_name}</Link></td>
                        if (col.id === 'contact') return <td key={col.id}>{c.contact_name ?? '—'}</td>
                        if (col.id === 'email') return <td key={col.id}>{(c as { email?: string }).email ?? c.email_override ?? '—'}</td>
                        if (col.id === 'phone') return <td key={col.id}>{c.phone ?? '—'}</td>
                        if (col.id === 'balance') return <td key={col.id}>£{Number(c.balance_outstanding).toFixed(2)}</td>
                        if (col.id === 'credit_limit') return <td key={col.id}>{c.credit_limit != null ? `£${Number(c.credit_limit).toFixed(2)}` : '—'}</td>
                        if (col.id === 'website') return <td key={col.id}>{c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer">{c.website}</a> : '—'}</td>
                        if (col.id === 'actions') return <td key={col.id} className="admin-table-actions"><Link to={`/admin/customers/${c.user_id}`}>View</Link><Link to={`/admin/orders?customer=${c.user_id}`}>Orders</Link><Link to={`/admin/create-quote?customer=${c.user_id}`}>Create quote</Link><Link to={`/admin/create-order?customer=${c.user_id}`}>Create order</Link></td>
                        return <td key={col.id}>—</td>
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
