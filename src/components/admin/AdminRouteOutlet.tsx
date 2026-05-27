import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

/** Force route components to remount when the pathname changes (fixes stale admin pages). */
export default function AdminRouteOutlet() {
  const location = useLocation()
  const routeKey = location.pathname + location.search

  useEffect(() => {
    const main = document.querySelector('.admin-main')
    if (main instanceof HTMLElement) main.scrollTop = 0
    window.scrollTo(0, 0)
  }, [routeKey])

  return <Outlet key={routeKey} />
}
