import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderRow, CustomerProfileRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

type Row = OrderRow & {
  line_count: number
  company_name?: string
  contact_name?: string | null
  phone?: string | null
  email_override?: string | null
}

const STALE_DAYS = 3

export default function AdminCrmOpenOrders() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    async function load() {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['draft', 'quotation'])
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .limit(200)
      const list = (orders ?? []) as OrderRow[]
      const orderIds = list.map((o) => o.id)
      const userIds = [...new Set(list.map((o) => o.user_id))]

      const [linesRes, profilesRes] = await Promise.all([
        orderIds.length
          ? supabase.from('order_lines').select('order_id').in('order_id', orderIds)
          : Promise.resolve({ data: [] as { order_id: string }[] }),
        userIds.length
          ? supabase.from('customer_profiles').select('user_id, company_name, contact_name, phone, email_override').in('user_id', userIds)
          : Promise.resolve({ data: [] as CustomerProfileRow[] }),
      ])

      const countByOrder = new Map<string, number>()
      for (const r of linesRes.data ?? []) {
        const id = (r as { order_id: string }).order_id
        countByOrder.set(id, (countByOrder.get(id) ?? 0) + 1)
      }

      const profileByUser = new Map<string, CustomerProfileRow>()
      for (const p of (profilesRes.data ?? []) as CustomerProfileRow[]) {
        profileByUser.set(p.user_id, p)
      }

      const enriched: Row[] = list.map((o) => {
        const p = profileByUser.get(o.user_id)
        return {
          ...o,
          line_count: countByOrder.get(o.id) ?? 0,
          company_name: p?.company_name,
          contact_name: p?.contact_name,
          phone: p?.phone,
          email_override: p?.email_override,
        }
      })
      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [canView])

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = new Date(a.updated_at).getTime()
      const tb = new Date(b.updated_at).getTime()
      return tb - ta
    })
  }, [rows])

  if (!canView) {
    return (
      <div className="card admin-card">
        <p>You don&apos;t have permission to view CRM.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-loading-state">
        <div className="admin-loading-spinner" aria-hidden />
        <p>Loading open orders…</p>
      </div>
    )
  }

  return (
    <>
      <p className="page-intro" style={{ marginTop: 0 }}>
        Drafts and quotations for follow-up: contact customers who abandoned baskets or did not complete checkout. Prioritise rows with lines and older &quot;last updated&quot; dates.
      </p>
      <div className="card admin-card">
        <h2 style={{ marginTop: 0 }}>Open baskets &amp; draft orders</h2>
        {sorted.length === 0 ? (
          <p className="admin-muted">No draft or quotation orders right now.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th className="admin-right">Lines</th>
                  <th className="admin-right">Total (inc VAT)</th>
                  <th>Last updated</th>
                  <th>Follow-up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => {
                  const updated = new Date(o.updated_at).getTime()
                  const stale = updated < staleCutoff && o.line_count > 0
                  const hot = o.line_count > 0 && o.status === 'draft'
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/customers/${o.user_id}`} className="admin-table-link">
                          {o.company_name ?? o.user_id.slice(0, 8)}
                        </Link>
                        {o.contact_name && <div className="admin-muted" style={{ fontSize: '0.85rem' }}>{o.contact_name}</div>}
                        {(o.phone || o.email_override) && (
                          <div className="admin-muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                            {o.phone ? `${o.phone}` : ''}
                            {o.phone && o.email_override ? ' · ' : ''}
                            {o.email_override ?? ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="admin-table-link">
                          {o.reference?.trim() || o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>
                        <span className={`admin-orders-status-cell admin-orders-status-select--${o.status}`}>{o.status}</span>
                      </td>
                      <td className="admin-right">{o.line_count}</td>
                      <td className="admin-right">£{Number(o.total_inc_vat || 0).toFixed(2)}</td>
                      <td>{new Date(o.updated_at).toLocaleString()}</td>
                      <td>
                        {stale && <span className="admin-overdue-badge">Stale</span>}
                        {hot && !stale && <span className="admin-table-paid-badge">Has lines</span>}
                        {!o.line_count && <span className="admin-muted">Empty</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                          <Link to={`/admin/orders/${o.id}`} className="btn btn-small btn-outline">
                            Open order
                          </Link>
                          <Link to={`/admin/customers/${o.user_id}`} className="btn btn-small btn-outline">
                            Customer
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
