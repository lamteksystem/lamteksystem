import fs from 'fs'
import path from 'path'

const root = path.join(import.meta.dirname, '..')
const w = (rel, content) => {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
  console.log('wrote', rel)
}

w('src/components/charts/chartTheme.ts', `export const CHART_COLORS = { primary: '#672732', primaryLight: '#a85263', grid: 'rgba(107, 114, 128, 0.2)' } as const
export const chartTooltipStyle = { background: 'var(--lamtek-surface)', border: '1px solid var(--lamtek-border, #e9d7db)', borderRadius: 8, fontSize: 12, color: 'var(--lamtek-text)' } as const
`)

w('src/components/charts/AreaTrendChart.tsx', `import { useId } from 'react'
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
          <Area type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} fill={\`url(#\${gradId})\`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </motion>
  )
}
`.replace('</motion>', '</div>'))

w('src/components/charts/BarTrendChart.tsx', `import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
`.replace('</motion>', '</div>'))

console.log('bootstrap done')
