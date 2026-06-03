import { supabase } from '@/lib/supabase'
import {
  addAssemblyLine,
  ensureAssemblyForProduct,
  fetchProductAssemblyBom,
} from '@/lib/productAssembly'
import {
  carcassSizeFromTradeCode,
  matchBomTemplate,
  type BomLineResolver,
  type CompleteUnitBomTemplate,
} from '@/lib/completeUnitBomTemplates'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { doorDimsForUnit } from '@/lib/variantGenerator'
import type { ProductRow } from '@/types/database'

/** Unit width (mm) from a complete product's options dims, for door sizing. */
function unitWidthMmFromProduct(product: ProductRow): number | null {
  const opts = product.options as Record<string, unknown> | null
  const dims = opts && typeof opts === 'object' ? (opts.tealbury_dims_mm ?? opts.lamtek_dims_mm) : null
  if (dims && typeof dims === 'object') {
    const w = Number((dims as Record<string, unknown>).w)
    if (Number.isFinite(w) && w > 0) return Math.round(w)
  }
  return null
}

export interface ApplyBomResult {
  completeProductId: string
  sku: string
  linesAdded: number
  warnings: string[]
  error: string | null
}

function pickLamtekCarcass(
  products: ProductRow[],
  carcassSize: string,
  doorRange?: string
): ProductRow | null {
  const lamtek = products.filter(
    (p) =>
      p.catalog_program === CATALOG_PROGRAM.LAMTEK && p.active && (p.part_type === 'unit' || !p.part_type)
  )
  const size = carcassSize.toLowerCase()
  const scored = lamtek
    .map((p) => {
      const sku = (p.sku ?? '').toLowerCase()
      const name = p.name.toLowerCase()
      let score = 0
      if (sku.startsWith(size) || sku.includes(`-${size}`) || sku.includes(`${size}-`)) score += 3
      if (name.includes(`${size} `) || name.includes(`${size}mm`)) score += 2
      if (doorRange && name.includes(doorRange.toLowerCase())) score += 1
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.p ?? null
}

function pickByPartType(products: ProductRow[], partType: string): ProductRow | null {
  return (
    products.find(
      (p) => p.catalog_program === CATALOG_PROGRAM.LAMTEK && p.active && p.part_type === partType
    ) ?? null
  )
}

function pickUformDoor(
  products: ProductRow[],
  doorRange: string,
  height_mm: number,
  width_mm: number,
  preferDrawer = false,
): ProductRow | null {
  const tag = `${height_mm}x${width_mm}`.toLowerCase()
  const rangeSlug = doorRange.toLowerCase().replace(/\s+/g, '')
  const matches = products.filter((p) => {
    const sku = (p.sku ?? '').toLowerCase()
    const name = p.name.toLowerCase()
    const isDrawer = sku.includes('-df-') || name.includes('drawer')
    const isDoor = sku.includes('-dr-') || (name.includes('door') && !isDrawer)
    if (preferDrawer && !isDrawer) return false
    if (!preferDrawer && isDrawer && !isDoor) return false
    return (
      p.active &&
      (sku.includes(tag) || name.includes(tag.replace('x', '×'))) &&
      (sku.includes('uf-') || (p.options as { uform_spec?: boolean })?.uform_spec) &&
      (name.includes(doorRange.toLowerCase()) || sku.includes(rangeSlug.slice(0, 12)))
    )
  })
  if (matches.length === 0) return null
  if (preferDrawer) return matches[0]
  return matches.find((p) => (p.sku ?? '').toLowerCase().includes('-dr-')) ?? matches[0]
}

async function resolveLine(
  resolver: BomLineResolver,
  ctx: {
    products: ProductRow[]
    tradeCode: string
    doorRange: string
    unitWidthMm: number | null
  }
): Promise<{ productId: string; role: string; qty: number } | null> {
  switch (resolver.type) {
    case 'lamtek_carcass_from_trade': {
      const size = carcassSizeFromTradeCode(ctx.tradeCode)
      if (!size) return null
      const p = pickLamtekCarcass(ctx.products, size, ctx.doorRange)
      if (!p) return null
      return { productId: p.id, role: 'unit', qty: 1 }
    }
    case 'lamtek_part_type': {
      const p = pickByPartType(ctx.products, resolver.part_type)
      if (!p) return null
      return { productId: p.id, role: resolver.part_type, qty: resolver.quantity }
    }
    case 'lamtek_part_type_per_door': {
      const p = pickByPartType(ctx.products, resolver.part_type)
      if (!p) return null
      const widthRaw = ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode))
      const doorCount = Number.isFinite(widthRaw) && widthRaw > 0 ? doorDimsForUnit(widthRaw).count : 1
      return { productId: p.id, role: resolver.part_type, qty: doorCount * resolver.per_door }
    }
    case 'uform_door': {
      const p = pickUformDoor(ctx.products, ctx.doorRange, resolver.height_mm, resolver.width_mm)
      if (!p) return null
      return { productId: p.id, role: 'door', qty: resolver.quantity }
    }
    case 'uform_door_auto': {
      const widthRaw =
        ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode) ?? NaN)
      if (!Number.isFinite(widthRaw) || widthRaw <= 0) return null
      const dims = doorDimsForUnit(widthRaw)
      const p = pickUformDoor(ctx.products, ctx.doorRange, dims.heightMm, dims.widthMm, false)
      if (!p) return null
      return { productId: p.id, role: 'door', qty: dims.count }
    }
    case 'uform_drawer_auto': {
      const widthRaw =
        ctx.unitWidthMm ?? Number(carcassSizeFromTradeCode(ctx.tradeCode) ?? NaN)
      if (!Number.isFinite(widthRaw) || widthRaw <= 0) return null
      const leafW = doorDimsForUnit(widthRaw, { doubleDoorMinWidthMm: 9999 }).widthMm
      const p = pickUformDoor(ctx.products, ctx.doorRange, resolver.drawer_height_mm, leafW, true)
      if (!p) return null
      return { productId: p.id, role: 'drawer', qty: resolver.quantity }
    }
    default:
      return null
  }
}

