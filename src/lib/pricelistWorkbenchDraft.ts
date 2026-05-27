import { supabase } from '@/lib/supabase'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { parseWarningsJson, type WorkbenchWarning } from '@/lib/pricelistWorkbenchWarnings'

const DRAFT_ID = 'global'

export interface WorkbenchDraftBundle {
  rows: PricelistWorkbenchRow[]
  warnings: WorkbenchWarning[]
  updated_at: string | null
}

export async function loadWorkbenchDraft(): Promise<WorkbenchDraftBundle> {
  const { data, error } = await supabase
    .from('catalogue_workbench_drafts')
    .select('rows, warnings, updated_at')
    .eq('id', DRAFT_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) return { rows: [], warnings: [], updated_at: null }
  const rows = Array.isArray(data.rows) ? (data.rows as PricelistWorkbenchRow[]) : []
  const warnings = parseWarningsJson(data.warnings)
  return {
    rows,
    warnings,
    updated_at: data.updated_at ?? null,
  }
}

export async function saveWorkbenchDraft(
  rows: PricelistWorkbenchRow[],
  warnings: WorkbenchWarning[] = []
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('catalogue_workbench_drafts').upsert({
    id: DRAFT_ID,
    rows,
    warnings,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  })
  if (error) throw error
}

export async function clearWorkbenchDraft(): Promise<void> {
  const { error } = await supabase.from('catalogue_workbench_drafts').upsert({
    id: DRAFT_ID,
    rows: [],
    warnings: [],
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
