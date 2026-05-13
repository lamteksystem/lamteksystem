import { useId } from 'react'

/**
 * Decorative mesh + organic shapes for marketing heroes (Lamtek-branded, original artwork).
 * Kept inline for zero extra requests; does not replace photography — sits beneath copy.
 */
export default function MarketingHeroBackdrop({ variant = 'split' }: { variant?: 'split' | 'media' }) {
  const mediaBoost = variant === 'media' ? 0.12 : 0
  const uid = useId().replace(/:/g, '')
  const gMesh = `mk-mesh-${uid}`
  const gA = `mk-blob-a-${uid}`
  const gB = `mk-blob-b-${uid}`
  const fSoft = `mk-soft-${uid}`

  return (
    <div className="marketing-hero-backdrop" aria-hidden>
      <svg className="marketing-hero-backdrop-svg" viewBox="0 0 900 520" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gMesh} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.07} />
            <stop offset="50%" stopColor="#c94f66" stopOpacity={0.06} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={gA} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#672732" stopOpacity={0.45 + mediaBoost} />
            <stop offset="55%" stopColor="#c94f66" stopOpacity={0.22 + mediaBoost} />
            <stop offset="100%" stopColor="#f0a3b2" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={gB} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a1d28" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#672732" stopOpacity={0.08} />
          </linearGradient>
          <filter id={fSoft} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          </filter>
        </defs>

        <rect width="900" height="520" fill={`url(#${gMesh})`} opacity={0.9} />

        <path
          fill={`url(#${gA})`}
          filter={`url(#${fSoft})`}
          d="M-40 120 C120 -20 340 40 420 160 C520 320 380 460 200 480 C40 498 -80 380 -40 120 Z"
        />
        <path
          fill={`url(#${gB})`}
          opacity={0.85}
          d="M520 40 C720 -40 940 120 900 280 C860 420 680 520 520 500 C360 480 440 260 520 40 Z"
        />

        <g opacity={0.35} stroke="#fff" strokeWidth={1.2} fill="none">
          <path d="M80 400 C200 340 260 260 340 180" />
          <path d="M120 440 C260 360 340 300 460 220" />
          <circle cx="680" cy="120" r="4" fill="#ffb8c8" stroke="none" />
          <circle cx="720" cy="200" r="3" fill="#ffb8c8" stroke="none" opacity={0.7} />
        </g>

        <g opacity={0.14} stroke="rgba(255,250,252,0.5)" strokeWidth={1}>
          <path d="M0 80 H900 M0 160 H900 M0 240 H900 M0 320 H900 M0 400 H900" />
          <path d="M120 0 V520 M240 0 V520 M360 0 V520 M480 0 V520 M600 0 V520 M720 0 V520" />
        </g>
      </svg>
    </div>
  )
}
