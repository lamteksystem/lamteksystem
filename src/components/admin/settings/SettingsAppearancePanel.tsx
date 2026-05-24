import { useAdminUi, type TableDensity } from '@/contexts/AdminUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'

export default function SettingsAppearancePanel() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarAccordion,
    updatePrefs,
    sidebarGroups,
    tableDensity,
    setTableDensity,
    showSkuInCatalogueTables,
    setShowSkuInCatalogueTables,
    resetPrefs,
  } = useAdminUi()
  const { theme, setTheme } = useTheme()

  function toggleSidebarGroup(key: string, open: boolean) {
    updatePrefs({ sidebarGroups: { ...sidebarGroups, [key]: open } })
  }

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Colour theme and layout preferences. Theme is saved to your staff account; layout options
        are per-user.
      </p>

      <fieldset className="admin-settings-fieldset">
        <legend>Theme</legend>
        <div className="admin-settings-list">
          <div className="admin-settings-row">
            <span className="admin-settings-label">Colour theme</span>
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
        </div>
      </fieldset>

      <fieldset className="admin-settings-fieldset">
        <legend>Sidebar</legend>
        <div className="admin-settings-list">
          <label className="admin-settings-row">
            <span className="admin-settings-label">Collapsed by default</span>
            <input
              type="checkbox"
              checked={sidebarCollapsed}
              onChange={(e) => setSidebarCollapsed(e.target.checked)}
            />
          </label>
          <label className="admin-settings-row">
            <span className="admin-settings-label">Only one section open at a time</span>
            <input
              type="checkbox"
              checked={sidebarAccordion}
              onChange={(e) => updatePrefs({ sidebarAccordion: e.target.checked })}
            />
          </label>
          <p className="admin-settings-hint">Default expanded groups when the sidebar loads:</p>
          {(
            [
              ['orders', 'Orders'],
              ['customers', 'Customers'],
              ['catalogue', 'Catalogue'],
              ['users', 'Users & access'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="admin-settings-row admin-settings-row--indent">
              <span className="admin-settings-label">{label}</span>
              <input
                type="checkbox"
                checked={!!sidebarGroups[key]}
                onChange={(e) => toggleSidebarGroup(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="admin-settings-fieldset">
        <legend>Tables</legend>
        <div className="admin-settings-list">
          <label className="admin-settings-row">
            <span className="admin-settings-label">Table density</span>
            <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as TableDensity)}>
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
          <label className="admin-settings-row">
            <span className="admin-settings-label">Show SKU in catalogue tables</span>
            <input
              type="checkbox"
              checked={showSkuInCatalogueTables}
              onChange={(e) => setShowSkuInCatalogueTables(e.target.checked)}
            />
          </label>
          <p className="admin-settings-hint">
            Density applies on Orders and Customers. SKU visibility applies on Catalogue and smart
            categorise where a SKU column is shown.
          </p>
        </div>
      </fieldset>

      <button type="button" className="btn btn-outline btn-small" onClick={resetPrefs}>
        Reset appearance preferences
      </button>
    </div>
  )
}
