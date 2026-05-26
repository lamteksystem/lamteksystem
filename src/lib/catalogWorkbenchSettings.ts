import { supabase } from '@/lib/supabase'
import {
  CATALOG_WORKBENCH_DEFAULT_ORDER_IDS,
  CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS,
  normalizeWorkbenchColumnOrder,
  normalizeWorkbenchVisibleIds,
} from '@/lib/catalogWorkbenchColumns'

export interface CatalogWorkbenchColumnDefaults {
  order: string[]
  visible: string[]
  updatedAt: string | null
}

const FALLBACK: CatalogWorkbenchColumnDefaults = {
  order: [...CATALOG_WORKBENCH_DEFAULT_ORDER_IDS],
  visible: [...CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS],
  updatedAt: null,
}

export async function fetchCatalogWorkbenchColumnDefaults(): Promise<CatalogWorkbenchColumnDefaults> {
  const { data, error } = await supabase
    .from('catalog_workbench_settings')
    .select('column_order, column_visible, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) return { ...FALLBACK }

  return {
    order: normalizeWorkbenchColumnOrder(data.column_order ?? []),
    visible: normalizeWorkbenchVisibleIds(data.column_visible ?? []),
    updatedAt: data.updated_at ?? null,
  }
}

export async function saveCatalogWorkbenchColumnDefaults(
  order: string[],
  visible: string[],
): Promise<CatalogWorkbenchColumnDefaults> {
  const normalizedOrder = normalizeWorkbenchColumnOrder(order)
  const normalizedVisible = normalizeWorkbenchVisibleIds(visible)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('catalog_workbench_settings')
    .upsert(
      {
        id: 1,
        column_order: normalizedOrder,
        column_visible: normalizedVisible,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: 'id' },
    )
    .select('column_order, column_visible, updated_at')
    .single()

  if (error) throw error

  return {
    order: normalizeWorkbenchColumnOrder(data.column_order ?? []),
    visible: normalizeWorkbenchVisibleIds(data.column_visible ?? []),
    updatedAt: data.updated_at ?? null,
  }
}
