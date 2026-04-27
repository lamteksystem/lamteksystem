/**
 * Persist column widths (px) in user_preferences. Key: admin_columns_<scope>_widths
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PREF_PREFIX = 'admin_columns_'
const PREF_SUFFIX = '_widths'

export function useColumnWidths(scope: string) {
  const [widths, setWidthsState] = useState<Record<string, number>>({})
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) {
        setInitialised(true)
        return
      }
      supabase
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', PREF_PREFIX + scope + PREF_SUFFIX)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          if (data?.value) {
            try {
              const parsed = JSON.parse(data.value as string) as Record<string, number>
              if (parsed && typeof parsed === 'object') setWidthsState(parsed)
            } catch (_) {}
          }
          setInitialised(true)
        })
    })
    return () => { cancelled = true }
  }, [scope])

  const persist = useCallback(
    async (next: Record<string, number>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          key: PREF_PREFIX + scope + PREF_SUFFIX,
          value: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' }
      )
    },
    [scope]
  )

  const setWidth = useCallback(
    (columnId: string, widthPx: number) => {
      setWidthsState((prev) => ({ ...prev, [columnId]: widthPx }))
    },
    []
  )

  const persistWidths = useCallback(
    (currentWidths: Record<string, number>) => {
      persist(currentWidths)
    },
    [persist]
  )

  return { widths, setWidth, persistWidths, initialised }
}
