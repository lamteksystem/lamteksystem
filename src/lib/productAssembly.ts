import { supabase } from '@/lib/supabase'
import { DEFAULT_ASSEMBLY_PART_TYPES, fetchAssemblyPartTypes, partTypeSortOrder } from '@/lib/assemblyPartTypes'
import type { AssemblyLineRow, AssemblyRow, ProductRow } from '@/types/database'

export type AssemblyComponentRole = string

/** Fallback labels when DB part types are unavailable (offline / pre-migration). */
export const ASSEMBLY_COMPONENT_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_ASSEMBLY_PART_TYPES.map((t) => [t.code, t.label])
)

export type AssemblyLineWithProduct = AssemblyLineRow & {
  component_role: AssemblyComponentRole
  product: ProductRow
}

export type ProductAssemblyBom = AssemblyRow & {
  assembly_lines: AssemblyLineWithProduct[]
}

export function sortAssemblyLines<T extends { sort_order: number; component_role?: string }>(
  lines: T[],
  roleOrder?: string[]
): T[] {
  const order = roleOrder ?? DEFAULT_ASSEMBLY_PART_TYPES.map((t) => t.code)
  return [...lines].sort((a, b) => {
    const ra = order.indexOf(a.component_role ?? 'other')
    const rb = order.indexOf(b.component_role ?? 'other')
    const ia = ra === -1 ? order.length : ra
    const ib = rb === -1 ? order.length : rb
    if (ia !== ib) return ia - ib
    return a.sort_order - b.sort_order
  })
}

export function inferComponentRoleFromProduct(
  product: Pick<ProductRow, 'name' | 'sku'>,
  categorySlug?: string | null
): AssemblyComponentRole {
  const slug = (categorySlug ?? '').toLowerCase()
  const sku = (product.sku ?? '').toLowerCase()
  const name = product.name.toLowerCase()
  if (slug.includes('carcass') || slug.includes('unit') || slug.includes('cabinet') || sku.startsWith('carc-')) {
    return 'unit'
  }
  if (slug.includes('drawer') || name.includes('drawer')) return 'drawer'
  if (slug.includes('door') || sku.startsWith('hf-') || name.includes('door')) return 'door'
  if ((slug.includes('hinge') || sku.includes('hinge')) && (name.includes('plate') || sku.includes('bp'))) {
    return 'hinge_plate'
  }
  if (slug.includes('hinge') || sku.includes('hinge')) return 'hinge'
  if (slug.includes('leg') || slug.includes('plinth') || sku.includes('leg')) return 'leg_kit'
  if (
    slug.includes('fitting') ||
    slug.includes('accessories') ||
    slug.includes('wirework') ||
    sku.includes('fit-')
  ) {
    return 'fittings'
  }
  return 'other'
}

/** Sellable complete product → BOM (assembly linked via assemblies.product_id). */
export async function fetchProductAssemblyBom(productId: string): Promise<ProductAssemblyBom | null> {
  const { data: assembly, error } = await supabase
    .from('assemblies')
    .select('*')
    .eq('product_id', productId)
    .eq('active', true)
    .maybeSingle()
  if (error || !assembly) return null

  const { data: lines, error: lineErr } = await supabase
    .from('assembly_lines')
    .select(
      `id, assembly_id, product_id, quantity, sort_order, component_role,
      product:products(id, name, sku, unit_price, category_id, is_stock, active, stock_quantity, catalog_program)`
    )
    .eq('assembly_id', assembly.id)
    .order('sort_order')

  if (lineErr) return null

  const partTypes = await fetchAssemblyPartTypes()
  const roleOrder = partTypeSortOrder(partTypes)

  const assemblyLines = sortAssemblyLines(
    (lines ?? []).map((row) => {
      const r = row as AssemblyLineRow & {
        component_role?: string
        product: ProductRow | ProductRow[]
      }
      const product = Array.isArray(r.product) ? r.product[0] : r.product
      return {
        ...r,
        component_role: r.component_role ?? 'other',
        product,
      }
    }),
    roleOrder
  ) as AssemblyLineWithProduct[]

  return { ...(assembly as AssemblyRow), assembly_lines: assemblyLines }
}

/** Product is used as a component inside other assemblies. */
export async function fetchAssembliesUsingComponent(productId: string): Promise<Pick<AssemblyRow, 'id' | 'name'>[]> {
  const { data: lineData } = await supabase
    .from('assembly_lines')
    .select('assembly_id')
    .eq('product_id', productId)
  const assemblyIds = [...new Set((lineData ?? []).map((r) => r.assembly_id))]
  if (assemblyIds.length === 0) return []
  const { data } = await supabase
    .from('assemblies')
    .select('id, name')
    .in('id', assemblyIds)
    .eq('active', true)
  return (data ?? []) as Pick<AssemblyRow, 'id' | 'name'>[]
}

export async function fetchCompleteProductIds(): Promise<Set<string>> {
  const { data } = await supabase.from('assemblies').select('product_id').not('product_id', 'is', null)
  return new Set((data ?? []).map((r) => r.product_id as string))
}

export async function ensureAssemblyForProduct(product: ProductRow): Promise<{ assemblyId: string | null; error: string | null }> {
  const existing = await fetchProductAssemblyBom(product.id)
  if (existing) return { assemblyId: existing.id, error: null }

  const { data, error } = await supabase
    .from('assemblies')
    .insert({
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      product_id: product.id,
      unit_type: 'other',
      active: true,
    })
    .select('id')
    .single()

  if (error) return { assemblyId: null, error: error.message }
  return { assemblyId: data?.id ?? null, error: null }
}

export async function addAssemblyLine(params: {
  assemblyId: string
  productId: string
  quantity: number
  componentRole: AssemblyComponentRole
  sortOrder?: number
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('assembly_lines').insert({
    assembly_id: params.assemblyId,
    product_id: params.productId,
    quantity: params.quantity,
    component_role: params.componentRole,
    sort_order: params.sortOrder ?? 0,
  })
  return { error: error?.message ?? null }
}

export async function removeAssemblyLine(lineId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('assembly_lines').delete().eq('id', lineId)
  return { error: error?.message ?? null }
}

export async function updateAssemblyLine(
  lineId: string,
  patch: Partial<Pick<AssemblyLineRow, 'quantity' | 'sort_order'>> & { component_role?: AssemblyComponentRole }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('assembly_lines').update(patch).eq('id', lineId)
  return { error: error?.message ?? null }
}
