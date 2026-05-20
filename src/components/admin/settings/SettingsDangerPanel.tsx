import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { downloadFullBackupXlsx } from '@/lib/catalogue-import-export'
import { formatUnknownError } from '@/lib/formatError'
import { fetchAllPaginated, fetchAllProducts } from '@/lib/supabaseFetchAll'
import { useStaff } from '@/hooks/useStaff'
import type { CategoryRow } from '@/types/database'

interface WipeProductsResult {
  wiped_products: number
}

interface WipeCategoriesResult {
  wiped_categories: number
}

export default function SettingsDangerPanel() {
  const { staffProfile } = useStaff()
  const isAdmin = staffProfile?.role === 'admin'
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<'products' | 'categories' | null>(null)
  const [backupBeforeDelete, setBackupBeforeDelete] = useState(true)
  const [confirmText, setConfirmText] = useState('')

  async function doBackup() {
    const [categories, products] = await Promise.all([
      fetchAllPaginated<CategoryRow>((from, to) =>
        supabase.from('categories').select('*').order('sort_order').order('name').range(from, to)
      ),
      fetchAllProducts(),
    ])
    downloadFullBackupXlsx(categories, products)
  }

  async function deleteAllProducts(createBackupFirst: boolean) {
    if (!isAdmin) {
      setResetError('Only admins can delete the full product catalogue. Ask an admin or use Reset catalogue.')
      return
    }
    setResetLoading(true)
    setResetError(null)
    setResetSuccess(null)
    try {
      if (createBackupFirst) await doBackup()
      const { data, error } = await supabase.rpc('wipe_product_catalogue')
      if (error) throw error
      const wiped = (data as WipeProductsResult | null)?.wiped_products ?? 0
      setResetSuccess(
        wiped > 0
          ? `Removed ${wiped} product(s) from the database. Open Admin → Catalogue and refresh if that page was already open.`
          : 'No products were in the database.'
      )
      setConfirmDelete(null)
      setConfirmText('')
    } catch (e) {
      setResetError(formatUnknownError(e, 'Could not delete products.'))
    } finally {
      setResetLoading(false)
    }
  }

  async function deleteAllCategories(createBackupFirst: boolean) {
    if (!isAdmin) {
      setResetError('Only admins can wipe the full category tree.')
      return
    }
    setResetLoading(true)
    setResetError(null)
    setResetSuccess(null)
    try {
      if (createBackupFirst) await doBackup()
      const { data: wipeProducts, error: wipeErr } = await supabase.rpc('wipe_product_catalogue')
      if (wipeErr) throw wipeErr
      const productsWiped = (wipeProducts as WipeProductsResult | null)?.wiped_products ?? 0
      const { data: wipeCats, error: catErr } = await supabase.rpc('wipe_all_categories')
      if (catErr) throw catErr
      const catsWiped = (wipeCats as WipeCategoriesResult | null)?.wiped_categories ?? 0
      setResetSuccess(
        `Removed ${productsWiped} product(s) and ${catsWiped} categor${catsWiped === 1 ? 'y' : 'ies'}. Refresh Admin → Catalogue.`
      )
      setConfirmDelete(null)
      setConfirmText('')
    } catch (e) {
      setResetError(formatUnknownError(e, 'Could not delete categories.'))
    } finally {
      setResetLoading(false)
    }
  }

  const confirmLabel = confirmDelete === 'products' ? 'DELETE ALL PRODUCTS' : 'DELETE ALL CATEGORIES'
  const confirmMatch = confirmText.toUpperCase().trim() === confirmLabel

  return (
    <div className="admin-settings-panel admin-settings-panel--danger">
      <p className="admin-settings-panel-intro">
        Download a full backup before any destructive action. Re-import the <strong>Catalogue</strong> sheet via
        Admin → Catalogue after restoring from backup.
      </p>
      <div className="admin-reset-actions">
        <button type="button" className="btn btn-outline" onClick={() => void doBackup()} disabled={resetLoading}>
          Download full backup (XLSX)
        </button>
        <Link to="/admin/catalogue/wipe" className="btn btn-danger-outline">
          Reset catalogue (rebuild component-first)
        </Link>
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={() => {
            setConfirmDelete('products')
            setResetError(null)
            setResetSuccess(null)
            setConfirmText('')
          }}
          disabled={resetLoading}
        >
          Delete all products
        </button>
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={() => {
            setConfirmDelete('categories')
            setResetError(null)
            setResetSuccess(null)
            setConfirmText('')
          }}
          disabled={resetLoading}
        >
          Delete all categories (and products)
        </button>
      </div>
      {resetSuccess && (
        <p className="admin-message-ok" style={{ marginTop: '0.75rem' }}>
          {resetSuccess}
        </p>
      )}
      {resetError && <p className="admin-error" style={{ marginTop: '0.75rem' }}>{resetError}</p>}
      {!isAdmin && (
        <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
          Product and category wipes require an <strong>admin</strong> account (uses a server-side wipe, not a
          1000-row batch).
        </p>
      )}

      {confirmDelete && (
        <div className="admin-settings-confirm card admin-modal--danger" role="dialog" aria-modal="true">
          <h3>{confirmDelete === 'products' ? 'Delete all products?' : 'Delete all categories?'}</h3>
          <p className="admin-reset-confirm-intro">
            {confirmDelete === 'products'
              ? 'This will remove every product, order line references, assembly lines, and stock. This cannot be undone.'
              : 'This will remove every category and every product. This cannot be undone.'}
          </p>
          <label className="admin-reset-backup-option">
            <input
              type="checkbox"
              checked={backupBeforeDelete}
              onChange={(e) => setBackupBeforeDelete(e.target.checked)}
            />
            Create backup before deleting (download XLSX)
          </label>
          <p className="admin-reset-type-to-confirm">
            Type <strong>{confirmLabel}</strong> to confirm:
          </p>
          <input
            type="text"
            className="admin-input admin-input--full"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmLabel}
            autoComplete="off"
            disabled={resetLoading}
          />
          <div className="admin-modal-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                void (confirmDelete === 'products'
                  ? deleteAllProducts(backupBeforeDelete)
                  : deleteAllCategories(backupBeforeDelete))
              }
              disabled={!confirmMatch || resetLoading}
            >
              {resetLoading ? 'Deleting…' : backupBeforeDelete ? 'Backup and delete' : 'Delete'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setConfirmDelete(null)
                setConfirmText('')
                setResetError(null)
                setResetSuccess(null)
              }}
              disabled={resetLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
