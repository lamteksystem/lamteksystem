import { useAdminUi, type DateFormat, type AdminOrderLinePricingMode } from '@/contexts/AdminUiContext'
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
    resetPrefs,
  } = adminUi

  const sampleDate = formatAdminDate(adminUi, new Date())

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Defaults for admin tables and order workflows. Changes apply to your account immediately.
      </p>
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
        <label className="admin-settings-row">
          <span className="admin-settings-label">Default order status filter</span>
          <select value={defaultOrderStatusFilter} onChange={(e) => setDefaultOrderStatusFilter(e.target.value)}>
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
            onChange={(e) => setAdminOrderLinePricingDefault(e.target.value as AdminOrderLinePricingMode)}
            className="admin-settings-select"
          >
            <option value="catalogue">Catalogue list price</option>
            <option value="customer_rules">Customer pricing (rules + account discount)</option>
          </select>
        </label>
        <p className="admin-settings-hint">
          Used on <strong>Order detail</strong> when adding catalogue lines with &quot;Use my default&quot;.
        </p>
        <button type="button" className="btn btn-outline btn-small" onClick={resetPrefs}>
          Reset admin UI preferences
        </button>
      </div>
    </div>
  )
}
