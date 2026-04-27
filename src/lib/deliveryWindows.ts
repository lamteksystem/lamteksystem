import type { DeliveryServiceDayRow, DeliveryWindowRow } from '@/types/database'
import { supabase } from '@/lib/supabase'

export type DeliveryWindowWithDays = DeliveryWindowRow & {
  delivery_service_days: DeliveryServiceDayRow[]
}

const WEEKDAY_LONG_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/** Calendar date string YYYY-MM-DD for "now" in Europe/London. */
export function londonYmd(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function londonWeekdayIndex(ymd: string): number {
  const [Y, M, D] = ymd.split('-').map((x) => Number(x))
  if (!Y || !M || !D) return 0
  const utcNoon = Date.UTC(Y, M - 1, D, 12, 0, 0)
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long' })
  const part = fmt.formatToParts(new Date(utcNoon)).find((p) => p.type === 'weekday')
  const key = (part?.value ?? 'sunday').toLowerCase()
  return WEEKDAY_LONG_TO_INDEX[key] ?? 0
}

function minutesSinceMidnightLondon(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

/** Parses `time` from Postgres (HH:MM:SS or HH:MM) to minutes from midnight. */
export function parseTimeToMinutes(time: string): number {
  const [h, min] = time.split(':').map((x) => Number(x))
  if (!Number.isFinite(h)) return 0
  return h * 60 + (Number.isFinite(min) ? min : 0)
}

/** UTC-calendar add; good enough for lead-time day counts vs scheduled date strings. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function formatDeliveryWindowLabel(w: Pick<DeliveryWindowRow, 'name' | 'start_time' | 'end_time'>): string {
  const start = w.start_time?.slice(0, 5) ?? ''
  const end = w.end_time?.slice(0, 5) ?? ''
  if (start && end) return `${w.name} (${start}–${end})`
  return w.name
}

export async function fetchDeliveryWindowsWithDays(): Promise<DeliveryWindowWithDays[]> {
  const { data, error } = await supabase
    .from('delivery_windows')
    .select('*, delivery_service_days(*)')
    .order('name')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as DeliveryWindowWithDays[]
  return rows.map((r) => ({
    ...r,
    delivery_service_days: Array.isArray(r.delivery_service_days) ? r.delivery_service_days : [],
  }))
}

export type DeliverySelectionResult = { ok: true } | { ok: false; message: string }

/**
 * MVP rules: service day must exist for London weekday of chosen date;
 * respect same-day cut-off; respect minimum lead_time_days from that rule vs London "today".
 */
export function validateDeliverySelection(args: {
  scheduledDate: string
  windowId: string
  windows: DeliveryWindowWithDays[]
  now?: Date
}): DeliverySelectionResult {
  const now = args.now ?? new Date()
  const { scheduledDate, windowId, windows } = args
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return { ok: false, message: 'Choose a valid delivery date.' }
  }
  const win = windows.find((w) => w.id === windowId)
  if (!win) return { ok: false, message: 'Choose a delivery time window.' }

  const weekday = londonWeekdayIndex(scheduledDate)
  const rule = win.delivery_service_days.find((r) => r.weekday === weekday)
  if (!rule) {
    return { ok: false, message: 'That day is not available for the selected window. Pick another date or window.' }
  }

  const todayLondon = londonYmd(now)
  const minByLead = addDaysYmd(todayLondon, rule.lead_time_days)
  if (scheduledDate < minByLead) {
    return {
      ok: false,
      message: `This window needs at least ${rule.lead_time_days} day(s) notice. First available date is ${minByLead}.`,
    }
  }

  if (scheduledDate === todayLondon) {
    const cutOff = parseTimeToMinutes(rule.cut_off_time)
    const nowM = minutesSinceMidnightLondon(now)
    if (nowM > cutOff) {
      return {
        ok: false,
        message: 'Today’s cut-off time has passed for this window. Choose tomorrow or another slot.',
      }
    }
  }

  return { ok: true }
}
