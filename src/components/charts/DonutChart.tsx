import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { StatusSlice } from '@/lib/dashboardAnalytics'
import { chartTooltipStyle } from './chartTheme'

type Props = { data: StatusSlice[]; height?: number; ariaLabel?: string }

export function DonutChart({ data, height = 220, ariaLabel }: Props) {
  if (data.length === 0) return <p className="chart-empty">No status data yet.</p>
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="chart-wrap chart-wrap--donut" style={{ height }} role="img" aria-label={ariaLabel ?? 'Status breakdown'}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [`${value} (${total ? Math.round((Number(value) / total) * 100) : 0}%)`, String(name)]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="chart-legend" aria-hidden>
        {data.map((d) => (
          <li key={d.name}>
            <span className="chart-legend-swatch" style={{ background: d.color }} />
            <span className="chart-legend-label">{d.name}</span>
            <span className="chart-legend-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
