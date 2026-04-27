/**
 * SVG shape diagrams for Made to Measure ordering.
 * All use viewBox for scaling; default size controlled by CSS (--mtm-diagram-size).
 */

import { useId } from 'react'

const defaultSize = 120

export function DoorRect({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-door-rect ${className}`} style={{ width, height }} aria-hidden>
      <rect x="8" y="8" width="84" height="84" rx="2" fill="var(--tm-surface)" stroke="var(--tm-gray)" strokeWidth="2" />
      <rect x="12" y="12" width="76" height="76" rx="1" fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="1" />
    </svg>
  )
}

/** Framed door: outer frame + inner panel */
export function DoorFramed({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-door-framed ${className}`} style={{ width, height }} aria-hidden>
      <rect x="5" y="5" width="90" height="90" rx="2" fill="none" stroke="var(--tm-black)" strokeWidth="4" />
      <rect x="14" y="14" width="72" height="72" rx="1" fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="1.5" />
    </svg>
  )
}

/** Angled door: shapes and dimension labels to match standard shop drawings. Front of door at bottom. */
const doorX = 10
const doorY = 10
const doorW = 80
const doorH = 80
const cut = 20

function AngledDoorLabels({
  type,
}: {
  type: 'top-right' | 'top-left' | 'both-top' | 'top-right-step' | 'top-left-step'
}) {
  const textClass = 'mtm-door-angled-label'
  const small = 'mtm-door-angled-label--small'
  const labels: Record<string, JSX.Element> = {
    'top-left': (
      <>
        <text x={50} y={96} textAnchor="middle" className={small}>Front Of Door</text>
        <text x={50} y={88} textAnchor="middle" className={textClass}>Width</text>
        <text x={92} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={18} y={88} textAnchor="middle" className={small}>LAW</text>
        <text x={18} y={18} textAnchor="middle" className={textClass}>LAH</text>
      </>
    ),
    'top-right': (
      <>
        <text x={50} y={96} textAnchor="middle" className={small}>Front Of Door</text>
        <text x={50} y={88} textAnchor="middle" className={textClass}>Width</text>
        <text x={8} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={82} y={88} textAnchor="middle" className={small}>LAW</text>
        <text x={82} y={18} textAnchor="middle" className={textClass}>LAH</text>
      </>
    ),
    'both-top': (
      <>
        <text x={50} y={96} textAnchor="middle" className={small}>Front Of Door</text>
        <text x={50} y={88} textAnchor="middle" className={textClass}>Width</text>
        <text x={8} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={92} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={22} y={88} textAnchor="middle" className={small}>LAW</text>
        <text x={78} y={88} textAnchor="middle" className={small}>RAW</text>
        <text x={28} y={18} textAnchor="middle" className={small}>LAH</text>
        <text x={72} y={18} textAnchor="middle" className={small}>RAH</text>
      </>
    ),
    'top-left-step': (
      <>
        <text x={50} y={96} textAnchor="middle" className={small}>Front Of Door</text>
        <text x={50} y={88} textAnchor="middle" className={textClass}>Width</text>
        <text x={8} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={92} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={22} y={88} textAnchor="middle" className={small}>LAW</text>
        <text x={78} y={88} textAnchor="middle" className={small}>RAW</text>
        <text x={32} y={18} textAnchor="middle" className={small}>LAH</text>
        <text x={68} y={18} textAnchor="middle" className={small}>RAH</text>
      </>
    ),
    'top-right-step': (
      <>
        <text x={50} y={96} textAnchor="middle" className={small}>Front Of Door</text>
        <text x={50} y={88} textAnchor="middle" className={textClass}>Width</text>
        <text x={8} y={50} textAnchor="middle" className={textClass} style={{ writingMode: 'vertical-rl' }}>Height</text>
        <text x={38} y={18} textAnchor="middle" className={small}>RAW</text>
        <text x={82} y={50} textAnchor="middle" className={textClass}>RAH</text>
      </>
    ),
  }
  return <g>{labels[type] ?? null}</g>
}

