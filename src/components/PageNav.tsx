import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  to?: string
  label: string
}

interface PageNavProps {
  /** Back link: single "← Back to Label" link */
  backTo?: string
  backLabel?: string
  /** Or breadcrumb trail (last item is current page, no link) */
  breadcrumb?: BreadcrumbItem[]
  /** Optional class for the wrapper */
  className?: string
}

export function PageNav({ backTo, backLabel, breadcrumb, className = '' }: PageNavProps) {
  if (breadcrumb && breadcrumb.length > 0) {
    return (
      <nav className={`page-nav page-nav--breadcrumb ${className}`} aria-label="Breadcrumb">
        <ol className="page-nav-list">
          <li className="page-nav-item">
            <Link to="/">Dashboard</Link>
          </li>
          {breadcrumb.map((item, i) => (
            <li key={i} className="page-nav-item">
              <span className="page-nav-sep" aria-hidden>/</span>
              {item.to && i < breadcrumb.length - 1 ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span className="page-nav-current">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }
  if (backTo && backLabel) {
    return (
      <nav className={`page-nav page-nav--back ${className}`} aria-label="Back">
        <Link to={backTo} className="page-nav-back-link">
          ← {backLabel}
        </Link>
      </nav>
    )
  }
  return null
}
