import type { OrderRow } from '@/types/database'
import type { OrderEventRow } from '@/types/database'
import { buildBasketDisplayLabels, getBasketDisplayLabel } from '@/lib/orderDisplayName'
import { formatBasketActivityShort, getLatestBasketActivity } from '@/lib/basketActivity'
import { useMemo } from 'react'

type Props = {
  draftOrders: OrderRow[]
  value: string
  onChange: (orderId: string | null) => void
  activityByOrderId?: Map<string, OrderEventRow[]>
  id?: string
  className?: string
}

/**
 * Basket picker: simple human-friendly names; last action (no date) as a hint when present.
 */
export default function BasketSelect({
  draftOrders,
  value,
  onChange,
  activityByOrderId,
  id,
  className,
}: Props) {
  const labels = useMemo(() => buildBasketDisplayLabels(draftOrders), [draftOrders])

  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Select basket"
    >
      {draftOrders.length === 0 ? <option value="">(none)</option> : null}
      {draftOrders.map((o) => {
        const name = getBasketDisplayLabel(o, labels)
        const latest = getLatestBasketActivity(activityByOrderId?.get(o.id))
        const activity = latest ? formatBasketActivityShort(latest.event_type) : null
        const optionLabel = activity ? `${name} · ${activity}` : name
        const title = latest?.note?.trim()
          ? `${name} — ${activity ?? 'Activity'}: ${latest.note.trim()}`
          : name
        return (
          <option key={o.id} value={o.id} title={title}>
            {optionLabel}
          </option>
        )
      })}
    </select>
  )
}
