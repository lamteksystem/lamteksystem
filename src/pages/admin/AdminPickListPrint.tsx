import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { PickListItemRow, PickListRow } from '@/types/database'

type PickListItemWithContext = PickListItemRow & {
  order_lines: { product_snapshot: { name?: string; sku?: string } | null } | null
  products: { name: string; sku: string | null } | null
}

export default function AdminPickListPrint() {
  const { pickListId } = useParams<{ pickListId: string }>()
  const [pickList, setPickList] = useState<PickListRow | null>(null)
  const [items, setItems] = useState<PickListItemWithContext[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pickListId) return
    Promise.all([
      supabase.from('pick_lists').select('*').eq('id', pickListId).single(),
      supabase
        .from('pick_list_items')
        .select('*, order_lines(product_snapshot), products(name, sku)')
        .eq('pick_list_id', pickListId)
        .order('created_at', { ascending: true }),
    ]).then(([pickListRes, itemsRes]) => {
      if (pickListRes.error) {
        setError(pickListRes.error.message || 'Could not load pick list.')
        return
      }
      setPickList(pickListRes.data as PickListRow)
      setItems((itemsRes.data ?? []) as PickListItemWithContext[])
    })
  }, [pickListId])

  const nowLabel = useMemo(() => new Date().toLocaleString('en-GB'), [])

  if (error) return <div className="admin-page"><div className="card admin-card"><p>{error}</p></div></div>
  if (!pickList) return <div className="admin-page"><div className="card admin-card"><p>Loading print view…</p></div></div>

  return (
    <div className="admin-page">
      <div className="card admin-card">
        <h1 style={{ marginTop: 0 }}>Pick List</h1>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Pick list: {pickList.id.slice(0, 8)} · Order: {pickList.order_id.slice(0, 8)} · Printed: {nowLabel}
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>SKU</th>
                <th>Required</th>
                <th>Picked</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const snapshot = item.order_lines?.product_snapshot
                const name = snapshot?.name || item.products?.name || 'Product'
                const sku = snapshot?.sku || item.products?.sku || '—'
                return (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>{name}</td>
                    <td>{sku}</td>
                    <td>{item.required_qty}</td>
                    <td>{item.picked_qty}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