export function DoorAngled({
  type,
  width = defaultSize,
  height = defaultSize,
  className = '',
}: {
  type: 'top-right' | 'top-left' | 'both-top' | 'top-right-step' | 'top-left-step'
  width?: number
  height?: number
  className?: string
}) {
  const x = doorX
  const y = doorY
  const w = doorW
  const h = doorH
  const c = cut
  // Paths: door with front at bottom (y=max). Top of door = smaller y.
  const paths: Record<string, string> = {
    // 1) Top-left corner angled: left top cut off
    'top-left': `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y} L ${x + c} ${y} L ${x} ${y + c} Z`,
    // 2) Top-right corner angled: right top cut off
    'top-right': `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + c} L ${x + w - c} ${y} L ${x} ${y} Z`,
    // 3) Both top corners angled (symmetric peak at centre)
    'both-top': `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + c} L ${x + w / 2} ${y} L ${x} ${y + c} Z`,
    // 4) Off-centre peak (peak left of centre)
    'top-left-step': `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + 0.35 * h} L ${x + w * 0.45} ${y} L ${x} ${y + 0.32 * h} Z`,
    // 5) Right side fully angled (trapezoid: vertical left, angled right)
    'top-right-step': `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w - c} ${y} L ${x} ${y} Z`,
  }
  const d = paths[type] ?? paths['top-right']
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-door-angled ${className}`} style={{ width, height }} aria-hidden>
      <path d={d} fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="2" strokeLinejoin="round" />
      <AngledDoorLabels type={type} />
    </svg>
  )
}

export function DoorNonStandard({ variant }: { variant: 'door' | 'drawer' }) {
  const isDoor = variant === 'door'
  return (
    <svg viewBox="0 0 100 100" className="mtm-diagram mtm-nonstandard" style={{ width: defaultSize, height: defaultSize }} aria-hidden>
      <rect
        x="15"
        y={isDoor ? 10 : 35}
        width={isDoor ? 70 : 70}
        height={isDoor ? 80 : 30}
        rx="2"
        fill="var(--tm-gray-light)"
        stroke="var(--tm-gray)"
        strokeWidth="2"
      />
      {variant === 'drawer' && (
        <rect x="35" y="42" width="30" height="6" rx="1" fill="var(--tm-gray)" />
      )}
    </svg>
  )
}

/** Panel: simple rectangle (portrait for grain height-ways) */
export function PanelRect({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-panel ${className}`} style={{ width, height }} aria-hidden>
      <rect x="15" y="8" width="70" height="84" rx="2" fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="2" />
    </svg>
  )
}

/** Round table top */
export function RoundTop({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-round ${className}`} style={{ width, height }} aria-hidden>
      <circle cx="50" cy="50" r="42" fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="2" />
    </svg>
  )
}

/** Corner angled worktop: one corner cut. Labels: LENGTH, DEPTH, ANGLE LENGTH, ANGLE DEPTH, grain direction. */
export function CornerAngledTop({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  const markerId = useId()
  const x = 12
  const y = 12
  const len = 76
  const depth = 76
  const angleLen = 28
  const angleDepth = 28
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-corner-angled ${className}`} style={{ width, height }} aria-hidden>
      <path
        d={`M ${x} ${y} L ${x + len} ${y} L ${x + len} ${y + depth - angleDepth} L ${x + len - angleLen} ${y + depth} L ${x} ${y + depth} Z`}
        fill="var(--tm-gray-light)"
        stroke="var(--tm-gray)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <text x={x + len / 2} y={y - 4} textAnchor="middle" className="mtm-corner-angled-label">LENGTH</text>
      <text x={x + len - angleLen / 2} y={y + depth + 6} textAnchor="middle" className="mtm-corner-angled-label--small">ANGLE LENGTH</text>
      <text x={x - 4} y={y + depth / 2} textAnchor="middle" className="mtm-corner-angled-label" style={{ writingMode: 'vertical-rl' }}>DEPTH</text>
      <text x={x + len + 5} y={y + (depth - angleDepth) / 2} textAnchor="middle" className="mtm-corner-angled-label--small" style={{ writingMode: 'vertical-rl' }}>ANGLE DEPTH</text>
      <path d={`M ${x + 8} ${y + 6} L ${x + len - 8} ${y + 6}`} stroke="var(--tm-gray)" strokeWidth="1" markerEnd={`url(#${markerId})`} />
      <text x={x + len / 2} y={y + 14} textAnchor="middle" className="mtm-corner-angled-label--small">GRAIN DIRECTION</text>
      <defs>
        <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 Z" fill="var(--tm-gray)" />
        </marker>
      </defs>
    </svg>
  )
}

/** Profiled panel: rectangle with rounded edge hint */
export function ProfiledPanel({ width = defaultSize, height = defaultSize, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`mtm-diagram mtm-profiled ${className}`} style={{ width, height }} aria-hidden>
      <rect x="12" y="15" width="76" height="70" rx="3" fill="var(--tm-gray-light)" stroke="var(--tm-gray)" strokeWidth="2" />
      <path d="M 12 18 Q 12 15 15 15" fill="none" stroke="var(--tm-gray)" strokeWidth="1.5" />
    </svg>
  )
}

/** Live preview: door with dimensions (H × W) */
export function DoorPreview({ heightMm, widthMm }: { heightMm: number; widthMm: number }) {
  if (!heightMm || !widthMm || heightMm <= 0 || widthMm <= 0) return null
  const max = Math.max(heightMm, widthMm, 1)
  const hNorm = (heightMm / max) * 80
  const wNorm = (widthMm / max) * 80
  const x = (100 - wNorm) / 2
  const y = (100 - hNorm) / 2
  return (
    <svg viewBox="0 0 100 100" className="mtm-diagram mtm-preview" style={{ width: 160, height: 160 }} aria-hidden>
      <rect x={x} y={y} width={wNorm} height={hNorm} rx="2" fill="var(--tm-gray-light)" stroke="var(--tm-gold)" strokeWidth="2" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--tm-gray)">
        {heightMm} × {widthMm}
      </text>
    </svg>
  )
}
