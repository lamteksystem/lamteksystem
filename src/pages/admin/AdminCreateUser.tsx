import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerGroupRow, CustomerLocationRow, TradeTypeRow, CompanyTypeRow } from '@/types/database'

const USER_TYPES = [
  { value: 'customer', label: 'Customer', description: 'Portal login, orders, account' },
  { value: 'staff', label: 'Staff', description: 'Staff backend access' },
  { value: 'admin', label: 'Admin', description: 'Full admin + user creation' },
  { value: 'supplier', label: 'Supplier', description: 'Supplier contact (optional login)' },
] as const

type UserType = (typeof USER_TYPES)[number]['value']

export default function AdminCreateUser() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<UserType>('customer')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [customerGroupId, setCustomerGroupId] = useState('')
  const [customerLocationId, setCustomerLocationId] = useState('')
  const [tradeTypeId, setTradeTypeId] = useState('')
  const [companyTypeId, setCompanyTypeId] = useState('')
  const [groups, setGroups] = useState<CustomerGroupRow[]>([])
  const [locations, setLocations] = useState<CustomerLocationRow[]>([])
  const [tradeTypes, setTradeTypes] = useState<TradeTypeRow[]>([])
  const [companyTypes, setCompanyTypes] = useState<CompanyTypeRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const [g, l, t, c] = await Promise.all([
        supabase.from('customer_groups').select('*').order('sort_order').order('name'),
        supabase.from('customer_locations').select('*').order('sort_order').order('name'),
        supabase.from('trade_types').select('*').order('sort_order').order('name'),
        supabase.from('company_types').select('*').order('sort_order').order('name'),
      ])
      setGroups((g.data ?? []) as CustomerGroupRow[])
      setLocations((l.data ?? []) as CustomerLocationRow[])
      setTradeTypes((t.data ?? []) as TradeTypeRow[])
      setCompanyTypes((c.data ?? []) as CompanyTypeRow[])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!email.trim() || !password.trim()) {
      setMessage({ type: 'err', text: 'Email and password required.' })
      return
    }
    if (password.length < 6) {
      setMessage({ type: 'err', text: 'Password must be at least 6 characters.' })
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMessage({ type: 'err', text: 'Not signed in.' })
        setSubmitting(false)
        return
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          type,
          company_name: (type === 'customer' || type === 'supplier') ? companyName.trim() || undefined : undefined,
          contact_name: (type === 'customer' || type === 'supplier') ? contactName.trim() || undefined : undefined,
          display_name: (type === 'staff' || type === 'admin') ? displayName.trim() || undefined : undefined,
          customer_group_id: type === 'customer' && customerGroupId ? customerGroupId : undefined,
          customer_location_id: type === 'customer' && customerLocationId ? customerLocationId : undefined,
          trade_type_id: type === 'customer' && tradeTypeId ? tradeTypeId : undefined,
          company_type_id: type === 'customer' && companyTypeId ? companyTypeId : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || `Error ${res.status}` })
        setSubmitting(false)
        return
      }
      setMessage({ type: 'ok', text: `${type} created: ${data.email}. They can sign in now.` })
      setEmail('')
      setPassword('')
      setCompanyName('')
      setContactName('')
      setDisplayName('')
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Request failed' })
    }
    setSubmitting(false)
  }

  return (
    <div className="admin-page admin-create-user-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Create user</span>
        <div className="admin-page-header-actions">
          <Link to="/admin/users" className="btn btn-outline btn-small">← All users</Link>
        </div>
      </div>
      <p className="page-intro">
        Add portal customers, staff, admins, or suppliers in one form: sign-in first, then type-specific fields. New customers can sign in immediately; open them under Customers to refine segments and notes.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="card admin-card admin-create-user-card">
        <h2 className="admin-create-user-title">Create user</h2>
        <form onSubmit={handleSubmit} className="admin-modal-form admin-create-user-form">
          <div className="admin-modal-form-section">
            <h3 className="admin-modal-form-section-title">Sign-in details</h3>
            <label>
              Email <span className="admin-required">*</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                autoComplete="off"
              />
            </label>
            <label>
              Password <span className="admin-required">*</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="admin-modal-form-section">
            <h3 className="admin-modal-form-section-title">User type</h3>
            <label>
              Role
              <select value={type} onChange={(e) => setType(e.target.value as UserType)} className="admin-create-user-select">
                {USER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(type === 'customer' || type === 'supplier') && (
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Profile (optional)</h3>
              <label>
                Company name
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={type === 'customer' ? 'Customer company' : 'Supplier company'}
                />
              </label>
              <label>
                Contact name
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact person"
                />
              </label>
            </div>
          )}
          {type === 'customer' && (
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Default pricing segment</h3>
              <p className="admin-create-user-note" style={{ marginTop: 0 }}>
                Set the customer’s pricing segment so price rules (e.g. location, company type) apply by default.
              </p>
              <label>
                Customer group
                <select value={customerGroupId} onChange={(e) => setCustomerGroupId(e.target.value)} className="admin-create-user-select">
                  <option value="">— Default —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <select value={customerLocationId} onChange={(e) => setCustomerLocationId(e.target.value)} className="admin-create-user-select">
                  <option value="">— Default —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Trade type
                <select value={tradeTypeId} onChange={(e) => setTradeTypeId(e.target.value)} className="admin-create-user-select">
                  <option value="">— Default —</option>
                  {tradeTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Company type
                <select value={companyTypeId} onChange={(e) => setCompanyTypeId(e.target.value)} className="admin-create-user-select">
                  <option value="">— Default —</option>
                  {companyTypes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(type === 'staff' || type === 'admin') && (
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Profile (optional)</h3>
              <label>
                Display name
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Name shown in admin"
                />
              </label>
            </div>
          )}
          <div className="admin-modal-actions">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
        <p className="admin-create-user-note">
          Requires the Edge Function <code>admin-create-user</code> to be deployed and <code>SUPABASE_SERVICE_ROLE_KEY</code> set in Function secrets.
        </p>
      </div>
    </div>
  )
}
