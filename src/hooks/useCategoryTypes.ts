import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  categoryTypeLabelMap,
  DEFAULT_CATEGORY_TYPES,
  fetchCategoryTypes,
} from '@/lib/categoryTypes'
import type { CategoryTypeRow } from '@/types/database'

export function useCategoryTypes(activeOnly = false) {
  const [types, setTypes] = useState<CategoryTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchCategoryTypes({ activeOnly, force: true })
      setTypes(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load category types.')
      setTypes(
        DEFAULT_CATEGORY_TYPES.map((row) => ({
          ...row,
          active: true,
          created_at: '',
          updated_at: '',
        })) as CategoryTypeRow[],
      )
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    void reload()
  }, [reload])

  const labels = useMemo(() => categoryTypeLabelMap(types), [types])

  return { types, labels, loading, error, reload }
}
