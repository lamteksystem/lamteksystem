import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { DeliveryWindowWithDays } from '@/lib/deliveryWindows'
import { fetchDeliveryWindowsWithDays, formatDeliveryWindowLabel } from '@/lib/deliveryWindows'

const WEEKDAYS: { v: number; label: string }[] = [
  { v: 0, label: 'Sunday' },
  { v: 1, label: 'Monday' },
  { v: 2, label: 'Tuesday' },
  { v: 3, label: 'Wednesday' },
  { v: 4, label: 'Thursday' },
  { v: 5, label: 'Friday' },
  { v: 6, label: 'Saturday' },
]

function toPgTime(v: string): string {
  const t = v.trim()
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t
  return t
}

export default function AdminDeliveryWindows() {
  const [windows, setWindows] = useState<DeliveryWindowWithDays[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [newName, setNewName] = useState('Morning')
  const [newStart, setNewStart] = useState('08:00')
  const [newEnd, setNewEnd] = useState('12:00')

  const [dayForms, setDayForms] = useState<
    Record<string, { weekday: string; cutOff: string; leadDays: string }>
  >({})

  async function load() {
    setLoading(true)
    try {
      const data = await fetchDeliveryWindowsWithDays()
      setWindows(data)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load windows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function dayForm(windowId: string) {
    return dayForms[windowId] ?? { weekday: '1', cutOff: '12:00', leadDays: '0' }
  }

  function setDayForm(windowId: string, patch: Partial<{ weekday: string; cutOff: string; leadDays: string }>) {
    setDayForms((prev) => ({
      ...prev,
      [windowId]: { ...dayForm(windowId), ...patch },
    }))
  }

  async function addWindow(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('delivery_windows').insert({
      name: newName.trim(),
      start_time: toPgTime(newStart),
      end_time: toPgTime(newEnd),
      timezone: 'Europe/London',
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setNewName('Afternoon')
    await load()
  }

  async function addServiceDay(windowId: string) {
    const f = dayForm(windowId)
    const weekday = Number(f.weekday)
    const lead = Number(f.leadDays)
    if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) return
    if (!Number.isFinite(lead) || lead < 0) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('delivery_service_days').insert({
      window_id: windowId,
      weekday,
      cut_off_time: toPgTime(f.cutOff),
      lead_time_days: lead,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    await load()
  }

  async function removeServiceDay(id: string) {
    if (!confirm('Remove this service day rule?')) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('delivery_service_days').delete().eq('id', id)
    setSaving(false)
    if (error) setMessage(error.message)
    else await load()
  }

  async function removeWindow(id: string, label: string) {
    if (!confirm(`Delete window “${label}” and all its rules?`)) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('delivery_windows').delete().eq('id', id)
    setSaving(false)
    if (error) setMessage(error.message)
    else await load()
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin">Today</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/stock">Stock take</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Delivery windows</span>
        </span>
      </div>

      <p className="page-intro">
        Define named time bands (e.g. AM / PM) and, for each weekday, cut-off time and minimum lead time in days. Customers only see scheduling UI when at least one window exists.
      </p>

      {message && <p className="admin-error">{message}</p>}

      <div className="card admin-card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Add window</h2>
        <form className="admin-detail-form admin-detail-form--two-col" onSubmit={addWindow}>
          <label>Name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Morning (8–12)" />
          <label>Start (local)</label>
          <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          <label>End (local)</label>
          <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn" disabled={saving || !newName.trim()}>
              {saving ? 'Saving…' : 'Create window'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <p className="admin-muted">Loading…</p>
      ) : windows.length === 0 ? (
        <div className="card admin-card">
          <p style={{ margin: 0 }}>No delivery windows yet. Add one above to enable customer date/window selection at checkout.</p>
        </div>
      ) : (
        <ul className="admin-report-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {windows.map((w) => (
            <li key={w.id} className="card admin-card" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{w.name}</strong>
                  <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
                    {formatDeliveryWindowLabel(w)}
                  </span>
                </div>
                <button type="button" className="btn btn-outline btn-danger-outline btn-small" onClick={() => removeWindow(w.id, w.name)} disabled={saving}>
                  Delete window
                </button>
              </div>
              <p className="admin-muted" style={{ marginBottom: '0.35rem' }}>Service days</p>
              {w.delivery_service_days.length === 0 ? (
                <p className="admin-muted" style={{ marginTop: 0 }}>No weekday rules — customers cannot select this window until you add at least one day.</p>
              ) : (
                <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
                  {w.delivery_service_days
                    .slice()
                    .sort((a, b) => a.weekday - b.weekday)
                    .map((d) => (
                      <li key={d.id}>
                        {WEEKDAYS.find((x) => x.v === d.weekday)?.label ?? d.weekday} · cut-off{' '}
                        {String(d.cut_off_time).slice(0, 5)} · lead {d.lead_time_days} day(s)
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          style={{ marginLeft: '0.35rem' }}
                          onClick={() => removeServiceDay(d.id)}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              <div className="admin-inline-form" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
                <label>
                  Weekday
                  <select
                    value={dayForm(w.id).weekday}
                    onChange={(e) => setDayForm(w.id, { weekday: e.target.value })}
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.v} value={String(d.v)}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cut-off
                  <input
                    type="time"
                    value={dayForm(w.id).cutOff}
                    onChange={(e) => setDayForm(w.id, { cutOff: e.target.value })}
                  />
                </label>
                <label>
                  Lead days
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={dayForm(w.id).leadDays}
                    onChange={(e) => setDayForm(w.id, { leadDays: e.target.value })}
                    style={{ width: '5rem' }}
                  />
                </label>
                <button type="button" className="btn btn-outline btn-small" onClick={() => addServiceDay(w.id)} disabled={saving}>
                  Add rule
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
