import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import type { CustomerProfileRow, OrderRow } from '@/types/database'

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function parseScheduleDate(order: OrderRow): Date | null {
  const raw = order.delivery_scheduled_date ?? order.delivery_expected_date
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type OrderSchedule = OrderRow & { company_name?: string; scheduleDate: Date }

export default function AdminDeliverySchedule() {
  const { allowed: canViewOrders } = usePermission('admin.orders', 'view')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [orders, setOrders] = useState<OrderSchedule[]>([])
  const [unscheduled, setUnscheduled] = useState<OrderSchedule[]>([])
  const [loading, setLoading] = useState(true)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const load = useCallback(async () => {
    if (!canViewOrders) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(
        'id, reference, status, user_id, delivery_address, delivery_postcode, delivery_scheduled_date, delivery_expected_date, fulfillment_method, total_inc_vat',
      )
      .eq('is_archived', false)
      .in('status', ['placed', 'invoiced', 'paid'])
      .order('delivery_scheduled_date', { ascending: true, nullsFirst: false })
      .limit(800)
    const rows = (data ?? []) as OrderRow[]
    const userIds = [...new Set(rows.map((o) => o.user_id))]
    const { data: profs } = await supabase
      .from('customer_profiles')
      .select('user_id, company_name')
      .in('user_id', userIds)
    const names = new Map(
      ((profs ?? []) as Pick<CustomerProfileRow, 'user_id' | 'company_name'>[]).map((p) => [
        p.user_id,
        p.company_name,
      ]),
    )
    const enriched: OrderSchedule[] = rows.map((o) => {
      const scheduleDate = parseScheduleDate(o)
      return {
        ...o,
        company_name: names.get(o.user_id),
        scheduleDate: scheduleDate ?? new Date(0),
      }
    })
    const inWeek: OrderSchedule[] = []
    const noDate: OrderSchedule[] = []
    for (const o of enriched) {
      const sd = parseScheduleDate(o)
      if (!sd) {
        noDate.push({ ...o, scheduleDate: new Date(0) })
        continue
      }
      if (sd >= weekStart && sd < weekEnd) inWeek.push({ ...o, scheduleDate: sd })
    }
    setOrders(inWeek)
    setUnscheduled(noDate.slice(0, 40))
    setLoading(false)
  }, [canViewOrders, weekStart, weekEnd])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => {
    const map = new Map<string, OrderSchedule[]>()
    for (const d of days) map.set(d.toDateString(), [])
    for (const o of orders) {
      const key = o.scheduleDate.toDateString()
      if (!map.has(key)) continue
      map.get(key)!.push(o)
    }
    return map
  }, [orders, days])

  if (!canViewOrders) {
    return <p className="admin-muted">You do not have permission to view the delivery schedule.</p>
  }

  const rangeLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="admin-page admin-delivery-schedule">
      <header className="admin-page-header">
        <h1>Delivery schedule</h1>
        <p className="admin-muted page-intro">
          Week view of placed, invoiced, and paid orders by scheduled or expected delivery date.
        </p>
      </header>
      <div className="admin-crm-calendar-toolbar">
        <button type="button" className="btn btn-outline btn-small" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← Previous week
        </button>
        <button type="button" className="btn btn-outline btn-small" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          This week
        </button>
        <button type="button" className="btn btn-outline btn-small" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Next week →
        </button>
        <span className="admin-crm-calendar-range">{rangeLabel}</span>
      </div>
      {loading ? (
        <p className="admin-muted">Loading…</p>
      ) : (
        <>
          <div className="admin-crm-calendar-grid admin-delivery-schedule-grid">
            {days.map((day, i) => {
              const key = day.toDateString()
              const items = byDay.get(key) ?? []
              const isToday = key === new Date().toDateString()
              return (
                <section
                  key={key}
                  className={`admin-crm-calendar-day${isToday ? ' admin-crm-calendar-day--today' : ''}`}
                >
                  <header className="admin-crm-calendar-day-head">
                    <span className="admin-crm-calendar-weekday">{WEEKDAY_LABELS[i]}</span>
                    <span className="admin-crm-calendar-date">{day.getDate()}</span>
                  </header>
                  <ul className="admin-crm-calendar-events">
                    {items.map((o) => (
                      <li key={o.id}>
                        <Link to={`/admin/orders/${o.id}`} className="admin-delivery-schedule-order">
                          <strong>{o.reference || o.id.slice(0, 8)}</strong>
                          <span className="admin-muted">{o.company_name}</span>
                          <span className="admin-muted">
                            {[o.delivery_postcode, o.fulfillment_method].filter(Boolean).join(' · ')}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {items.length === 0 && <li className="admin-muted">None</li>}
                  </ul>
                </section>
              )
            })}
          </div>
          {unscheduled.length > 0 && (
            <section className="card admin-card admin-delivery-unscheduled">
              <h2 className="admin-modal-form-section-title">No delivery date ({unscheduled.length})</h2>
              <ul className="admin-delivery-unscheduled-list">
                {unscheduled.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/orders/${o.id}`}>
                      {o.reference || o.id.slice(0, 8)} — {o.company_name} ({o.status})
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
