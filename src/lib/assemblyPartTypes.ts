import { supabase } from '@/lib/supabase'
import type { AssemblyPartTypeRow } from '@/types/database'

export const DEFAULT_ASSEMBLY_PART_TYPES: Pick<AssemblyPartTypeRow, 'code' | 'label' | 'sort_order' | 'is_system'>[] = [
  { code: 'complete', label: 'Complete', sort_order: 5, is_system: true },
  { code: 'unit', label: 'Unit / carcass / cabinet', sort_order: 10, is_system: true },
  { code: 'door', label: 'Door', sort_order: 20, is_system: true },
  { code: 'drawer', label: 'Drawer', sort_order: 30, is_system: true },
  { code: 'hinge', label: 'Hinge', sort_order: 40, is_system: true },
  { code: 'hinge_plate', label: 'Hinge plate', sort_order: 50, is_system: true },
  { code: 'leg_kit', label: 'Leg kit', sort_order: 60, is_system: true },
  { code: 'fittings', label: 'Fittings bag', sort_order: 70, is_system: true },
  { code: 'other', label: 'Other', sort_order: 999, is_system: true },
]

let partTypesCache: AssemblyPartTypeRow[] | null = null

/** Ensures built-in part types exist in lists even if the DB seed lags a migration. */
export function mergeAssemblyPartTypesWithDefaults(
  rows: AssemblyPartTypeRow[],
  options?: { activeOnly?: boolean }
): AssemblyPartTypeRow[] {
  const activeOnly = options?.activeOnly ?? false
  const byCode = new Map(rows.map((r) => [r.code, r]))
  for (const def of DEFAULT_ASSEMBLY_PART_TYPES) {
    if (!byCode.has(def.code)) {
      byCode.set(def.code, {
        ...def,
        active: true,
        created_at: '',
        updated_at: '',
      } as AssemblyPartTypeRow)
    }
  }
  const merged = [...byCode.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  )
  return activeOnly ? merged.filter((t) => t.active) : merged
}

export function invalidateAssemblyPartTypesCache(): void {
  partTypesCache = null
}

export function slugifyPartTypeCode(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'part_type'
  )
}

function uniquePartTypeCode(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

export async function fetchAssemblyPartTypes(options?: {
  activeOnly?: boolean
  force?: boolean
}): Promise<AssemblyPartTypeRow[]> {
  const activeOnly = options?.activeOnly ?? false
  if (!options?.force && partTypesCache && !activeOnly) {
    return partTypesCache
  }

  let query = supabase.from('assembly_part_types').select('*').order('sort_order').order('label')
  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) {
    const fallback = DEFAULT_ASSEMBLY_PART_TYPES.map((row) => ({
      ...row,
      active: true,
      created_at: '',
      updated_at: '',
    })) as AssemblyPartTypeRow[]
    return activeOnly ? fallback.filter((t) => t.active) : fallback
  }

  const rows = mergeAssemblyPartTypesWithDefaults((data ?? []) as AssemblyPartTypeRow[], { activeOnly })
  if (!activeOnly) partTypesCache = rows
  return rows
}

export function partTypeLabelsMap(types: AssemblyPartTypeRow[]): Map<string, string> {
  return new Map(types.map((t) => [t.code, t.label]))
}

export function partTypeSortOrder(types: AssemblyPartTypeRow[]): string[] {
  return [...types].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)).map((t) => t.code)
}

export async function createAssemblyPartType(params: {
  label: string
  code?: string
  sort_order?: number
}): Promise<{ partType: AssemblyPartTypeRow | null; error: string | null }> {
  const label = params.label.trim()
  if (!label) return { partType: null, error: 'Part type name is required.' }

  const existing = await fetchAssemblyPartTypes({ force: true })
  const codes = new Set(existing.map((t) => t.code))
  const baseCode = (params.code?.trim() || slugifyPartTypeCode(label)).toLowerCase()
  const code = uniquePartTypeCode(baseCode, codes)

  const maxSort = existing.reduce((m, t) => Math.max(m, t.sort_order), 0)

  const { data, error } = await supabase
    .from('assembly_part_types')
    .insert({
      code,
      label,
      sort_order: params.sort_order ?? maxSort + 10,
      active: true,
      is_system: false,
    })
    .select('*')
    .single()

  if (error) return { partType: null, error: error.message }
  invalidateAssemblyPartTypesCache()
  return { partType: data as AssemblyPartTypeRow, error: null }
}

export async function updateAssemblyPartType(
  code: string,
  patch: Partial<Pick<AssemblyPartTypeRow, 'label' | 'sort_order' | 'active'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('assembly_part_types')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (!error) invalidateAssemblyPartTypesCache()
  return { error: error?.message ?? null }
}

export async function deleteAssemblyPartType(code: string): Promise<{ error: string | null }> {
  const { count, error: countErr } = await supabase
    .from('assembly_lines')
    .select('id', { count: 'exact', head: true })
    .eq('component_role', code)
  if (countErr) return { error: countErr.message }
  if ((count ?? 0) > 0) {
    return { error: 'This part type is used on assembly lines. Deactivate it instead, or reassign those lines first.' }
  }

  const { error } = await supabase.from('assembly_part_types').delete().eq('code', code).eq('is_system', false)
  if (!error) invalidateAssemblyPartTypesCache()
  return { error: error?.message ?? null }
}
