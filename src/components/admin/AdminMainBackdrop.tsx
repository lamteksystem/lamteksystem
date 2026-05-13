import { useId } from 'react'

/**
 * Decorative layer for admin main canvas — burgundy blobs + faint grid (Lamtek-coloured; does not obstruct content).
 */
export default function AdminMainBackdrop() {
  const uid = useId().replace(/:/g, '')
  const ga = `adm-bl-${uid}-a`
  const gb = `adm-bl-${uid}-b`
  const gm = `adm-ms-${uid}`

  return (
    <div className="admin-main-backdrop" aria-hidden>
      <svg className="admin-main-backdrop-svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gm} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#672732" stopOpacity={0} />
            <stop offset="50%" stopColor="#8a3a49" stopOpacity={0.09} />
            <stop offset="100%" stopColor="#672732" stopOpacity={0} />
          </linearGradient>
          <radialGradient id={ga} cx="72%" cy="12%" r="65%">
            <stop offset="0%" stopColor="#672732" stopOpacity={0.22} />
            <stop offset="55%" stopColor="#7f3442" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#672732" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={gb} cx="8%" cy="88%" r="55%">
            <stop offset="0%" stopColor="#4a1d28" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#4a1d28" stopOpacity={0} />
          </radialGradient>
          <filter id={`adm-soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
          </filter>
        </defs>

        <rect width="1400" height="900" fill={`url(#${gm})`} opacity={0.85} />

        <ellipse cx="980" cy="120" rx="420" ry="240" fill={`url(#${ga})`} filter={`url(#adm-soft-${uid})`} />
        <ellipse cx="260" cy="760" rx="340" ry="280" fill={`url(#${gb})`} filter={`url(#adm-soft-${uid})`} opacity={0.9} />

        <g opacity={0.5} stroke="rgba(103, 39, 50, 0.2)" strokeWidth={1} fill="none">
          <path d="M0 120 H1400 M0 300 H1400 M0 480 H1400 M0 660 H1400 M0 840 H1400" />
          <path d="M140 0 V900 M350 0 V900 M560 0 V900 M770 0 V900 M980 0 V900 M1190 0 V900" />
        </g>

        <g opacity={0.12} stroke="rgba(138, 58, 73, 0.45)" strokeWidth={1.2}>
          <path d="M200 760 Q420 620 760 460 T1320 200" />
          <circle cx="1080" cy="180" r="5" fill="rgba(248,200,210,0.5)" stroke="none" />
          <circle cx="980" cy="280" r="3" fill="rgba(248,200,210,0.35)" stroke="none" />
        </g>
      </svg>
    </div>
  )
}
