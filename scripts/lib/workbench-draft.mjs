/**
 * Shared helpers: build workbench rows and save to catalogue_workbench_drafts (not live products).
 */
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const DRAFT_ID = 'global'
const COST_FACTOR = 0.75

export function slugifyCategoryName(name) {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'general'
  )
}

function mapTealburyAccessoryToCategory(description, code) {
  const hay = `${description} ${code}`.toLowerCase()
  if (/cutlery|tray/.test(hay)) return 'Cutlery Trays'
  if (/light|led|spot/.test(hay)) return 'Lighting'
  if (/plinth/.test(hay)) return 'Plinth'
  if (/cornice|pelmet/.test(hay)) return 'Cornice & Pelmet'
  if (/panel|post/.test(hay)) return 'Panels'
  if (/handle/.test(hay)) return 'Handles'
  if (/hinge/.test(hay)) return 'Hinges & Fittings'
  if (/drawer/.test(hay)) return 'Shelves & Interiors'
  return 'Misc'
}

export function suggestCategoryForRow(section, categories, source, accessoryHint) {
  const candidates = []
  const sectionTrim = (section || '').trim()
  if (sectionTrim) candidates.push(sectionTrim)
  if (source === 'tealbury' && /accessor/i.test(sectionTrim) && accessoryHint) {
    const mapped = mapTealburyAccessoryToCategory(accessoryHint.description, accessoryHint.code)
    if (mapped) candidates.unshift(mapped)
  }
  const seen = new Set()
  for (const name of candidates) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const byName = categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (byName) return { category_id: byName.id, category_slug: byName.slug, category_name: byName.name }
    const slug = slugifyCategoryName(name)
    const bySlug = categories.find((c) => c.slug === slug)
    if (bySlug) return { category_id: bySlug.id, category_slug: bySlug.slug, category_name: bySlug.name }
  }
  return { category_id: null, category_slug: '', category_name: '' }
}

function inferPartType(row, source) {
  if (source === 'tealbury') return ''
  const hay = `${row.categoryName || ''} ${row.name || ''} ${row.description || ''}`.toLowerCase()
  if (/hinge\s*plate|base\s*plate/.test(hay)) return 'hinge_plate'
  if (/hinge/.test(hay)) return 'hinge'
  if (/drawer\s*box|drawerbox/.test(hay)) return 'drawer'
  if (/cutlery|tray/.test(hay)) return 'other'
  if (/leg/.test(hay)) return 'leg_kit'
  if (/fitting/.test(hay)) return 'fittings'
  if (/carcass|base\s*unit|wall\s*unit|tall|cabinet/.test(hay)) return 'unit'
  return 'other'
}

export function parsedToWorkbenchRow(parsed, fileSource, categories) {
  const catalog_program = parsed.options?.tealbury_layout || parsed.options?.tealbury_source_sheet ? 'tealbury' : fileSource === 'tealbury' ? 'tealbury' : 'lamtek'
  const section = parsed.categoryName || ''
  const door_range = typeof parsed.options?.tealbury_door_range === 'string' ? parsed.options.tealbury_door_range : ''
  const trade_code =
    typeof parsed.options?.tealbury_trade_code === 'string' && parsed.options.tealbury_trade_code
      ? parsed.options.tealbury_trade_code
      : parsed.sku.includes(' · ')
        ? parsed.sku.slice(0, parsed.sku.indexOf(' · '))
        : parsed.sku
  const descParts = (parsed.description || '').split('\n')
  const itemLine = descParts.find((l) => l.startsWith('Item: '))?.slice(6) ?? ''
  const cat = suggestCategoryForRow(section, categories, fileSource, {
    description: itemLine || parsed.name,
    code: trade_code,
  })
  const item_kind = fileSource === 'tealbury' ? 'complete' : 'component'
  return {
    id: randomUUID(),
    source: fileSource,
    catalog_program,
    sku: parsed.sku,
    name: parsed.name || parsed.sku,
    description: parsed.description || '',
    unit_price: parsed.unitPrice ?? 0,
    cost_price: parsed.cost_price ?? (parsed.unitPrice != null ? Math.round(parsed.unitPrice * COST_FACTOR * 100) / 100 : null),
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
    item_kind,
    part_type: inferPartType(parsed, fileSource),
  }
}

export function uformToWorkbenchRow(p, categories) {
  const section = p.section || ''
  const cat =
    p.kind === 'door'
      ? suggestCategoryForRow('Doors', categories, 'uform')
      : suggestCategoryForRow(section, categories, 'uform', {
          description: p.name,
          code: p.sku,
        })
  return {
    id: randomUUID(),
    source: 'uform',
    catalog_program: 'tealbury',
    sku: p.sku,
    name: p.name,
    description: p.description || '',
    unit_price: 0,
    cost_price: null,
    active: true,
    is_stock: true,
    image_url: '',
    image_alt: '',
    category_id: cat?.id ?? null,
    category_slug: cat?.slug ?? '',
    category_name: cat?.name ?? '',
    section: p.section || '',
    door_range: p.door_range || '',
    trade_code: '',
    selected: false,
    options: {
      uform_spec: true,
      height_mm: p.height_mm,
      width_mm: p.width_mm,
      depth_mm: p.depth_mm,
      uform_section: p.section,
    },
    item_kind: p.kind === 'door' ? 'door' : 'accessory',
    part_type: p.kind === 'door' ? 'door' : 'other',
  }
}

export async function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function fetchCategories(supabase) {
  const { data, error } = await supabase.from('categories').select('id, name, slug, parent_id, category_kind').order('name')
  if (error) throw error
  return data ?? []
}

export async function saveWorkbenchDraft(supabase, rows, warnings = []) {
  const { error } = await supabase.from('catalogue_workbench_drafts').upsert({
    id: DRAFT_ID,
    rows,
    warnings,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadWorkbenchDraft(supabase) {
  const { data, error } = await supabase.from('catalogue_workbench_drafts').select('rows, warnings').eq('id', DRAFT_ID).maybeSingle()
  if (error) throw error
  return { rows: data?.rows ?? [], warnings: data?.warnings ?? [] }
}
