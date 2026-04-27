import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import type { CustomerProfileRow } from '@/types/database'
import type { StaffProfileRow } from '@/types/database'
import type { SupplierRow } from '@/types/database'

type TabId = 'staff' | 'customers' | 'suppliers'

export default function AdminUsers() {
  const { tableDensity } = useAdminUi()
  const [tab, setTab] = useState<TabId>('staff')
  const [staff, setStaff] = useState<StaffProfileRow[]>([])
  const [customers, setCustomers] = useState<CustomerProfileRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [staffRes, custRes, suppRes] = await Promise.all([
        supabase.from('staff_profiles').select('*').order('role').order('display_name'),
        supabase.from('customer_profiles').select('*').order('company_name'),
        supabase.from('suppliers').select('*').order('company_name'),
      ])
      setStaff((staffRes.data ?? []) as StaffProfileRow[])
      setCustomers((custRes.data ?? []) as CustomerProfileRow[])
      setSuppliers((suppRes.data ?? []) as SupplierRow[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="admin-page">
      <p className="page-intro">
        View users by type: Staff (admin backend), Customers (portal), Suppliers. Create new users from Create user.
      </p>
      <div className="admin-pricing-tabs" style={{ marginBottom: '1rem' }}>
        {(['staff', 'customers', 'suppliers'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-pricing-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'staff' && 'Staff'}
            {t === 'customers' && `Customers (${customers.length})`}
            {t === 'suppliers' && `Suppliers (${suppliers.length})`}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading…</p>
        </div>
      ) : (
        <div className="card admin-card">
          {tab === 'staff' && (
            <>
              <h2>Staff ({staff.length})</h2>
              <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Display name</th>
                      <th>Role</th>
                      <th>User ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr><td colSpan={3} className="admin-table-empty">No staff profiles. Create a staff or admin user from Create user.</td></tr>
                    ) : (
                      staff.map((s) => (
                        <tr key={s.id}>
                          <td>{s.display_name ?? '—'}</td>
                          <td><code>{s.role}</code></td>
                          <td><code className="admin-muted">{s.user_id.slice(0, 8)}…</code></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'customers' && (
            <>
              <h2>Customers ({customers.length})</h2>
              <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr><td colSpan={3} className="admin-table-empty">No customer profiles yet.</td></tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id}>
                          <td><Link to={`/admin/customers/${c.user_id}`} className="admin-table-link">{c.company_name}</Link></td>
                          <td>{c.contact_name ?? '—'}</td>
                          <td>
                            <Link to={`/admin/customers/${c.user_id}`}>View</Link>
                            {' · '}
                            <Link to={`/admin/create-order?customer=${c.user_id}`}>Create order</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'suppliers' && (
            <>
              <h2>Suppliers ({suppliers.length})</h2>
              <div className={`table-wrap admin-table-wrap admin-table-wrap--${tableDensity}`}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr><td colSpan={3} className="admin-table-empty">No suppliers yet.</td></tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr key={s.id}>
                          <td>{s.company_name}</td>
                          <td>{s.contact_name ?? '—'}</td>
                          <td>{s.email ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="admin-muted" style={{ marginTop: '1rem' }}>
            <Link to="/admin/users/create">Create user</Link> to add staff, customers, or suppliers.
          </p>
        </div>
      )}
    </div>
  )
}
