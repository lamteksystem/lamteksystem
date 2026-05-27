/**
 * Parse UFORM kitchen/bedroom tech-spec PDF text into catalogue workbench rows.
 * PDF → text is done in scripts/parse-uform-spec-pdfs.mjs (Node + pdf-parse).
 */
import { slugifyCategorySegment } from '@/lib/tealburyPricelistParse'
import { TEALBURY_DOOR_RANGES, type TealburyDoorRange } from '@/lib/tealburyDoorRanges'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'

const UNASSIGNED_CATEGORY = {
  category_id: null as string | null,
  category_slug: '',
  category_name: '',
}

/** Map PDF filename stems to portal door-range names (extend when new specs arrive). */
export const UFORM_SPEC_FILENAME_TO_RANGE: Record<string, TealburyDoorRange> = {
  kensington: 'Knightsbridge Std',
  'kensington-tech-spec-1': 'Knightsbridge Std',
  dawson: 'Dawson',
  'dawson-tech-spec': 'Dawson',
  oakham: 'Oakham Soft Matte',
  'oakham-soft': 'Oakham Soft Matte',
  'oakham-gloss': 'Oakham Gloss',
  norwood: 'Norwood',
  papplewick: 'Papplewick',
  knightsbridge: 'Knightsbridge Std',
  'knightsbridge-std': 'Knightsbridge Std',
  'knightsbridge-prm': 'Knightsbridge Prm',
}

export interface UformSpecParsedProduct {
  door_range: string
  section: string
  name: string
  sku: string
  description: string
  height_mm: number | null
  width_mm: number | null
  depth_mm: number | null
  kind: 'door' | 'accessory'
}

const SIZE_LINE =
  /^(\d{2,4})\s*x\s*(\d{2,4})(?:\s*x\s*(\d{2,4}))?(?:\s+slab)?(?:\s+pair)?(?:\s+.*)?$/i

const FIXED_ACCESSORY =
  /^(\d{2,4})\s+X\s+(\d{2,4})\s+X\s+(\d{2,4})/i

function normalizeRangeFromFilename(fileStem: string): string {
  const key = fileStem.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (UFORM_SPEC_FILENAME_TO_RANGE[key]) return UFORM_SPEC_FILENAME_TO_RANGE[key]
  for (const [k, v] of Object.entries(UFORM_SPEC_FILENAME_TO_RANGE)) {
    if (key.includes(k)) return v
  }
  const titleCase = fileStem
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
  const match = TEALBURY_DOOR_RANGES.find((r) => r.toLowerCase() === titleCase.toLowerCase())
  return match ?? titleCase
}

function buildDoorSku(range: string, h: number, w: number, section: string): string {
  const rangeSlug = slugifyCategorySegment(range).slice(0, 24)
  const kind = /drawer/i.test(section) ? 'DF' : 'DR'
  return `UF-${rangeSlug}-${kind}-${h}x${w}`.toUpperCase()
}

function buildAccessorySku(range: string, name: string, h: number, w: number, d: number): string {
  const rangeSlug = slugifyCategorySegment(range).slice(0, 20)
  const nameSlug = slugifyCategorySegment(name).slice(0, 16)
  return `UF-${rangeSlug}-${nameSlug}-${h}x${w}x${d}`.toUpperCase()
}

export function parseUformSpecText(text: string, fileStem: string): UformSpecParsedProduct[] {
  const door_range = normalizeRangeFromFilename(fileStem)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter(Boolean)

  const products: UformSpecParsedProduct[] = []
  let section = 'Doors & drawer fronts'
  const seen = new Set<string>()

  function push(p: UformSpecParsedProduct) {
    if (seen.has(p.sku)) return
    seen.add(p.sku)
    products.push(p)
  }

  for (const line of lines) {
    if (/^STANDARD\s+DRAWERFRONTS/i.test(line) || /^STANDARD\s+DOORS/i.test(line)) {
      section = 'Doors & drawer fronts'
      continue
    }
    if (/^STANDARD\s+ACCESSORIES/i.test(line)) {
      section = 'Accessories'
      continue
    }
    if (/^PLINTH$/i.test(line)) {
      section = 'Plinth'
      continue
    }
    if (/^CORNICE/i.test(line) || /^PLAIN END PANEL/i.test(line)) {
      section = line.length < 40 ? line : 'Accessories'
      continue
    }

    const sizeMatch = line.match(SIZE_LINE)
    if (sizeMatch) {
      const h = parseInt(sizeMatch[1], 10)
      const w = parseInt(sizeMatch[2], 10)
      const d = sizeMatch[3] ? parseInt(sizeMatch[3], 10) : null
      if (h < 50 || w < 50) continue
      const name = `${door_range} ${section.includes('drawer') ? 'Drawer front' : 'Door'} ${h}×${w} mm`
      push({
        door_range,
        section,
        name,
        sku: buildDoorSku(door_range, h, w, section),
        description: `UFORM spec (${fileStem}): ${line}`,
        height_mm: h,
        width_mm: w,
        depth_mm: d,
        kind: 'door',
      })
      continue
    }

    const accMatch = line.match(FIXED_ACCESSORY)
    if (accMatch && section !== 'Doors & drawer fronts') {
      const h = parseInt(accMatch[1], 10)
      const w = parseInt(accMatch[2], 10)
      const d = parseInt(accMatch[3], 10)
      const accName = section.slice(0, 48) || 'Accessory'
      push({
        door_range,
        section,
        name: `${door_range} ${accName} ${h}×${w}×${d} mm`,
        sku: buildAccessorySku(door_range, accName, h, w, d),
        description: `UFORM spec (${fileStem}): ${line}`,
        height_mm: h,
        width_mm: w,
        depth_mm: d,
        kind: 'accessory',
      })
    }
  }

  return products
}

export function uformProductsToWorkbenchRows(
  products: UformSpecParsedProduct[],
  idPrefix = 'uform'
): PricelistWorkbenchRow[] {
  return products.map((p, i) => ({
    id: `${idPrefix}-${p.sku}-${i}`,
    source: 'uform' as const,
    catalog_program: CATALOG_PROGRAM.TEALBURY,
    sku: p.sku,
    name: p.name,
    description: p.description,
    unit_price: 0,
    cost_price: null,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    ...UNASSIGNED_CATEGORY,
    section: p.section,
    door_range: p.door_range,
    trade_code: '',
    selected: false,
    item_kind: p.kind === 'door' ? 'door' : 'accessory',
    part_type: p.kind === 'door' ? 'door' : 'other',
    options: {
      uform_spec: true,
      height_mm: p.height_mm,
      width_mm: p.width_mm,
      depth_mm: p.depth_mm,
    },
  }))
}

export interface UformSpecJsonBundle {
  generated_at: string
  files: { file: string; door_range: string; product_count: number }[]
  products: UformSpecParsedProduct[]
}

export function parseUformSpecJsonBundle(json: unknown): UformSpecParsedProduct[] {
  if (!json || typeof json !== 'object') return []
  const bundle = json as UformSpecJsonBundle
  if (!Array.isArray(bundle.products)) return []
  return bundle.products
}
