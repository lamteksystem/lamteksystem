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
  kitchen_range_id: string | null
  door_finish: string | null
  carcass_finish: string | null
  build_style: OrderRow['build_style']
  line_style_preference: OrderRow['line_style_preference']
}

export function orderNeedsTealburySetup(order: Pick<OrderRow, keyof TealburyOrderSetup> | null): boolean {
  if (!order) return true
  return (
    !order.kitchen_range_id ||
    !order.door_finish ||
    !order.carcass_finish ||
    !order.build_style ||
    !order.line_style_preference
  )
}

export async function loadTealburyOrderSetup(orderId: string): Promise<TealburyOrderSetup | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('kitchen_range_id, door_finish, carcass_finish, build_style, line_style_preference')
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
      kitchen_range_id: setup.kitchen_range_id,
      door_finish: setup.door_finish,
      carcass_finish: setup.carcass_finish,
      build_style: setup.build_style,
      line_style_preference: setup.line_style_preference,
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
