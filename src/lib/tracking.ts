/** Build tracking URL from courier name and tracking number (or return as-is if already a URL). */
export function trackingUrl(courier: string | null | undefined, tracking: string | null | undefined): string {
  if (!tracking?.trim()) return '#'
  const t = tracking.trim()
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  switch (courier) {
    case 'DPD': return `https://www.dpd.co.uk/apps/tracking/?reference=${encodeURIComponent(t)}`
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`
    case 'Royal Mail': return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(t)}`
    case 'Yodel': return `https://www.yodel.co.uk/tracking/${encodeURIComponent(t)}`
    default: return `https://www.google.com/search?q=${encodeURIComponent(t + ' tracking')}`
  }
}
