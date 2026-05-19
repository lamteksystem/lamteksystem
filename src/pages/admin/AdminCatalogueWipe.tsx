import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { downloadFullBackupXlsx } from '@/lib/catalogue-import-export'
import { usePermission } from '@/hooks/usePermission'
import { useStaff } from '@/hooks/useStaff'
import type { CategoryRow, ProductRow } from '@/types/database'

interface CountSnapshot {
  products: number
  assemblies: number
  assembly_lines: number
  product_categories: number
  product_stock: number
  order_lines: number
  orders: number
  categories: number
  assembly_part_types: number
}

interface WipeResult {
  wiped_products: number
  wiped_assemblies: number
  wiped_assembly_lines: number
  wiped_product_categories: number
  wiped_order_lines: number
}

async function fetchCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.error(`[wipe] count(${table}) failed:`, error.message)
    return 0
  }
  return count ?? 0
}

export default function AdminCatalogueWipe() {
  const navigate = useNavigate()
  const { staffProfile, loading: staffLoading } = useStaff()
  const { allowed: canEditCatalogue, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const isAdmin = staffProfile?.role === 'admin'

  const [counts, setCounts] = useState<CountSnapshot | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [backupFirst, setBackupFirst] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WipeResult | null>(null)

  const reload = useCallback(async () => {
    setLoadingCounts(true)
    const [
      products,
      assemblies,
      assembly_lines,
      product_categories,
      product_stock,
      order_lines,
      orders,
      categories,
      assembly_part_types,
    ] = await Promise.all([
      fetchCount('products'),
      fetchCount('assemblies'),
      fetchCount('assembly_lines'),
      fetchCount('product_categories'),
      fetchCount('product_stock'),
      fetchCount('order_lines'),
      fetchCount('orders'),
      fetchCount('categories'),
      fetchCount('assembly_part_types'),
    ])
    setCounts({
      products,
      assemblies,
      assembly_lines,
      product_categories,
      product_stock,
      order_lines,
      orders,
      categories,
      assembly_part_types,
    })
    setLoadingCounts(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const expectedConfirm = counts ? `WIPE ${counts.products}` : ''
  const confirmOk = confirmText.trim().toUpperCase() === expectedConfirm

  async function doBackup() {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('name'),
      supabase.from('products').select('*').order('sort_order').order('name'),
    ])
    downloadFullBackupXlsx(
      (catRes.data ?? []) as CategoryRow[],
      (prodRes.data ?? []) as ProductRow[]
    )
  }

  async function handleWipe() {
    if (!confirmOk) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (backupFirst) {
        await doBackup()
      }
      const { data, error: rpcError } = await supabase.rpc('wipe_product_catalogue')
      if (rpcError) throw rpcError
      setResult(data as WipeResult)
      setConfirmText('')
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[wipe] wipe_product_catalogue RPC failed:', msg)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (staffLoading || permLoading) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    )
  }

  if (!canEditCatalogue || !isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1>Reset catalogue</h1>
        </div>
        <p className="admin-error">
          Only admin users can wipe the catalogue. You are{' '}
          {staffProfile ? `signed in as ${staffProfile.role}` : 'not signed in as staff'}.
        </p>
      </div>
    )
  }

  return (
    <div className="admin-page admin-settings-page">
      <div className="admin-page-header">
        <h1>Reset catalogue</h1>
        <p className="page-intro">
          Wipe every product, assembly, and product-category link so you can rebuild the catalogue
          component-first. Categories, part types, ranges and order headers are preserved.
        </p>
      </div>

      <div className="admin-settings-layout card">
        <div className="admin-settings-tab-panel admin-settings-panel--danger" style={{ padding: '1.25rem' }}>
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>What this will do</h2>
            <p>
              This action is <strong>destructive and irreversible</strong>. Download a backup first
              (the toggle is on by default), or restore from the XLSX afterwards using Admin →
              Catalogue.
            </p>
            <div className="admin-modal-card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
              <h3 style={{ marginTop: 0 }}>Will be wiped</h3>
              <ul style={{ marginBottom: 0 }}>
                <li>Products ({counts?.products ?? '…'})</li>
                <li>Assemblies ({counts?.assemblies ?? '…'})</li>
                <li>Assembly lines ({counts?.assembly_lines ?? '…'})</li>
                <li>Product → category links ({counts?.product_categories ?? '…'})</li>
                <li>Per-location product stock ({counts?.product_stock ?? '…'})</li>
                <li>
                  Order lines ({counts?.order_lines ?? '…'}) — order headers stay, but their line
                  items go because they reference products
                </li>
              </ul>
            </div>
            <div className="admin-modal-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Will be kept</h3>
              <ul style={{ marginBottom: 0 }}>
                <li>Categories ({counts?.categories ?? '…'}) — generic product types, ranges, and universal groups</li>
                <li>Assembly part types ({counts?.assembly_part_types ?? '…'}) — door, hinge, plinth, etc.</li>
                <li>Orders headers ({counts?.orders ?? '…'}) — customer and order metadata</li>
                <li>Customers, staff, suppliers, locations, settings — everything not catalogue-shaped</li>
              </ul>
            </div>
          </section>

          {error && (
            <p className="admin-error" style={{ marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          {result && (
            <div
              className="admin-message-ok admin-modal-card"
              style={{ padding: '1rem', marginBottom: '1rem' }}
            >
              <p style={{ marginTop: 0 }}>
                <strong>Catalogue wiped.</strong>
              </p>
              <ul style={{ marginBottom: '0.75rem' }}>
                <li>{result.wiped_products} products removed</li>
                <li>{result.wiped_assemblies} assemblies removed</li>
                <li>{result.wiped_assembly_lines} assembly lines removed</li>
                <li>{result.wiped_product_categories} product → category links removed</li>
                <li>{result.wiped_order_lines} order lines removed</li>
              </ul>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link to="/admin/catalogue/components/import" className="btn">
                  Import components from CSV
                </Link>
                <Link to="/admin/catalogue/components/variant-builder" className="btn btn-outline">
                  Open variant matrix builder
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/catalogue')}>
                  Back to catalogue
                </button>
              </div>
            </div>
          )}

          {!result && (
            <section className="admin-modal-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Confirm</h3>
              <label
                className="admin-reset-backup-option"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  checked={backupFirst}
                  onChange={(e) => setBackupFirst(e.target.checked)}
                  disabled={busy}
                />
                <span>Download full backup (XLSX) before wiping</span>
              </label>
              <p style={{ margin: '0.75rem 0 0.25rem' }}>
                Type <code>{loadingCounts ? 'WIPE …' : expectedConfirm}</code> below to enable the
                wipe button:
              </p>
              <input
                type="text"
                className="admin-input admin-input--full"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedConfirm}
                autoComplete="off"
                disabled={busy || loadingCounts}
                style={{ width: '100%' }}
              />
              <div className="admin-modal-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void handleWipe()}
                  disabled={!confirmOk || busy || loadingCounts}
                >
                  {busy ? 'Wiping…' : backupFirst ? 'Back up and wipe catalogue' : 'Wipe catalogue'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate('/admin/catalogue')}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
