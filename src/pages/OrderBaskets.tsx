import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { supabase } from '@/lib/supabase'

export default function OrderBaskets() {
  const navigate = useNavigate()
  const {
    draftOrders,
    draftOrder,
    setActiveDraftOrder,
    createDraftOrder,
    renameDraftOrder,
    duplicateDraftOrder,
    refresh,
    loading,
  } = useDraftOrder()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(() => {
    const list = [...draftOrders]
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [draftOrders])

  async function startRename(id: string) {
    const current = draftOrders.find((o) => o.id === id)
    setRenamingId(id)
    setRenameValue((current?.reference ?? '').trim())
  }

  async function saveRename() {
    if (!renamingId) return
    setBusyId(renamingId)
    setError(null)
    try {
      await renameDraftOrder(renamingId, renameValue)
      setRenamingId(null)
      setRenameValue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename basket.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteBasket(id: string) {
    if (busyId) return
    if (!confirm('Delete this basket? This will remove all lines in it.')) return
    setBusyId(id)
    setError(null)
    try {
      const { error: delErr } = await supabase.from('orders').delete().eq('id', id)
      if (delErr) throw delErr
      await refresh()
      if (draftOrder?.id === id) {
        await setActiveDraftOrder(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete basket.')
    } finally {
      setBusyId(null)
    }
  }

  async function makeActiveAndGo(id: string, to: string) {
    setBusyId(id)
    setError(null)
    try {
      await setActiveDraftOrder(id)
      navigate(to)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch basket.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="ordering-page">
        <PageNav backTo="/ordering/start" backLabel="Create order" />
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="ordering-page">
      <PageNav backTo="/ordering/start" backLabel="Create order" />
      <div className="ordering-header">
        <h1>Baskets</h1>
        <p className="page-intro">
          Manage multiple draft baskets. Your active basket is remembered automatically.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => createDraftOrder()}>
            New basket
          </button>
          <Link to="/ordering" className="btn btn-outline">Back to products</Link>
          <Link to="/ordering/cart" className="btn btn-outline">Go to cart</Link>
        </div>
        {error && <div className="login-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
      </div>

      <div className="card">
        {sorted.length === 0 ? (
          <p className="admin-muted">No baskets yet. Create one to start building an order.</p>
        ) : (
          <div className="admin-table-wrap admin-table-wrap--compact">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Basket</th>
                  <th>Updated</th>
                  <th className="admin-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o) => {
                  const label = formatOrderReferenceOrFallback(o)
                  const isActive = draftOrder?.id === o.id
                  const busy = busyId === o.id
                  return (
                    <tr key={o.id}>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong title={`Order ID: ${o.id}`}>{label}</strong>
                          {isActive ? <span className="admin-table-paid-badge">Active</span> : null}
                        </div>
                        {renamingId === o.id && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              placeholder="Basket name (optional)"
                              style={{ minWidth: 280 }}
                            />
                            <button type="button" className="btn btn-small" onClick={saveRename} disabled={busy}>
                              Save
                            </button>
                            <button type="button" className="btn btn-small btn-outline" onClick={() => setRenamingId(null)} disabled={busy}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{new Date(o.updated_at).toLocaleString()}</td>
                      <td className="admin-right">
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => makeActiveAndGo(o.id, '/ordering')}
                            disabled={busy}
                            title="Set active and continue adding items"
                          >
                            Add items
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => makeActiveAndGo(o.id, '/ordering/cart')}
                            disabled={busy}
                            title="Set active and open cart"
                          >
                            Open cart
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => startRename(o.id)}
                            disabled={busy || renamingId === o.id}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={async () => {
                              setBusyId(o.id)
                              setError(null)
                              try {
                                await duplicateDraftOrder(o.id)
                                await refresh()
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Failed to duplicate basket.')
                              } finally {
                                setBusyId(null)
                              }
                            }}
                            disabled={busy}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-danger-outline"
                            onClick={() => deleteBasket(o.id)}
                            disabled={busy}
                            title="Delete draft basket"
                          >
                            Delete
                          </button>
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
    </div>
  )
}

