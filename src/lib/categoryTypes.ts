import { supabase } from '@/lib/supabase'
import type { CategoryTypeRow } from '@/types/database'

export const DEFAULT_CATEGORY_TYPES: Pick<
  CategoryTypeRow,
  'code' | 'label' | 'description' | 'sort_order' | 'browse_mode' | 'ordering_behaviour' | 'is_system'
>[] = [
  {
    code: 'product_type',
    label: 'Product category',
    description: 'Standard catalogue grouping',
    sort_order: 10,
    browse_mode: 'product',
    ordering_behaviour: 'standard',
    is_system: true,
  },
  {
    code: 'door_range',
    label: 'Kitchen range',
    description: 'Door programme used on orders',
    sort_order: 20,
    browse_mode: 'door_range',
    ordering_behaviour: 'standard',
    is_system: true,
  },
  {
    code: 'universal',
    label: 'Cross-range',
    description: 'Items usable with any range',
    sort_order: 30,
    browse_mode: 'universal',
    ordering_behaviour: 'accessory',
    is_system: true,
  },
  {
    code: 'tealbury_complete',
    label: 'Tealbury Complete',
    description: 'Sellable units with BOM (carcass, doors, hinges, etc.)',
    sort_order: 15,
    browse_mode: 'product',
    ordering_behaviour: 'tealbury_complete',
    is_system: false,
  },
]

export const ORDERING_BEHAVIOUR_LABELS: Record<CategoryTypeRow['ordering_behaviour'], string> = {
  standard: 'Standard — search & add',
  tealbury_complete: 'Tealbury Complete — guided setup + BOM units',
  component_only: 'Components only — individual parts',
  accessory: 'Accessories — plinth, cornice, posts, etc.',
}

let categoryTypesCache: CategoryTypeRow[] | null = null

export function invalidateCategoryTypesCache(): void {
  categoryTypesCache = null
}

export function slugifyCategoryTypeCode(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'category_type'
  )
}

function uniqueTypeCode(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

export async function fetchCategoryTypes(options?: {
  activeOnly?: boolean
  force?: boolean
}): Promise<CategoryTypeRow[]> {
  const activeOnly = options?.activeOnly ?? false
  if (!options?.force && categoryTypesCache && !activeOnly) {
    return categoryTypesCache
  }

  let query = supabase.from('category_types').select('*').order('sort_order').order('label')
  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query
  if (error) {
    return DEFAULT_CATEGORY_TYPES.map((row) => ({
      ...row,
      active: true,
      created_at: '',
      updated_at: '',
    })) as CategoryTypeRow[]
  }

  const rows = (data ?? []) as CategoryTypeRow[]
  if (!activeOnly) categoryTypesCache = rows
  return rows.length > 0
    ? rows
    : (DEFAULT_CATEGORY_TYPES.map((row) => ({
        ...row,
        active: true,
        created_at: '',
        updated_at: '',
      })) as CategoryTypeRow[])
}

export function categoryTypeLabelMap(types: CategoryTypeRow[]): Map<string, string> {
  return new Map(types.map((t) => [t.code, t.label]))
}

export function categoryTypeBrowseMode(
  types: CategoryTypeRow[],
  code: string | null | undefined,
): CategoryTypeRow['browse_mode'] {
  const row = types.find((t) => t.code === code)
  return row?.browse_mode ?? 'product'
}

export function categoryTypeOrderingBehaviour(
  types: CategoryTypeRow[],
  code: string | null | undefined,
): CategoryTypeRow['ordering_behaviour'] {
  const row = types.find((t) => t.code === code)
  return row?.ordering_behaviour ?? 'standard'
}

export async function createCategoryType(params: {
  label: string
  code?: string
  description?: string
  browse_mode?: CategoryTypeRow['browse_mode']
  ordering_behaviour?: CategoryTypeRow['ordering_behaviour']
  sort_order?: number
}): Promise<{ categoryType: CategoryTypeRow | null; error: string | null }> {
  const label = params.label.trim()
  if (!label) return { categoryType: null, error: 'Type name is required.' }

  const existing = await fetchCategoryTypes({ force: true })
  const codes = new Set(existing.map((t) => t.code))
  const baseCode = (params.code?.trim() || slugifyCategoryTypeCode(label)).toLowerCase()
  const code = uniqueTypeCode(baseCode, codes)
  const maxSort = existing.reduce((m, t) => Math.max(m, t.sort_order), 0)

  const { data, error } = await supabase
    .from('category_types')
    .insert({
      code,
      label,
      description: params.description?.trim() || null,
      browse_mode: params.browse_mode ?? 'product',
      ordering_behaviour: params.ordering_behaviour ?? 'standard',
      sort_order: params.sort_order ?? maxSort + 10,
      active: true,
      is_system: false,
    })
    .select('*')
    .single()

  if (error) return { categoryType: null, error: error.message }
  invalidateCategoryTypesCache()
  return { categoryType: data as CategoryTypeRow, error: null }
}

export async function updateCategoryType(
  code: string,
  patch: Partial<
    Pick<CategoryTypeRow, 'label' | 'description' | 'browse_mode' | 'ordering_behaviour' | 'sort_order' | 'active'>
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('category_types')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (!error) invalidateCategoryTypesCache()
  return { error: error?.message ?? null }
}

export async function deleteCategoryType(code: string): Promise<{ error: string | null }> {
  const { count, error: countErr } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('category_kind', code)
  if (countErr) return { error: countErr.message }
  if ((count ?? 0) > 0) {
    return {
      error: `${count} categor${count === 1 ? 'y uses' : 'ies use'} this type. Reassign them first, or hide the type instead.`,
    }
  }

  const { error } = await supabase.from('category_types').delete().eq('code', code).eq('is_system', false)
  if (!error) invalidateCategoryTypesCache()
  return { error: error?.message ?? null }
}
