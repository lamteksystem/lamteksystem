/**
 * Column visibility and order: persist in user_preferences (no localStorage).
 * Supports show/hide, drag-and-drop reorder, and reset to default.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface ColumnDef {
  id: string
  label: string
}

const PREF_KEY_PREFIX = 'admin_columns_'

type StoredPref = { order: string[]; visible: string[] }

export interface UseColumnVisibilityOptions {
  /** Full column order used when no user preference exists (and for reset). */
  defaultOrder?: string[]
  /** Bumps when organisation defaults load so unset users pick them up. */
  defaultsEpoch?: string | number | null
}

function mergeOrder(defaultIds: string[], preferred?: string[]): string[] {
  if (!preferred?.length) return defaultIds
  const orderIds = preferred.filter((id) => defaultIds.includes(id))
  const missingOrder = defaultIds.filter((id) => !orderIds.includes(id))
  return [...orderIds, ...missingOrder]
}

function filterVisible(defaultIds: string[], visible?: string[]): string[] {
  if (!visible?.length) return defaultIds
  return visible.filter((id) => defaultIds.includes(id))
}

export function useColumnVisibility(
  scope: string,
  defaultColumns: ColumnDef[],
  defaultVisibleIds?: string[],
  options?: UseColumnVisibilityOptions,
) {
  const defaultIds = defaultColumns.map((c) => c.id)
  const resolvedDefaultOrder = useMemo(
    () => mergeOrder(defaultIds, options?.defaultOrder),
    [defaultIds, options?.defaultOrder?.join(',')],
  )
  const resolvedDefaultVisible = useMemo(() => {
    const visible = filterVisible(defaultIds, defaultVisibleIds)
    return visible.length > 0 ? visible : defaultIds
  }, [defaultIds, defaultVisibleIds?.join(',')])

  const [order, setOrderState] = useState<string[]>(resolvedDefaultOrder)
  const [visibleSet, setVisibleSetState] = useState<Set<string>>(
    () => new Set(resolvedDefaultVisible),
  )
  const [initialised, setInitialised] = useState(false)
  const usedPersistedPrefsRef = useRef(false)

  const visibleIds = useMemo(
    () => order.filter((id) => visibleSet.has(id)),
    [order, visibleSet],
  )
  const columnDefsInOrder = useMemo(
    () =>
      order
        .map((id) => defaultColumns.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c),
    [order, defaultColumns],
  )

  const applyOrgDefaults = useCallback(() => {
    setOrderState(resolvedDefaultOrder)
    setVisibleSetState(new Set(resolvedDefaultVisible))
  }, [resolvedDefaultOrder, resolvedDefaultVisible])

  useEffect(() => {
    let cancelled = false
    usedPersistedPrefsRef.current = false
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
                usedPersistedPrefsRef.current = true
                setOrderState(mergeOrder(defaultIds, resolvedDefaultOrder))
                setVisibleSetState(new Set(filterVisible(defaultIds, parsed as string[])))
              } else if (parsed && Array.isArray(parsed.order) && Array.isArray(parsed.visible)) {
                usedPersistedPrefsRef.current = true
                setOrderState(mergeOrder(defaultIds, (parsed as StoredPref).order))
                setVisibleSetState(new Set(filterVisible(defaultIds, (parsed as StoredPref).visible)))
              }
            } catch {
              /* use defaults */
            }
          }
          setInitialised(true)
        })
    })
    return () => {
      cancelled = true
    }
  }, [scope, defaultIds.join(','), resolvedDefaultOrder.join(',')])

  useEffect(() => {
    if (!initialised || usedPersistedPrefsRef.current) return
    applyOrgDefaults()
  }, [initialised, applyOrgDefaults, options?.defaultsEpoch])

  const persist = useCallback(
    async (payload: StoredPref) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          key: PREF_KEY_PREFIX + scope,
          value: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )
    },
    [scope],
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
    [order, persist],
  )

  const setColumnOrder = useCallback(
    (orderedIds: string[]) => {
      const nextOrder = mergeOrder(defaultIds, orderedIds)
      setOrderState(nextOrder)
      setVisibleSetState((prev) => {
        persist({ order: nextOrder, visible: [...prev] })
        return prev
      })
    },
    [defaultIds, persist],
  )

  const setVisibleIds = useCallback(
    (ids: string[]) => {
      setVisibleSetState(new Set(ids))
      persist({ order, visible: ids })
    },
    [order, persist],
  )

  const resetToDefault = useCallback(() => {
    setOrderState(resolvedDefaultOrder)
    setVisibleSetState(new Set(resolvedDefaultVisible))
    persist({ order: resolvedDefaultOrder, visible: resolvedDefaultVisible })
  }, [resolvedDefaultOrder, resolvedDefaultVisible, persist])

  const isVisible = useCallback((id: string) => visibleSet.has(id), [visibleSet])

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
    defaultVisibleIds: resolvedDefaultVisible,
    defaultOrder: resolvedDefaultOrder,
  }
}
