import type { PricelistSource } from '@/lib/pricelistWorkbench'

/** Full catalogue source name for workbench display. */
export function catalogueSourceLabel(source: PricelistSource): string {
  if (source === 'tealbury') return 'Tealbury'
  if (source === 'lamtek') return 'Lamtek'
  return 'Uform'
}

/** Short badge (optional). */
export function catalogueSourceAbbrev(source: PricelistSource): string {
  if (source === 'tealbury') return 'TB'
  if (source === 'lamtek') return 'LK'
  return 'UF'
}
