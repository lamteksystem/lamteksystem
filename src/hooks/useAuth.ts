import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const next = session?.user ?? null
      setUser((prev) => (prev?.id === next?.id ? prev : next))
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null
      setUser((prev) => (prev?.id === next?.id ? prev : next))
    })
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
