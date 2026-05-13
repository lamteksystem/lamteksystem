import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { isPickListFullyPicked, setPickListStatus } from '@/lib/pickLists'
import { createPackageLabelForPickList, markPackageLabelPrinted, markPackageLabelScannedByCode } from '@/lib/packageLabels'
import type { PackageLabelRow, PickListItemRow, PickListRow } from '@/types/database'

type PickListItemWithContext = PickListItemRow & {
  order_lines: { product_snapshot: { name?: string; sku?: string } | null } | null
  products: { name: string; sku: string | null } | null
}

const STATUS_LABELS: Record<PickListRow['status'], string> = {
  generated: 'Generated',
  picking: 'Picking',
  picked: 'Picked',
  cancelled: 'Cancelled',
}

export default function AdminPickListDetail() {
  const { pickListId } = useParams<{ pickListId: string }>()
  const navigate = useNavigate()
  const [pickList, setPickList] = useState<PickListRow | null>(null)
  const [items, setItems] = useState<PickListItemWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labels, setLabels] = useState<PackageLabelRow[]>([])
  const [creatingLabel, setCreatingLabel] = useState(false)
  const [markingPrintedId, setMarkingPrintedId] = useState<string | null>(null)
  const [scanCodeInput, setScanCodeInput] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  async function load() {
    if (!pickListId) return
    setLoading(true)
    setError(null)
    const [pickListRes, itemsRes, labelsRes] = await Promise.all([
      supabase.from('pick_lists').select('*').eq('id', pickListId).single(),
      supabase
        .from('pick_list_items')
        .select('*, order_lines(product_snapshot), products(name, sku)')
        .eq('pick_list_id', pickListId)
        .order('created_at', { ascending: true }),
      supabase.from('package_labels').select('*').eq('pick_list_id', pickListId).order('created_at', { ascending: true }),
    ])

    if (pickListRes.error) {
      setError(pickListRes.error.message || 'Could not load pick list.')
      setLoading(false)
      return
    }

    setPickList(pickListRes.data as PickListRow)
    setItems((itemsRes.data ?? []) as PickListItemWithContext[])
    setLabels((labelsRes.data ?? []) as PackageLabelRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [pickListId])

  const totals = useMemo(() => {
    const required = items.reduce((sum, item) => sum + Number(item.required_qty), 0)
    const picked = items.reduce((sum, item) => sum + Number(item.picked_qty), 0)
    return { required, picked, remaining: Math.max(required - picked, 0) }
  }, [items])

  async function updatePickedQty(item: PickListItemWithContext, value: number) {
    const clamped = Math.max(0, Math.min(value, item.required_qty))
    setSavingItemId(item.id)
    setError(null)
    const { error: updateError } = await supabase
      .from('pick_list_items')
      .update({ picked_qty: clamped, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (updateError) {
      setError(updateError.message || 'Could not update picked quantity.')
      setSavingItemId(null)
      return
    }
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, picked_qty: clamped } : row)))
    setSavingItemId(null)
  }

  async function changeStatus(status: PickListRow['status']) {
    if (!pickList) return
    setStatusSaving(true)
    setError(null)
    try {
      if (status === 'picked') {
        const ok = await isPickListFullyPicked(pickList.id)
        if (!ok) {
          if (
            !window.confirm(
              'Not all line quantities are fully picked. Mark as picked anyway? (supervisor override)',
            )
          ) {
            return
          }
          await setPickListStatus(pickList, status, { forceComplete: true })
        } else {
          await setPickListStatus(pickList, status)
        }
      } else {
        await setPickListStatus(pickList, status)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update pick list status.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function addPackageLabel() {
    if (!pickList) return
    setCreatingLabel(true)
    setError(null)
    try {
      await createPackageLabelForPickList({ pickListId: pickList.id, orderId: pickList.order_id })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create label.')
    } finally {
      setCreatingLabel(false)
    }
  }

  async function onMarkPrinted(labelId: string) {
    setMarkingPrintedId(labelId)
    setError(null)
    try {
      await markPackageLabelPrinted(labelId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update label.')
    } finally {
      setMarkingPrintedId(null)
    }
  }

  async function onScanSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pickListId) return
    setScanBusy(true)
    setScanMessage(null)
    setError(null)
    try {
      const res = await markPackageLabelScannedByCode(scanCodeInput)
      setScanMessage(`Scanned: ${res.package_code}`)
      setScanCodeInput('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.')
    } finally {
      setScanBusy(false)
    }
  }

  if (loading) return <div className="admin-page"><div className="card admin-card"><p>Loading pick list…</p></div></div>

  if (!pickList) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Pick list not found.</p>
          <button type="button" className="btn btn-outline btn-small" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/pick-lists">Pick lists</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Pick list {pickList.id.slice(0, 8)}</span>
        </span>
        <div className="admin-page-header-actions">
          <Link to={`/admin/pick-lists/${pickList.id}/print`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-small">
            Print view
          </Link>
          <Link to={`/admin/orders/${pickList.order_id}`} className="btn btn-outline btn-small">Open order</Link>
        </div>
      </div>

      <div className="card admin-card">
        {error && <div className="admin-confirm-box" role="alert"><p>{error}</p></div>}
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Status: <strong>{STATUS_LABELS[pickList.status]}</strong> · Required {totals.required} · Picked {totals.picked} · Remaining {totals.remaining}
        </p>
        <div className="admin-order-processing-actions" style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-small" disabled={statusSaving || pickList.status === 'picking'} onClick={() => changeStatus('picking')}>Mark picking</button>
          <button type="button" className="btn btn-small" disabled={statusSaving || pickList.status === 'picked'} onClick={() => changeStatus('picked')}>Mark picked</button>
          <button type="button" className="btn btn-small btn-outline" disabled={statusSaving || pickList.status === 'generated'} onClick={() => changeStatus('generated')}>Reset to generated</button>
          <button type="button" className="btn btn-small btn-danger-outline" disabled={statusSaving || pickList.status === 'cancelled'} onClick={() => changeStatus('cancelled')}>Cancel</button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Required</th>
                <th>Picked</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const snapshot = item.order_lines?.product_snapshot
                const name = snapshot?.name || item.products?.name || 'Product'
                const sku = snapshot?.sku || item.products?.sku || '—'
                return (
                  <tr key={item.id}>
                    <td>{name}</td>
                    <td>{sku}</td>
                    <td>{item.required_qty}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.required_qty}
                        value={item.picked_qty}
                        disabled={savingItemId === item.id || pickList.status === 'cancelled'}
                        onChange={(e) => updatePickedQty(item, Number(e.target.value) || 0)}
                        style={{ width: 90 }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card admin-card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Package labels</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Create labels for cartons or pallets. Print a sheet, then mark printed when produced. Scan codes to confirm handling.
        </p>
        <div style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-small" disabled={creatingLabel || pickList.status === 'cancelled'} onClick={() => addPackageLabel()}>
            {creatingLabel ? 'Creating…' : 'Create label'}
          </button>
        </div>
        {labels.length === 0 ? (
          <p className="admin-muted">No labels yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Printed</th>
                  <th>Scanned</th>
                  <th className="admin-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((lb) => (
                  <tr key={lb.id}>
                    <td><code>{lb.package_code}</code></td>
                    <td>{lb.printed ? `Yes · ${lb.printed_at ? new Date(lb.printed_at).toLocaleString('en-GB') : ''}` : 'No'}</td>
                    <td>{lb.scanned ? `Yes · ${lb.scanned_at ? new Date(lb.scanned_at).toLocaleString('en-GB') : ''}` : 'No'}</td>
                    <td className="admin-right">
                      <Link
                        to={`/admin/package-labels/${lb.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-small"
                      >
                        Print
                      </Link>
                      {' '}
                      <button
                        type="button"
                        className="btn btn-small btn-outline"
                        disabled={lb.printed || markingPrintedId === lb.id || pickList.status === 'cancelled'}
                        onClick={() => onMarkPrinted(lb.id)}
                      >
                        {markingPrintedId === lb.id ? 'Saving…' : 'Mark printed'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={onScanSubmit} style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="admin-muted" style={{ fontSize: '0.85rem' }}>Scan or enter package code</span>
            <input
              type="text"
              value={scanCodeInput}
              onChange={(e) => setScanCodeInput(e.target.value)}
              placeholder="LAM-…"
              autoComplete="off"
              style={{ minWidth: 220 }}
            />
          </label>
          <button type="submit" className="btn btn-small" disabled={scanBusy || !scanCodeInput.trim()}>
            {scanBusy ? 'Recording…' : 'Record scan'}
          </button>
          {scanMessage ? <span className="admin-muted">{scanMessage}</span> : null}
        </form>
      </div>
    </div>
  )
}
