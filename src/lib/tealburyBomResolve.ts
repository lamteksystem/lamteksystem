import type { AssemblyWithLines, ProductRow } from '@/types/database'
import type { HingeBrand } from '@/lib/tealburyOrderSetup'

const HINGE_ROLES = new Set(['hinge', 'hinge_plate'])

export function productMatchesHingeBrand(
  product: Pick<ProductRow, 'name' | 'sku' | 'description'>,
  brand: HingeBrand,
): boolean {
  const hay = `${product.name} ${product.sku ?? ''} ${product.description ?? ''}`.toLowerCase()
  if (hay.includes(brand)) return true
  // Pricelist uses "Hettich" SKUs; order setup offers Hafele as the brand choice.
  if (brand === 'hafele' && hay.includes('hettich')) return true
  if (brand === 'titus' && (hay.includes('titus') || hay.startsWith('tit'))) return true
  return false
}

/**
 * Swap hinge / hinge-plate BOM lines to catalogue SKUs matching the order's hinge brand.
 * Falls back to the assembly's default line when no matching product exists.
 */
export function resolveAssemblyForHingeBrand(
  assembly: AssemblyWithLines,
  hingeBrand: HingeBrand | null | undefined,
  candidateProducts: ProductRow[],
): AssemblyWithLines {
  if (!hingeBrand) return assembly
  const lines = assembly.assembly_lines ?? []
  const resolved = lines.map((line) => {
    const role = line.component_role
    if (!role || !HINGE_ROLES.has(role)) return line
    const pool = candidateProducts.filter(
      (p) =>
        p.active &&
        p.part_type === role &&
        productMatchesHingeBrand(p, hingeBrand),
    )
    if (pool.length === 0) return line
    const pick =
      pool.find((p) => (p.stock_quantity ?? 0) > 0) ??
      pool.sort((a, b) => a.name.localeCompare(b.name))[0]
    return { ...line, product: pick }
  })
  return { ...assembly, assembly_lines: resolved }
}
