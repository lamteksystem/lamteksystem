import { supabase } from '@/lib/supabase'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { recalcOrderTotals } from '@/lib/orders'
import { effectiveBaseUnitPrice } from '@/lib/finishPricing'
import {
  composeAssemblyCode,
  composeProductLineCode,
  type OrderSetupForCode,
} from '@/lib/productCode'
import type { AssemblyWithLines, ProductRow } from '@/types/database'

export function productSnapshotFromRow(product: ProductRow) {
  return {
    name: product.name,
    description: product.description,
    sku: product.sku,
    image_url: product.image_url,
  }
}

interface OrderSetupContext {
  /** Chosen door/range finish — drives finish-aware base pricing. */
  doorFinish: string | null
  /** Setup used to compose the configuration code for added lines. */
  codeSetup: OrderSetupForCode
}

/** Fetch the order's setup once: finish for pricing + range/style for code composition. */
async function getOrderSetupContext(orderId: string): Promise<OrderSetupContext> {
  const { data } = await supabase
    .from('orders')
    .select('door_finish, carcass_finish, build_style, line_style_preference, kitchen_range_id')
    .eq('id', orderId)
    .maybeSingle()

  const doorFinish = ((data?.door_finish as string | null) ?? null) || null
  let rangeName: string | null = null
  const rangeId = (data?.kitchen_range_id as string | null) ?? null
  if (rangeId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('name')
      .eq('id', rangeId)
      .maybeSingle()
    rangeName = ((cat?.name as string | null) ?? null) || null
  }

  return {
    doorFinish,
    codeSetup: {
      build_style: (data?.build_style as OrderSetupForCode['build_style']) ?? null,
      line_style_preference:
        (data?.line_style_preference as OrderSetupForCode['line_style_preference']) ?? null,
      carcass_finish: (data?.carcass_finish as string | null) ?? null,
      door_finish: doorFinish,
      rangeName,
    },
  }
}

export async function insertProductOrderLines(params: {
  orderId: string
  lines: { product: ProductRow; quantity: number }[]
  customerUserId?: string | null
  repriceCustomer?: boolean
}): Promise<void> {
  const { orderId, lines, customerUserId, repriceCustomer = true } = params
  if (lines.length === 0) return

  const { doorFinish, codeSetup } = await getOrderSetupContext(orderId)
  const rows = lines.map(({ product, quantity }) => ({
    order_id: orderId,
    product_id: product.id,
    product_snapshot: productSnapshotFromRow(product),
    quantity,
    unit_price: effectiveBaseUnitPrice(product, doorFinish),
    options: product.options ?? {},
    composed_code: composeProductLineCode(product, codeSetup) || null,
  }))

  const { error } = await supabase.from('order_lines').insert(rows)
  if (error) throw error

  if (repriceCustomer && customerUserId) {
    await repriceDraftOrderLinesForCustomer({ orderId, customerUserId })
  } else {
    await recalcOrderTotals(orderId)
  }
}

export async function insertAssemblyOrderLines(params: {
  orderId: string
  assembly: AssemblyWithLines
  quantity: number
  customerUserId?: string | null
  repriceCustomer?: boolean
}): Promise<void> {
  const { orderId, assembly, quantity, customerUserId, repriceCustomer = true } = params
  const assemblyLines = assembly.assembly_lines ?? []
  const { doorFinish, codeSetup } = await getOrderSetupContext(orderId)
  // One configuration code for the whole unit; every component line shares it.
  const unitCode = composeAssemblyCode(assembly, codeSetup) || null
  const inserts = assemblyLines.flatMap((line) => {
    const product = line.product as ProductRow | undefined
    if (!product) return []
    // Door/range-finished components (e.g. the doors) price from the chosen
    // finish; carcass, legs and fittings have no finish matrix so keep unit_price.
    return {
      order_id: orderId,
      product_id: product.id,
      product_snapshot: productSnapshotFromRow(product),
      quantity: line.quantity * quantity,
      unit_price: effectiveBaseUnitPrice(product, doorFinish),
      options: product.options ?? {},
      composed_code: unitCode,
    }
  })
  if (inserts.length === 0) return
  const { error } = await supabase.from('order_lines').insert(inserts)
  if (error) throw error
  if (repriceCustomer && customerUserId) {
    await repriceDraftOrderLinesForCustomer({ orderId, customerUserId })
  } else {
    await recalcOrderTotals(orderId)
  }
}
