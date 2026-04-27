import { Link, useLocation } from 'react-router-dom'

export default function NotFound() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  return (
    <div className="not-found-page">
      <div className="not-found-card card">
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-text">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link to={isAdmin ? '/admin' : '/'} className="btn">
          {isAdmin ? 'Back to Admin Dashboard' : 'Go to Dashboard'}
        </Link>
      </div>
    </div>
  )
}
