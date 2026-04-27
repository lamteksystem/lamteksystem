import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { TicketRow, OrderRow, OrderLineRow, ProductRow } from '@/types/database'

export default function Support() {
  const effectiveUserId = useEffectiveUserId()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderLines, setOrderLines] = useState<OrderLineRow[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductRow>>(new Map())
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    type: 'question' as TicketRow['type'],
    order_id: '',
    subject: '',
    body: '',
    selectedLineIds: new Set<string>(),
  })
  const [message, setMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [typeFilter, setTypeFilter] = useState<'all' | TicketRow['type']>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const typeParam = (searchParams.get('type') ?? '').toLowerCase()
    const orderIdParam = (searchParams.get('orderId') ?? '').trim()
    const allowedTypes: TicketRow['type'][] = ['question', 'issue', 'returns']
    const nextType = allowedTypes.includes(typeParam as TicketRow['type']) ? (typeParam as TicketRow['type']) : 'question'
    const template = (() => {
      if (nextType === 'returns') return { subject: 'Return request', body: 'Hi, I would like to request a return. Please advise next steps.' }
      if (nextType === 'issue') return { subject: 'Issue with my order', body: 'Hi, I have an issue with my order. Here are the details:' }
      return { subject: '', body: '' }
    })()
    setForm((f) => ({
      ...f,
      type: nextType,
      order_id: orderIdParam || f.order_id,
      subject: f.subject || template.subject,
      body: f.body || template.body,
      selectedLineIds: new Set<string>(),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function load() {
    if (!effectiveUserId) return
    const [tRes, oRes, pRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('customer_user_id', effectiveUserId).order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('*').eq('user_id', effectiveUserId).neq('status', 'draft').order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('id, name, sku, image_url, cost_price, unit_price, active, category_id, description, stock_quantity, options, image_alt, sort_order, created_at'),
    ])
    setTickets((tRes.data ?? []) as TicketRow[])
    setOrders((oRes.data ?? []) as OrderRow[])
    const map = new Map<string, ProductRow>()
    ;(pRes.data ?? []).forEach((p) => map.set((p as ProductRow).id, p as ProductRow))
    setProductsById(map)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId])

  const openCount = useMemo(
    () => tickets.filter((t) => t.status !== 'resolved').length,
    [tickets]
  )

  const visibleTickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter === 'open' && t.status === 'resolved') return false
      if (statusFilter === 'resolved' && t.status !== 'resolved') return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (!q) return true
      const haystack = `${t.subject} ${t.body} ${t.type} ${t.status}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [tickets, statusFilter, typeFilter, query])

  async function createTicket() {
    if (!effectiveUserId || creating) return
    if (!form.subject.trim() || !form.body.trim()) return
    setCreating(true)
    setMessage(null)
    const now = new Date().toISOString()
    const payload = {
      customer_user_id: effectiveUserId,
      type: form.type,
      order_id: form.order_id || null,
      subject: form.subject.trim(),
      body: form.body.trim(),
      status: 'open',
      priority: 2,
      updated_at: now,
    }
    const { data: inserted, error } = await supabase.from('tickets').insert(payload).select('id').single()
    if (error) setMessage(error.message)
    else {
      if (form.type === 'returns' && inserted?.id && form.selectedLineIds.size > 0) {
        const selected = orderLines.filter((l) => form.selectedLineIds.has(l.id))
        if (selected.length > 0) {
          await supabase.from('return_lines').insert(selected.map((l) => ({
            ticket_id: inserted.id,
            order_line_id: l.id,
            product_id: l.product_id,
            quantity: Number(l.quantity) || 1,
            reason: 'Return requested',
          })))
        }
      }
      setForm({ type: 'question', order_id: '', subject: '', body: '', selectedLineIds: new Set() })
      await load()
    }
    setCreating(false)
  }

  useEffect(() => {
    async function loadLines() {
      if (!form.order_id) {
        setOrderLines([])
        return
      }
      const { data } = await supabase.from('order_lines').select('*').eq('order_id', form.order_id)
      setOrderLines((data ?? []) as OrderLineRow[])
    }
    loadLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.order_id])

  function toggleLine(id: string) {
    setForm((f) => {
      const next = new Set(f.selectedLineIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...f, selectedLineIds: next }
    })
  }

  if (loading) {
    return (
      <div className="account-page">
        <PageNav breadcrumb={[{ label: 'Support' }]} />
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="account-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { label: 'Support' }]} />

      <div className="card">
        <h1 style={{ marginTop: 0 }}>Support</h1>
        <p className="muted">
          Create a ticket for returns, issues, or questions. We&apos;ll respond as soon as possible.
        </p>
        <p className="muted">Open tickets: <strong>{openCount}</strong></p>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>New ticket</h2>
        {message && <div className="login-error">{message}</div>}
        <label>Type</label>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TicketRow['type'], selectedLineIds: new Set() }))}>
          <option value="question">Question</option>
          <option value="issue">Issue</option>
          <option value="returns">Return</option>
        </select>
        <label>Order (optional)</label>
        <select value={form.order_id} onChange={(e) => setForm((f) => ({ ...f, order_id: e.target.value, selectedLineIds: new Set() }))}>
          <option value="">—</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.reference ?? o.id.slice(0, 8)} · {o.status} · {new Date(o.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>
        {form.type === 'returns' && form.order_id && orderLines.length > 0 && (
          <>
            <p className="muted" style={{ marginTop: '0.5rem' }}>Select items to return:</p>
            <ul className="admin-report-list">
              {orderLines.map((l) => (
                <li key={l.id} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={form.selectedLineIds.has(l.id)} onChange={() => toggleLine(l.id)} />
                      {(productsById.get(l.product_id)?.name ?? (l.product_snapshot as any)?.name ?? 'Product')}
                      <span className="admin-muted"> · qty {Number(l.quantity) || 0}</span>
                    </label>
                  </span>
                  <span className="admin-report-list-value">£{Number(l.unit_price || 0).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <label>Subject</label>
        <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="e.g. Missing item from order" />
        <label>Message</label>
        <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4} placeholder="Describe what happened…" />
        <button type="button" className="btn" onClick={createTicket} disabled={creating || !form.subject.trim() || !form.body.trim()}>
          {creating ? 'Sending…' : 'Create ticket'}
        </button>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Your tickets</h2>
        {tickets.length === 0 ? (
          <p className="muted">No tickets yet.</p>
        ) : (
          <>
            <div className="admin-inline-form--stack" style={{ marginTop: '0.5rem' }}>
              <label>
                Status{' '}
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label>
                Type{' '}
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
                  <option value="all">All</option>
                  <option value="question">Question</option>
                  <option value="issue">Issue</option>
                  <option value="returns">Returns</option>
                </select>
              </label>
              <label>
                Search{' '}
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Subject, type, status…"
                  className="admin-filter-input"
                />
              </label>
            </div>
            {visibleTickets.length === 0 ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                No tickets match your filters.
              </p>
            ) : (
              <ul className="admin-report-list">
                {visibleTickets.slice(0, 50).map((t) => (
                  <li key={t.id} className="admin-report-list-item">
                    <span className="admin-report-list-label">
                      <Link to={`/account/support/${t.id}`}>{t.subject}</Link>
                      <span className="admin-muted">
                        {' '}
                        · {t.type} · {t.status} · priority {t.priority}
                      </span>
                    </span>
                    <span className="admin-report-list-value">{new Date(t.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

