import type { ColumnDef } from '@/hooks/useColumnVisibility'

/** All configurable product-table columns in the workbench picker. */
export const CATALOG_WORKBENCH_COLUMNS: ColumnDef[] = [
  { id: 'image', label: 'Image' },
  { id: 'code', label: 'Product code' },
  { id: 'name', label: 'Product name' },
  { id: 'sku', label: 'SKU' },
  { id: 'trade_code', label: 'Trade code' },
  { id: 'category', label: 'Category / range' },
  { id: 'door_range', label: 'Door range' },
  { id: 'description', label: 'Description' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'availability', label: 'Availability' },
  { id: 'stock', label: 'Stock quantity' },
  { id: 'catalogue', label: 'Catalogue programme' },
  { id: 'spec', label: 'Specification' },
  { id: 'props', label: 'Properties' },
  { id: 'price', label: 'Price' },
  { id: 'qty', label: 'Qty' },
  { id: 'action', label: 'Add' },
]

const COLUMN_ID_ALIASES: Record<string, string> = {
  product_name: 'name',
}

export const CATALOG_WORKBENCH_COLUMN_IDS = new Set(CATALOG_WORKBENCH_COLUMNS.map((c) => c.id))

/** Fallback when organisation settings are unavailable. */
export const CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS: string[] = [
  'image',
  'code',
  'description',
  'price',
  'qty',
  'action',
]

export const CATALOG_WORKBENCH_DEFAULT_ORDER_IDS: string[] = CATALOG_WORKBENCH_COLUMNS.map((c) => c.id)

export const CATALOG_WORKBENCH_LOCKED_COLUMN_IDS = new Set(['qty', 'action'])

export const CATALOG_WORKBENCH_CONFIGURABLE_COLUMN_IDS = CATALOG_WORKBENCH_COLUMNS.filter(
  (c) => !CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(c.id),
).map((c) => c.id)

export function normalizeWorkbenchColumnId(id: string): string | null {
  const mapped = COLUMN_ID_ALIASES[id] ?? id
  return CATALOG_WORKBENCH_COLUMN_IDS.has(mapped) ? mapped : null
}

export function normalizeWorkbenchColumnOrder(order: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of order) {
    const id = normalizeWorkbenchColumnId(raw)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of CATALOG_WORKBENCH_DEFAULT_ORDER_IDS) {
    if (!seen.has(id)) out.push(id)
  }
  return out
}

export function normalizeWorkbenchVisibleIds(visible: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of visible) {
    const id = normalizeWorkbenchColumnId(raw)
    if (!id || seen.has(id) || CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const locked of CATALOG_WORKBENCH_LOCKED_COLUMN_IDS) {
    if (!seen.has(locked)) out.push(locked)
  }
  return out.length > 0 ? out : [...CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS]
}

export function workbenchTableColClass(colId: string): string {
  const map: Record<string, string> = {
    image: 'tb-col-image',
    code: 'tb-col-code',
    name: 'tb-col-name',
    sku: 'tb-col-sku',
    trade_code: 'tb-col-trade-code',
    category: 'tb-col-category',
    door_range: 'tb-col-door-range',
    description: 'tb-col-desc',
    dimensions: 'tb-col-dimensions',
    availability: 'tb-col-availability',
    stock: 'tb-col-stock',
    catalogue: 'tb-col-catalogue',
    spec: 'tb-col-spec',
    props: 'tb-col-props',
    price: 'tb-col-price',
    qty: 'tb-col-qty',
    action: 'tb-col-action',
  }
  return map[colId] ?? `tb-col-${colId}`
}

export function workbenchTableCellClass(colId: string): string {
  const base = workbenchTableColClass(colId)
  if (colId === 'qty') return `${base} tb-col-sticky-end tb-col-sticky-qty`
  if (colId === 'action') return `${base} tb-col-sticky-end tb-col-sticky-action`
  return base
}

export function workbenchTableColumnLabel(colId: string): string {
  return CATALOG_WORKBENCH_COLUMNS.find((c) => c.id === colId)?.label ?? colId
}
