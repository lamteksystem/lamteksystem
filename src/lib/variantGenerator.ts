/**
 * Variant generation helpers: door geometry, finish (colour) price matrices,
 * and SKU/name templating. Pure + deterministic so they can be unit-tested and
 * reused by the admin Variant Generator and the BOM resolver.
 *
 * Colour is modelled as a *finish price matrix* on a single product (the
 * established `*_finish_prices_gbp` pattern) — NOT as a separate SKU per colour.
 * The chosen finish is selected at order time (orders.door_finish /
 * carcass_finish) and resolved by `finishPricing.ts`.
 */
import { abbreviateRange } from '@/lib/productCode'

/**
 * Gap between the cabinet opening and the door/front leaf. A 400mm unit takes a
 * 397mm-wide door (3mm tolerance), per Tealbury/UFORM spec.
 */
export const DOOR_OPENING_TOLERANCE_MM = 3

/** Standard high-line door height for a 720mm-high base unit. */
export const HIGH_LINE_DOOR_HEIGHT_MM = 715

/** Default width above which a unit takes two doors rather than one. */
export const DOUBLE_DOOR_MIN_WIDTH_MM = 600

export type DoorLineStyle = 'high_line' | 'drawer_line'

/** Number of doors for a unit of the given width (1 up to the threshold, else 2). */
export function doorCountForWidth(
  widthMm: number,
  doubleDoorMinWidthMm = DOUBLE_DOOR_MIN_WIDTH_MM,
): number {
  if (!Number.isFinite(widthMm) || widthMm <= 0) return 1
  return widthMm > doubleDoorMinWidthMm ? 2 : 1
}

/** Width of each door leaf: the unit width split by door count, minus the opening tolerance. */
export function doorWidthForUnit(widthMm: number, doorCount: number): number {
  const count = Math.max(1, Math.round(doorCount))
  return Math.round(widthMm / count) - DOOR_OPENING_TOLERANCE_MM
}

export interface DoorDims {
  count: number
  widthMm: number
  heightMm: number
}

/**
 * Door leaf geometry for a complete base unit. Height is the high-line door
 * height; width is derived from the unit width and door count (width − 3mm).
 */
export function doorDimsForUnit(
  unitWidthMm: number,
  opts?: { doubleDoorMinWidthMm?: number; heightMm?: number },
): DoorDims {
  const count = doorCountForWidth(unitWidthMm, opts?.doubleDoorMinWidthMm)
  return {
    count,
    widthMm: doorWidthForUnit(unitWidthMm, count),
    heightMm: opts?.heightMm ?? HIGH_LINE_DOOR_HEIGHT_MM,
  }
}

export interface FinishOption {
  label: string
  /** Absolute price for this finish, or undefined to derive from base + uplift. */
  price?: number
  /** Uplift added to the base price when `price` is not given. */
  uplift?: number
}

/**
 * Build a finish→price map (e.g. { White: 62.54, Plain: 77.64 }). Finishes
 * without an explicit price use base + uplift.
 */
export function buildFinishPriceMatrix(
  finishes: FinishOption[],
  basePrice = 0,
): Record<string, number> {
  const matrix: Record<string, number> = {}
  for (const f of finishes) {
    const label = f.label.trim()
    if (!label) continue
    const price = f.price != null ? f.price : basePrice + (f.uplift ?? 0)
    matrix[label] = Math.round(price * 100) / 100
  }
  return matrix
}

/** Cheapest price in a finish matrix — used as the catalogue `unit_price`. */
export function cheapestFinishPrice(matrix: Record<string, number>): number | null {
  const values = Object.values(matrix)
  if (values.length === 0) return null
  return Math.min(...values)
}

/** Short uppercase code for a finish/colour (White → WHI). */
export function finishCode(label: string): string {
  const clean = label.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  return clean.slice(0, 3)
}

export { abbreviateRange as rangeCode }

export interface TemplateContext {
  size?: string | null
  sizeCode?: string | null
  range?: string | null
  rangeCode?: string | null
  finish?: string | null
  finishCode?: string | null
}

/**
 * Substitute {SIZE} {SIZE_CODE} {RANGE} {RANGE_CODE} {FINISH} {FINISH_CODE}
 * placeholders in a SKU/name/description template.
 */
export function applyVariantTemplate(template: string, ctx: TemplateContext): string {
  return template
    .replace(/\{SIZE\}/g, ctx.size ?? '')
    .replace(/\{SIZE_CODE\}/g, ctx.sizeCode ?? ctx.size ?? '')
    .replace(/\{RANGE\}/g, ctx.range ?? '')
    .replace(/\{RANGE_CODE\}/g, ctx.rangeCode ?? '')
    .replace(/\{FINISH\}/g, ctx.finish ?? '')
    .replace(/\{FINISH_CODE\}/g, ctx.finishCode ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
