/**
 * Pricelist workbench: merge Tealbury + Lamtek trade workbook rows into editable
 * catalogue template rows (category_slug, sku, unit_price, …) before publish.
 */
import { supabase } from '@/lib/supabase'
import type { CategoryRow, Json } from '@/types/database'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import { slugifyCategoryName } from '@/lib/categoryAdmin'
import {
  mapTealburyAccessoryToCategory,
  slugifyCategorySegment,
  type TealburyParsedRow,
} from '@/lib/tealburyPricelistParse'
import {
  downloadXlsx,
  type CatalogueExportRow,
} from '@/lib/catalogue-import-export'

export type PricelistSource = 'tealbury' | 'lamtek'

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

/** Suggest portal category from spreadsheet section (+ Tealbury accessory rules). */
export function suggestCategoryForPricelistRow(
  section: string,
  categories: CategoryRow[],
  source: PricelistSource,
  accessoryHint?: { description: string; code: string }
): { category_id: string | null; category_slug: string; category_name: string } {
  let name = section.trim() || 'Uncategorised'
  if (source === 'tealbury' && /accessor/i.test(section) && accessoryHint) {
    const mapped = mapTealburyAccessoryToCategory(accessoryHint.description, accessoryHint.code)
    if (mapped) name = mapped
  }

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
    return cn.includes(sn) || sn.includes(cn)
  })
  if (partial) {
    return { category_id: partial.id, category_slug: partial.slug, category_name: partial.name }
  }

  return {
    category_id: null,
    category_slug: slugCandidate,
    category_name: name,
  }
}

export function parsedToWorkbenchRow(
  parsed: TealburyParsedRow,
  fileSource: PricelistSource,
  categories: CategoryRow[],
  id?: string
): PricelistWorkbenchRow {
  const catalog_program = programFromParsed(parsed, fileSource)
  const section = parsed.categoryName || 'Uncategorised'
  const door_range = doorRangeFromParsed(parsed)
  const trade_code = tradeCodeFromParsed(parsed)
  const descParts = parsed.description.split('\n')
  const itemLine = descParts.find((l) => l.startsWith('Item: '))?.slice(6) ?? ''
  const cat = suggestCategoryForPricelistRow(section, categories, fileSource, {
    description: itemLine || parsed.name,
    code: trade_code,
  })

  return {
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
  }
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

async function ensureCategoryId(
  slug: string,
  name: string,
  slugToId: Map<string, string>
): Promise<string | null> {
  const existing = slugToId.get(slug)
  if (existing) return existing
  const { data: newCat, error: catErr } = await supabase
    .from('categories')
    .insert({
      name: name.slice(0, 200) || slug.replace(/-/g, ' '),
      slug: slug.slice(0, 80),
      sort_order: 0,
    })
    .select('id')
    .single()
  if (catErr) return null
  if (newCat?.id) {
    slugToId.set(slug, newCat.id)
    return newCat.id
  }
  return null
}

/** Upsert workbench rows into products (by SKU). Creates categories when slug is new. */
export async function publishWorkbenchRows(
  rows: PricelistWorkbenchRow[],
  opts?: { onlySelected?: boolean; skipMissingSku?: boolean }
): Promise<PublishWorkbenchResult> {
  const result: PublishWorkbenchResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
  const slugToId = new Map<string, string>(
    (await supabase.from('categories').select('id, slug')).data?.map((c) => [c.slug, c.id]) ?? []
  )

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

    const catSlug = (row.category_slug || slugifyCategoryName(row.category_name || 'other')).slice(0, 80)
    const catName = row.category_name || catSlug.replace(/-/g, ' ')
    const catId =
      row.category_id ?? slugToId.get(catSlug) ?? (await ensureCategoryId(catSlug, catName, slugToId))
    if (!catId) {
      result.skipped++
      result.errors.push(`Category ${catSlug}: could not create or resolve`)
      continue
    }

    const payload = {
      category_id: catId,
      name: row.name.slice(0, 255),
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
      options: row.options as Json,
    }

    const { data: existing } = await supabase.from('products').select('id').eq('sku', sku).maybeSingle()
    if (existing?.id) {
      const { error: upErr } = await supabase.from('products').update(payload).eq('id', existing.id)
      if (upErr) result.errors.push(`Update ${sku}: ${upErr.message}`)
      else result.updated++
    } else {
      const { error: insErr } = await supabase.from('products').insert(payload)
      if (insErr) result.errors.push(`Insert ${sku}: ${insErr.message}`)
      else result.inserted++
    }
  }

  return result
}
