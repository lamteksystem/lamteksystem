import { useCallback, useEffect, useState } from 'react'
import { fetchOrderingBehaviours } from '@/lib/orderingBehaviours'
import type { OrderingBehaviourDefinitionRow } from '@/types/database'

export function useOrderingBehaviours() {
  const [rows, setRows] = useState<OrderingBehaviourDefinitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrderingBehaviours({ force: true })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ordering behaviours.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const labelMap = new Map(rows.map((r) => [r.code, r.label]))

  return {
    behaviours: rows,
    labelMap,
    loading,
    error,
    reload,
    labelFor: (code: string | null | undefined) =>
      labelMap.get(code ?? '') ?? code ?? 'standard',
  }
}
