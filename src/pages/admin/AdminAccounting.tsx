import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { AccountTransactionRow, CustomerProfileRow, OrderRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

type TxType = AccountTransactionRow['type']

function fmtGBP(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

export default function AdminAccounting() {
  const { allowed: canView } = usePermission('accounts.view', 'view')
  const { allowed: canReceive } = usePermission('accounts.receive_payments', 'create')
  const { allowed: canAdjust } = usePermission('accounts.adjust_balances', 'create')

  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<CustomerProfileRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [tx, setTx] = useState<AccountTransactionRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [newTxOpen, setNewTxOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'payment' as TxType,
    amount: '',
    reference: '',
    note: '',
    order_id: '',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: profiles } = await supabase.from('customer_profiles').select('*').order('company_name')
      setCustomers((profiles ?? []) as CustomerProfileRow[])
      setSelectedUserId((profiles?.[0]?.user_id as string) ?? '')
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadCustomer() {
      if (!selectedUserId) {
        setTx([])
        setOrders([])
        return
      }
      const [txRes, orderRes] = await Promise.all([
        supabase.from('account_transactions').select('*').eq('customer_user_id', selectedUserId).order('created_at', { ascending: false }).limit(200),
        supabase.from('orders').select('*').eq('user_id', selectedUserId).order('created_at', { ascending: false }).limit(200),
      ])
      setTx((txRes.data ?? []) as AccountTransactionRow[])
      setOrders((orderRes.data ?? []) as OrderRow[])
    }
    loadCustomer()
  }, [selectedUserId])

  const running = useMemo(() => {
    const chronological = [...tx].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let balance = 0
    const withBalance = chronological.map((t) => {
      balance += Number(t.amount || 0)
      return { ...t, balance_after: balance }
    })
    return { withBalance: withBalance.reverse(), balance }
  }, [tx])

  const overdue = useMemo(() => {
    // Lightweight: use customer_profiles.balance_outstanding as headline and list unpaid invoiced orders
    const invoiced = orders.filter((o) => o.status === 'invoiced')
    return invoiced.slice(0, 50)
  }, [orders])

  async function saveTx() {
    if (!selectedUserId || saving) return
    const amt = parseFloat(form.amount)
    if (!Number.isFinite(amt) || amt === 0) return
    setSaving(true)
    setMessage(null)
    const amount = form.type === 'invoice' || form.type === 'adjustment' ? Math.abs(amt) : -Math.abs(amt)
    const payload = {
      customer_user_id: selectedUserId,
      type: form.type,
      amount,
      order_id: form.order_id || null,
      reference: form.reference.trim() || null,
      note: form.note.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('account_transactions').insert(payload)
    if (error) setMessage({ type: 'err', text: error.message })
    else {
      setMessage({ type: 'ok', text: 'Transaction added.' })
      setNewTxOpen(false)
      setForm({ type: 'payment', amount: '', reference: '', note: '', order_id: '' })
      const { data } = await supabase.from('account_transactions').select('*').eq('customer_user_id', selectedUserId).order('created_at', { ascending: false }).limit(200)
      setTx((data ?? []) as AccountTransactionRow[])
    }
    setSaving(false)
  }

  if (!canView) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <h2>No access</h2>
          <p>You don&apos;t have permission to view accounting.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading accounting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Accounting</span>
      </div>

      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="card admin-card">
        <h2 style={{ marginTop: 0 }}>Working with customers</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Use tickets for invoice queries, statement disputes, and payment plans. Open the customer to adjust profile and payment terms, or jump to their orders from the list below.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Link
            to={selectedUserId ? `/admin/tickets?customer=${selectedUserId}` : '/admin/tickets'}
            className="btn btn-small btn-outline"
          >
            Tickets for this customer
          </Link>
          {selectedUserId ? (
            <Link to={`/admin/customers/${selectedUserId}`} className="btn btn-small btn-outline">
              Customer profile
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card admin-card">
        <div className="admin-inline-form--stack">
          <label>
            Customer{' '}
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.company_name} {c.contact_name ? `· ${c.contact_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-muted">
            Balance (statement): <strong>{fmtGBP(running.balance)}</strong>
          </div>
          {(canReceive || canAdjust) && (
            <button type="button" className="btn btn-small" onClick={() => setNewTxOpen(true)}>
              Add transaction
            </button>
          )}
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card admin-card">
          <h2>Statement</h2>
          {running.withBalance.length === 0 ? (
            <p className="admin-muted">No transactions yet.</p>
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
                  {running.withBalance.map((t: any) => (
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
        </div>

        <div className="card admin-card">
          <h2>Invoiced orders</h2>
          {overdue.length === 0 ? (
            <p className="admin-muted">No invoiced orders.</p>
          ) : (
            <ul className="admin-report-list">
              {overdue.map((o) => (
                <li key={o.id} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    <Link to={`/admin/orders/${o.id}`}>{o.reference ?? o.id.slice(0, 8)}</Link>
                    <span className="admin-muted"> · {new Date(o.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="admin-report-list-value">{fmtGBP(Number(o.total_inc_vat || 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {newTxOpen && (
        <div className="admin-modal-backdrop" onClick={() => setNewTxOpen(false)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3>Add transaction</h3>
            <div className="admin-modal-form">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TxType }))}
              >
                <option value="payment" disabled={!canReceive}>Payment</option>
                <option value="credit_note" disabled={!canAdjust}>Credit note</option>
                <option value="invoice" disabled={!canAdjust}>Invoice</option>
                <option value="adjustment" disabled={!canAdjust}>Adjustment</option>
              </select>
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 250.00"
              />
              <label>Order (optional)</label>
              <select value={form.order_id} onChange={(e) => setForm((f) => ({ ...f, order_id: e.target.value }))}>
                <option value="">—</option>
                {orders.slice(0, 50).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.reference ?? o.id.slice(0, 8)} · {o.status} · {fmtGBP(Number(o.total_inc_vat || 0))}
                  </option>
                ))}
              </select>
              <label>Reference</label>
              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Optional reference" />
              <label>Note</label>
              <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note" />
              <div className="admin-modal-actions">
                <button type="button" className="btn" onClick={saveTx} disabled={saving || !form.amount}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setNewTxOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

