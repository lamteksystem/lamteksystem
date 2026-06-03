import type { ColumnDef } from '@/hooks/useColumnVisibility'

export type WorkbenchColumnId =
  | 'catalog_source'
  | 'item_kind'
  | 'part_type'
  | 'door_range'
  | 'section'
  | 'trade_code'
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'cost_price'
  | 'unit_price'
  | 'bom'
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
    id: 'catalog_source',
    label: 'Catalogue',
    tip: 'Original pricelist the row was imported from: Tealbury, Lamtek, or Uform.',
    minWidth: 88,
    defaultWidth: 96,
  },
  {
    id: 'item_kind',
    label: 'Sold as',
    tip: 'How the product is sold: Complete (a sellable finished unit) · Component (a BOM building block) · Accessory. This drives whether adding it explodes into parts.',
    minWidth: 72,
    defaultWidth: 177,
  },
  {
    id: 'part_type',
    label: 'Component role',
    tip: 'For components only — the role it plays inside a unit (unit/carcass, door, hinge, leg, fittings…). Blank for complete units.',
    minWidth: 88,
    defaultWidth: 158,
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
    label: 'Import section (legacy)',
    tip: 'Original Tealbury/Lamtek spreadsheet heading (e.g. HIGHLINE BASE UNITS, 575 HIGH WALL UNITS). Not the same as Categories — do not pick Carcasses/Doors here. Hidden by default.',
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
    label: 'Categories',
    tip: 'Portal categories this product belongs to. The first is the primary; extra categories mean it is also sold on its own there.',
    minWidth: 150,
    defaultWidth: 200,
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
    id: 'bom',
    label: 'BOM',
    tip: 'Draft bill of materials stored on this row (✓). Publish copies it to live assemblies when component SKUs exist.',
    minWidth: 44,
    defaultWidth: 52,
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

/**
 * Columns visible on first use. The Catalogue column and the legacy Import
 * section column are hidden until enabled in column settings (Section is
 * superseded by Categories).
 */
const DEFAULT_HIDDEN_IDS: WorkbenchColumnId[] = ['catalog_source', 'section']
export const PRICELIST_WORKBENCH_DEFAULT_VISIBLE_IDS = PRICELIST_WORKBENCH_COLUMNS.filter(
  (c) => !DEFAULT_HIDDEN_IDS.includes(c.id as WorkbenchColumnId),
).map((c) => c.id)

// Generous upper bound so columns can be widened substantially; only guards
// against truly runaway persisted values. Mirrors MAX_WIDTH in useColumnWidths.
const WORKBENCH_MAX_WIDTH = 800

export function workbenchColumnWidth(
  id: string,
  widths: Record<string, number>,
  cols: WorkbenchColumnDef[] = PRICELIST_WORKBENCH_COLUMNS
): number {
  const def = cols.find((c) => c.id === id)
  const raw = widths[id] ?? def?.defaultWidth ?? 100
  return Math.max(def?.minWidth ?? 60, Math.min(raw, WORKBENCH_MAX_WIDTH))
}
