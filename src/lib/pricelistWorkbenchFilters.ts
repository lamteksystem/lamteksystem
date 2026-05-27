import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'

export type WorkbenchSortKey =
  | 'sku'
  | 'name'
  | 'section'
  | 'category_name'
  | 'unit_price'
  | 'source'
  | 'item_kind'
  | 'part_type'

export type SortDir = 'asc' | 'desc'

export interface WorkbenchTableFilters {
  search: string
  source: 'all' | 'tealbury' | 'lamtek' | 'uform'
  doorRange: string
  section: string
  categoryId: string
  itemKind: string
  partType: string
  onlyUnassigned: boolean
  onlyStandaloneCapable: boolean
  sortKey: WorkbenchSortKey
  sortDir: SortDir
}

export const DEFAULT_WORKBENCH_FILTERS: WorkbenchTableFilters = {
  search: '',
  source: 'all',
  doorRange: '',
  section: '',
  categoryId: '',
  itemKind: '',
  partType: '',
  onlyUnassigned: false,
  onlyStandaloneCapable: false,
  sortKey: 'sku',
  sortDir: 'asc',
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function cmpNum(a: number, b: number): number {
  return a - b
}

export function filterAndSortWorkbenchRows(
  rows: PricelistWorkbenchRow[],
  f: WorkbenchTableFilters,
): PricelistWorkbenchRow[] {
  const q = f.search.trim().toLowerCase()
  let list = rows.filter((r) => {
    if (f.source !== 'all' && r.source !== f.source) return false
    if (f.doorRange && r.door_range !== f.doorRange) return false
    if (f.section && r.section !== f.section) return false
    if (f.categoryId && r.category_id !== f.categoryId) return false
    if (f.itemKind && r.item_kind !== f.itemKind) return false
    if (f.partType && r.part_type !== f.partType) return false
    if (f.onlyUnassigned && r.category_id) return false
    if (f.onlyStandaloneCapable && !r.options?.sellable_standalone) return false
    if (!q) return true
    const extraCats = (r.options?.extra_category_names as string[] | undefined)?.join(' ') ?? ''
    return (
      r.sku.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q) ||
      r.category_name.toLowerCase().includes(q) ||
      r.trade_code.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      extraCats.toLowerCase().includes(q)
    )
  })

  const dir = f.sortDir === 'asc' ? 1 : -1
  list = [...list].sort((a, b) => {
    let c = 0
    switch (f.sortKey) {
      case 'sku':
        c = cmpStr(a.sku, b.sku)
        break
      case 'name':
        c = cmpStr(a.name, b.name)
        break
      case 'section':
        c = cmpStr(a.section, b.section)
        break
      case 'category_name':
        c = cmpStr(a.category_name, b.category_name)
        break
      case 'unit_price':
        c = cmpNum(a.unit_price, b.unit_price)
        break
      case 'source':
        c = cmpStr(a.source, b.source)
        break
      case 'item_kind':
        c = cmpStr(a.item_kind, b.item_kind)
        break
      case 'part_type':
        c = cmpStr(a.part_type, b.part_type)
        break
      default:
        c = 0
    }
    return c * dir
  })
  return list
}
