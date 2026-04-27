/**
 * Column visibility and order: persist in user_preferences (no localStorage).
 * Supports show/hide, drag-and-drop reorder, and reset to default.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export interface ColumnDef {
  id: string
  label: string
}

const PREF_KEY_PREFIX = 'admin_columns_'

type StoredPref = { order: string[]; visible: string[] }

export function useColumnVisibility(
  scope: string,
  defaultColumns: ColumnDef[]
) {
  const defaultIds = defaultColumns.map((c) => c.id)
  const [order, setOrderState] = useState<string[]>(defaultIds)
  const [visibleSet, setVisibleSetState] = useState<Set<string>>(() => new Set(defaultIds))
  const [initialised, setInitialised] = useState(false)

  const visibleIds = useMemo(
    () => order.filter((id) => visibleSet.has(id)),
    [order, visibleSet]
  )
  const columnDefsInOrder = useMemo(
    () =>
      order
        .map((id) => defaultColumns.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c),
    [order, defaultColumns]
  )

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
        .eq('key', PREF_KEY_PREFIX + scope)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          if (data?.value) {
            try {
              const parsed = JSON.parse(data.value as string)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setOrderState(defaultIds)
                setVisibleSetState(new Set(parsed as string[]))
              } else if (parsed && Array.isArray(parsed.order) && Array.isArray(parsed.visible)) {
                const orderIds = (parsed as StoredPref).order.filter((id) =>
                  defaultIds.includes(id)
                )
                const missingOrder = defaultIds.filter((id) => !orderIds.includes(id))
                setOrderState([...orderIds, ...missingOrder])
                setVisibleSetState(new Set((parsed as StoredPref).visible))
              }
            } catch (_) {}
          }
          setInitialised(true)
        })
    })
    return () => { cancelled = true }
  }, [scope, defaultIds.join(',')])

  const persist = useCallback(
    async (payload: StoredPref) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          key: PREF_KEY_PREFIX + scope,
          value: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' }
      )
    },
    [scope]
  )

  const setColumnVisible = useCallback(
    (id: string, visible: boolean) => {
      setVisibleSetState((prev) => {
        const next = new Set(prev)
        if (visible) next.add(id)
        else next.delete(id)
        persist({ order, visible: [...next] })
        return next
      })
    },
    [order, persist]
  )

  const setColumnOrder = useCallback(
    (orderedIds: string[]) => {
      const valid = orderedIds.filter((id) => defaultIds.includes(id))
      const missing = defaultIds.filter((id) => !valid.includes(id))
      const nextOrder = [...valid, ...missing]
      setOrderState(nextOrder)
      setVisibleSetState((prev) => {
        persist({ order: nextOrder, visible: [...prev] })
        return prev
      })
    },
    [defaultIds, persist]
  )

  const setVisibleIds = useCallback(
    (ids: string[]) => {
      setVisibleSetState(new Set(ids))
      persist({ order, visible: ids })
    },
    [order, persist]
  )

  const resetToDefault = useCallback(() => {
    setOrderState(defaultIds)
    setVisibleSetState(new Set(defaultIds))
    persist({ order: defaultIds, visible: defaultIds })
  }, [defaultIds, persist])

  const isVisible = useCallback(
    (id: string) => visibleSet.has(id),
    [visibleSet]
  )

  return {
    columnDefs: columnDefsInOrder,
    columnDefsAll: defaultColumns,
    order,
    visibleIds,
    setVisibleIds,
    setColumnVisible,
    setColumnOrder,
    resetToDefault,
    isVisible,
    initialised,
  }
}
