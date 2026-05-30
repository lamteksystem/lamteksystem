/**
 * Pricelist workbench: merge Tealbury + Lamtek trade workbook rows into editable
 * catalogue template rows (category_slug, sku, unit_price, …) before publish.
 */
import { supabase } from '@/lib/supabase'
import { saveProductCategories } from '@/lib/productCategories'
import type { CategoryRow, Json } from '@/types/database'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import { slugifyCategoryName } from '@/lib/categoryAdmin'
import { enrichWorkbenchRowMetadata } from '@/lib/tealburyCatalogueBuild'
import {
  mapTealburyAccessoryToCategory,
  slugifyCategorySegment,
  type TealburyParsedRow,
} from '@/lib/tealburyPricelistParse'
import {
  downloadXlsx,
  type CatalogueExportRow,
} from '@/lib/catalogue-import-export'

export type PricelistSource = 'tealbury' | 'lamtek' | 'uform'

export interface PricelistWorkbenchRow {
  id: string
  source: PricelistSource
  catalog_program: CatalogProgram
  sku: string
  name: string
  description: string
  unit_price: number
  cost_price: number | null
  active: boolean
  is_stock: boolean
  image_url: string
  image_alt: string
  category_id: string | null
  category_slug: string
  category_name: string
  section: string
  door_range: string
  trade_code: string
  selected: boolean
  options: Record<string, Json>
  /** complete (Tealbury sellable), component (Lamtek part), door, accessory (UFORM trim). */
  item_kind: 'complete' | 'component' | 'door' | 'drawer_front' | 'accessory' | 'other'
  /** assembly_part_types.code — blank for complete units. */
  part_type: string
  /**
   * Multi-assign companions. The single `section`/`item_kind`/`part_type` fields above
   * remain the "primary" value (first element) for backward-compatible logic; these arrays
   * hold the full set. Kept in sync via {@link setRowSectionsPatch} etc.
   */
  sections?: string[]
  item_kinds?: WorkbenchItemKindValue[]
  part_types?: string[]
}

export type WorkbenchItemKindValue = PricelistWorkbenchRow['item_kind']

/** Effective list of sections (array if set, else the single primary, else empty). */
export function rowSections(row: PricelistWorkbenchRow): string[] {
  if (Array.isArray(row.sections) && row.sections.length) return dedupeStrings(row.sections)
  return row.section.trim() ? [row.section.trim()] : []
}

export function rowItemKinds(row: PricelistWorkbenchRow): WorkbenchItemKindValue[] {
  if (Array.isArray(row.item_kinds) && row.item_kinds.length) {
    return [...new Set(row.item_kinds)]
  }
  return row.item_kind ? [row.item_kind] : []
}

