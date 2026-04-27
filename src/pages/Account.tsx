import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { useCustomerUi } from '@/contexts/CustomerUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId, useImpersonation } from '@/contexts/ImpersonationContext'
import { useAuth } from '@/hooks/useAuth'
import { STAFF_PORTAL_ACCESS_POLICY_VERSION, STAFF_PORTAL_ACCESS_SUMMARY } from '@/lib/staffPortalConsent'
import type { OrderRow, UserNotificationRow, CustomerDeliveryAddressRow } from '@/types/database'
import type { CustomerProfileRow } from '@/types/database'
import type { AccountTransactionRow } from '@/types/database'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  placed: 'Placed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export default function Account() {
  const { user } = useAuth()
  const { impersonatingUserId } = useImpersonation()
  const effectiveUserId = useEffectiveUserId()
  const isRealCustomerSession = Boolean(user?.id && effectiveUserId && user.id === effectiveUserId)
  const { useSidebarMenu, setUseSidebarMenu, sidebarAccordion, setSidebarAccordion } = useCustomerUi()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<CustomerProfileRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [transactions, setTransactions] = useState<AccountTransactionRow[]>([])
  const [notifications, setNotifications] = useState<UserNotificationRow[]>([])
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all')
  const [deliveryAddresses, setDeliveryAddresses] = useState<CustomerDeliveryAddressRow[]>([])
  const [addressSaving, setAddressSaving] = useState(false)
  const [newAddress, setNewAddress] = useState({
    label: '',
    address: '',
    postcode: '',
    notes: '',
    is_default: false,
  })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '' })
  const [orderFilter, setOrderFilter] = useState<'all' | 'open'>('all')
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest'>('newest')
  const [orderPageSize, setOrderPageSize] = useState(10)
  const [staffAccessConsent, setStaffAccessConsent] = useState(false)
  const [consentSaving, setConsentSaving] = useState(false)

  useEffect(() => {
    setOrderPageSize(10)
  }, [orderFilter, orderSort])

  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('customer_profiles').select('*').eq('user_id', effectiveUserId).maybeSingle(),
      supabase.from('orders').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }),
      supabase.from('account_transactions').select('*').eq('customer_user_id', effectiveUserId).order('created_at', { ascending: false }).limit(500),
      supabase.from('user_notifications').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(50),
      supabase.from('customer_delivery_addresses').select('*').eq('customer_user_id', effectiveUserId).order('is_default', { ascending: false }).order('created_at'),
    ]).then(([profileRes, ordersRes, txRes, notificationsRes, addressRes]) => {
      const p = profileRes.data ?? null
      setProfile(p as CustomerProfileRow | null)
      if (p) {
        const pr = p as CustomerProfileRow
        setEditForm({ company_name: pr.company_name || '', contact_name: pr.contact_name || '' })
        setStaffAccessConsent(Boolean(pr.staff_portal_access_consent_at))
      } else {
        setStaffAccessConsent(false)
      }
      setOrders(ordersRes.data ?? [])
      setTransactions((txRes.data ?? []) as AccountTransactionRow[])
      // Notifications may not exist until migration is run; fail closed.
      setNotifications(((notificationsRes?.data ?? []) as UserNotificationRow[]) ?? [])
      setDeliveryAddresses((addressRes.data ?? []) as CustomerDeliveryAddressRow[])
      setLoading(false)
    })
  }, [effectiveUserId])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markNotificationRead(id: string) {
    if (!effectiveUserId) return
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
    await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', effectiveUserId)
  }

  async function markAllNotificationsRead() {
    if (!effectiveUserId) return
    const now = new Date().toISOString()
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    await supabase
      .from('user_notifications')
      .update({ read_at: now })
      .eq('user_id', effectiveUserId)
      .is('read_at', null)
  }

  const outstanding = orders.filter((o) => ['quotation', 'placed', 'invoiced'].includes(o.status))
  const sumFromTransactions = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const displayStatementBalance =
    profile != null ? Number(profile.balance_outstanding ?? 0) : sumFromTransactions

  const statement = useMemo(() => {
    const chronological = [...transactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    let balance = 0
    const withBalance = chronological.map((t) => {
      balance += Number(t.amount || 0)
      return { ...t, balance_after: balance }
    })
    return { balance, rows: withBalance.reverse() as (AccountTransactionRow & { balance_after: number })[] }
  }, [transactions])

  function fmtGBP(n: number) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
  }

  function csvEscapeCell(value: string) {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }

  function downloadStatementCsv() {
    const header = ['Date', 'Type', 'Reference', 'Amount', 'Balance', 'Note']
    const lines = [
      header.join(','),
      ...statement.rows.map((t) =>
        [
          new Date(t.created_at).toISOString().slice(0, 10),
          t.type,
          t.reference ?? '',
          Number(t.amount || 0).toFixed(2),
          Number(t.balance_after || 0).toFixed(2),
          t.note ?? '',
        ]
          .map((c) => csvEscapeCell(String(c)))
          .join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `account-statement-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredOrders = orders
    .filter((o) => orderFilter === 'open' ? ['quotation', 'placed', 'invoiced'].includes(o.status) : true)
    .sort((a, b) => orderSort === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const visibleOrders = filteredOrders.slice(0, orderPageSize)
  const hasMoreOrders = filteredOrders.length > orderPageSize
  const visibleNotifications =
    notificationFilter === 'unread'
      ? notifications.filter((n) => !n.read_at)
      : notifications

  async function saveStaffAccessConsent(next: boolean) {
    if (!effectiveUserId || !profile?.id || consentSaving || !isRealCustomerSession) return
    setConsentSaving(true)
    const now = new Date().toISOString()
    await supabase
      .from('customer_profiles')
      .update({
        staff_portal_access_consent_at: next ? now : null,
        staff_portal_access_consent_version: next ? STAFF_PORTAL_ACCESS_POLICY_VERSION : null,
        updated_at: now,
      })
      .eq('user_id', effectiveUserId)
    setStaffAccessConsent(next)
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            staff_portal_access_consent_at: next ? now : null,
            staff_portal_access_consent_version: next ? STAFF_PORTAL_ACCESS_POLICY_VERSION : null,
          }
        : null,
    )
    setConsentSaving(false)
  }

  async function saveProfile() {
    if (!profile?.id || saving) return
    setSaving(true)
    await supabase.from('customer_profiles').update({
      company_name: editForm.company_name,
      contact_name: editForm.contact_name || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)
    setProfile((prev) => prev ? { ...prev, ...editForm } : null)
    setSaving(false)
    setEditing(false)
  }

  async function refreshAddresses() {
    if (!effectiveUserId) return
    const { data } = await supabase
      .from('customer_delivery_addresses')
      .select('*')
      .eq('customer_user_id', effectiveUserId)
      .order('is_default', { ascending: false })
      .order('created_at')
    setDeliveryAddresses((data ?? []) as CustomerDeliveryAddressRow[])
  }

  async function addDeliveryAddress() {
    if (!effectiveUserId || addressSaving || !newAddress.label.trim() || !newAddress.address.trim()) return
    setAddressSaving(true)
    await supabase.from('customer_delivery_addresses').insert({
      customer_user_id: effectiveUserId,
      label: newAddress.label.trim(),
      address: newAddress.address.trim(),
      postcode: newAddress.postcode.trim() || null,
      notes: newAddress.notes.trim() || null,
      is_default: newAddress.is_default,
      updated_at: new Date().toISOString(),
    })
    setNewAddress({ label: '', address: '', postcode: '', notes: '', is_default: false })
    await refreshAddresses()
    setAddressSaving(false)
  }

  async function deleteDeliveryAddress(id: string) {
    if (!effectiveUserId || addressSaving) return
    setAddressSaving(true)
    await supabase.from('customer_delivery_addresses').delete().eq('id', id).eq('customer_user_id', effectiveUserId)
    await refreshAddresses()
    setAddressSaving(false)
  }

  async function setDefaultDeliveryAddress(id: string) {
    if (!effectiveUserId || addressSaving) return
    setAddressSaving(true)
    await supabase
      .from('customer_delivery_addresses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_user_id', effectiveUserId)
    await refreshAddresses()
    setAddressSaving(false)
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="account-page">
      <PageNav breadcrumb={[{ label: 'My account' }]} />
      <div className="account-header">
        <h1>My account</h1>
        <p className="page-intro">Manage your profile, view orders, and preferences.</p>
      </div>

      <div className="account-grid">
        <section className="account-section account-overview card">
          <h2>Overview</h2>
          <div className="account-stats">
            <div className="account-stat">
              <span className="account-stat-value">{fmtGBP(displayStatementBalance)}</span>
              <span className="account-stat-label">Statement balance</span>
            </div>
            <div className="account-stat">
              <span className="account-stat-value">{outstanding.length}</span>
              <span className="account-stat-label">Open orders / quotations</span>
            </div>
          </div>
          <div className="account-quick-actions">
            <Link to="/ordering" className="btn">Create order</Link>
            <Link to="/downloads" className="btn btn-outline">Downloads</Link>
            <Link to="/account/support" className="btn btn-outline">Support</Link>
            <Link to="/account/help" className="btn btn-outline">Help</Link>
          </div>
        </section>

        <section className="account-section card">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Account statement</h2>
            {statement.rows.length > 0 ? (
              <button type="button" className="btn btn-outline btn-small" onClick={downloadStatementCsv}>
                Download CSV
              </button>
            ) : null}
          </div>
          <p className="admin-muted">Running balance from your ledger (newest lines first). Up to 500 recent lines are shown.</p>
          {statement.rows.length === 0 ? (
            <p className="admin-muted">No statement lines yet.</p>
          ) : (
            <div className="admin-table-wrap admin-table-wrap--compact" style={{ marginTop: '0.75rem', maxHeight: 'min(60vh, 28rem)', overflow: 'auto' }}>
              <table className="admin-table" data-testid="account-statement-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Ref</th>
                    <th>Order</th>
                    <th className="admin-right">Amount</th>
                    <th className="admin-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td title={t.note ?? undefined}>
                        {t.type}
                        {t.return_line_id ? <span className="admin-muted"> · return</span> : null}
                      </td>
                      <td>{t.reference ?? '—'}</td>
                      <td>
                        {t.order_id ? (
                          <Link to={`/account/orders/${t.order_id}`}>{t.order_id.slice(0, 8)}…</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="admin-right">{fmtGBP(Number(t.amount || 0))}</td>
                      <td className="admin-right">{fmtGBP(Number(t.balance_after || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="account-section card">
          <h2>
            Updates {unreadCount > 0 ? <span className="admin-table-paid-badge" title="Unread updates">{unreadCount} new</span> : null}
          </h2>
          <p className="admin-muted">Order updates and messages from Lamtek.</p>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="account-orders-toggle" role="group" aria-label="Filter updates">
                <button
                  type="button"
                  className={notificationFilter === 'all' ? 'active' : ''}
                  onClick={() => setNotificationFilter('all')}
                  aria-pressed={notificationFilter === 'all'}
                >
                  All
                </button>
                <button
                  type="button"
                  className={notificationFilter === 'unread' ? 'active' : ''}
                  onClick={() => setNotificationFilter('unread')}
                  aria-pressed={notificationFilter === 'unread'}
                >
                  Unread
                </button>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={markAllNotificationsRead}
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          )}
          {visibleNotifications.length === 0 ? (
            <p className="admin-muted">
              {notificationFilter === 'unread' ? 'No unread updates.' : 'No updates yet.'}
            </p>
          ) : (
            <ul className="admin-report-list" style={{ marginTop: '0.5rem' }}>
              {visibleNotifications.slice(0, 12).map((n) => (
                <li key={n.id} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    <span className="admin-muted" style={{ marginRight: '0.5rem' }}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                    {!n.read_at ? <strong title="Unread">New</strong> : null}{!n.read_at ? ' · ' : ''}
                    {n.link ? (
                      <Link to={n.link} onClick={() => markNotificationRead(n.id)}>
                        {n.title}
                      </Link>
                    ) : (
                      <span>{n.title}</span>
                    )}
                    {n.body ? <span className="admin-muted"> — {n.body}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="account-section account-profile-section card">
          <h2>Profile</h2>
          {editing ? (
            <div className="account-profile-form">
              <label>Company name</label>
              <input
                value={editForm.company_name}
                onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Company name"
              />
              <label>Contact name</label>
              <input
                value={editForm.contact_name}
                onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="Contact name"
              />
              <div className="account-profile-actions">
                <button type="button" className="btn" onClick={saveProfile} disabled={saving || !editForm.company_name.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => { setEditing(false); setEditForm({ company_name: profile?.company_name || '', contact_name: profile?.contact_name || '' }); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : profile ? (
            <>
              <p><strong>Company</strong> {profile.company_name}</p>
              <p><strong>Contact</strong> {profile.contact_name ?? '—'}</p>
              {profile.payment_terms && <p><strong>Payment terms</strong> {profile.payment_terms}</p>}
              <button type="button" className="btn btn-outline btn-small" onClick={() => setEditing(true)}>Edit profile</button>
            </>
          ) : (
            <p className="muted">No profile on file. Contact Lamtek to set up your account details, or they will be created when you place an order.</p>
          )}
        </section>

        <section className="account-section card">
          <h2>Saved delivery addresses</h2>
          <p className="admin-muted">Use saved addresses during checkout to fill delivery details quickly.</p>
          {deliveryAddresses.length === 0 ? (
            <p className="admin-muted">No saved delivery addresses yet.</p>
          ) : (
            <ul className="admin-report-list" style={{ marginTop: '0.5rem' }}>
              {deliveryAddresses.map((a) => (
                <li key={a.id} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    <strong>{a.label}</strong>
                    {a.is_default ? <span className="admin-table-paid-badge" style={{ marginLeft: '0.5rem' }}>Default</span> : null}
                    <span className="admin-muted"> · {a.address}{a.postcode ? `, ${a.postcode}` : ''}</span>
                  </span>
                  <span className="admin-report-list-value" style={{ display: 'inline-flex', gap: '0.4rem' }}>
                    {!a.is_default && (
                      <button type="button" className="btn btn-outline btn-small" onClick={() => setDefaultDeliveryAddress(a.id)} disabled={addressSaving}>
                        Make default
                      </button>
                    )}
                    <button type="button" className="btn btn-danger-outline btn-small" onClick={() => deleteDeliveryAddress(a.id)} disabled={addressSaving}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="account-profile-form" style={{ marginTop: '0.75rem' }}>
            <label>Label</label>
            <input value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Main site, Warehouse" />
            <label>Address</label>
            <textarea value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} rows={2} placeholder="Delivery address" />
            <label>Postcode</label>
            <input value={newAddress.postcode} onChange={(e) => setNewAddress((p) => ({ ...p, postcode: e.target.value }))} placeholder="Postcode" />
            <label>Notes (optional)</label>
            <input value={newAddress.notes} onChange={(e) => setNewAddress((p) => ({ ...p, notes: e.target.value }))} placeholder="Gate code, access notes" />
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={newAddress.is_default}
                onChange={(e) => setNewAddress((p) => ({ ...p, is_default: e.target.checked }))}
              />
              Set as default
            </label>
            <div>
              <button type="button" className="btn" onClick={addDeliveryAddress} disabled={addressSaving || !newAddress.label.trim() || !newAddress.address.trim()}>
                {addressSaving ? 'Saving…' : 'Save address'}
              </button>
            </div>
          </div>
        </section>

        {profile && (
          <section className="account-section card">
            <h2>Staff portal access</h2>
            {impersonatingUserId ? (
              <p className="admin-muted">
                You are viewing this account as staff. The customer must sign in themselves to change this setting.
                {profile.staff_portal_access_consent_at
                  ? ` Staff access was accepted on ${new Date(profile.staff_portal_access_consent_at).toLocaleString()}.`
                  : ' Staff access is not yet recorded for this account.'}
              </p>
            ) : isRealCustomerSession ? (
              <>
                <p className="admin-muted" style={{ marginTop: 0 }}>
                  {STAFF_PORTAL_ACCESS_SUMMARY}
                </p>
                <p className="admin-muted" style={{ fontSize: '0.85rem' }}>
                  Policy version: {STAFF_PORTAL_ACCESS_POLICY_VERSION}. You can withdraw consent at any time by unticking the box.
                </p>
                <label className="admin-checkbox-label" style={{ marginTop: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={staffAccessConsent}
                    disabled={consentSaving}
                    onChange={(e) => saveStaffAccessConsent(e.target.checked)}
                  />
                  I authorise Lamtek staff who have permission to use &quot;View as customer&quot; on my account to help with orders and service.
                </label>
                {consentSaving ? <p className="admin-muted">Saving…</p> : null}
              </>
            ) : (
              <p className="admin-muted">Sign in as this customer to manage staff access consent.</p>
            )}
          </section>
        )}

        <section className="account-section account-preferences card">
          <h2>Preferences</h2>
          <div className="account-preference-row">
            <label className="account-preference-label">Theme</label>
            <div className="account-preference-control">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeId)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--tm-gray-light)' }}
              >
                <option value="auto">Auto (system)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <p className="account-preference-hint">Colour theme for the portal. Saved to your account.</p>
          </div>
          <div className="account-preference-row">
            <label className="account-preference-label">Navigation</label>
            <div className="account-preference-control">
              <button
                type="button"
                className={`btn btn-small ${!useSidebarMenu ? 'active' : 'btn-outline'}`}
                onClick={() => setUseSidebarMenu(false)}
              >
                Top menu
              </button>
              <button
                type="button"
                className={`btn btn-small ${useSidebarMenu ? 'active' : 'btn-outline'}`}
                onClick={() => setUseSidebarMenu(true)}
              >
                Side menu
              </button>
            </div>
            <p className="account-preference-hint">Choose how you prefer to navigate the site. Your choice is saved to your account.</p>
          </div>
          {useSidebarMenu && (
            <div className="account-preference-row">
              <label className="account-preference-label">Side menu behaviour</label>
              <div className="account-preference-control">
                <label className="admin-checkbox-label" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={sidebarAccordion}
                    onChange={(e) => setSidebarAccordion(e.target.checked)}
                  />
                  Only one parent open at a time
                </label>
              </div>
              <p className="account-preference-hint">
                When enabled, opening one section closes the others. When disabled, you can keep multiple sections open and close them manually.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="account-section account-orders-section">
        <div className="account-orders-header">
          <h2>Order history</h2>
          {orders.length > 0 && (
            <div className="account-orders-controls">
              <span className="account-orders-filter-label">Show</span>
              <div className="account-orders-toggle" role="group" aria-label="Filter orders">
                <button
                  type="button"
                  className={orderFilter === 'all' ? 'active' : ''}
                  onClick={() => setOrderFilter('all')}
                  aria-pressed={orderFilter === 'all'}
                >
                  All
                </button>
                <button
                  type="button"
                  className={orderFilter === 'open' ? 'active' : ''}
                  onClick={() => setOrderFilter('open')}
                  aria-pressed={orderFilter === 'open'}
                >
                  Open only
                </button>
              </div>
              <span className="account-orders-filter-label">Sort</span>
              <select
                value={orderSort}
                onChange={(e) => setOrderSort(e.target.value as 'newest' | 'oldest')}
                className="account-orders-sort"
                aria-label="Sort order history"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          )}
        </div>
        {filteredOrders.length === 0 ? (
          <div className="card">
            <p>
              {orders.length === 0
                ? 'No orders yet. Create an order from the ordering section and save as quotation or proceed to place.'
                : 'No orders match the current filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Total ex VAT</th>
                    <th>Total inc VAT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>{order.reference ?? '—'}</td>
                      <td><span className={`order-status order-status-${order.status}`}>{STATUS_LABELS[order.status] ?? order.status}</span></td>
                      <td>£{Number(order.total_ex_vat).toFixed(2)}</td>
                      <td>£{Number(order.total_inc_vat).toFixed(2)}</td>
                      <td><Link to={`/account/orders/${order.id}`} className="order-view-link">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMoreOrders && (
              <div className="account-orders-load-more">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setOrderPageSize((n) => n + 10)}
                >
                  Load more ({filteredOrders.length - orderPageSize} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
