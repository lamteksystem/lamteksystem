/**
 * Composed product/configuration codes for quoted units.
 *
 * Grammar (segments joined with "-", empties dropped):
 *   [SIZE]-[STYLE]-[TYPE]-[CARCASS]-[RANGE]-[DOOR]
 *   e.g. 1000-HL-BASE-WHI-DAW-WHI
 *
 *   SIZE    width in mm (e.g. 1000)
 *   STYLE   build/line style — HL (high-line) | DL (drawer-line) | MX (mixed)
 *   TYPE    unit type — BASE | WALL | TALL | UNIT
 *   CARCASS carcass finish — WHI | OAK | GRY | GRA | OTH
 *   RANGE   kitchen range — first letters of the range name (Dawson -> DAW)
 *   DOOR    door/range finish — short token from the finish label (White -> WHI)
 *
 * These are deterministic, human-readable abbreviations. Where a value is
 * unknown the segment is simply omitted, so partial configurations still
 * produce a sensible (shorter) code.
 */
import type { AssemblyWithLines, OrderRow, ProductRow } from '@/types/database'

export type BuildStyle = OrderRow['build_style']
export type LineStylePreference = OrderRow['line_style_preference']

const CARCASS_FINISH_CODES: Record<string, string> = {
  white: 'WHI',
  'light-oak': 'OAK',
  grey: 'GRY',
  graphite: 'GRA',
  other: 'OTH',
}

const UNIT_TYPE_CODES: Record<string, string> = {
  base_unit: 'BASE',
  wall_unit: 'WALL',
  tall_unit: 'TALL',
  other: 'UNIT',
}

/** Abbreviate an arbitrary word/label to an uppercase token (default 3 chars). */
export function abbreviateToken(value: string | null | undefined, length = 3): string {
  const cleaned = (value ?? '').replace(/[^A-Za-z0-9]+/g, ' ').trim()
  if (!cleaned) return ''
  // Use the last meaningful word (finish labels like "Dawson White" -> White).
  const words = cleaned.split(/\s+/)
  const word = words[words.length - 1]
  return word.slice(0, length).toUpperCase()
}

/** Range abbreviation from the range/category name (Dawson -> DAW). */
export function abbreviateRange(rangeName: string | null | undefined): string {
  const cleaned = (rangeName ?? '').replace(/[^A-Za-z0-9]+/g, '').trim()
  return cleaned.slice(0, 3).toUpperCase()
}

export function carcassFinishCode(carcassFinish: string | null | undefined): string {
  if (!carcassFinish) return ''
  const key = carcassFinish.trim().toLowerCase()
  return CARCASS_FINISH_CODES[key] ?? abbreviateToken(carcassFinish)
}

export function buildStyleCode(
  buildStyle: BuildStyle,
  lineStyle: LineStylePreference,
): string {
  // Line style (high-line vs drawer-line) is the meaningful door-facing choice.
  if (lineStyle === 'high_line') return 'HL'
  if (lineStyle === 'drawer_line') return 'DL'
  if (lineStyle === 'mixed') return 'MX'
  // Fall back to flat-pack/rigid build style when no line style is set.
  if (buildStyle === 'flat_pack') return 'FP'
  if (buildStyle === 'rigid') return 'RG'
  return ''
}

export function unitTypeCode(unitType: string | null | undefined): string {
  if (!unitType) return ''
  return UNIT_TYPE_CODES[unitType] ?? 'UNIT'
}

/** Best-effort width in mm from an assembly or product (options dims or name/SKU). */
export function deriveWidthMm(source: {
  assemblyWidthMm?: number | null
  product?: Pick<ProductRow, 'options' | 'name' | 'sku'> | null
}): number | null {
  if (typeof source.assemblyWidthMm === 'number' && source.assemblyWidthMm > 0) {
    return Math.round(source.assemblyWidthMm)
  }
  const product = source.product
  if (!product) return null
  const opts = product.options
  if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
    const bag = opts as Record<string, unknown>
    for (const key of ['tealbury_dims_mm', 'lamtek_dims_mm']) {
      const dims = bag[key]
      if (dims && typeof dims === 'object' && !Array.isArray(dims)) {
        const w = Number((dims as Record<string, unknown>).w)
        if (Number.isFinite(w) && w > 0) return Math.round(w)
      }
    }
    const directW = Number(bag.width_mm)
    if (Number.isFinite(directW) && directW > 0) return Math.round(directW)
  }
  // Parse a plausible mm width (300–1200) from name or SKU, e.g. "1000 Base unit".
  for (const text of [product.name ?? '', product.sku ?? '']) {
    const m = text.match(/\b(\d{3,4})\b/)
    if (m) {
      const n = Number(m[1])
      if (n >= 100 && n <= 3000) return n
    }
  }
  return null
}

export interface ComposeCodeParts {
  widthMm?: number | null
  buildStyle?: BuildStyle
  lineStyle?: LineStylePreference
  unitType?: string | null
  carcassFinish?: string | null
  rangeName?: string | null
  doorFinish?: string | null
}

/** Join the configured segments into the dashed code, omitting empties. */
export function composeProductCode(parts: ComposeCodeParts): string {
  const segments = [
    parts.widthMm && parts.widthMm > 0 ? String(Math.round(parts.widthMm)) : '',
    buildStyleCode(parts.buildStyle ?? null, parts.lineStyle ?? null),
    unitTypeCode(parts.unitType ?? null),
    carcassFinishCode(parts.carcassFinish ?? null),
    abbreviateRange(parts.rangeName ?? null),
    abbreviateToken(parts.doorFinish ?? null),
  ].filter((s) => s.length > 0)
  return segments.join('-')
}

export interface OrderSetupForCode {
  build_style: BuildStyle
  line_style_preference: LineStylePreference
  carcass_finish: string | null
  door_finish: string | null
  rangeName: string | null
}

/** Compose the code for a complete unit (assembly) given the order setup. */
export function composeAssemblyCode(
  assembly: Pick<AssemblyWithLines, 'unit_type' | 'width_mm'>,
  setup: OrderSetupForCode,
): string {
  return composeProductCode({
    widthMm: deriveWidthMm({ assemblyWidthMm: assembly.width_mm }),
    buildStyle: setup.build_style,
    lineStyle: setup.line_style_preference,
    unitType: assembly.unit_type,
    carcassFinish: setup.carcass_finish,
    rangeName: setup.rangeName,
    doorFinish: setup.door_finish,
  })
}

/** Compose a best-effort code for a single product line given the order setup. */
export function composeProductLineCode(
  product: Pick<ProductRow, 'options' | 'name' | 'sku'>,
  setup: OrderSetupForCode,
): string {
  return composeProductCode({
    widthMm: deriveWidthMm({ product }),
    buildStyle: setup.build_style,
    lineStyle: setup.line_style_preference,
    carcassFinish: setup.carcass_finish,
    rangeName: setup.rangeName,
    doorFinish: setup.door_finish,
  })
}
