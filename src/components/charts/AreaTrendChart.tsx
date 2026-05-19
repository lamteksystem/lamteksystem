import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartPoint } from '@/lib/dashboardAnalytics'
import { CHART_COLORS, chartTooltipStyle } from './chartTheme'
type Props = { data: ChartPoint[]; height?: number; valueFormatter?: (n: number) => string; ariaLabel?: string }
export function AreaTrendChart({ data, height = 220, valueFormatter, ariaLabel }: Props) {
  const gradId = useId().replace(/:/g, '')
  const fmt = valueFormatter ?? ((n: number) => String(n))
  if (data.length === 0) return <p className="chart-empty">No data for this period.</p>
  const chartData = data.map((p) => ({ ...p, displayLabel: p.label ?? p.date.slice(5) }))
  return (
    <div className="chart-wrap chart-wrap--animate" style={{ height }} role="img" aria-label={ariaLabel ?? 'Trend chart'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} /><stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="displayLabel" tick={{ fontSize: 11, fill: 'var(--lamtek-text-muted, #6b7280)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: 'var(--lamtek-text-muted, #6b7280)' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [fmt(Number(value ?? 0)), '']} />
          <Area type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
