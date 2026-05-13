const common = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: 'false' as const,
}

export function IconProducts() {
  return (
    <svg {...common}>
      <path d="M4.5 5.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5v-4zM12.5 5.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4zM4.5 14.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0110 20H6a1.5 1.5 0 01-1.5-1.5v-4zM12.5 14.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z" />
    </svg>
  )
}

export function IconOrdering() {
  return (
    <svg {...common}>
      <path d="M9 4.5h6l.9 1.8H19a1.75 1.75 0 011.75 1.75V19A1.75 1.75 0 0119 20.75H5A1.75 1.75 0 013.25 19V8.05A1.75 1.75 0 015 6.3h3.1L9 4.5z" />
      <path d="M9 12.25h7.5M9 16h5.5" />
    </svg>
  )
}

export function IconDownloads() {
  return (
    <svg {...common}>
      <path d="M12 4.5v11.5" />
      <path d="M8.5 14L12 17.5 15.5 14" />
      <path d="M4 20.5h16" />
    </svg>
  )
}

/** Warehouse / HQ */
export function IconWarehouse() {
  return (
    <svg {...common}>
      <path d="M6 22V10l6-5 6 5v12" />
      <path d="M9 22v-7h6v7" />
      <path d="M3 22h18" />
    </svg>
  )
}
