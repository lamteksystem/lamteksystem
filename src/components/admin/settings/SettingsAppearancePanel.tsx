import { useAdminUi, type TableDensity } from '@/contexts/AdminUiContext'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'

export default function SettingsAppearancePanel() {
  const { theme, setTheme } = useTheme()
  const { sidebarCollapsed, setSidebarCollapsed, sidebarAccordion, updatePrefs, tableDensity, setTableDensity } =
    useAdminUi()

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Colour theme and layout preferences. Theme is saved to your staff account.
      </p>
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
        <label className="admin-settings-row">
          <span className="admin-settings-label">Sidebar collapsed by default</span>
          <input type="checkbox" checked={sidebarCollapsed} onChange={(e) => setSidebarCollapsed(e.target.checked)} />
        </label>
        <label className="admin-settings-row">
          <span className="admin-settings-label">Sidebar: only one section open at a time</span>
          <input
            type="checkbox"
            checked={sidebarAccordion}
            onChange={(e) => updatePrefs({ sidebarAccordion: e.target.checked })}
          />
        </label>
        <label className="admin-settings-row">
          <span className="admin-settings-label">Table density</span>
          <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as TableDensity)}>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <p className="admin-settings-hint">
          Table density applies on Orders and Customers. Sidebar accordion controls how nav groups expand.
        </p>
      </div>
    </div>
  )
}
