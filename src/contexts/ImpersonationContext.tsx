import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

type ImpersonationContextValue = {
  impersonatingUserId: string | null
  setImpersonating: (userId: string | null) => void
  effectiveUserId: string | null
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null)

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [impersonatingUserId, setImpersonatingState] = useState<string | null>(null)

  const setImpersonating = useCallback((userId: string | null) => {
    setImpersonatingState(userId)
  }, [])

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
