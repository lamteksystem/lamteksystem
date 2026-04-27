import { useEffect, useState } from 'react'
import { hasPermission, type PermissionAction } from '@/lib/permissions'
import { useStaff } from '@/hooks/useStaff'

export function usePermission(scope: string, action: PermissionAction): { allowed: boolean; loading: boolean } {
  const { staffProfile, loading: staffLoading } = useStaff()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (staffLoading) return
    let cancelled = false
    setLoading(true)
    hasPermission(scope, action, { staff: staffProfile ?? null })
      .then((ok) => { if (!cancelled) setAllowed(ok) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, action, staffProfile?.id, staffLoading])

  return { allowed, loading }
}

