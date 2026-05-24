import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import { normalizePageSize } from '@/lib/listPagination'

export type TableDensity = 'compact' | 'comfortable' | 'spacious'
export type DateFormat = 'locale' | 'ddmmyyyy' | 'iso'
export type CatalogBrowseModePref = 'category' | 'range'

/** How admin order detail sets unit prices when adding catalogue lines (staff). */
export type AdminOrderLinePricingMode = 'catalogue' | 'customer_rules'

export interface AdminUiPrefs {
  sidebarCollapsed: boolean
  sidebarAccordion: boolean
  sidebarGroups: Record<string, boolean>
  tableDensity: TableDensity
  dateFormat: DateFormat
  rowsPerPage: number
  defaultOrderStatusFilter: string
  /** Default for order detail: list price vs resolve rules + account discount when adding lines. */
  adminOrderLinePricingDefault: AdminOrderLinePricingMode
  /** Require confirmation before destructive admin actions (delete category, wipe, etc.). */
  confirmDestructiveActions: boolean
  /** Show SKU column in catalogue and smart categorise tables where space allows. */
  showSkuInCatalogueTables: boolean
  /** Default browse mode when opening the catalogue (category tree vs kitchen ranges). */
  defaultCatalogBrowseMode: CatalogBrowseModePref
  /** Include inactive products in admin catalogue list filters by default. */
  showInactiveProductsInCatalogue: boolean
  /** Expand high-confidence smart categorise suggestions on first load. */
  expandSmartSuggestionsByDefault: boolean
}

const defaults: AdminUiPrefs = {
  sidebarCollapsed: false,
  sidebarAccordion: true,
  sidebarGroups: {
    orders: false,
    customers: false,
    catalogue: false,
    finance: false,
    users: false,
  },
  tableDensity: 'comfortable',
  dateFormat: 'locale',
  rowsPerPage: 50,
  defaultOrderStatusFilter: '',
  adminOrderLinePricingDefault: 'catalogue',
  confirmDestructiveActions: true,
  showSkuInCatalogueTables: true,
  defaultCatalogBrowseMode: 'category',
  showInactiveProductsInCatalogue: false,
  expandSmartSuggestionsByDefault: false,
}

const PREF_KEY = 'admin_ui_prefs'

type AdminUiContextValue = AdminUiPrefs & {
  setSidebarCollapsed: (v: boolean) => void
  setTableDensity: (v: TableDensity) => void
  setDateFormat: (v: DateFormat) => void
  setRowsPerPage: (v: number) => void
  setDefaultOrderStatusFilter: (v: string) => void
  setAdminOrderLinePricingDefault: (v: AdminOrderLinePricingMode) => void
  setConfirmDestructiveActions: (v: boolean) => void
  setShowSkuInCatalogueTables: (v: boolean) => void
  setDefaultCatalogBrowseMode: (v: CatalogBrowseModePref) => void
  setShowInactiveProductsInCatalogue: (v: boolean) => void
  setExpandSmartSuggestionsByDefault: (v: boolean) => void
  updatePrefs: (partial: Partial<AdminUiPrefs>) => void
  resetPrefs: () => void
}

const AdminUiContext = createContext<AdminUiContextValue | null>(null)

export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<AdminUiPrefs>({ ...defaults })
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    let cancelled = false
    getUserPreference(PREF_KEY).then((raw) => {
      if (cancelled) return
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<AdminUiPrefs>
          const merged = { ...defaults, ...parsed }
          if (typeof merged.rowsPerPage === 'number') {
            merged.rowsPerPage = normalizePageSize(merged.rowsPerPage)
          }
          setPrefsState(merged)
        } catch (_) {
          setPrefsState({ ...defaults })
        }
      } else {
        setPrefsState({ ...defaults })
      }
      setInitialised(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!initialised) return
    setUserPreference(PREF_KEY, JSON.stringify(prefs))
  }, [prefs, initialised])

  const setPrefs = useCallback((update: Partial<AdminUiPrefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...update }
      return next
    })
  }, [])

  const resetPrefs = useCallback(() => {
    setPrefsState({ ...defaults })
  }, [])

  const value: AdminUiContextValue = {
    ...prefs,
    setSidebarCollapsed: (v) => setPrefs({ sidebarCollapsed: v }),
    setTableDensity: (v) => setPrefs({ tableDensity: v }),
    setDateFormat: (v) => setPrefs({ dateFormat: v }),
    setRowsPerPage: (v) => setPrefs({ rowsPerPage: normalizePageSize(v) }),
    setDefaultOrderStatusFilter: (v) => setPrefs({ defaultOrderStatusFilter: v }),
    setAdminOrderLinePricingDefault: (v) => setPrefs({ adminOrderLinePricingDefault: v }),
    setConfirmDestructiveActions: (v) => setPrefs({ confirmDestructiveActions: v }),
    setShowSkuInCatalogueTables: (v) => setPrefs({ showSkuInCatalogueTables: v }),
    setDefaultCatalogBrowseMode: (v) => setPrefs({ defaultCatalogBrowseMode: v }),
    setShowInactiveProductsInCatalogue: (v) => setPrefs({ showInactiveProductsInCatalogue: v }),
    setExpandSmartSuggestionsByDefault: (v) => setPrefs({ expandSmartSuggestionsByDefault: v }),
    updatePrefs: setPrefs,
    resetPrefs,
  }

  return (
    <AdminUiContext.Provider value={value}>
      {children}
    </AdminUiContext.Provider>
  )
}

export function useAdminUi() {
  const ctx = useContext(AdminUiContext)
  if (!ctx) throw new Error('useAdminUi must be used within AdminUiProvider')
  return ctx
}

export function formatAdminDate(prefs: AdminUiPrefs, date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (prefs.dateFormat === 'iso') return d.toISOString().slice(0, 10)
  if (prefs.dateFormat === 'ddmmyyyy') return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
