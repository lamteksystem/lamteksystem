import { useState } from 'react'
import { useAdminUi, type TableDensity, type DateFormat } from '@/contexts/AdminUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import { downloadFullBackupXlsx } from '@/lib/catalogue-import-export'
import type { CategoryRow, ProductRow } from '@/types/database'
import AdminMarketingCarouselSettings from '@/components/admin/AdminMarketingCarouselSettings'

export default function AdminSettings() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarAccordion,
    updatePrefs,
    tableDensity,
    setTableDensity,
    dateFormat,
    setDateFormat,
    rowsPerPage,
    setRowsPerPage,
    defaultOrderStatusFilter,
    setDefaultOrderStatusFilter,
    resetPrefs,
  } = useAdminUi()
  const { theme, setTheme } = useTheme()

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
    <div className="admin-page admin-settings-page">
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p className="page-intro">Customise the admin interface. Theme is saved to your account.</p>
      </div>

      <div className="admin-settings-grid">
        <AdminMarketingCarouselSettings />

        <section className="card admin-settings-card">
          <h2>Appearance</h2>
          <div className="admin-settings-list">
            <div className="admin-settings-row">
              <span className="admin-settings-label">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeId)}
                className="admin-settings-select"
              >
                <option value="auto">Auto (system)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <p className="admin-settings-hint">Colour theme for the portal and admin. Saved per account.</p>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Sidebar collapsed by default</span>
              <input
                type="checkbox"
                checked={sidebarCollapsed}
                onChange={(e) => setSidebarCollapsed(e.target.checked)}
              />
            </label>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Sidebar: only one section open at a time</span>
              <input
                type="checkbox"
                checked={sidebarAccordion}
                onChange={(e) => updatePrefs({ sidebarAccordion: e.target.checked })}
              />
            </label>
            <p className="admin-settings-hint">
              When enabled, opening a sidebar section closes the others. When disabled, you can keep multiple sections open and close them manually.
            </p>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Table density</span>
              <select
                value={tableDensity}
                onChange={(e) => setTableDensity(e.target.value as TableDensity)}
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
            <p className="admin-settings-hint">Affects tables on Orders and Customers. Compact shows more rows; spacious is easier to scan.</p>
          </div>
        </section>

        <section className="card admin-settings-card">
          <h2>Dates &amp; format</h2>
          <div className="admin-settings-list">
            <label className="admin-settings-row">
              <span className="admin-settings-label">Date format</span>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              >
                <option value="locale">Locale (e.g. 3 Mar 2025)</option>
                <option value="ddmmyyyy">DD/MM/YYYY</option>
                <option value="iso">ISO (YYYY-MM-DD)</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card admin-settings-card">
          <h2>Advanced</h2>
          <div className="admin-settings-list">
            <label className="admin-settings-row">
              <span className="admin-settings-label">Rows per page (tables)</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <label className="admin-settings-row">
              <span className="admin-settings-label">Default order status filter</span>
              <select
                value={defaultOrderStatusFilter}
                onChange={(e) => setDefaultOrderStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
                <option value="placed">Placed</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <p className="admin-settings-hint">When you open the Orders page, this status will be pre-selected.</p>
            <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={resetPrefs}
              >
                Reset admin UI preferences
              </button>
            </div>
            <p className="admin-settings-hint">
              Resets sidebar, table density, date format, rows per page, and default order status filter to defaults.
            </p>
          </div>
        </section>

        <section className="card admin-settings-card admin-settings-card--danger">
          <h2>Reset inventory</h2>
          <p className="admin-settings-hint">Download a full backup (Categories + Catalogue) as XLSX. You can re-import the <strong>Catalogue</strong> sheet via Admin → Catalogue to restore products. Deleting is irreversible except from backup.</p>
          <div className="admin-reset-actions">
            <button type="button" className="btn btn-outline" onClick={doBackup} disabled={resetLoading}>
              Download full backup (XLSX)
            </button>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => { setConfirmDelete('products'); setResetError(null); setConfirmText(''); }}
              disabled={resetLoading}
            >
              Delete all products
            </button>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => { setConfirmDelete('categories'); setResetError(null); setConfirmText(''); }}
              disabled={resetLoading}
            >
              Delete all categories (and products)
            </button>
          </div>
          {resetError && <p className="admin-error" style={{ marginTop: '0.75rem' }}>{resetError}</p>}
        </section>
      </div>

      {confirmDelete && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="card admin-modal admin-modal--danger">
            <h2 id="confirm-delete-title">
              {confirmDelete === 'products' ? 'Delete all products?' : 'Delete all categories?'}
            </h2>
            <p className="admin-reset-confirm-intro">
              {confirmDelete === 'products'
                ? 'This will remove every product, order line references, assembly lines, and stock. This cannot be undone.'
                : 'This will remove every category and every product (and their order lines, assembly lines, stock). This cannot be undone.'}
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
                onClick={() => confirmDelete === 'products' ? deleteAllProducts(backupBeforeDelete) : deleteAllCategories(backupBeforeDelete)}
                disabled={!confirmMatch || resetLoading}
              >
                {resetLoading ? 'Deleting…' : backupBeforeDelete ? 'Backup and delete' : 'Delete'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setConfirmDelete(null); setConfirmText(''); setResetError(null); }}
                disabled={resetLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
