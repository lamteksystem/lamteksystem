export type ChartPoint = { date: string; value: number; label?: string }
export type StatusSlice = { name: string; value: number; color: string }
export const STATUS_CHART_COLORS: Record<string, string> = {
  draft: '#9ca3af', quotation: '#a85263', placed: '#672732', invoiced: '#6366f1', paid: '#059669', cancelled: '#dc2626',
}
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
export function formatDashboardCurrency(n: number): string { return GBP.format(n) }
function dateKeys(days: number): string[] {
  const keys: string[] = []
  const end = new Date(); end.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) { const d = new Date(end); d.setDate(d.getDate() - i); keys.push(d.toISOString().slice(0, 10)) }
  return keys
}
export function buildDailyCounts(rows: { created_at: string }[], days = 30): ChartPoint[] {
  const keys = dateKeys(days); const counts = new Map(keys.map((k) => [k, 0]))
  for (const row of rows) { const k = row.created_at?.slice(0, 10); if (k && counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1) }
  return keys.map((date) => ({ date, value: counts.get(date) ?? 0, label: date.slice(5) }))
}
export function buildDailyRevenue(rows: { created_at: string; total_inc_vat?: number | null }[], days = 30): ChartPoint[] {
  const keys = dateKeys(days); const totals = new Map(keys.map((k) => [k, 0]))
  for (const row of rows) { const k = row.created_at?.slice(0, 10); if (!k || !totals.has(k)) continue; totals.set(k, (totals.get(k) ?? 0) + Number(row.total_inc_vat || 0)) }
  return keys.map((date) => ({ date, value: totals.get(date) ?? 0, label: date.slice(5) }))
}
export function statusBreakdown(rows: { status: string }[]): StatusSlice[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, color: STATUS_CHART_COLORS[name] ?? '#6b7280' }))
}
export function sparklineFromPoints(points: ChartPoint[]): number[] { return points.map((p) => p.value) }
export function trendToChartPoints(trend: { date: string; rev?: number; margin?: number }[], key: 'rev' | 'margin'): ChartPoint[] {
  return trend.map((p) => ({ date: p.date, value: Number(p[key] ?? 0), label: p.date.slice(5) }))
}
