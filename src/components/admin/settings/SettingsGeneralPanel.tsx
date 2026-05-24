import {
  useAdminUi,
  type AdminOrderLinePricingMode,
  type CatalogBrowseModePref,
  type DateFormat,
} from '@/contexts/AdminUiContext'
import { formatAdminDate } from '@/contexts/AdminUiContext'
import { PAGE_SIZE_OPTIONS } from '@/lib/listPagination'

export default function SettingsGeneralPanel() {
  const adminUi = useAdminUi()
  const {
    dateFormat,
    setDateFormat,
    rowsPerPage,
    setRowsPerPage,
    defaultOrderStatusFilter,
    setDefaultOrderStatusFilter,
    adminOrderLinePricingDefault,
    setAdminOrderLinePricingDefault,
    confirmDestructiveActions,
    setConfirmDestructiveActions,
    defaultCatalogBrowseMode,
    setDefaultCatalogBrowseMode,
    showInactiveProductsInCatalogue,
    setShowInactiveProductsInCatalogue,
    expandSmartSuggestionsByDefault,
    setExpandSmartSuggestionsByDefault,
    resetPrefs,
  } = adminUi

  const sampleDate = formatAdminDate(adminUi, new Date())

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Defaults for admin tables, orders, and catalogue workflows. Changes apply to your staff
        account immediately.
      </p>

      <fieldset className="admin-settings-fieldset">
        <legend>Tables &amp; dates</legend>
        <div className="admin-settings-list">
          <label className="admin-settings-row">
            <span className="admin-settings-label">Date format</span>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
              <option value="locale">Locale (e.g. 3 Mar 2025)</option>
              <option value="ddmmyyyy">DD/MM/YYYY</option>
              <option value="iso">ISO (YYYY-MM-DD)</option>
            </select>
          </label>
          <p className="admin-settings-hint">Preview: {sampleDate}</p>
          <label className="admin-settings-row">
            <span className="admin-settings-label">Rows per page (tables)</span>
            <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-settings-fieldset">
        <legend>Orders</legend>
        <div className="admin-settings-list">
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
          <label className="admin-settings-row">
            <span className="admin-settings-label">Default: new order lines use…</span>
            <select
              value={adminOrderLinePricingDefault}
              onChange={(e) =>
                setAdminOrderLinePricingDefault(e.target.value as AdminOrderLinePricingMode)
              }
              className="admin-settings-select"
            >
              <option value="catalogue">Catalogue list price</option>
              <option value="customer_rules">Customer pricing (rules + account discount)</option>
            </select>
          </label>
          <p className="admin-settings-hint">
            Used on <strong>Order detail</strong> when adding catalogue lines with &quot;Use my
            default&quot;.
          </p>
        </div>
      </fieldset>

      <fieldset className="admin-settings-fieldset">
        <legend>Catalogue</legend>
        <div className="admin-settings-list">
          <label className="admin-settings-row">
            <span className="admin-settings-label">Default browse mode</span>
            <select
              value={defaultCatalogBrowseMode}
              onChange={(e) => setDefaultCatalogBrowseMode(e.target.value as CatalogBrowseModePref)}
            >
              <option value="category">Product categories</option>
              <option value="range">Kitchen ranges</option>
            </select>
          </label>
          <label className="admin-settings-row">
            <span className="admin-settings-label">Show inactive products by default</span>
            <input
              type="checkbox"
              checked={showInactiveProductsInCatalogue}
              onChange={(e) => setShowInactiveProductsInCatalogue(e.target.checked)}
            />
          </label>
          <label className="admin-settings-row">
            <span className="admin-settings-label">Expand high-confidence smart suggestions</span>
            <input
              type="checkbox"
              checked={expandSmartSuggestionsByDefault}
              onChange={(e) => setExpandSmartSuggestionsByDefault(e.target.checked)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-settings-fieldset">
        <legend>Safety</legend>
        <div className="admin-settings-list">
          <label className="admin-settings-row">
            <span className="admin-settings-label">Confirm destructive actions</span>
            <input
              type="checkbox"
              checked={confirmDestructiveActions}
              onChange={(e) => setConfirmDestructiveActions(e.target.checked)}
            />
          </label>
          <p className="admin-settings-hint">
            When enabled, deleting categories, wiping the catalogue, and similar actions ask for
            confirmation first.
          </p>
        </div>
      </fieldset>

      <button type="button" className="btn btn-outline btn-small" onClick={resetPrefs}>
        Reset all admin UI preferences
      </button>
    </div>
  )
}
