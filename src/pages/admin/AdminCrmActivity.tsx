import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderEventRow, CustomerNoteRow, ActivityRow, CustomerProfileRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

type Tab = 'all' | 'orders' | 'companies' | 'tasks'

type FeedItem =
  | { kind: 'order'; at: string; id: string; order_id: string; label: string; sub?: string }
  | { kind: 'note'; at: string; id: string; customer_user_id: string; label: string; sub?: string }
  | { kind: 'task'; at: string; id: string; customer_user_id: string; label: string; sub?: string }

export default function AdminCrmActivity() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<FeedItem[]>([])
  const [lookup, setLookup] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    async function load() {
      const [evRes, notesRes, actRes, profRes] = await Promise.all([
        supabase.from('order_events').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('customer_notes').select('*').order('created_at', { ascending: false }).limit(80),
        supabase.from('activities').select('*').order('updated_at', { ascending: false }).limit(80),
        supabase.from('customer_profiles').select('user_id, company_name'),
      ])
      const profiles = (profRes.data ?? []) as CustomerProfileRow[]
      const map = new Map<string, string>()
      profiles.forEach((p) => map.set(p.user_id, p.company_name))
      setLookup(map)

      const evs = (evRes.data ?? []) as OrderEventRow[]
      const notes = (notesRes.data ?? []) as CustomerNoteRow[]
      const acts = (actRes.data ?? []) as ActivityRow[]

      const orderItems: FeedItem[] = evs.map((e) => ({
        kind: 'order',
        at: e.created_at,
        id: e.id,
        order_id: e.order_id,
        label: e.note || `${e.event_type}${e.to_status ? ` → ${e.to_status}` : ''}`,
        sub: e.event_type,
      }))

      const noteItems: FeedItem[] = notes.map((n) => ({
        kind: 'note',
        at: n.created_at,
        id: n.id,
        customer_user_id: n.customer_user_id,
        label: (n.body ?? '').slice(0, 160) + ((n.body?.length ?? 0) > 160 ? '…' : ''),
        sub: 'Company note',
      }))

      const taskItems: FeedItem[] = acts.map((a) => ({
        kind: 'task',
        at: a.updated_at ?? a.created_at,
        id: a.id,
        customer_user_id: a.customer_user_id,
        label: `${a.activity_type}: ${a.subject ?? '—'}`,
        sub: a.completed_at ? 'Done' : a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : 'Open',
      }))

      const merged = [...orderItems, ...noteItems, ...taskItems].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )
      setItems(merged)
      setLoading(false)
    }
    load()
  }, [canView])

  const visible = items.filter((it) => {
    if (tab === 'all') return true
    if (tab === 'orders') return it.kind === 'order'
    if (tab === 'companies') return it.kind === 'note'
    if (tab === 'tasks') return it.kind === 'task'
    return true
  })

  if (!canView) {
    return (
      <div className="card admin-card">
        <p>You don&apos;t have permission to view CRM activity.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-loading-state">
        <div className="admin-loading-spinner" aria-hidden />
        <p>Loading activity…</p>
      </div>
    )
  }

  return (
    <>
      <p className="page-intro" style={{ marginTop: 0 }}>
        Recent order events, internal company notes, and CRM tasks in one place. Use tabs to focus a stream.
      </p>
      <div className="admin-segment" style={{ marginBottom: '1rem' }}>
        {(['all', 'orders', 'companies', 'tasks'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-segment-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t === 'orders' ? 'Order activity' : t === 'companies' ? 'Company notes' : 'CRM tasks'}
          </button>
        ))}
      </div>
      <div className="card admin-card">
        <h2 style={{ marginTop: 0 }}>Activity feed</h2>
        {visible.length === 0 ? (
          <p className="admin-muted">Nothing in this view yet.</p>
        ) : (
          <ul className="admin-report-list">
            {visible.slice(0, 100).map((it) => (
              <li key={`${it.kind}-${it.id}`} className="admin-report-list-item">
                <span className="admin-report-list-label">
                  <span className="admin-muted" style={{ marginRight: '0.5rem' }}>
                    {new Date(it.at).toLocaleString()}
                  </span>
                  <span className="admin-muted" style={{ marginRight: '0.35rem' }}>
                    [{it.kind}]
                  </span>
                  {it.kind === 'order' && (
                    <>
                      <Link to={`/admin/orders/${it.order_id}`} className="admin-link">
                        Order {it.order_id.slice(0, 8)}…
                      </Link>
                      <span> — {it.label}</span>
                    </>
                  )}
                  {it.kind === 'note' && (
                    <>
                      <Link to={`/admin/customers/${it.customer_user_id}`} className="admin-link">
                        {lookup.get(it.customer_user_id) ?? it.customer_user_id.slice(0, 8)}
                      </Link>
                      <span> — {it.label}</span>
                    </>
                  )}
                  {it.kind === 'task' && (
                    <>
                      <Link to={`/admin/customers/${it.customer_user_id}`} className="admin-link">
                        {lookup.get(it.customer_user_id) ?? it.customer_user_id.slice(0, 8)}
                      </Link>
                      <span> — {it.label}</span>
                    </>
                  )}
                </span>
                <span className="admin-report-list-value admin-muted">{it.sub}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
