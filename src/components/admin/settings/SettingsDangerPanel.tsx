import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadFullBackupXlsx } from '@/lib/catalogue-import-export'
import type { CategoryRow, ProductRow } from '@/types/database'

export default function SettingsDangerPanel() {
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<'products' | 'categories' | null>(null)
  const [backupBeforeDelete, setBackupBeforeDelete] = useState(true)
  const [confirmText, setConfirmText] = useState('')

  async function fetchCategoriesAndProducts(): Promise<{ categories: CategoryRow[]; products: ProductRow[] }> {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('name'),
      supabase.from('products').select('*').order('sort_order').order('name'),
    ])
    return { categories: catRes.data ?? [], products: prodRes.data ?? [] }
  }

  async function doBackup() {
    const { categories, products } = await fetchCategoriesAndProducts()
    downloadFullBackupXlsx(categories, products)
  }

  async function deleteAllProducts(createBackupFirst: boolean) {
    setResetLoading(true)
    setResetError(null)
    try {
      if (createBackupFirst) await doBackup()
      const { data: products } = await supabase.from('products').select('id')
      const ids = (products ?? []).map((p) => p.id)
      if (ids.length === 0) {
        setConfirmDelete(null)
        setResetLoading(false)
        return
      }
      await supabase.from('product_stock').delete().in('product_id', ids)
      await supabase.from('order_lines').delete().in('product_id', ids)
      await supabase.from('assembly_lines').delete().in('product_id', ids)
      const { error } = await supabase.from('products').delete().in('id', ids)
      if (error) throw error
      setConfirmDelete(null)
      setConfirmText('')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e))
    } finally {
      setResetLoading(false)
    }
  }

  async function deleteAllCategories(createBackupFirst: boolean) {
    setResetLoading(true)
    setResetError(null)
    try {
      if (createBackupFirst) await doBackup()
      const { data: products } = await supabase.from('products').select('id')
      const productIds = (products ?? []).map((p) => p.id)
      if (productIds.length > 0) {
        await supabase.from('product_stock').delete().in('product_id', productIds)
        await supabase.from('order_lines').delete().in('product_id', productIds)
        await supabase.from('assembly_lines').delete().in('product_id', productIds)
        await supabase.from('products').delete().in('id', productIds)
      }
      const { data: categories } = await supabase.from('categories').select('id')
      const catIds = (categories ?? []).map((c) => c.id)
      if (catIds.length > 0) {
        await supabase.from('categories').update({ parent_id: null }).not('parent_id', 'is', null)
        const { error } = await supabase.from('categories').delete().in('id', catIds)
        if (error) throw error
      }
      setConfirmDelete(null)
      setConfirmText('')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e))
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
        <button
          type="button"
          className="btn btn-danger-outline"
          onClick={() => {
            setConfirmDelete('products')
            setResetError(null)
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
            setConfirmText('')
          }}
          disabled={resetLoading}
        >
          Delete all categories (and products)
        </button>
      </div>
      {resetError && <p className="admin-error" style={{ marginTop: '0.75rem' }}>{resetError}</p>}

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