export async function applyBomToCompleteProduct(params: {
  completeProduct: ProductRow
  tradeCode: string
  doorRange: string
  section: string
  templates?: CompleteUnitBomTemplate[]
  replaceExisting?: boolean
}): Promise<ApplyBomResult> {
  const { completeProduct, tradeCode, doorRange, section } = params
  const sku = completeProduct.sku ?? completeProduct.id
  const base: ApplyBomResult = {
    completeProductId: completeProduct.id,
    sku,
    linesAdded: 0,
    warnings: [],
    error: null,
  }

  const template = matchBomTemplate(tradeCode, section, params.templates)
  if (!template) {
    return { ...base, error: `No BOM template matched trade code “${tradeCode}” / section “${section}”.` }
  }

  const { data: products, error: prodErr } = await supabase.from('products').select('*').eq('active', true)
  if (prodErr) return { ...base, error: prodErr.message }
  const all = (products ?? []) as ProductRow[]

  const { assemblyId, error: asmErr } = await ensureAssemblyForProduct(completeProduct)
  if (asmErr || !assemblyId) return { ...base, error: asmErr ?? 'Could not create assembly.' }

  if (params.replaceExisting) {
    const bom = await fetchProductAssemblyBom(completeProduct.id)
    if (bom?.assembly_lines.length) {
      for (const line of bom.assembly_lines) {
        await supabase.from('assembly_lines').delete().eq('id', line.id)
      }
    }
  }

  const unitWidthMm = unitWidthMmFromProduct(completeProduct)

  let sort = 1
  for (const lineDef of template.lines) {
    const resolved = await resolveLine(lineDef, { products: all, tradeCode, doorRange, unitWidthMm })
    if (!resolved) {
      base.warnings.push(`Could not resolve: ${JSON.stringify(lineDef)}`)
      continue
    }
    const { error } = await addAssemblyLine({
      assemblyId,
      productId: resolved.productId,
      quantity: resolved.qty,
      componentRole: resolved.role,
      sortOrder: sort++,
    })
    if (error) {
      base.warnings.push(error)
      continue
    }
    base.linesAdded++
  }

  if (base.linesAdded === 0) {
    return {
      ...base,
      error: 'No BOM lines could be resolved — publish Lamtek + UFORM component SKUs first.',
    }
  }

  return base
}
