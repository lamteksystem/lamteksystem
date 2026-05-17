import type { CategoryRow, ProductRow } from '@/types/database'

export interface TealburyFilterState {
  productCode: string
  search: string
  categoryId: string | null
  doorRange: string | null
  section: string | null
}

export const EMPTY_TEALBURY_FILTERS: TealburyFilterState = {
  productCode: '',
  search: '',
  categoryId: null,
  doorRange: null,
  section: null,
}

export interface TealburyFacets {
  doorRanges: string[]
  sections: string[]
}

export function getTealburyOpts(product: ProductRow): Record<string, unknown> {
  const o = product.options
  return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
}

export function getTealburyTradeCode(product: ProductRow): string | null {
  const v = getTealburyOpts(product).tealbury_trade_code
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function getTealburyDoorRange(product: ProductRow): string | null {
  const v = getTealburyOpts(product).tealbury_door_range
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function getTealburySections(product: ProductRow): string[] {
  const s = getTealburyOpts(product).tealbury_sections
  if (Array.isArray(s)) return s.map((x) => String(x).trim()).filter(Boolean)
  if (typeof s === 'string' && s.trim()) return [s.trim()]
  return []
}

export function formatTealburyDimensions(product: ProductRow): string | null {
  const dims = getTealburyOpts(product).tealbury_dims_mm
  if (!dims || typeof dims !== 'object' || Array.isArray(dims)) return null
  const d = dims as { h?: number; w?: number; d?: number }
  const parts: string[] = []
  if (typeof d.h === 'number' && d.h > 0) parts.push(`${d.h}h`)
  if (typeof d.w === 'number' && d.w > 0) parts.push(`${d.w}w`)
  if (typeof d.d === 'number' && d.d > 0) parts.push(`${d.d}d`)
  if (parts.length === 0) return null
  return `${parts.join(' × ')} mm`
}

export function buildTealburyFacets(products: ProductRow[]): TealburyFacets {
  const doorSet = new Set<string>()
  const sectionSet = new Set<string>()
  for (const p of products) {
    const door = getTealburyDoorRange(p)
    if (door) doorSet.add(door)
    for (const s of getTealburySections(p)) sectionSet.add(s)
  }
  return {
    doorRanges: [...doorSet].sort((a, b) => a.localeCompare(b)),
    sections: [...sectionSet].sort((a, b) => a.localeCompare(b)),
  }
}

export function getTealburySpecificationBullets(product: ProductRow): string[] {
  const bullets: string[] = []
  if (product.description) {
    const parts = product.description
      .split(/[\n•;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    bullets.push(...parts)
  }
  const dims = formatTealburyDimensions(product)
  if (dims) bullets.push(dims)
  const door = getTealburyDoorRange(product)
  if (door && !bullets.some((b) => b.toLowerCase().includes(door.toLowerCase()))) {
    bullets.push(`Door range: ${door}`)
  }
  return bullets.slice(0, 6)
}

export function getTealburyPropertiesRows(product: ProductRow): { label: string; value: string }[] {
  const opts = getTealburyOpts(product)
  const rows: { label: string; value: string }[] = []
  const door = getTealburyDoorRange(product)
  if (door) rows.push({ label: 'Door range', value: door })
  const dims = formatTealburyDimensions(product)
  if (dims) rows.push({ label: 'Dimensions', value: dims })
  const trade = getTealburyTradeCode(product)
  if (trade) rows.push({ label: 'Trade code', value: trade })
  const sections = getTealburySections(product)
  if (sections.length > 0) rows.push({ label: 'Section', value: sections.join(', ') })
  const finishes = opts.tealbury_finish_prices_gbp
  if (finishes && typeof finishes === 'object' && !Array.isArray(finishes)) {
    const keys = Object.keys(finishes as Record<string, number>).slice(0, 3)
    if (keys.length > 0) rows.push({ label: 'Finishes', value: keys.join(', ') })
  }
  return rows.slice(0, 6)
}

export function filterTealburyProducts(
  products: ProductRow[],
  filters: TealburyFilterState,
): ProductRow[] {
  return products.filter((p) => {
    if (filters.categoryId && p.category_id !== filters.categoryId) return false
    if (filters.doorRange && getTealburyDoorRange(p) !== filters.doorRange) return false
    if (filters.section && !getTealburySections(p).includes(filters.section)) return false

    if (filters.productCode.trim()) {
      const code = filters.productCode.trim().toLowerCase()
      const sku = (p.sku ?? '').toLowerCase()
      const trade = (getTealburyTradeCode(p) ?? '').toLowerCase()
      if (!sku.includes(code) && !trade.includes(code)) return false
    }

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      const hay = [
        p.name,
        p.sku,
        p.description,
        getTealburyTradeCode(p),
        getTealburyDoorRange(p),
        ...getTealburySections(p),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

export function categoryNameById(categories: CategoryRow[]): Map<string, string> {
  return new Map(categories.map((c) => [c.id, c.name]))
}

export function displayProductCode(product: ProductRow): string {
  return getTealburyTradeCode(product) ?? product.sku ?? '—'
}
