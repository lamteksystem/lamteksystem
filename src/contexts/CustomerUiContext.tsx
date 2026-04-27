import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'

const PREF_KEY = 'customer_ui_sidebar'
const GROUPS_KEY = 'customer_ui_sidebar_groups'
const ACCORDION_KEY = 'customer_ui_sidebar_accordion'

export type CustomerSidebarGroupId = 'shop' | 'ordering' | 'resources' | 'account'
export type CustomerSidebarGroups = Record<CustomerSidebarGroupId, boolean>

const defaultGroups: CustomerSidebarGroups = {
  shop: false,
  ordering: false,
  resources: false,
  account: false,
}

type CustomerUiContextValue = {
  useSidebarMenu: boolean
  setUseSidebarMenu: (value: boolean) => void
  sidebarGroups: CustomerSidebarGroups
  setSidebarGroupOpen: (group: CustomerSidebarGroupId, open: boolean) => void
  sidebarAccordion: boolean
  setSidebarAccordion: (value: boolean) => void
}

const CustomerUiContext = createContext<CustomerUiContextValue | null>(null)

export function CustomerUiProvider({ children }: { children: ReactNode }) {
  const [useSidebarMenu, setUseSidebarMenuState] = useState(false)
  const [sidebarGroups, setSidebarGroups] = useState<CustomerSidebarGroups>({ ...defaultGroups })
  const [sidebarAccordion, setSidebarAccordionState] = useState(true)
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getUserPreference(PREF_KEY), getUserPreference(GROUPS_KEY), getUserPreference(ACCORDION_KEY)]).then(([rawSidebar, rawGroups, rawAccordion]) => {
      if (cancelled) return
      if (rawSidebar === 'true') setUseSidebarMenuState(true)
      else if (rawSidebar === 'false') setUseSidebarMenuState(false)

      if (rawAccordion === 'true') setSidebarAccordionState(true)
      else if (rawAccordion === 'false') setSidebarAccordionState(false)

      if (rawGroups) {
        try {
          const parsed = JSON.parse(rawGroups) as Partial<CustomerSidebarGroups>
          setSidebarGroups({ ...defaultGroups, ...parsed })
        } catch (_) {
          setSidebarGroups({ ...defaultGroups })
        }
      } else {
        setSidebarGroups({ ...defaultGroups })
      }

      setInitialised(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!initialised) return
    setUserPreference(PREF_KEY, useSidebarMenu ? 'true' : 'false')
  }, [useSidebarMenu, initialised])

  useEffect(() => {
    if (!initialised) return
    setUserPreference(GROUPS_KEY, JSON.stringify(sidebarGroups))
  }, [sidebarGroups, initialised])

  useEffect(() => {
    if (!initialised) return
    setUserPreference(ACCORDION_KEY, sidebarAccordion ? 'true' : 'false')
  }, [sidebarAccordion, initialised])

  const setUseSidebarMenu = useCallback((value: boolean) => {
    setUseSidebarMenuState(value)
  }, [])

  const setSidebarGroupOpen = useCallback((group: CustomerSidebarGroupId, open: boolean) => {
    setSidebarGroups((g) => {
      if (!open) return { ...g, [group]: false }
      if (!sidebarAccordion) return { ...g, [group]: true }
      return {
        shop: group === 'shop',
        ordering: group === 'ordering',
        resources: group === 'resources',
        account: group === 'account',
      }
    })
  }, [sidebarAccordion])

  const setSidebarAccordion = useCallback((value: boolean) => {
    setSidebarAccordionState(value)
  }, [])

  const value: CustomerUiContextValue = {
    useSidebarMenu,
    setUseSidebarMenu,
    sidebarGroups,
    setSidebarGroupOpen,
    sidebarAccordion,
    setSidebarAccordion,
  }

  return (
    <CustomerUiContext.Provider value={value}>
      {children}
    </CustomerUiContext.Provider>
  )
}

export function useCustomerUi() {
  const ctx = useContext(CustomerUiContext)
  if (!ctx) throw new Error('useCustomerUi must be used within CustomerUiProvider')
  return ctx
}
