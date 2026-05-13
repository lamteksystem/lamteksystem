/**
 * Legacy depot rows from before Lamtek-only location data (e.g. old Trade Mouldings UK/ROI addresses).
 * Kept explicit so stale Supabase rows are hidden until migrations purge them.
 */
const LEGACY_DEPOT_CODES = new Set(['ROC', 'COOK', 'DUB', 'MAIN'])

/** First alphanumeric token from code (handles `ROC-HQ`, ` roc `). */
function legacyCodePrefix(code: string): string {
  const m = code.trim().toUpperCase().match(/[A-Z0-9]+/)
  return m ? m[0] : ''
}

/** Old Trade Mouldings–era depot slug at start of display name e.g. "ROC — Rochdale …", "DUB — Dublin". */
function nameStartsWithTmDepotSlug(name?: string | null): boolean {
  if (!name) return false
  const s = name.trim()
  return /^(ROC|COOK|DUB|MAIN)\b\s*[—–-]/i.test(s)
}

/** Heuristic for unnamed-code rows that still carry old Rochdale/NI/ROI depot copy */
function legacyDepotFingerprint(name?: string | null, address?: string | null): boolean {
  const n = `${name ?? ''} ${address ?? ''}`.toLowerCase()
  return (
    /trade\s*mould|trademould/i.test(n) ||
    /\bol16\b|kingsway business|faraday avenue|northwest trade/i.test(n) ||
    /rochdale\s*\(|rochdale,? lancashire|rochdale,\s*lancashire|\brochdale\b/i.test(n) ||
    /cookstown|sandholes|northern ireland|bt\d{2}/i.test(n) ||
    /dublin\s*12|bluebell industrial|co\.?\s*dublin|\bdublin\b/i.test(n)
  )
}

/** Whether this row should never be offered for Lamtek portal collection points or depot marketing. */
export function isLegacyTmDepotRow(l: { code?: string | null; name?: string | null; address?: string | null }): boolean {
  const raw = (l.code ?? '').trim()
  const c = raw.toUpperCase()
  const prefix = legacyCodePrefix(raw)
  if (LEGACY_DEPOT_CODES.has(c) || LEGACY_DEPOT_CODES.has(prefix)) return true
  if (legacyDepotFingerprint(l.name, l.address)) return true
  if (nameStartsWithTmDepotSlug(l.name)) return true
  return false
}

/** Locations safe to show customers (cart, customer depots, collection dropdowns). */
export function lamtekPortalLocations<T extends { code?: string | null; name?: string | null; address?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !isLegacyTmDepotRow(r))
}
