import { supabase } from '@/lib/supabase'
import type { OrderRow } from '@/types/database'

export const BUILD_STYLE_OPTIONS = [
  {
    value: 'flat_pack' as const,
    label: 'Flat pack',
    detail: 'Carcasses ship unassembled — lower carriage, shorter lead time.',
  },
  {
    value: 'rigid' as const,
    label: 'Rigid (factory built)',
    detail: 'Units assembled in the factory — longer lead time and higher delivery cost.',
  },
]

export const CATALOGUE_CHOICE_OPTIONS = [
  {
    value: 'tealbury' as const,
    label: 'Tealbury Complete',
    detail: 'Packaged kitchens — pick a door range, then add complete units with BOM lines.',
  },
  {
    value: 'lamtek' as const,
    label: 'Lamtek',
    detail: 'Individual components and parts — search the Lamtek catalogue without a kitchen range wizard.',
  },
] as const

export type CatalogueChoice = (typeof CATALOGUE_CHOICE_OPTIONS)[number]['value']

export const HINGE_BRAND_OPTIONS = [
  { value: 'blum' as const, label: 'Blum' },
  { value: 'titus' as const, label: 'Titus' },
  { value: 'hafele' as const, label: 'Hafele' },
] as const

export type HingeBrand = (typeof HINGE_BRAND_OPTIONS)[number]['value']

export function hingeBrandLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return HINGE_BRAND_OPTIONS.find((o) => o.value === code)?.label ?? code
}

export const LINE_STYLE_OPTIONS = [
  {
    value: 'high_line' as const,
    label: 'Predominantly high-line',
    detail: 'Full-height doors — high-line base and wall units shown first.',
  },
  {
    value: 'drawer_line' as const,
    label: 'Predominantly drawer-line',
    detail: 'Door with drawer above — drawer-line units shown first.',
  },
  {
    value: 'mixed' as const,
    label: 'Mixed / show everything',
    detail: 'No preference — all unit types visible.',
  },
]

export type TealburyOrderSetup = {
  catalogue_choice: CatalogueChoice | null
  kitchen_range_id: string | null
  door_finish: string | null
  carcass_finish: string | null
  build_style: OrderRow['build_style']
  line_style_preference: OrderRow['line_style_preference']
  hinge_brand: OrderRow['hinge_brand']
}

export function isTealburyCatalogueChoice(choice: CatalogueChoice | null | undefined): boolean {
  return choice === 'tealbury'
}

export function orderNeedsGuidedSetup(order: Pick<OrderRow, keyof TealburyOrderSetup> | null): boolean {
  if (!order) return true
  if (!order.catalogue_choice) return true
  if (order.catalogue_choice === 'lamtek') return false
  return orderNeedsTealburyKitchenSetup(order)
}

export function orderNeedsTealburyKitchenSetup(
  order: Pick<OrderRow, keyof TealburyOrderSetup> | null,
): boolean {
  if (!order) return true
  return (
    !order.kitchen_range_id ||
    !order.door_finish ||
    !order.carcass_finish ||
    !order.build_style ||
    !order.line_style_preference ||
    !order.hinge_brand
  )
}

/** @deprecated Use orderNeedsGuidedSetup */
export function orderNeedsTealburySetup(order: Pick<OrderRow, keyof TealburyOrderSetup> | null): boolean {
  return orderNeedsGuidedSetup(order)
}

export async function loadTealburyOrderSetup(orderId: string): Promise<TealburyOrderSetup | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'catalogue_choice, kitchen_range_id, door_finish, carcass_finish, build_style, line_style_preference, hinge_brand',
    )
    .eq('id', orderId)
    .maybeSingle()
  if (error || !data) return null
  return data as TealburyOrderSetup
}

export async function saveTealburyOrderSetup(
  orderId: string,
  setup: TealburyOrderSetup,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orders')
    .update({
      catalogue_choice: setup.catalogue_choice,
      kitchen_range_id: setup.kitchen_range_id,
      door_finish: setup.door_finish,
      carcass_finish: setup.carcass_finish,
      build_style: setup.build_style,
      line_style_preference: setup.line_style_preference,
      hinge_brand: setup.hinge_brand,
    })
    .eq('id', orderId)
  return { error: error?.message ?? null }
}

export function lineStyleMatchesCategoryName(
  preference: OrderRow['line_style_preference'],
  categoryName: string,
): boolean {
  if (!preference || preference === 'mixed') return true
  const n = categoryName.toUpperCase()
  if (preference === 'high_line') {
    return /HIGH\s*LINE|HIGHLINE/.test(n) && !/DRAWER\s*LINE|DRAWERLINE/.test(n)
  }
  if (preference === 'drawer_line') {
    return /DRAWER\s*LINE|DRAWERLINE/.test(n)
  }
  return true
}

/** Kitchen ranges only — excludes plinth, cornice, pelmet and other cross-range groups. */
export function isKitchenDoorRangeCategoryName(name: string): boolean {
  const n = name.trim()
  if (/plinth|cornice|pelmet|panel|post|wirework|accessor|mould|corbel|worktop/i.test(n)) return false
  return true
}
