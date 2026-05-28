import { useLayoutEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'

/**
 * Wraps the matched admin child route in a keyed host so every navigation
 * commits a fresh page tree (avoids stale outlet content with React transitions).
 */
export default function AdminMainContent() {
  const location = useLocation()
  const outlet = useOutlet()
  const routeKey = `${location.pathname}${location.search}`

  useLayoutEffect(() => {
    const main = document.querySelector('.admin-main')
    if (main instanceof HTMLElement) main.scrollTop = 0
    window.scrollTo(0, 0)
  }, [routeKey])

  if (!outlet) return null

  return (
    <div key={routeKey} className="admin-route-outlet-host">
      {outlet}
    </div>
  )
}
