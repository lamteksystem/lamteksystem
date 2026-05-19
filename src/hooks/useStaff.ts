import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface StaffProfileRow {
  id: string
  user_id: string
  role: 'admin' | 'staff'
  display_name: string | null
}

export function useStaff() {
  const { user, loading: authLoading } = useAuth()
  const [staffProfile, setStaffProfile] = useState<StaffProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (isRetry = false) => {
    if (!user) {
      setStaffProfile(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('id, user_id, role, display_name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error && !isRetry) {
      setTimeout(() => refresh(true), 500)
      return
    }
    if (error && isRetry) {
      setStaffProfile(null)
      setLoading(false)
      return
    }
    // RLS can return empty (no row) instead of error when session isn't ready yet – retry once
    if (data == null && !isRetry) {
      setTimeout(() => refresh(true), 500)
      return
    }
    setStaffProfile(data ?? null)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setStaffProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
  }, [user?.id, refresh])

  return {
    isStaff: !!staffProfile,
    staffProfile,
    loading: authLoading || loading,
    refresh,
  }
}
