import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerProfileRow, CustomerNoteRow, OrderRow, CustomerGroupRow, CustomerLocationRow, TradeTypeRow, CompanyTypeRow, OpportunityRow, ActivityRow, AccountTransactionRow } from '@/types/database'

export default function AdminCustomerDetail() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<CustomerProfileRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [tx, setTx] = useState<AccountTransactionRow[]>([])
  const [accountTab, setAccountTab] = useState<'summary' | 'statement' | 'invoices'>('summary')
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountMsg, setAccountMsg] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [quickTxType, setQuickTxType] = useState<'payment' | 'credit_note' | 'adjustment'>('payment')
  const [quickTxAmount, setQuickTxAmount] = useState('')
  const [quickTxRef, setQuickTxRef] = useState('')
  const [quickTxNote, setQuickTxNote] = useState('')
  const [quickTxOrderId, setQuickTxOrderId] = useState('')
  const [notes, setNotes] = useState<CustomerNoteRow[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [groups, setGroups] = useState<CustomerGroupRow[]>([])
  const [locations, setLocations] = useState<CustomerLocationRow[]>([])
  const [tradeTypes, setTradeTypes] = useState<TradeTypeRow[]>([])
  const [companyTypes, setCompanyTypes] = useState<CompanyTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [newOppName, setNewOppName] = useState('')
  const [newOppStage, setNewOppStage] = useState('lead')
  const [newOppValue, setNewOppValue] = useState('')
  const [addingOpp, setAddingOpp] = useState(false)
  const [newActType, setNewActType] = useState('call')
  const [newActSubject, setNewActSubject] = useState('')
  const [newActDue, setNewActDue] = useState('')
  const [addingAct, setAddingAct] = useState(false)
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false)
  const [showCrmPanels, setShowCrmPanels] = useState(false)
  const [balanceRecalcBusy, setBalanceRecalcBusy] = useState(false)
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_name: '',
    payment_terms: '',
    customer_group_id: '' as string,
    customer_location_id: '' as string,
    trade_type_id: '' as string,
    company_type_id: '' as string,
    phone: '',
    email_override: '',
    website: '',
    billing_address: '',
    billing_city: '',
    billing_postcode: '',
    delivery_address: '',
    delivery_city: '',
    delivery_postcode: '',
    credit_limit: '' as string,
    company_notes: '',
    employee_count: '' as string,
  })

  useEffect(() => {
    if (!userId) return
    async function load() {
      const [profileRes, ordersRes, txRes, notesRes, oppsRes, actsRes, groupsRes, locationsRes, tradeRes, companyRes] = await Promise.all([
        supabase.from('customer_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('account_transactions').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('customer_notes').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false }),
        supabase.from('opportunities').select('*').eq('customer_user_id', userId).order('updated_at', { ascending: false }),
        supabase.from('activities').select('*').eq('customer_user_id', userId).order('due_at', { ascending: true, nullsFirst: false }),
        supabase.from('customer_groups').select('*').order('sort_order').order('name'),
        supabase.from('customer_locations').select('*').order('sort_order').order('name'),
        supabase.from('trade_types').select('*').order('sort_order').order('name'),
        supabase.from('company_types').select('*').order('sort_order').order('name'),
      ])
      const p = profileRes.data as CustomerProfileRow | null
      setProfile(p ?? null)
      if (p) setEditForm({
        company_name: p.company_name || '',
        contact_name: p.contact_name || '',
        payment_terms: p.payment_terms ?? '',
        customer_group_id: p.customer_group_id ?? '',
        customer_location_id: p.customer_location_id ?? '',
        trade_type_id: p.trade_type_id ?? '',
        company_type_id: p.company_type_id ?? '',
        phone: p.phone ?? '',
        email_override: p.email_override ?? '',
        website: p.website ?? '',
        billing_address: p.billing_address ?? '',
        billing_city: p.billing_city ?? '',
        billing_postcode: p.billing_postcode ?? '',
        delivery_address: p.delivery_address ?? '',
        delivery_city: p.delivery_city ?? '',
        delivery_postcode: p.delivery_postcode ?? '',
        credit_limit: p.credit_limit != null ? String(p.credit_limit) : '',
        company_notes: p.company_notes ?? '',
        employee_count: p.employee_count != null ? String(p.employee_count) : '',
      })
      setOrders(ordersRes.data ?? [])
      if (txRes.error) {
        setAccountError(txRes.error.message)
        setTx([])
      } else {
        setAccountError(null)
        setTx((txRes.data ?? []) as AccountTransactionRow[])
      }
      setNotes((notesRes.data ?? []) as CustomerNoteRow[])
      setOpportunities((oppsRes.data ?? []) as OpportunityRow[])
      setActivities((actsRes.data ?? []) as ActivityRow[])
      setGroups((groupsRes.data ?? []) as CustomerGroupRow[])
      setLocations((locationsRes.data ?? []) as CustomerLocationRow[])
      setTradeTypes((tradeRes.data ?? []) as TradeTypeRow[])
      setCompanyTypes((companyRes.data ?? []) as CompanyTypeRow[])
      setLoading(false)
    }
    load()
  }, [userId])

  function fmtGBP(n: number) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
  }

  const statement = useMemo(() => {
    const chronological = [...tx].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let balance = 0
    const withBalance = chronological.map((t) => {
      balance += Number(t.amount || 0)
      return { ...t, balance_after: balance }
    })
    return { balance, rows: withBalance.reverse() }
  }, [tx])

  const invoiceSummary = useMemo(() => {
    const invoicedOrders = orders.filter((o) => o.status === 'invoiced')
    const paidOrders = orders.filter((o) => o.status === 'paid')
    const placedOrders = orders.filter((o) => o.status === 'placed')

    const byOrder: Record<string, { invoice: number; payments: number; credits: number; net: number }> = {}
    for (const t of tx) {
      if (!t.order_id) continue
      const k = t.order_id
      if (!byOrder[k]) byOrder[k] = { invoice: 0, payments: 0, credits: 0, net: 0 }
      const amt = Number(t.amount || 0)
      byOrder[k].net += amt
      if (t.type === 'invoice') byOrder[k].invoice += amt
      else if (t.type === 'payment') byOrder[k].payments += amt
      else if (t.type === 'credit_note') byOrder[k].credits += amt
    }

    const openInvoices = invoicedOrders
      .map((o) => {
        const net = byOrder[o.id]?.net ?? Number(o.total_inc_vat || 0)
        return { order: o, net }
      })
      .filter((x) => x.net > 0.01)
      .sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime())

    return {
      invoicedCount: invoicedOrders.length,
      paidCount: paidOrders.length,
      placedCount: placedOrders.length,
      openInvoices,
    }
  }, [orders, tx])

  const accountKpis = useMemo(() => {
    const invoicedAmount = orders
      .filter((o) => o.status === 'invoiced' || o.status === 'paid')
      .reduce((sum, o) => sum + Number(o.total_inc_vat || 0), 0)
    const pendingAmount = orders
      .filter((o) => o.status === 'placed' || o.status === 'quotation')
      .reduce((sum, o) => sum + Number(o.total_inc_vat || 0), 0)
    const paidAmount = Math.abs(
      tx
        .filter((t) => t.type === 'payment')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    )
    return { invoicedAmount, pendingAmount, paidAmount }
  }, [orders, tx])

  const invoiceAging = useMemo(() => {
    const now = Date.now()
    let current = 0
    let d30 = 0
    let d60 = 0
    let d90 = 0
    for (const { order, net } of invoiceSummary.openInvoices) {
      const ageDays = Math.floor((now - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))
      if (ageDays <= 30) current += Number(net || 0)
      else if (ageDays <= 60) d30 += Number(net || 0)
      else if (ageDays <= 90) d60 += Number(net || 0)
      else d90 += Number(net || 0)
    }
    return { current, d30, d60, d90 }
  }, [invoiceSummary.openInvoices])

  async function refreshAccounting() {
    if (!userId) return
    const [txRes, profileRes] = await Promise.all([
      supabase.from('account_transactions').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false }).limit(500),
      supabase.from('customer_profiles').select('*').eq('user_id', userId).maybeSingle(),
    ])
    if (!txRes.error) setTx((txRes.data ?? []) as AccountTransactionRow[])
    if (!profileRes.error && profileRes.data) setProfile(profileRes.data as CustomerProfileRow)
  }

  async function recalcBalanceFromLedger() {
    if (!userId || balanceRecalcBusy) return
    setBalanceRecalcBusy(true)
    setAccountMsg(null)
    const { error } = await supabase.rpc('staff_recalc_customer_balance', { p_customer_user_id: userId })
    if (error) setAccountMsg(error.message)
    else {
      setAccountMsg('Balance recalculated from ledger.')
      await refreshAccounting()
    }
    setBalanceRecalcBusy(false)
  }

  async function saveQuickTx() {
    if (!userId || accountSaving) return
    const amt = parseFloat(quickTxAmount)
    if (!Number.isFinite(amt) || amt <= 0) return
    setAccountSaving(true)
    setAccountMsg(null)
    const amount =
      quickTxType === 'payment' || quickTxType === 'credit_note'
        ? -Math.abs(amt)
        : Math.abs(amt)
    const { error } = await supabase.from('account_transactions').insert({
      customer_user_id: userId,
      type: quickTxType,
      amount,
      order_id: quickTxOrderId || null,
      reference: quickTxRef.trim() || null,
      note: quickTxNote.trim() || null,
      updated_at: new Date().toISOString(),
    })
    if (error) setAccountMsg(error.message)
    else {
      setQuickTxAmount('')
      setQuickTxRef('')
      setQuickTxNote('')
      setQuickTxOrderId('')
      setAccountMsg('Account transaction saved.')
      await refreshAccounting()
    }
    setAccountSaving(false)
  }

  async function addNote() {
    if (!userId || !noteBody.trim() || addingNote) return
    setAddingNote(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('customer_notes').insert({
      customer_user_id: userId,
      author_user_id: user?.id ?? null,
      body: noteBody.trim(),
    })
    if (!error) {
      const { data } = await supabase.from('customer_notes').select('*').eq('customer_user_id', userId).order('created_at', { ascending: false })
      setNotes((data ?? []) as CustomerNoteRow[])
      setNoteBody('')
    }
    setAddingNote(false)
  }

  const OPP_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
  const ACT_TYPES = ['call', 'email', 'task', 'meeting'] as const

  async function addOpportunity() {
    if (!userId || !newOppName.trim() || addingOpp) return
    setAddingOpp(true)
    const { error } = await supabase.from('opportunities').insert({
      customer_user_id: userId,
      name: newOppName.trim(),
      stage: newOppStage,
      value_ex_vat: parseFloat(newOppValue) || 0,
    })
    if (!error) {
      const { data } = await supabase.from('opportunities').select('*').eq('customer_user_id', userId).order('updated_at', { ascending: false })
      setOpportunities((data ?? []) as OpportunityRow[])
      setNewOppName('')
      setNewOppValue('')
    }
    setAddingOpp(false)
  }

  async function addActivity() {
    if (!userId || addingAct) return
    setAddingAct(true)
    const { error } = await supabase.from('activities').insert({
      customer_user_id: userId,
      activity_type: newActType,
      subject: newActSubject.trim() || null,
      due_at: newActDue ? `${newActDue}T23:59:59Z` : null,
    })
    if (!error) {
      const { data } = await supabase.from('activities').select('*').eq('customer_user_id', userId).order('due_at', { ascending: true, nullsFirst: false })
      setActivities((data ?? []) as ActivityRow[])
      setNewActSubject('')
      setNewActDue('')
    }
    setAddingAct(false)
  }

  async function markActivityDone(activityId: string) {
    if (!userId) return
    const completed_at = new Date().toISOString()
    const { error } = await supabase
      .from('activities')
      .update({ completed_at, updated_at: completed_at })
      .eq('id', activityId)
    if (!error) {
      const { data } = await supabase.from('activities').select('*').eq('customer_user_id', userId).order('due_at', { ascending: true, nullsFirst: false })
      setActivities((data ?? []) as ActivityRow[])
    }
  }

  async function saveProfile() {
    if (!profile?.id || saving) return
    setSaving(true)
    const payload = {
      company_name: editForm.company_name,
      contact_name: editForm.contact_name || null,
      payment_terms: editForm.payment_terms || null,
      customer_group_id: editForm.customer_group_id || null,
      customer_location_id: editForm.customer_location_id || null,
      trade_type_id: editForm.trade_type_id || null,
      company_type_id: editForm.company_type_id || null,
      phone: editForm.phone || null,
      email_override: editForm.email_override || null,
      website: editForm.website || null,
      billing_address: editForm.billing_address || null,
      billing_city: editForm.billing_city || null,
      billing_postcode: editForm.billing_postcode || null,
      delivery_address: editForm.delivery_address || null,
      delivery_city: editForm.delivery_city || null,
      delivery_postcode: editForm.delivery_postcode || null,
      credit_limit: editForm.credit_limit !== '' ? parseFloat(editForm.credit_limit) || null : null,
      company_notes: editForm.company_notes || null,
      employee_count: editForm.employee_count !== '' ? parseInt(editForm.employee_count, 10) || null : null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('customer_profiles').update(payload).eq('id', profile.id)
    setProfile((prev) => prev ? { ...prev, ...payload } : null)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading customer…</p>
        </div>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Customer not found.</p>
          <Link to="/admin/customers" className="btn btn-outline">← Customers</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/customers">Customers</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{profile.company_name}</span>
        </span>
        <div className="admin-page-header-actions">
          <Link to={`/admin/create-order?customer=${userId}`} className="btn btn-small">Create order</Link>
          <Link to="/admin/customers" className="btn btn-outline btn-small">← Customers</Link>
        </div>
      </div>

      {!profile.staff_portal_access_consent_at ? (
        <div className="card admin-card" style={{ borderColor: 'var(--lamtek-gold, #b8860b)', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Staff portal access not recorded.</strong> This customer must accept the authorisation under{' '}
            <em>My account → Staff portal access</em> before anyone can use <strong>View as customer</strong>.
          </p>
        </div>
      ) : (
        <p className="admin-muted" style={{ marginBottom: '1rem' }}>
          Staff portal access accepted{' '}
          {profile.staff_portal_access_consent_at
            ? new Date(profile.staff_portal_access_consent_at).toLocaleString()
            : ''}
          {profile.staff_portal_access_consent_version ? ` (policy ${profile.staff_portal_access_consent_version})` : ''}.
        </p>
      )}

      <div className="admin-detail-grid">
        <div className="card admin-card">
          <h2>Profile</h2>
          <p className="admin-muted" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            Core details first. Expand advanced profile fields only when needed.
          </p>
          <div className="admin-detail-form admin-detail-form--two-col">
            <label>Company name</label>
            <input
              value={editForm.company_name}
              onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
            />
            <label>Contact name</label>
            <input
              value={editForm.contact_name}
              onChange={(e) => setEditForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
            <label>Balance outstanding (£)</label>
            <p className="admin-muted" style={{ margin: 0 }}>
              {fmtGBP(Number(profile.balance_outstanding || 0))} — derived from account transactions (not editable here).
            </p>
            <label>Payment terms</label>
            <input
              value={editForm.payment_terms}
              onChange={(e) => setEditForm((f) => ({ ...f, payment_terms: e.target.value }))}
              placeholder="e.g. Net 7, Net 30, Due on receipt"
            />
            <button
              type="button"
              className={`btn btn-small ${showAdvancedProfile ? 'active' : 'btn-outline'}`}
              onClick={() => setShowAdvancedProfile((v) => !v)}
            >
              {showAdvancedProfile ? 'Hide advanced profile fields' : 'Show advanced profile fields'}
            </button>
            {showAdvancedProfile && (
              <>
            <h3 className="admin-detail-section-title">Contact &amp; company</h3>
            <label>Phone</label>
            <input
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Company phone"
            />
            <label>Email (billing/contact)</label>
            <input
              type="email"
              value={editForm.email_override}
              onChange={(e) => setEditForm((f) => ({ ...f, email_override: e.target.value }))}
              placeholder="Override if different from login"
            />
            <label>Website</label>
            <input
              type="url"
              value={editForm.website}
              onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://"
            />
            <label>Credit limit (£)</label>
            <input
              type="number"
              step="0.01"
              value={editForm.credit_limit}
              onChange={(e) => setEditForm((f) => ({ ...f, credit_limit: e.target.value }))}
              placeholder="Optional"
            />
            <label>Employee count</label>
            <input
              type="number"
              min={0}
              value={editForm.employee_count}
              onChange={(e) => setEditForm((f) => ({ ...f, employee_count: e.target.value }))}
              placeholder="Optional (e.g. for pricing rules)"
            />
            <label>Company notes (internal)</label>
            <textarea
              value={editForm.company_notes}
              onChange={(e) => setEditForm((f) => ({ ...f, company_notes: e.target.value }))}
              placeholder="Internal CRM notes about this company"
              rows={2}
              className="admin-detail-textarea"
            />
            <h3 className="admin-detail-section-title">Billing address</h3>
            <label>Address</label>
            <input
              value={editForm.billing_address}
              onChange={(e) => setEditForm((f) => ({ ...f, billing_address: e.target.value }))}
              placeholder="Street, building"
            />
            <div className="admin-detail-form-row">
              <label>City<input value={editForm.billing_city} onChange={(e) => setEditForm((f) => ({ ...f, billing_city: e.target.value }))} placeholder="City" /></label>
              <label>Postcode<input value={editForm.billing_postcode} onChange={(e) => setEditForm((f) => ({ ...f, billing_postcode: e.target.value }))} placeholder="Postcode" /></label>
            </div>
            <h3 className="admin-detail-section-title">Delivery address</h3>
            <label>Address</label>
            <input
              value={editForm.delivery_address}
              onChange={(e) => setEditForm((f) => ({ ...f, delivery_address: e.target.value }))}
              placeholder="Street, building"
            />
            <div className="admin-detail-form-row">
              <label>City<input value={editForm.delivery_city} onChange={(e) => setEditForm((f) => ({ ...f, delivery_city: e.target.value }))} placeholder="City" /></label>
              <label>Postcode<input value={editForm.delivery_postcode} onChange={(e) => setEditForm((f) => ({ ...f, delivery_postcode: e.target.value }))} placeholder="Postcode" /></label>
            </div>
            <h3 className="admin-detail-section-title">Pricing segments</h3>
            <p className="admin-muted" style={{ marginBottom: '0.5rem' }}>Used for customer price rules and promotions.</p>
            <label>Customer group</label>
            <select
              value={editForm.customer_group_id}
              onChange={(e) => setEditForm((f) => ({ ...f, customer_group_id: e.target.value }))}
            >
              <option value="">— None —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <label>Location</label>
            <select
              value={editForm.customer_location_id}
              onChange={(e) => setEditForm((f) => ({ ...f, customer_location_id: e.target.value }))}
            >
              <option value="">— None —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label>Trade type</label>
            <select
              value={editForm.trade_type_id}
              onChange={(e) => setEditForm((f) => ({ ...f, trade_type_id: e.target.value }))}
            >
              <option value="">— None —</option>
              {tradeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label>Company type</label>
            <select
              value={editForm.company_type_id}
              onChange={(e) => setEditForm((f) => ({ ...f, company_type_id: e.target.value }))}
            >
              <option value="">— None —</option>
              {companyTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="admin-muted" title="Internal identifier (Supabase auth user_id)">
              Customer ref: <code>{profile.customer_ref ?? '—'}</code>{' '}
              <span className="admin-muted">(user_id: {userId?.slice(0, 8)}…)</span>
            </p>
              </>
            )}
            <button type="button" className="btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="card admin-card">
          <h2>Account &amp; billing</h2>
          <div className="admin-inline-form--stack" style={{ marginBottom: '0.75rem' }}>
            <div className="admin-order-history-tabs" role="tablist" aria-label="Account & billing tabs">
              <button type="button" className={`admin-tab ${accountTab === 'summary' ? 'active' : ''}`} onClick={() => setAccountTab('summary')} role="tab" aria-selected={accountTab === 'summary'}>
                Summary
              </button>
              <button type="button" className={`admin-tab ${accountTab === 'statement' ? 'active' : ''}`} onClick={() => setAccountTab('statement')} role="tab" aria-selected={accountTab === 'statement'}>
                Statement
              </button>
              <button type="button" className={`admin-tab ${accountTab === 'invoices' ? 'active' : ''}`} onClick={() => setAccountTab('invoices')} role="tab" aria-selected={accountTab === 'invoices'}>
                Invoices
              </button>
            </div>
            <span className="admin-muted" title="Statement balance is calculated from account transactions.">
              Statement balance: <strong>{fmtGBP(statement.balance)}</strong>
            </span>
          </div>

          {accountError && (
            <div className="admin-confirm-box" role="alert">
              <p>
                Accounting data isn't available yet. ({accountError}) Run the accounting migrations to enable statements and balances.
              </p>
            </div>
          )}

          {accountTab === 'summary' && (
            <div className="admin-customer-account-summary">
              <div className="admin-customer-account-grid">
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Credit limit</strong></p>
                  <p style={{ marginTop: 0 }}>{profile.credit_limit != null ? fmtGBP(Number(profile.credit_limit)) : '—'}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Balance outstanding (ledger)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(Number(statement.balance || 0))}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Open invoices</strong></p>
                  <p style={{ marginTop: 0 }}>{invoiceSummary.openInvoices.length}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Orders</strong></p>
                  <p style={{ marginTop: 0 }}>
                    Placed: {invoiceSummary.placedCount} · Invoiced: {invoiceSummary.invoicedCount} · Paid: {invoiceSummary.paidCount}
                  </p>
                </div>
              </div>
              <div className="admin-customer-account-grid" style={{ marginTop: '0.5rem' }}>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Amount invoiced</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(accountKpis.invoicedAmount)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Amount pending</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(accountKpis.pendingAmount)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Amount paid</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(accountKpis.paidAmount)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Profile balance (sync copy)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(Number(profile.balance_outstanding || 0))}</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    style={{ marginTop: '0.35rem' }}
                    onClick={() => recalcBalanceFromLedger()}
                    disabled={balanceRecalcBusy}
                  >
                    {balanceRecalcBusy ? 'Recalculating…' : 'Recalculate from ledger'}
                  </button>
                </div>
              </div>
              <div className="admin-customer-account-grid" style={{ marginTop: '0.5rem' }}>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Aging (0-30)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(invoiceAging.current)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Aging (31-60)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(invoiceAging.d30)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Aging (61-90)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(invoiceAging.d60)}</p>
                </div>
                <div>
                  <p className="admin-muted" style={{ marginTop: 0 }}><strong>Aging (90+)</strong></p>
                  <p style={{ marginTop: 0 }}>{fmtGBP(invoiceAging.d90)}</p>
                </div>
              </div>
              <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
                <p className="admin-muted" style={{ margin: 0 }}>
                  Quick account action
                </p>
                <select value={quickTxType} onChange={(e) => setQuickTxType(e.target.value as typeof quickTxType)}>
                  <option value="payment">Record payment</option>
                  <option value="credit_note">Issue credit note</option>
                  <option value="adjustment">Adjustment</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={quickTxAmount}
                  onChange={(e) => setQuickTxAmount(e.target.value)}
                  placeholder="Amount"
                />
                <select value={quickTxOrderId} onChange={(e) => setQuickTxOrderId(e.target.value)}>
                  <option value="">Order (optional)</option>
                  {orders.slice(0, 100).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.reference ?? o.id.slice(0, 8)} · {o.status}
                    </option>
                  ))}
                </select>
                <input value={quickTxRef} onChange={(e) => setQuickTxRef(e.target.value)} placeholder="Reference (optional)" />
                <input value={quickTxNote} onChange={(e) => setQuickTxNote(e.target.value)} placeholder="Note (optional)" />
                <div className="admin-table-actions">
                  <button type="button" className="btn btn-small" onClick={saveQuickTx} disabled={accountSaving || !quickTxAmount}>
                    {accountSaving ? 'Saving…' : 'Save action'}
                  </button>
                  <button type="button" className="btn btn-small btn-outline" onClick={refreshAccounting} disabled={accountSaving}>
                    Refresh balances
                  </button>
                </div>
                {accountMsg && <p className="admin-muted" style={{ margin: 0 }}>{accountMsg}</p>}
              </div>
              <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
                Open full accounting view: <Link to="/admin/accounting">Accounting</Link>
              </p>
            </div>
          )}

          {accountTab === 'statement' && (
            <>
              {statement.rows.length === 0 ? (
                <p className="admin-muted">No statement lines yet.</p>
              ) : (
                <div className="admin-table-wrap admin-table-wrap--compact">
                  <table className="admin-table">
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
                      {statement.rows.slice(0, 200).map((t: any) => (
                        <tr key={t.id}>
                          <td>{new Date(t.created_at).toLocaleDateString()}</td>
                          <td title={t.note ?? undefined}>
                            {t.type}
                            {t.return_line_id ? <span className="admin-muted"> · return</span> : null}
                          </td>
                          <td>{t.reference ?? '—'}</td>
                          <td>{t.order_id ? <Link to={`/admin/orders/${t.order_id}`}>{t.order_id.slice(0, 8)}</Link> : '—'}</td>
                          <td className="admin-right">{fmtGBP(Number(t.amount || 0))}</td>
                          <td className="admin-right">{fmtGBP(Number(t.balance_after || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {accountTab === 'invoices' && (
            <>
              {invoiceSummary.openInvoices.length === 0 ? (
                <p className="admin-muted">No open invoices.</p>
              ) : (
                <ul className="admin-report-list">
                  {invoiceSummary.openInvoices.slice(0, 50).map(({ order, net }) => (
                    <li key={order.id} className="admin-report-list-item">
                      <span className="admin-report-list-label">
                        <Link to={`/admin/orders/${order.id}`}>{order.reference ?? order.id.slice(0, 8)}</Link>
                        <span className="admin-muted"> · {order.invoice_number ?? '—'} · {new Date(order.created_at).toLocaleDateString()}</span>
                      </span>
                      <span className="admin-report-list-value">{fmtGBP(Number(net || 0))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
                Approved return lines (support tickets) post credit notes automatically against the linked order; manual credits and payments apply here too.
              </p>
            </>
          )}
        </div>

        <div className="card admin-card">
          <h2>Orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="admin-muted">No orders yet.</p>
          ) : (
            <ul className="admin-customer-orders">
              {orders.slice(0, 20).map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`}>
                    {o.reference || o.id.slice(0, 8)} — {o.status} — £{Number(o.total_inc_vat).toFixed(2)}
                  </Link>
                  <span className="admin-muted">{new Date(o.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
          {orders.length > 20 && <p className="admin-muted">+ {orders.length - 20} more. View all via <Link to={`/admin/orders?customer=${userId}`}>Orders filtered by customer</Link>.</p>}
        </div>
        <div className="card admin-card">
          <div className="admin-card-heading-row">
            <h2 style={{ marginBottom: 0 }}>CRM workspace</h2>
            <button
              type="button"
              className={`btn btn-small ${showCrmPanels ? 'active' : 'btn-outline'}`}
              onClick={() => setShowCrmPanels((v) => !v)}
            >
              {showCrmPanels ? 'Hide CRM panels' : 'Show CRM panels'}
            </button>
          </div>
          <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
            Use this area for opportunities, activities, and notes. Keep it collapsed when focusing on profile/accounting.
          </p>
        </div>
        {showCrmPanels && (
        <>
        <div className="card admin-card">
          <h2>Opportunities ({opportunities.length})</h2>
          <div className="admin-inline-form admin-inline-form--stack">
            <input
              value={newOppName}
              onChange={(e) => setNewOppName(e.target.value)}
              placeholder="Opportunity name"
            />
            <select value={newOppStage} onChange={(e) => setNewOppStage(e.target.value)}>
              {OPP_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              type="number"
              step="0.01"
              value={newOppValue}
              onChange={(e) => setNewOppValue(e.target.value)}
              placeholder="Value £"
            />
            <button type="button" className="btn btn-small" onClick={addOpportunity} disabled={addingOpp || !newOppName.trim()}>
              {addingOpp ? 'Adding…' : 'Add'}
            </button>
          </div>
          {opportunities.length === 0 ? (
            <p className="admin-muted">No opportunities yet.</p>
          ) : (
            <ul className="admin-opportunities-list">
              {opportunities.map((o) => (
                <li key={o.id} className="admin-opportunity-item">
                  <span className="admin-opportunity-name">{o.name}</span>
                  <span className="admin-opportunity-stage">{o.stage}</span>
                  <span className="admin-opportunity-value">£{Number(o.value_ex_vat).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card admin-card">
          <h2>Activities ({activities.length})</h2>
          <div className="admin-inline-form admin-inline-form--stack">
            <select value={newActType} onChange={(e) => setNewActType(e.target.value)}>
              {ACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={newActSubject}
              onChange={(e) => setNewActSubject(e.target.value)}
              placeholder="Subject"
            />
            <input
              type="date"
              value={newActDue}
              onChange={(e) => setNewActDue(e.target.value)}
              placeholder="Due date"
            />
            <button type="button" className="btn btn-small" onClick={addActivity} disabled={addingAct}>
              {addingAct ? 'Adding…' : 'Add'}
            </button>
          </div>
          {activities.length === 0 ? (
            <p className="admin-muted">No activities yet.</p>
          ) : (
            <ul className="admin-activities-list">
              {activities.map((a) => (
                <li key={a.id} className="admin-activity-item">
                  <span className="admin-activity-type">{a.activity_type}</span>
                  <span className="admin-activity-subject">{a.subject ?? '—'}</span>
                  <span className="admin-activity-due">{a.due_at ? new Date(a.due_at).toLocaleDateString() : '—'}</span>
                  {a.completed_at && <span className="admin-activity-done">Done</span>}
                  {!a.completed_at && (
                    <button type="button" className="btn btn-small btn-outline" onClick={() => markActivityDone(a.id)}>
                      Mark done
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card admin-card admin-card--notes">
          <h2>CRM notes ({notes.length})</h2>
          <div className="admin-notes-form">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="admin-notes-input"
            />
            <button type="button" className="btn btn-small" onClick={addNote} disabled={addingNote || !noteBody.trim()}>
              {addingNote ? 'Adding…' : 'Add note'}
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="admin-muted">No notes yet.</p>
          ) : (
            <ul className="admin-notes-list">
              {notes.map((n) => (
                <li key={n.id} className="admin-note-item">
                  <p className="admin-note-body">{n.body}</p>
                  <span className="admin-note-meta">{new Date(n.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

