import { useId } from 'react'

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function DashboardHeroRibbon({ className }: { className?: string }) {
  const gid = useId().replace(/:/g, '')
  const gradId = `dash-ribbon-${gid}`
  return (
    <svg className={className} viewBox="0 0 640 48" preserveAspectRatio="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#672732" stopOpacity={0} />
          <stop offset="25%" stopColor="#672732" stopOpacity={0.25} />
          <stop offset="50%" stopColor="#a85263" stopOpacity={0.35} />
          <stop offset="75%" stopColor="#672732" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#672732" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path className="dash-ribbon-path" d="M0 28 Q120 8 240 26 T480 24 T640 30" fill="none" stroke={`url(#${gradId})`} strokeWidth={2.5} strokeLinecap="round" />
      <circle className="dash-ribbon-dot dash-ribbon-dot--1" cx="120" cy="22" r="4" fill="#672732" opacity={0.7} />
      <circle className="dash-ribbon-dot dash-ribbon-dot--2" cx="320" cy="24" r="4" fill="#a85263" opacity={0.85} />
      <circle className="dash-ribbon-dot dash-ribbon-dot--3" cx="520" cy="20" r="4" fill="#672732" opacity={0.7} />
    </svg>
  )
}

export function StatProductsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={40} height={40} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" {...stroke} />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" {...stroke} />
      <path d="M9 12h6M9 16h4" {...stroke} />
    </svg>
  )
}

export function StatOrdersGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={40} height={40} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M6 4h12l2 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V8l2-4z" {...stroke} />
      <path d="M4 8h16" {...stroke} />
      <path d="M9 13h6M9 17h4" {...stroke} />
    </svg>
  )
}

export function StatRevenueGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={40} height={40} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 18V8l4-3 4 5 4-4 4 3v9" {...stroke} />
      <circle className="dash-pulse-dot" cx="20" cy="6" r="2" fill="currentColor" opacity={0.85} />
    </svg>
  )
}

export function StatDownloadsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={40} height={40} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 3v10M8 11l4 4 4-4" {...stroke} />
      <path d="M5 19h14" {...stroke} />
    </svg>
  )
}

export function AnimatedChartIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 64" aria-hidden focusable="false">
      <rect x="8" y="8" width="104" height="48" rx="6" fill="rgba(103,39,50,0.06)" stroke="currentColor" strokeWidth={1} opacity={0.35} />
      <polyline className="dash-chart-line" points="20,44 36,32 52,38 68,22 84,28 100,16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle className="dash-chart-dot" cx="100" cy="16" r="3" fill="currentColor" />
    </svg>
  )
}

export function SparklineSvg({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 32
  const padX = 4
  const padY = 5
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || (max > 0 ? max : 1)
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const step = innerW / (values.length - 1)
  const coords = values.map((v, i) => {
    const x = padX + i * step
    const norm = max === min ? 0.5 : (v - min) / range
    const y = padY + innerH * (1 - norm)
    return { x, y }
  })
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${coords[0].x},${h - padY} ${line} ${coords[coords.length - 1].x},${h - padY}`
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden focusable="false">
      <polygon points={area} fill="currentColor" opacity={0.14} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  )
}
