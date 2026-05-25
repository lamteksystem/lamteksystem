import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import type { ActivityRow, CustomerProfileRow } from '@/types/database'

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

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AdminCrmCalendar() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('activities')
      .select('*')
      .gte('due_at', weekStart.toISOString())
      .lt('due_at', weekEnd.toISOString())
      .order('due_at')
      .limit(500)
    const rows = (data ?? []) as ActivityRow[]
    setActivities(rows)
    const ids = [...new Set(rows.map((a) => a.customer_user_id))]
    if (ids.length) {
      const { data: profs } = await supabase
        .from('customer_profiles')
        .select('user_id, company_name')
        .in('user_id', ids)
      const map = new Map<string, string>()
      for (const p of (profs ?? []) as Pick<CustomerProfileRow, 'user_id' | 'company_name'>[]) {
        map.set(p.user_id, p.company_name)
      }
      setCustomerNames(map)
    }
    setLoading(false)
  }, [canView, weekStart, weekEnd])

  useEffect(() => {
    void load()
  }, [load])

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityRow[]>()
    for (const d of days) {
      map.set(d.toDateString(), [])
    }
    for (const a of activities) {
      if (!a.due_at) continue
      const key = new Date(a.due_at).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [activities, days])

  if (!canView) {
    return <p className="admin-muted">You do not have permission to view the activity calendar.</p>
  }

  const rangeLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="admin-crm-calendar">
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
        <div className="admin-crm-calendar-grid">
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
                  {items.map((a) => (
                    <li key={a.id} className={a.completed_at ? 'admin-crm-calendar-event--done' : undefined}>
                      <span className="admin-crm-calendar-event-time">
                        {a.due_at
                          ? new Date(a.due_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                      <strong>{a.subject || a.activity_type}</strong>
                      <Link to={`/admin/customers/${a.customer_user_id}`} className="admin-crm-calendar-event-customer">
                        {customerNames.get(a.customer_user_id) ?? 'Customer'}
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && <li className="admin-muted">No tasks</li>}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <p className="admin-muted">
        Add tasks on a <Link to="/admin/customers">customer profile</Link> or mark complete on{' '}
        <Link to="/admin/crm/pipeline">Sales pipeline</Link>.
      </p>
    </div>
  )
}
