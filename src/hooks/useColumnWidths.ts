/**
 * Persist column widths (px) in user_preferences. Key: admin_columns_<scope>_widths
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PREF_PREFIX = 'admin_columns_'
const PREF_SUFFIX = '_widths'

const MIN_WIDTH = 40
// Generous upper bound so users can widen columns substantially; only guards
// against truly runaway persisted values.
const MAX_WIDTH = 800

function sanitizeWidths(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(input)) {
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number.parseFloat(raw)
          : Number.NaN
    if (!Number.isFinite(n)) continue
    out[key] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n))
  }
  return out
}

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
              const parsed = JSON.parse(data.value as string) as Record<string, unknown>
              if (parsed && typeof parsed === 'object') setWidthsState(sanitizeWidths(parsed))
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
      const safe = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, widthPx))
      setWidthsState((prev) => ({ ...prev, [columnId]: safe }))
    },
    []
  )

  const persistWidths = useCallback(
    (currentWidths: Record<string, number>) => {
      persist(currentWidths)
    },
    [persist]
  )

  const resetWidths = useCallback(
    (defaults: Record<string, number>) => {
      const safe = sanitizeWidths(defaults)
      setWidthsState(safe)
      void persist(safe)
    },
    [persist]
  )

  return { widths, setWidth, persistWidths, resetWidths, initialised }
}
