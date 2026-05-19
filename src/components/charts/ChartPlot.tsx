import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type Props = {
  height: number
  children: ReactElement
  className?: string
}

/** ResponsiveContainer needs a parent with explicit pixel dimensions (not only % height). */
export function ChartPlot({ height, children, className = '' }: Props) {
  const h = Math.max(height, 120)
  return (
    <div
      className={`chart-plot ${className}`.trim()}
      style={{ width: '100%', height: h, minWidth: 0, minHeight: h, position: 'relative' }}
    >
      <ResponsiveContainer width="100%" height={h}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
