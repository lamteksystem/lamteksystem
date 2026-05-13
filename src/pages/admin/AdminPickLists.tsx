import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { OrderRow, PickListRow } from '@/types/database'

type Tab = 'open' | 'done' | 'cancelled' | 'all'

type QueueRow = {
  pickList: PickListRow
  order: Pick<OrderRow, 'id' | 'reference' | 'user_id' | 'status'> | undefined
  customer: string
  required: number
  picked: number
}

const STATUS_LABELS: Record<PickListRow['status'], string> = {
  generated: 'Generated',
  picking: 'Picking',
  picked: 'Picked',
  cancelled: 'Cancelled',
}

export default function AdminPickLists() {
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [rawRows, setRawRows] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const qsearch = search.trim().toLowerCase()
    if (!qsearch) return rawRows
    return rawRows.filter((r) => {
      const ref = (r.order?.reference ?? '').toLowerCase()
      const oid = r.order?.id?.slice(0, 8).toLowerCase() ?? ''
      const pid = r.pickList.id.slice(0, 8).toLowerCase()
      return (
        ref.includes(qsearch) ||
        oid.includes(qsearch) ||
        pid.includes(qsearch) ||
        r.customer.toLowerCase().includes(qsearch)
      )
    })
  }, [rawRows, search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase.from('pick_lists').select('*').order('updated_at', { ascending: false }).limit(250)
      if (tab === 'open') q = q.in('status', ['generated', 'picking'])
      else if (tab === 'done') q = q.eq('status', 'picked')
      else if (tab === 'cancelled') q = q.eq('status', 'cancelled')

      const { data: lists, error: listErr } = await q
      if (listErr) throw new Error(listErr.message)
      const pickLists = (lists ?? []) as PickListRow[]
      if (pickLists.length === 0) {
        setRawRows([])
        setLoading(false)
        return
      }

      const orderIds = [...new Set(pickLists.map((p) => p.order_id))]
      const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('id, reference, user_id, status')
        .in('id', orderIds)
      if (ordErr) throw new Error(ordErr.message)
      const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o as OrderRow]))

      const pickIds = pickLists.map((p) => p.id)
      const { data: items, error: itemErr } = await supabase
        .from('pick_list_items')
        .select('pick_list_id, required_qty, picked_qty')
        .in('pick_list_id', pickIds)
      if (itemErr) throw new Error(itemErr.message)

      const agg: Record<string, { required: number; picked: number }> = {}
      for (const it of items ?? []) {
        const pid = it.pick_list_id as string
        if (!agg[pid]) agg[pid] = { required: 0, picked: 0 }
        agg[pid].required += Number(it.required_qty)
        agg[pid].picked += Number(it.picked_qty)
      }

      const userIds = [...new Set((orders ?? []).map((o) => o.user_id))]
      let cust: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('user_id, company_name')
          .in('user_id', userIds)
        cust = Object.fromEntries(
          (profiles ?? []).map((p) => [p.user_id as string, (p.company_name as string)?.trim() || '']),
        )
      }

      const built: QueueRow[] = pickLists.map((pl) => {
        const order = orderMap[pl.order_id]
        const a = agg[pl.id] ?? { required: 0, picked: 0 }
        return {
          pickList: pl,
          order,
          customer: order ? cust[order.user_id] || order.user_id.slice(0, 8) : '—',
          required: a.required,
          picked: a.picked,
        }
      })

      setRawRows(built)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load pick lists.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const tabButtons = useMemo(
    () =>
      [
        { id: 'open' as const, label: 'Open' },
        { id: 'done' as const, label: 'Complete' },
        { id: 'cancelled' as const, label: 'Cancelled' },
        { id: 'all' as const, label: 'All' },
      ] as const,
    [],
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin">Today</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/orders">Orders</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Pick lists</span>
        </span>
      </div>

      <div className="card admin-card">
        <h1 style={{ marginTop: 0 }}>Pick lists</h1>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Warehouse queue: open pick lists first, then complete and cancelled history.
        </p>

        {error && (
          <div className="admin-confirm-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          {tabButtons.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`btn btn-small ${tab === b.id ? '' : 'btn-outline'}`}
              onClick={() => setTab(b.id)}
            >
              {b.label}
            </button>
          ))}
          <input
            type="search"
            placeholder="Search reference, customer, order or pick list id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-filter-input"
            style={{ minWidth: 260, flex: '1 1 200px' }}
            aria-label="Filter pick lists"
          />
          <button type="button" className="btn btn-outline btn-small" onClick={() => load()}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="admin-muted">No pick lists match this filter.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pick list</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Pick status</th>
                  <th>Progress</th>
                  <th>Updated</th>
                  <th className="admin-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pl = r.pickList
                  const progress =
                    r.required > 0 ? `${r.picked} / ${r.required}` : r.required === 0 && r.picked === 0 ? '—' : '0 / 0'
                  return (
                    <tr key={pl.id}>
                      <td>
                        <code>{pl.id.slice(0, 8)}</code>
                      </td>
                      <td>
                        {r.order ? (
                          <Link to={`/admin/orders/${r.order.id}`}>
                            {r.order.reference?.trim() || r.order.id.slice(0, 8)}
                          </Link>
                        ) : (
                          '—'
                        )}
                        {r.order ? <span className="admin-muted"> · {r.order.status}</span> : null}
                      </td>
                      <td>{r.customer}</td>
                      <td>{STATUS_LABELS[pl.status]}</td>
                      <td>{progress}</td>
                      <td className="admin-muted">{new Date(pl.updated_at).toLocaleString('en-GB')}</td>
                      <td className="admin-right">
                        <Link to={`/admin/pick-lists/${pl.id}`} className="btn btn-small btn-outline">
                          Open
                        </Link>{' '}
                        <Link
                          to={`/admin/pick-lists/${pl.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-small btn-outline"
                        >
                          Print
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
