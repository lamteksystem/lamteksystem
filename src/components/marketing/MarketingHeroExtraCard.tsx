import type { ReactNode } from 'react'

type MarketingHeroExtraCardProps = {
  title: string
  /** Short supporting lines — trade-focused, not duplicating the burgundy panel verbatim */
  items: readonly string[]
  footer?: ReactNode
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx={12} cy={12} r={10} fill="none" stroke="currentColor" strokeWidth={1.75} opacity={0.35} />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12.5l2.5 2.5L16 9"
      />
    </svg>
  )
}

export default function MarketingHeroExtraCard({ title, items, footer }: MarketingHeroExtraCardProps) {
  return (
    <aside className="marketing-hero-extra-card" aria-label={title}>
      <h3>{title}</h3>
      <ul className="marketing-hero-extra-list">
        {items.map((text) => (
          <li key={text}>
            <CheckGlyph className="marketing-hero-extra-check" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="marketing-hero-extra-footer">{footer}</div> : null}
    </aside>
  )
}
