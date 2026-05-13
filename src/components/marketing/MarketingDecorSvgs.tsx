import { useId } from 'react'

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function StatYearsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={36} height={36} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth={1.65} opacity={0.35} />
      <path d="M8 3v4M16 3v4M3.5 10h17" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" />
      <path d="M9.5 14.5h1M12 14.5h1M14.5 14.5h1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function StatFootprintGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={36} height={36} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 20V10.5L12 5l8 5.5V20" {...stroke} />
      <path d="M9 20v-6h6v6" {...stroke} />
    </svg>
  )
}

export function StatLocationGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={36} height={36} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        {...stroke}
      />
      <circle cx={12} cy={11} r={2.25} {...stroke} />
    </svg>
  )
}

/** Wide decorative ribbon — sits under process heading */
export function ProcessFlowRibbon({ className }: { className?: string }) {
  const gid = useId().replace(/:/g, '')
  const gradId = `mk-ribbon-${gid}`
  return (
    <svg className={className} viewBox="0 0 800 72" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#672732" stopOpacity={0} />
          <stop offset="18%" stopColor="#672732" stopOpacity={0.45} />
          <stop offset="50%" stopColor="#c94f66" stopOpacity={0.35} />
          <stop offset="82%" stopColor="#672732" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#672732" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d="M0 40 Q100 18 200 36 T400 36 T600 34 T800 38"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {[100, 266, 432, 598].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={34} r={9} fill="rgba(103,39,50,0.08)" stroke="#d4a8b2" strokeWidth={1.25} />
          <circle cx={cx} cy={34} r={3.5} fill="#672732" opacity={0.85} />
        </g>
      ))}
    </svg>
  )
}
