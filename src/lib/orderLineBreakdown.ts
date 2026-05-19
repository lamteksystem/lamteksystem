import { fetchProductAssemblyBom, type ProductAssemblyBom } from '@/lib/productAssembly'

export interface OrderLineComponentRow {
  label: string
  sku?: string
  quantity?: number
  detail?: string
}

export function componentsFromOrderLineOptions(
  options: Record<string, unknown>,
): OrderLineComponentRow[] {
  const raw = options.components
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? [raw]
      : []
  return list
    .map((entry) => {
      if (typeof entry === 'string') {
        return { label: entry.trim() }
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const o = entry as Record<string, unknown>
        const label = String(o.name ?? o.label ?? o.description ?? o.sku ?? '').trim()
        if (!label) return null
        return {
          label,
          sku: typeof o.sku === 'string' ? o.sku : undefined,
          quantity: typeof o.quantity === 'number' ? o.quantity : undefined,
          detail: typeof o.role === 'string' ? o.role : undefined,
        }
      }
      return null
    })
    .filter((x): x is OrderLineComponentRow => Boolean(x))
}

export function bomToComponentRows(bom: ProductAssemblyBom): OrderLineComponentRow[] {
  return bom.assembly_lines.map((line) => ({
    label: line.product?.name ?? 'Component',
    sku: line.product?.sku ?? undefined,
    quantity: line.quantity,
    detail: line.component_role,
  }))
}

export async function loadOrderLineBreakdown(
  productId: string | null,
  options: Record<string, unknown>,
): Promise<{ rows: OrderLineComponentRow[]; source: 'bom' | 'options' | 'single' }> {
  if (productId) {
    const bom = await fetchProductAssemblyBom(productId)
    if (bom && bom.assembly_lines.length > 0) {
      return { rows: bomToComponentRows(bom), source: 'bom' }
    }
  }
  const fromOptions = componentsFromOrderLineOptions(options)
  if (fromOptions.length > 0) {
    return { rows: fromOptions, source: 'options' }
  }
  return { rows: [], source: 'single' }
}
