/**
 * Standard BOM lines for Tealbury complete base units (e.g. 1000 HL).
 * Applied after Lamtek + UFORM component products exist in the catalogue.
 */
export type BomLineResolver =
  | { type: 'lamtek_carcass_from_trade' }
  | { type: 'lamtek_part_type'; part_type: string; quantity: number }
  | { type: 'uform_door'; height_mm: number; width_mm: number; quantity: number }

export interface CompleteUnitBomTemplate {
  id: string
  label: string
  /** Match Tealbury trade code prefix, e.g. B100, B50 */
  tradeCodePattern: RegExp
  /** Optional section hint from Tealbury pricelist */
  sectionPattern?: RegExp
  lines: BomLineResolver[]
}

/** Default HL base unit breakdown (user example: Dawson 1000 HL). */
export const DEFAULT_COMPLETE_UNIT_BOM_TEMPLATES: CompleteUnitBomTemplate[] = [
  {
    id: 'hl-base-standard',
    label: 'High-line base unit (standard hardware pack)',
    tradeCodePattern: /^B\d+/i,
    sectionPattern: /high[\s-]*line.*base/i,
    lines: [
      { type: 'lamtek_carcass_from_trade' },
      { type: 'lamtek_part_type', part_type: 'hinge', quantity: 4 },
      { type: 'lamtek_part_type', part_type: 'hinge_plate', quantity: 4 },
      { type: 'uform_door', height_mm: 715, width_mm: 497, quantity: 2 },
      { type: 'lamtek_part_type', part_type: 'leg_kit', quantity: 1 },
      { type: 'lamtek_part_type', part_type: 'other', quantity: 1 },
      { type: 'lamtek_part_type', part_type: 'fittings', quantity: 1 },
    ],
  },
]

export function matchBomTemplate(
  tradeCode: string,
  section: string,
  templates: CompleteUnitBomTemplate[] = DEFAULT_COMPLETE_UNIT_BOM_TEMPLATES
): CompleteUnitBomTemplate | null {
  const code = tradeCode.trim()
  const sec = section.trim()
  for (const t of templates) {
    if (!t.tradeCodePattern.test(code)) continue
    if (t.sectionPattern && !t.sectionPattern.test(sec)) continue
    return t
  }
  return null
}

/** B100 → carcass family 1000 (strip leading B, map width code). */
export function carcassSizeFromTradeCode(tradeCode: string): string | null {
  const m = tradeCode.trim().match(/^B(\d+)/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 10) return null
  if (n >= 100) return String(n)
  return String(n * 10)
}
