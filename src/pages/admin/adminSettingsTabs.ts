export type AdminSettingsTabId =
  | 'general'
  | 'appearance'
  | 'marketing'
  | 'products'
  | 'categories'
  | 'danger'

export const ADMIN_SETTINGS_TABS: { id: AdminSettingsTabId; label: string; description: string }[] = [
  { id: 'general', label: 'General', description: 'Tables, dates, and order defaults' },
  { id: 'appearance', label: 'Appearance', description: 'Theme and admin layout' },
  { id: 'marketing', label: 'Marketing', description: 'Public homepage carousel' },
  { id: 'products', label: 'Products & inventory', description: 'BOM part types and catalogue tools' },
  { id: 'categories', label: 'Categories', description: 'Catalogue category list' },
  { id: 'danger', label: 'Danger zone', description: 'Backup and destructive resets' },
]

export function parseAdminSettingsTab(raw: string | null): AdminSettingsTabId {
  const ids = ADMIN_SETTINGS_TABS.map((t) => t.id)
  if (raw && ids.includes(raw as AdminSettingsTabId)) return raw as AdminSettingsTabId
  return 'general'
}
