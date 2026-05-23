import { Link, Outlet } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'
import { LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'

/** Blocks catalogue tooling unless staff has catalogue edit permission. */
export default function CatalogueToolsGate() {
  const { allowed: canEdit, loading } = usePermission('admin.catalogue', 'edit')

  if (loading) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="admin-page">
        <h1>Product &amp; category tools</h1>
        <p className="admin-callout admin-callout--warn">
          You need catalogue <strong>edit</strong> permission to use import, parsers, and categorisation tools.
          Ask an admin to grant this under Permissions, or use the live{' '}
          <Link to={LIVE_CATALOGUE.products}>Catalogue</Link> and{' '}
          <Link to={LIVE_CATALOGUE.categories}>Categories</Link> pages if you only have view access.
        </p>
      </div>
    )
  }

  return <Outlet />
}
