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
    <div className="visual-stat-card-inner">
      <div className="visual-stat-main">
        {icon && <span className="visual-stat-icon">{icon}</span>}
        <span className="visual-stat-body">
          <span className={`visual-stat-value visual-stat-value--${accent}`}>{value}</span>
          <span className="visual-stat-label">{label}</span>
          {hint && <span className="visual-stat-hint">{hint}</span>}
        </span>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="visual-stat-spark-row" aria-hidden>
          <SparklineSvg values={sparkline} className="visual-stat-sparkline" />
        </div>
      )}
    </div>
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
