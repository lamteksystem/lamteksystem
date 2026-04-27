import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerProfileRow, CustomerNoteRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

type CustomerWithNote = CustomerProfileRow & { last_note?: CustomerNoteRow | null }

export default function AdminCrmDirectory() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [customers, setCustomers] = useState<CustomerWithNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    async function load() {
      const [profilesRes, notesRes] = await Promise.all([
        supabase.from('customer_profiles').select('*').order('company_name'),
        supabase.from('customer_notes').select('*').order('created_at', { ascending: false }).limit(2000),
      ])
      const list = (profilesRes.data ?? []) as CustomerProfileRow[]
      const userIds = list.map((c) => c.user_id)
      const notesByCustomer = new Map<string, CustomerNoteRow[]>()
      for (const n of (notesRes.data ?? []) as CustomerNoteRow[]) {
        if (!userIds.includes(n.customer_user_id)) continue
        if (!notesByCustomer.has(n.customer_user_id)) notesByCustomer.set(n.customer_user_id, [])
        notesByCustomer.get(n.customer_user_id)!.push(n)
      }
      const withNotes: CustomerWithNote[] = list.map((c) => ({
        ...c,
        last_note: (notesByCustomer.get(c.user_id) ?? [])[0] ?? null,
      }))
      setCustomers(withNotes)
      setLoading(false)
    }
    load()
  }, [canView])

  if (!canView) {
    return (
      <div className="card admin-card">
        <p>You don&apos;t have permission to view the directory.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-loading-state">
        <div className="admin-loading-spinner" aria-hidden />
        <p>Loading directory…</p>
      </div>
    )
  }

  return (
    <>
      <p className="page-intro" style={{ marginTop: 0 }}>
        Cards with the latest internal note per company. For the full table, use{' '}
        <Link to="/admin/customers">Customers</Link>.
      </p>
      <div className="admin-crm-grid">
        {customers.length === 0 ? (
          <div className="card admin-card">
            <p className="admin-muted">No customer profiles yet.</p>
            <Link to="/admin/customers">View customers</Link>
          </div>
        ) : (
          customers.map((c) => (
            <div key={c.id} className="card admin-card admin-crm-card">
              <div className="admin-crm-card-head">
                <Link to={`/admin/customers/${c.user_id}`} className="admin-crm-card-title">
                  {c.company_name}
                </Link>
                <span className="admin-crm-card-contact">{c.contact_name ?? '—'}</span>
              </div>
              <div className="admin-crm-card-meta">Balance: £{Number(c.balance_outstanding).toFixed(2)}</div>
              {c.last_note ? (
                <div className="admin-crm-card-note">
                  <p className="admin-crm-note-preview">
                    {c.last_note.body.slice(0, 120)}
                    {c.last_note.body.length > 120 ? '…' : ''}
                  </p>
                  <span className="admin-crm-note-date">{new Date(c.last_note.created_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <p className="admin-crm-no-note">No notes yet</p>
              )}
              <div className="admin-crm-card-actions">
                <Link to={`/admin/customers/${c.user_id}`} className="btn btn-small btn-outline">
                  View &amp; add notes
                </Link>
                <Link to={`/admin/create-order?customer=${c.user_id}`} className="btn btn-small">
                  Create order
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
