import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { markPackageLabelPrinted } from '@/lib/packageLabels'
import { supabase } from '@/lib/supabase'
import type { PackageLabelRow, PickListRow } from '@/types/database'

export default function AdminPackageLabelPrint() {
  const { labelId } = useParams<{ labelId: string }>()
  const [searchParams] = useSearchParams()
  const preview = searchParams.get('preview') === '1'
  const [label, setLabel] = useState<PackageLabelRow | null>(null)
  const [pickList, setPickList] = useState<PickListRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!labelId) return
    supabase
      .from('package_labels')
      .select('*')
      .eq('id', labelId)
      .single()
      .then(async ({ data: row, error: rowErr }) => {
        if (rowErr || !row) {
          setError(rowErr?.message || 'Label not found.')
          return
        }
        setLabel(row as PackageLabelRow)
        if (row.pick_list_id) {
          const { data: pl } = await supabase.from('pick_lists').select('*').eq('id', row.pick_list_id).maybeSingle()
          setPickList((pl as PickListRow) ?? null)
        }
      })
  }, [labelId])

  useEffect(() => {
    if (!label || preview || label.printed) return
    const id = label.id
    let cancelled = false
    void markPackageLabelPrinted(id)
      .then(() => {
        if (cancelled) return
        setLabel((prev) =>
          prev && prev.id === id ? { ...prev, printed: true, printed_at: new Date().toISOString() } : prev,
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [label, preview])

  if (error) {
    return (
      <div className="admin-page">
        <div className="card admin-card"><p>{error}</p></div>
      </div>
    )
  }

  if (!label) {
    return (
      <div className="admin-page">
        <div className="card admin-card"><p>Loading label…</p></div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <style>{`
        .package-label-sheet { max-width: 420px; margin: 0 auto; padding: 1.5rem; border: 2px solid var(--lamtek-gray-light, #ddd); border-radius: 8px; }
        .package-label-code { font-family: ui-monospace, monospace; font-size: 1.75rem; font-weight: 700; letter-spacing: 0.04em; margin: 1rem 0; word-break: break-all; }
      `}</style>
      <div className="card admin-card package-label-sheet">
        <h1 style={{ marginTop: 0, fontSize: '1.1rem' }}>Lamtek — package</h1>
        <p className="admin-muted" style={{ margin: '0.25rem 0' }}>
          Order · {label.order_id.slice(0, 8)}
          {pickList ? ` · Pick ${pickList.id.slice(0, 8)}` : ''}
        </p>
        <div className="package-label-code">{label.package_code}</div>
        <p className="admin-muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
          Scan this code when the package is loaded or verified. Printed {new Date().toLocaleString('en-GB')}
        </p>
      </div>
    </div>
  )
}
