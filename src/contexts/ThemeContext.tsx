import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export type ThemeId = 'auto' | 'light' | 'dark'

const PREF_KEY = 'theme'
const DEFAULT_THEME: ThemeId = 'auto'

type ThemeContextValue = {
  theme: ThemeId
  resolvedTheme: 'light' | 'dark'
  setTheme: (value: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(theme: ThemeId): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(resolveTheme(DEFAULT_THEME))
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        applyTheme(DEFAULT_THEME)
        setThemeState(DEFAULT_THEME)
        setInitialised(true)
        return
      }
      supabase
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', PREF_KEY)
        .maybeSingle()
        .then(({ data }) => {
          const raw = String(data?.value ?? DEFAULT_THEME)
          const v: ThemeId =
            raw === 'light' || raw === 'dark' || raw === 'auto'
              ? raw
              : 'auto'
          setThemeState(v)
          setResolvedTheme(resolveTheme(v))
          applyTheme(v)
          setInitialised(true)
        })
    })
  }, [])

  useEffect(() => {
    if (!initialised) return
    setResolvedTheme(resolveTheme(theme))
    applyTheme(theme)
  }, [theme, initialised])

  useEffect(() => {
    if (!initialised || theme !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [initialised, theme])

  const setTheme = useCallback(async (value: ThemeId) => {
    setThemeState(value)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_preferences').upsert(
      { user_id: user.id, key: PREF_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    )
  }, [])

  const value: ThemeContextValue = { theme, resolvedTheme, setTheme }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { theme: DEFAULT_THEME as ThemeId, resolvedTheme: resolveTheme(DEFAULT_THEME), setTheme: async () => {} }
  return ctx
}
