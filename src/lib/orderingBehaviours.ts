import { supabase } from '@/lib/supabase'
import type { OrderingBehaviourDefinitionRow } from '@/types/database'

export const DEFAULT_ORDERING_BEHAVIOURS: Pick<
  OrderingBehaviourDefinitionRow,
  'code' | 'label' | 'description' | 'sort_order' | 'is_system'
>[] = [
  {
    code: 'standard',
    label: 'Standard — search & add',
    description: 'Default product search and add-to-order flow.',
    sort_order: 10,
    is_system: true,
  },
  {
    code: 'tealbury_complete',
    label: 'Tealbury Complete — guided setup + BOM units',
    description: 'Tealbury kitchen wizard and complete units with BOM explosion.',
    sort_order: 20,
    is_system: true,
  },
  {
    code: 'component_only',
    label: 'Components only — individual parts',
    description: 'Browse and add individual components rather than complete units.',
    sort_order: 30,
    is_system: true,
  },
  {
    code: 'accessory',
    label: 'Accessories — plinth, cornice, posts, etc.',
    description: 'Cross-range accessories and add-on items.',
    sort_order: 40,
    is_system: true,
  },
]

let cache: OrderingBehaviourDefinitionRow[] | null = null

export function invalidateOrderingBehavioursCache(): void {
  cache = null
}

export function slugifyOrderingBehaviourCode(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'behaviour'
  )
}

function uniqueCode(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

export async function fetchOrderingBehaviours(options?: {
  force?: boolean
}): Promise<OrderingBehaviourDefinitionRow[]> {
  if (!options?.force && cache) return cache

  const { data, error } = await supabase
    .from('ordering_behaviour_definitions')
    .select('*')
    .order('sort_order')
    .order('label')

  if (error) {
    return DEFAULT_ORDERING_BEHAVIOURS.map((row) => ({
      ...row,
      created_at: '',
      updated_at: '',
    })) as OrderingBehaviourDefinitionRow[]
  }

  const rows = (data ?? []) as OrderingBehaviourDefinitionRow[]
  cache = rows.length > 0 ? rows : null
  return rows.length > 0
    ? rows
    : (DEFAULT_ORDERING_BEHAVIOURS.map((row) => ({
        ...row,
        created_at: '',
        updated_at: '',
      })) as OrderingBehaviourDefinitionRow[])
}

export function orderingBehaviourLabelMap(
  rows: OrderingBehaviourDefinitionRow[],
): Map<string, string> {
  return new Map(rows.map((r) => [r.code, r.label]))
}

export async function createOrderingBehaviour(params: {
  label: string
  code?: string
  description?: string
}): Promise<{ row: OrderingBehaviourDefinitionRow | null; error: string | null }> {
  const label = params.label.trim()
  if (!label) return { row: null, error: 'Behaviour name is required.' }

  const existing = await fetchOrderingBehaviours({ force: true })
  const codes = new Set(existing.map((r) => r.code))
  const base = (params.code?.trim() || slugifyOrderingBehaviourCode(label)).toLowerCase()
  const code = uniqueCode(base, codes)
  const maxSort = existing.reduce((m, r) => Math.max(m, r.sort_order), 0)

  const { data, error } = await supabase
    .from('ordering_behaviour_definitions')
    .insert({
      code,
      label,
      description: params.description?.trim() || null,
      sort_order: maxSort + 10,
      is_system: false,
    })
    .select('*')
    .single()

  if (error) return { row: null, error: error.message }
  invalidateOrderingBehavioursCache()
  return { row: data as OrderingBehaviourDefinitionRow, error: null }
}

export async function updateOrderingBehaviour(
  code: string,
  patch: Partial<Pick<OrderingBehaviourDefinitionRow, 'label' | 'description' | 'sort_order' | 'is_system'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ordering_behaviour_definitions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (!error) invalidateOrderingBehavioursCache()
  return { error: error?.message ?? null }
}

export async function deleteOrderingBehaviour(code: string): Promise<{ error: string | null }> {
  const { count, error: countErr } = await supabase
    .from('category_types')
    .select('code', { count: 'exact', head: true })
    .eq('ordering_behaviour', code)
  if (countErr) return { error: countErr.message }
  if ((count ?? 0) > 0) {
    return {
      error: `${count} category type(s) use this behaviour. Change them first.`,
    }
  }

  const { error } = await supabase
    .from('ordering_behaviour_definitions')
    .delete()
    .eq('code', code)
    .eq('is_system', false)
  if (!error) invalidateOrderingBehavioursCache()
  return { error: error?.message ?? null }
}
