/** Turn thrown values (incl. Supabase PostgrestError objects) into user-visible text. */
export function formatUnknownError(e: unknown, fallback = 'Something went wrong.'): string {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message || fallback
  if (e && typeof e === 'object') {
    const msg = (e as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
    const details = (e as { details?: unknown }).details
    if (typeof details === 'string' && details.trim()) return details
  }
  return fallback
}
