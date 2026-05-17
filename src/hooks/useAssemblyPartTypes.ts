import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_ASSEMBLY_PART_TYPES,
  fetchAssemblyPartTypes,
  partTypeLabelsMap,
  partTypeSortOrder,
} from '@/lib/assemblyPartTypes'
import type { AssemblyPartTypeRow } from '@/types/database'

export function useAssemblyPartTypes(activeOnly = true) {
  const [types, setTypes] = useState<AssemblyPartTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAssemblyPartTypes({ activeOnly, force: true })
      setTypes(
        rows.length > 0
          ? rows
          : DEFAULT_ASSEMBLY_PART_TYPES.map((row) => ({
              ...row,
              active: true,
              created_at: '',
              updated_at: '',
            }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load part types.')
      setTypes(
        DEFAULT_ASSEMBLY_PART_TYPES.map((row) => ({
          ...row,
          active: true,
          created_at: '',
          updated_at: '',
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    void reload()
  }, [reload])

  const labels = useMemo(() => partTypeLabelsMap(types), [types])
  const roleOrder = useMemo(() => partTypeSortOrder(types), [types])

  return { types, labels, roleOrder, loading, error, reload }
}
