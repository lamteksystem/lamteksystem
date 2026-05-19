import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SparklineSvg } from './DashboardDecorSvgs'

type Props = {
  value: ReactNode
  label: string
  icon?: ReactNode
  hint?: string
  to?: string
  sparkline?: number[]
  accent?: 'gold' | 'success' | 'neutral'
  className?: string
}

export function VisualStatCard({ value, label, icon, hint, to, sparkline, accent = 'gold', className = '' }: Props) {
  const inner = (
    <>
      {icon && <span className="visual-stat-icon">{icon}</span>}
      <span className="visual-stat-body">
        <span className={`visual-stat-value visual-stat-value--${accent}`}>{value}</span>
        <span className="visual-stat-label">{label}</span>
        {hint && <span className="visual-stat-hint">{hint}</span>}
      </span>
      {sparkline && sparkline.length > 1 && (
        <span className="visual-stat-spark">
          <SparklineSvg values={sparkline} className="visual-stat-sparkline" />
        </span>
      )}
    </>
  )
  const cls = `visual-stat-card visual-stat-card--${accent} ${className}`.trim()
  if (to) {
    return (
      <Link to={to} className={`${cls} visual-stat-card--link`}>
        {inner}
      </Link>
    )
  }
  return <div className={cls}>{inner}</div>
}
