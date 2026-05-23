import type { ColumnDef } from '@/hooks/useColumnVisibility'

export type WorkbenchColumnId =
  | 'source'
  | 'door_range'
  | 'section'
  | 'trade_code'
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'cost_price'
  | 'unit_price'
  | 'active'
  | 'is_stock'
  | 'actions'

export type WorkbenchColumnDef = ColumnDef & {
  tip: string
  minWidth: number
  defaultWidth: number
}

export const PRICELIST_WORKBENCH_COLUMNS: WorkbenchColumnDef[] = [
  {
    id: 'source',
    label: 'Source',
    tip: 'Tealbury customer pricelist (TB) or Lamtek trade kitchen pricelist (LK).',
    minWidth: 52,
    defaultWidth: 56,
  },
  {
    id: 'door_range',
    label: 'Door / range',
    tip: 'Tealbury door-range sheet name (e.g. No Doors, Dawson). Double-click a cell to edit.',
    minWidth: 100,
    defaultWidth: 120,
  },
  {
    id: 'section',
    label: 'Section',
    tip: 'Spreadsheet section heading (e.g. HIGHLINE BASE UNITS). Double-click to edit.',
    minWidth: 110,
    defaultWidth: 140,
  },
  {
    id: 'trade_code',
    label: 'Trade code',
    tip: 'Original Tealbury CODE from the pricelist before door-range suffix was applied to SKU.',
    minWidth: 72,
    defaultWidth: 88,
  },
  {
    id: 'sku',
    label: 'SKU',
    tip: 'Stock keeping unit stored in the catalogue. Double-click to edit.',
    minWidth: 120,
    defaultWidth: 160,
  },
  {
    id: 'name',
    label: 'Name',
    tip: 'Customer-facing product name. Double-click to edit.',
    minWidth: 140,
    defaultWidth: 200,
  },
  {
    id: 'description',
    label: 'Description',
    tip: 'Longer notes imported from the pricelist (section, dimensions, etc.). Double-click to edit.',
    minWidth: 160,
    defaultWidth: 220,
  },
  {
    id: 'category',
    label: 'Category',
    tip: 'Portal category assigned for browse/filter. Use bulk Assign category or smart commands.',
    minWidth: 130,
    defaultWidth: 150,
  },
  {
    id: 'cost_price',
    label: 'Cost £',
    tip: "Lamtek cost price (ex VAT) — typically 75% of list price from import. This is your internal cost, not the customer's sell price.",
    minWidth: 72,
    defaultWidth: 80,
  },
  {
    id: 'unit_price',
    label: 'List / sell £',
    tip: 'Sell or list price (ex VAT) from the spreadsheet — what the customer pays before discounts.',
    minWidth: 80,
    defaultWidth: 88,
  },
  {
    id: 'active',
    label: 'Active',
    tip: 'Whether the product is active in the catalogue when published.',
    minWidth: 52,
    defaultWidth: 56,
  },
  {
    id: 'is_stock',
    label: 'Stock',
    tip: 'Treat as stock item (vs made-to-order only).',
    minWidth: 52,
    defaultWidth: 56,
  },
  {
    id: 'actions',
    label: 'Actions',
    tip: 'Remove this row from the workbench draft.',
    minWidth: 88,
    defaultWidth: 92,
  },
]

export function workbenchColumnWidth(
  id: string,
  widths: Record<string, number>,
  cols: WorkbenchColumnDef[] = PRICELIST_WORKBENCH_COLUMNS
): number {
  const def = cols.find((c) => c.id === id)
  return Math.max(def?.minWidth ?? 60, widths[id] ?? def?.defaultWidth ?? 100)
}
