import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import {
  PRICELIST_WORKBENCH_COLUMNS,
  type WorkbenchColumnDef,
} from '@/lib/pricelistWorkbenchColumns'

const CHAR_PX = 7.2
const PADDING = 28

function measureText(s: string, maxChars: number): number {
  const len = Math.min(s.length, maxChars)
  return Math.ceil(len * CHAR_PX) + PADDING
}

/** Suggested widths from visible sample rows; user overrides in useColumnWidths take precedence. */
export function suggestWorkbenchColumnWidths(
  rows: PricelistWorkbenchRow[],
  visibleColIds: string[],
  cols: WorkbenchColumnDef[] = PRICELIST_WORKBENCH_COLUMNS,
): Record<string, number> {
  const sample = rows.slice(0, 80)
  const out: Record<string, number> = {}

  for (const id of visibleColIds) {
    const def = cols.find((c) => c.id === id)
    if (!def || id === 'actions') continue
    let maxW = measureText(def.label, 24)

    for (const row of sample) {
      let text = ''
      switch (id) {
        case 'catalog_source':
          text = row.source === 'tealbury' ? 'Tealbury' : row.source === 'lamtek' ? 'Lamtek' : 'Uform'
          break
        case 'item_kind':
          text = row.item_kind || ''
          break
        case 'part_type':
          text = row.part_type || ''
          break
        case 'door_range':
          text = row.door_range || ''
          break
        case 'section':
          text = row.section || ''
          break
        case 'trade_code':
          text = row.trade_code || ''
          break
        case 'sku':
          text = row.sku || ''
          break
        case 'name':
          text = row.name || ''
          break
        case 'description':
          text = (row.description || '').split('\n')[0] ?? ''
          break
        case 'category':
          text = row.category_name || 'Unassigned'
          break
        case 'cost_price':
        case 'unit_price':
          text = '99999.99'
          break
        case 'active':
        case 'is_stock':
          text = 'Yes'
          break
        default:
          break
      }
      maxW = Math.max(maxW, measureText(text, id === 'description' ? 48 : id === 'name' ? 42 : 28))
    }
    out[id] = Math.max(def.minWidth, Math.min(maxW, def.id === 'description' ? 360 : 280))
  }
  return out
}
