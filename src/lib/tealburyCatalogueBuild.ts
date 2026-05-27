/**
 * Tealbury Complete catalogue build: door ranges, part-type inference, category bootstrap.
 */
import { createCategory, fetchAllCategories } from '@/lib/categoryAdmin'
import type { CategoryRow } from '@/types/database'
import type { PricelistSource, PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { TEALBURY_DOOR_RANGES, type TealburyDoorRange } from '@/lib/tealburyDoorRanges'

export { TEALBURY_DOOR_RANGES, type TealburyDoorRange }

export type WorkbenchItemKind = 'complete' | 'component' | 'door' | 'accessory' | 'other'

const LAMTEK_SECTION_PART_TYPE: [RegExp, string][] = [
  [/hinge\s*plate|base\s*plate/i, 'hinge_plate'],
  [/hinge/i, 'hinge'],
  [/drawer\s*box|drawerbox/i, 'drawer'],
  [/cutlery|tray/i, 'other'],
  [/internal\s*drawer/i, 'drawer'],
  [/flap\s*stay|stay/i, 'other'],
  [/leg|plinth\s*kit/i, 'leg_kit'],
  [/fitting/i, 'fittings'],
  [/carcass|base\s*unit|wall\s*unit|tall|cabinet|unit/i, 'unit'],
  [/shelf/i, 'other'],
  [/door/i, 'door'],
]

const UFORM_SECTION_PART_TYPE: [RegExp, string][] = [
  [/plinth/i, 'other'],
  [/cornice|pelmet/i, 'other'],
  [/panel|post|moulding/i, 'other'],
  [/drawer\s*front|drawerfront/i, 'drawer'],
  [/door|slab/i, 'door'],
]

export function inferWorkbenchItemKind(row: Pick<PricelistWorkbenchRow, 'source' | 'section' | 'name' | 'options'>): WorkbenchItemKind {
  if (row.source === 'tealbury') return 'complete'
  if (row.source === 'uform') {
    const sec = `${row.section} ${row.name}`.toLowerCase()
    if (/door|drawer\s*front|slab/.test(sec)) return 'door'
    if (/plinth|cornice|panel|post|pelmet|moulding|accessor/.test(sec)) return 'accessory'
    return 'other'
  }
  return 'component'
}

export function inferWorkbenchPartType(
  row: Pick<PricelistWorkbenchRow, 'source' | 'section' | 'name' | 'description' | 'item_kind'>
): string {
  if (row.item_kind === 'complete') return ''
  const hay = `${row.section} ${row.name} ${row.description}`.toLowerCase()
  const rules = row.source === 'uform' ? UFORM_SECTION_PART_TYPE : LAMTEK_SECTION_PART_TYPE
  for (const [re, code] of rules) {
    if (re.test(hay)) return code
  }
  return row.source === 'uform' ? 'door' : 'other'
}

export function enrichWorkbenchRowMetadata(row: PricelistWorkbenchRow): PricelistWorkbenchRow {
  const item_kind = row.item_kind || inferWorkbenchItemKind(row)
  const part_type = row.part_type || (item_kind === 'complete' ? '' : inferWorkbenchPartType({ ...row, item_kind }))
  return { ...row, item_kind, part_type }
}

export function enrichWorkbenchRowsMetadata(rows: PricelistWorkbenchRow[]): PricelistWorkbenchRow[] {
  return rows.map(enrichWorkbenchRowMetadata)
}

export interface BootstrapCategoriesResult {
  created: string[]
  existing: string[]
  errors: string[]
}

/** Ensure door-range categories + common component groupings exist. */
export async function bootstrapTealburyCatalogueCategories(): Promise<BootstrapCategoriesResult> {
  const result: BootstrapCategoriesResult = { created: [], existing: [], errors: [] }
  const existing = await fetchAllCategories()
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]))

  async function ensure(name: string, kind: CategoryRow['category_kind']) {
    const key = name.trim().toLowerCase()
    if (byName.has(key)) {
      result.existing.push(name)
      return
    }
    const { category, error } = await createCategory({ name, category_kind: kind })
    if (error || !category) {
      result.errors.push(`${name}: ${error ?? 'failed'}`)
      return
    }
    byName.set(key, category)
    result.created.push(name)
  }

  for (const range of TEALBURY_DOOR_RANGES) {
    await ensure(range, 'door_range')
  }

  const componentGroups = [
    'Base units',
    'Wall units',
    'Tall units',
    'Hinges',
    'Hinge plates',
    'Drawer boxes',
    'Cutlery trays',
    'Leg kits',
    'Fittings',
    'Doors',
    'Plinth',
    'Cornice & pelmet',
    'Panels & posts',
  ]
  for (const g of componentGroups) {
    await ensure(g, 'product_type')
  }

  await ensure('Tealbury Complete', 'product_type')

  return result
}

/** Assign door_range rows to matching door_range category when names align. */
export function autoAssignDoorRangeCategories(
  rows: PricelistWorkbenchRow[],
  categories: CategoryRow[]
): PricelistWorkbenchRow[] {
  const rangeCats = categories.filter((c) => c.category_kind === 'door_range')
  return rows.map((r) => {
    if (r.category_id || !r.door_range.trim()) return r
    const dr = r.door_range.trim().toLowerCase()
    const cat = rangeCats.find((c) => c.name.trim().toLowerCase() === dr)
    if (!cat) return r
    return {
      ...r,
      category_id: cat.id,
      category_slug: cat.slug,
      category_name: cat.name,
    }
  })
}

export function sourceLabel(source: PricelistSource | 'uform'): string {
  if (source === 'tealbury') return 'TB'
  if (source === 'lamtek') return 'LK'
  return 'UF'
}
