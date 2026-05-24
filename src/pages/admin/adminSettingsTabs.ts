export type AdminSettingsTabId =
  | 'general'
  | 'appearance'
  | 'marketing'
  | 'products'
  | 'categories'
  | 'danger'

export const ADMIN_SETTINGS_TABS: { id: AdminSettingsTabId; label: string; description: string }[] = [
  { id: 'general', label: 'General', description: 'Tables, dates, orders, and catalogue defaults' },
  { id: 'appearance', label: 'Appearance', description: 'Theme, sidebar, and table density' },
  { id: 'marketing', label: 'Marketing', description: 'Public homepage carousel' },
  { id: 'products', label: 'Products & inventory', description: 'BOM part types, SKU display, and catalogue tools' },
  { id: 'categories', label: 'Catalogue taxonomy', description: 'Category types and the live category tree' },
  { id: 'danger', label: 'Danger zone', description: 'Backup and destructive resets' },
]

export function parseAdminSettingsTab(raw: string | null): AdminSettingsTabId {
  const ids = ADMIN_SETTINGS_TABS.map((t) => t.id)
  if (raw && ids.includes(raw as AdminSettingsTabId)) return raw as AdminSettingsTabId
  return 'general'
}
