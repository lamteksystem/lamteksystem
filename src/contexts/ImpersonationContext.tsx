import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

type ImpersonationContextValue = {
  impersonatingUserId: string | null
  setImpersonating: (userId: string | null) => void
  effectiveUserId: string | null
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null)

const STORAGE_KEY = 'lamtek_impersonating_user_id'

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  const [impersonatingUserId, setImpersonatingState] = useState<string | null>(() => {
    try {
      if (typeof sessionStorage === 'undefined') return null
      const s = sessionStorage.getItem(STORAGE_KEY)
      return s && /^[0-9a-f-]{36}$/i.test(s.trim()) ? s.trim() : null
    } catch {
      return null
    }
  })

  const setImpersonating = useCallback((userId: string | null) => {
    setImpersonatingState(userId)
    try {
      if (userId) sessionStorage.setItem(STORAGE_KEY, userId)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore quota / privacy mode */
    }
  }, [])

  /** Clear impersonation storage only after auth finishes and the session ended */
  useEffect(() => {
    if (loading) return
    if (!user) {
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* noop */
      }
      setImpersonatingState(null)
    }
  }, [user, loading])

  const effectiveUserId = (impersonatingUserId || user?.id) ?? null

  const value: ImpersonationContextValue = {
    impersonatingUserId,
    setImpersonating,
    effectiveUserId,
  }

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext)
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider')
  return ctx
}

/** Use for data that should be scoped to the "current" user (customer when impersonating). */
export function useEffectiveUserId() {
  const { user } = useAuth()
  const ctx = useContext(ImpersonationContext)
  if (!ctx) return user?.id ?? null
  return ctx.effectiveUserId
}
