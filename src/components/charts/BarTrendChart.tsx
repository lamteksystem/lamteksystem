import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from '@/lib/dashboardAnalytics'
import { CHART_COLORS, chartTooltipStyle } from './chartTheme'
type Props = { data: ChartPoint[]; height?: number; valueFormatter?: (n: number) => string; ariaLabel?: string }
export function BarTrendChart({ data, height = 220, valueFormatter, ariaLabel }: Props) {
  const fmt = valueFormatter ?? ((n: number) => String(n))
  if (data.length === 0) return <p className="chart-empty">No data for this period.</p>
  const chartData = data.map((p) => ({ ...p, displayLabel: p.label ?? p.date.slice(5) }))
  return (
    <div className="chart-wrap chart-wrap--animate" style={{ height }} role="img" aria-label={ariaLabel ?? 'Bar chart'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="displayLabel" tick={{ fontSize: 11, fill: 'var(--lamtek-text-muted, #6b7280)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--lamtek-text-muted, #6b7280)' }} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [fmt(Number(value ?? 0)), 'Orders']} />
          <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
