import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ADMIN_SETTINGS_TABS, parseAdminSettingsTab, type AdminSettingsTabId } from '@/pages/admin/adminSettingsTabs'

const SettingsGeneralPanel = lazy(() => import('@/components/admin/settings/SettingsGeneralPanel'))
const SettingsAppearancePanel = lazy(() => import('@/components/admin/settings/SettingsAppearancePanel'))
const SettingsMarketingPanel = lazy(() => import('@/components/admin/AdminMarketingCarouselSettings'))
const SettingsProductsPanel = lazy(() => import('@/components/admin/AdminAssemblyPartTypesSettings'))
const SettingsCategoriesPanel = lazy(() => import('@/components/admin/settings/SettingsCategoriesPanel'))
const SettingsDangerPanel = lazy(() => import('@/components/admin/settings/SettingsDangerPanel'))

function TabPanelFallback() {
  return <p className="admin-muted admin-settings-tab-loading">Loading…</p>
}

function renderTabPanel(tab: AdminSettingsTabId) {
  switch (tab) {
    case 'general':
      return <SettingsGeneralPanel />
    case 'appearance':
      return <SettingsAppearancePanel />
    case 'marketing':
      return <SettingsMarketingPanel embedded />
    case 'products':
      return <SettingsProductsPanel embedded />
    case 'categories':
      return <SettingsCategoriesPanel />
    case 'danger':
      return <SettingsDangerPanel />
    default:
      return <SettingsGeneralPanel />
  }
}

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseAdminSettingsTab(searchParams.get('tab'))
  const activeMeta = ADMIN_SETTINGS_TABS.find((t) => t.id === activeTab) ?? ADMIN_SETTINGS_TABS[0]

  function selectTab(id: AdminSettingsTabId) {
    if (id === 'general') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: id }, { replace: true })
  }

  return (
    <div className="admin-page admin-settings-page">
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p className="page-intro">Configure the admin portal, catalogue, and public marketing site.</p>
      </div>

      <div className="admin-settings-layout card">
        <nav className="admin-settings-tabs" aria-label="Settings sections">
          {ADMIN_SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-settings-tab${activeTab === tab.id ? ' admin-settings-tab--active' : ''}`}
              onClick={() => selectTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="admin-settings-tab-panel">
          <header className="admin-settings-tab-panel-header">
            <h2>{activeMeta.label}</h2>
            <p className="admin-muted">{activeMeta.description}</p>
          </header>
          <Suspense fallback={<TabPanelFallback />}>
            {renderTabPanel(activeTab)}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
