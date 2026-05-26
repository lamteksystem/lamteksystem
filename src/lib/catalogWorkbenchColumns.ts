import type { ColumnDef } from '@/hooks/useColumnVisibility'

/** All configurable product-table columns in the workbench picker. */
export const CATALOG_WORKBENCH_COLUMNS: ColumnDef[] = [
  { id: 'image', label: 'Image' },
  { id: 'code', label: 'Code' },
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'spec', label: 'Specification' },
  { id: 'props', label: 'Properties' },
  { id: 'price', label: 'Price' },
  { id: 'qty', label: 'Qty' },
  { id: 'action', label: 'Add' },
]

/** Default visible columns (Name is optional; user can enable via column settings). */
export const CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS: string[] = [
  'image',
  'code',
  'description',
  'price',
  'qty',
  'action',
]

export const CATALOG_WORKBENCH_LOCKED_COLUMN_IDS = new Set(['qty', 'action'])
