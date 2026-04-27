/** Trade customer portal sign-in (not staff /admin/login). */
export const CUSTOMER_LOGIN_PATH = '/login'

/** Default destination after marketing “Login to order” CTAs. */
export const CUSTOMER_ORDERING_PATH = '/ordering'

function safeInternalPath(path: string | null): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false
  if (path.startsWith('/admin')) return false
  return true
}

/** Login URL with optional post-auth redirect for customers (ignored for staff accounts). */
export function customerLoginHref(nextPath?: string): string {
  if (!nextPath || !safeInternalPath(nextPath)) return CUSTOMER_LOGIN_PATH
  const q = new URLSearchParams({ next: nextPath })
  return `${CUSTOMER_LOGIN_PATH}?${q.toString()}`
}

/** `next` query on `/login` — only same-origin relative paths; never staff routes. */
export function getSafeNextPath(searchParams: URLSearchParams): string | null {
  const n = searchParams.get('next')
  if (!n || !safeInternalPath(n)) return null
  return n
}
