/**
 * Tealbury Complete catalogue build: door ranges, part-type inference, category bootstrap.
 */
import { createCategory, fetchAllCategories, updateCategory } from '@/lib/categoryAdmin'
import { ACCESSORIES_SUBCATEGORY_NAMES } from '@/lib/coreCatalogueCategories'
import type { CategoryRow } from '@/types/database'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
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

/** Ensure Accessories parent + Cutlery Trays / Lighting / Misc only (no import section categories). */
export async function bootstrapTealburyCatalogueCategories(): Promise<BootstrapCategoriesResult> {
  const result: BootstrapCategoriesResult = { created: [], existing: [], errors: [] }
  const existing = await fetchAllCategories()
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]))

  async function ensure(
    name: string,
    kind: CategoryRow['category_kind'],
    parentId: string | null = null,
  ): Promise<CategoryRow | null> {
    const key = name.trim().toLowerCase()
    const hit = [...byName.values()].find(
      (c) => c.name.trim().toLowerCase() === key && (parentId ? c.parent_id === parentId : !c.parent_id),
    )
    if (hit) {
      result.existing.push(name)
      return hit
    }
    const { category, error } = await createCategory({
      name,
      category_kind: kind,
      parent_id: parentId,
    })
    if (error || !category) {
      result.errors.push(`${name}: ${error ?? 'failed'}`)
      return null
    }
    byName.set(key, category)
    result.created.push(name)
    return category
  }

  const accessoriesRow =
    existing.find((c) => c.name.trim().toLowerCase() === 'accessories' && !c.parent_id) ??
    (await ensure('Accessories', 'product_type'))
  const accessoriesId = accessoriesRow?.id ?? null
  if (!accessoriesId) return result

  for (const sub of ACCESSORIES_SUBCATEGORY_NAMES) {
    await ensure(sub, 'product_type', accessoriesId)
  }

  const topLighting = existing.find(
    (c) => c.name.trim().toLowerCase() === 'lighting' && !c.parent_id,
  )
  if (topLighting && topLighting.parent_id !== accessoriesId) {
    await updateCategory(topLighting.id, { parent_id: accessoriesId })
  }

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

export { catalogueSourceAbbrev as sourceAbbrev, catalogueSourceLabel as sourceLabel } from '@/lib/catalogueSourceLabel'