export function rowPartTypes(row: PricelistWorkbenchRow): string[] {
  if (Array.isArray(row.part_types) && row.part_types.length) return dedupeStrings(row.part_types)
  return row.part_type.trim() ? [row.part_type.trim()] : []
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

/** Build a patch that keeps the array and its single "primary" field in sync. */
export function setRowSectionsPatch(values: string[]): Partial<PricelistWorkbenchRow> {
  const list = dedupeStrings(values)
  return { sections: list, section: list[0] ?? '' }
}

export function setRowItemKindsPatch(values: WorkbenchItemKindValue[]): Partial<PricelistWorkbenchRow> {
  const list = [...new Set(values)].filter(Boolean) as WorkbenchItemKindValue[]
  return { item_kinds: list, item_kind: list[0] ?? 'other' }
}

export function setRowPartTypesPatch(values: string[]): Partial<PricelistWorkbenchRow> {
  const list = dedupeStrings(values)
  return { part_types: list, part_type: list[0] ?? '' }
}

export interface PublishWorkbenchResult {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

function programFromParsed(row: TealburyParsedRow, fileSource: PricelistSource): CatalogProgram {
  if (row.options.tealbury_layout || row.options.tealbury_source_sheet) return CATALOG_PROGRAM.TEALBURY
  if (row.options.lamtek_sheet || row.options.lamtek_source_sheet) return CATALOG_PROGRAM.LAMTEK
  return fileSource === 'tealbury' ? CATALOG_PROGRAM.TEALBURY : CATALOG_PROGRAM.LAMTEK
}

function doorRangeFromParsed(row: TealburyParsedRow): string {
  const dr = row.options.tealbury_door_range
  return typeof dr === 'string' ? dr : ''
}

function tradeCodeFromParsed(row: TealburyParsedRow): string {
  const tc = row.options.tealbury_trade_code
  if (typeof tc === 'string' && tc) return tc
  const sku = row.sku
  const idx = sku.indexOf(' · ')
  return idx > 0 ? sku.slice(0, idx) : sku
}

export const UNASSIGNED_CATEGORY = {
  category_id: null as string | null,
  category_slug: '',
  category_name: '',
}

/** Suggest an existing portal category only — never invent new category names/slugs. */
export function suggestCategoryForPricelistRow(
  section: string,
  categories: CategoryRow[],
  source: PricelistSource,
  accessoryHint?: { description: string; code: string }
): { category_id: string | null; category_slug: string; category_name: string } {
  const candidates: string[] = []
  const sectionTrim = section.trim()
  if (sectionTrim) candidates.push(sectionTrim)

  if (/drawer\s*front/i.test(sectionTrim)) {
    candidates.unshift('Drawer Fronts')
  }
  if (source === 'tealbury' && /accessor/i.test(section) && accessoryHint) {
    const mapped = mapTealburyAccessoryToCategory(accessoryHint.description, accessoryHint.code)
    if (mapped) candidates.unshift(mapped)
  }

  const seen = new Set<string>()
  for (const name of candidates) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const byName = categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (byName) {
      return { category_id: byName.id, category_slug: byName.slug, category_name: byName.name }
    }

    const slugCandidate = slugifyCategoryName(name)
    const bySlug = categories.find((c) => c.slug === slugCandidate)
    if (bySlug) {
      return { category_id: bySlug.id, category_slug: bySlug.slug, category_name: bySlug.name }
    }

    const partial = categories.find((c) => {
      const cn = c.name.toLowerCase()
      const sn = name.toLowerCase()
      if (sn.length < 4) return false
      return cn === sn || (cn.includes(sn) && sn.length >= cn.length * 0.6)
    })
    if (partial) {
      return { category_id: partial.id, category_slug: partial.slug, category_name: partial.name }
    }
  }

  return { ...UNASSIGNED_CATEGORY }
}

/** Build a display name when the parser left name blank (common on sparse accessory lines). */
export function deriveWorkbenchProductName(row: {
  name: string
  sku: string
  description: string
  section: string
  trade_code: string
}): string {
  const direct = row.name.trim()
  if (direct) return direct.slice(0, 300)

  const itemLine =
    row.description
      .split('\n')
      .find((l) => l.startsWith('Item: '))
      ?.slice(6)
      .trim() ?? ''
  if (itemLine) return itemLine.slice(0, 300)

  const specLine =
    row.description
      .split('\n')
      .find((l) => l.startsWith('Specification: '))
      ?.slice(15)
      .trim() ?? ''
  if (specLine) return specLine.slice(0, 300)

  const sku = row.sku.trim()
  const code = row.trade_code.trim()
  if (sku && code && sku !== code) return `${code} — ${sku}`.slice(0, 300)
  if (sku) return sku.slice(0, 300)
  if (code) return code.slice(0, 300)

  const section = row.section.trim()
  if (section && !/^tealbury catalogue$/i.test(section) && !/^uncategorised$/i.test(section)) {
    return section.slice(0, 300)
  }

  return ''
}

export function fillMissingWorkbenchProductNames(rows: PricelistWorkbenchRow[]): PricelistWorkbenchRow[] {
  return rows.map((r) => {
    const name = deriveWorkbenchProductName(r)
    return name && !r.name.trim() ? { ...r, name } : r
  })
}

export function parsedToWorkbenchRow(
  parsed: TealburyParsedRow,
  fileSource: PricelistSource,
  categories: CategoryRow[],
  id?: string
): PricelistWorkbenchRow {
  const catalog_program = programFromParsed(parsed, fileSource)
  const section = parsed.categoryName || ''
  const door_range = doorRangeFromParsed(parsed)
  const trade_code = tradeCodeFromParsed(parsed)
  const descParts = parsed.description.split('\n')
  const itemLine = descParts.find((l) => l.startsWith('Item: '))?.slice(6) ?? ''
  const cat = suggestCategoryForPricelistRow(section, categories, fileSource, {
    description: itemLine || parsed.name,
    code: trade_code,
  })

  const draft: PricelistWorkbenchRow = {
    id: id ?? crypto.randomUUID(),
    source: fileSource,
    catalog_program,
    sku: parsed.sku,
    name: parsed.name,
    description: parsed.description,
    unit_price: parsed.unitPrice,
    cost_price: parsed.cost_price,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    category_id: cat.category_id,
    category_slug: cat.category_slug,
    category_name: cat.category_name,
    section,
    door_range,
    trade_code,
    selected: false,
    options: { ...parsed.options },
    item_kind: fileSource === 'tealbury' ? 'complete' : 'component',
    part_type: '',
  }

  const name = deriveWorkbenchProductName(draft)
  const withName = name ? { ...draft, name } : draft
  return enrichWorkbenchRowMetadata(withName)
}

export function workbenchToExportRow(row: PricelistWorkbenchRow): CatalogueExportRow {
  return {
    category_slug: row.category_slug,
    category_name: row.category_name,
    name: row.name,
    description: row.description,
    sku: row.sku,
    unit_price: row.unit_price,
    active: row.active,
    image_url: row.image_url,
    image_alt: row.image_alt,
    is_stock: row.is_stock,
  }
}

export function downloadWorkbenchTemplateXlsx(rows: PricelistWorkbenchRow[], filename?: string) {
  const exportRows = rows.map(workbenchToExportRow)
  downloadXlsx(exportRows, filename ?? `catalogue-draft-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function applyCategoryToRows(
  rows: PricelistWorkbenchRow[],
  ids: Set<string>,
  category: CategoryRow | null,
  custom?: { slug: string; name: string }
): PricelistWorkbenchRow[] {
  if (!category && !custom) return rows
  const slug = category?.slug ?? custom?.slug ?? ''
  const name = category?.name ?? custom?.name ?? ''
  const categoryId = category?.id ?? null
  return rows.map((r) => {
    if (!ids.has(r.id)) return r
    return { ...r, category_id: categoryId, category_slug: slug, category_name: name }
  })
}

export function autoMapWorkbenchCategories(
  rows: PricelistWorkbenchRow[],
  categories: CategoryRow[],
  onlyUnassigned: boolean
): PricelistWorkbenchRow[] {
  return rows.map((r) => {
    if (onlyUnassigned && r.category_id) return r
    const descParts = r.description.split('\n')
    const itemLine = descParts.find((l) => l.startsWith('Item: '))?.slice(6) ?? ''
    const cat = suggestCategoryForPricelistRow(r.section, categories, r.source, {
      description: itemLine || r.name,
      code: r.trade_code,
    })
    if (!cat.category_id) return r
    return {
      ...r,
      category_id: cat.category_id,
      category_slug: cat.category_slug,
      category_name: cat.category_name,
    }
  })
}

/** Tealbury slug prefix used by legacy importer — avoid for new assignments unless already tealbury-* */
export function tealburyLegacySlugPrefix(): string {
  return 'tealbury-'
}

export function sectionToDefaultSlug(section: string, source: PricelistSource): string {
  const core = slugifyCategorySegment(section)
  if (source === 'tealbury' && !core.startsWith('tealbury-')) {
    return `${tealburyLegacySlugPrefix()}${core}`.slice(0, 80)
  }
  return slugifyCategoryName(section).slice(0, 80)
}

/** Upsert workbench rows into products (by SKU). Only uses categories you assigned — never creates new ones. */
export async function publishWorkbenchRows(
  rows: PricelistWorkbenchRow[],
  opts?: { onlySelected?: boolean; skipMissingSku?: boolean }
): Promise<PublishWorkbenchResult> {
  const result: PublishWorkbenchResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }

  const toPublish = opts?.onlySelected ? rows.filter((r) => r.selected) : rows
  if (!toPublish.length) {
    result.errors.push('No rows to publish.')
    return result
  }

  for (const row of toPublish) {
    const sku = row.sku.trim()
    if (!sku) {
      if (opts?.skipMissingSku !== false) {
        result.skipped++
        result.errors.push(`Skipped row with empty SKU: ${row.name.slice(0, 40)}`)
      }
      continue
    }

    const displayName = (row.name.trim() || deriveWorkbenchProductName(row)).trim()
    if (!displayName) {
      result.skipped++
      result.errors.push(`Skipped ${sku}: missing product name (edit name before publish)`)
      continue
    }

    const catId = row.category_id?.trim() || null

    const sections = rowSections(row)
    const itemKinds = rowItemKinds(row)
    const partTypes = rowPartTypes(row)
    // Surface multi-sections to the ordering screen, which reads `*_sections` from options.
    const sectionsKey = row.catalog_program === CATALOG_PROGRAM.TEALBURY ? 'tealbury_sections' : 'lamtek_sections'
    const mergedOptions: Record<string, Json> = {
      ...row.options,
      workbench_sections: sections,
      workbench_item_kinds: itemKinds,
      workbench_part_types: partTypes,
    }
    if (sections.length) mergedOptions[sectionsKey] = sections

    const payload = {
      category_id: catId,
      name: displayName.slice(0, 255),
      description: row.description || null,
      sku,
      unit_price: Math.max(0, row.unit_price),
      cost_price: row.cost_price,
      active: row.active,
      sort_order: 0,
      image_url: row.image_url || null,
      image_alt: row.image_alt || null,
      is_stock: row.is_stock !== false,
      catalog_program: row.catalog_program,
      part_type: partTypes[0] ?? (row.part_type?.trim() || null),
      options: mergedOptions as Json,
    }

    const { data: existing } = await supabase.from('products').select('id').eq('sku', sku).maybeSingle()
    let productId = existing?.id ?? null
    if (existing?.id) {
      const { error: upErr } = await supabase.from('products').update(payload).eq('id', existing.id)
      if (upErr) result.errors.push(`Update ${sku}: ${upErr.message}`)
      else result.updated++
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .maybeSingle()
      if (insErr) result.errors.push(`Insert ${sku}: ${insErr.message}`)
      else {
        result.inserted++
        productId = inserted?.id ?? null
      }
    }

    if (productId && catId) {
      const extraRaw = row.options.extra_category_id
      const extraId = typeof extraRaw === 'string' && extraRaw.trim() ? extraRaw.trim() : null
      const sellable = row.options.sellable_standalone === true
      if (sellable && extraId && extraId !== catId) {
        const { error: catErr } = await saveProductCategories(productId, [catId, extraId], catId)
        if (catErr) result.errors.push(`Categories ${sku}: ${catErr}`)
      }
    }
  }

  return result
}
