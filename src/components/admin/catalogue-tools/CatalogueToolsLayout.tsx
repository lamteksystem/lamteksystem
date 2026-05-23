import { Link, Outlet, useLocation } from 'react-router-dom'
import { CATALOGUE_TOOLS, LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'

const TOOL_NAV: { to: string; label: string; match: (path: string) => boolean }[] = [
  {
    to: CATALOGUE_TOOLS.hub,
    label: 'Overview',
    match: (p) => p === CATALOGUE_TOOLS.hub,
  },
  {
    to: CATALOGUE_TOOLS.pricelistWorkbench,
    label: 'Pricelist workbench',
    match: (p) => p.startsWith(CATALOGUE_TOOLS.pricelistWorkbench),
  },
  {
    to: CATALOGUE_TOOLS.catalogueDataImport,
    label: 'Import & export',
    match: (p) => p.startsWith(CATALOGUE_TOOLS.catalogueData),
  },
  {
    to: CATALOGUE_TOOLS.smartCategorise,
    label: 'Smart categorise',
    match: (p) => p.startsWith(CATALOGUE_TOOLS.smartCategorise),
  },
  {
    to: CATALOGUE_TOOLS.parts,
    label: 'Parts registry',
    match: (p) => p.startsWith(CATALOGUE_TOOLS.parts),
  },
  {
    to: CATALOGUE_TOOLS.componentImport,
    label: 'Component import',
    match: (p) => p.includes('/components/import'),
  },
  {
    to: CATALOGUE_TOOLS.variantBuilder,
    label: 'Variant builder',
    match: (p) => p.includes('/variant-builder'),
  },
  {
    to: CATALOGUE_TOOLS.wipe,
    label: 'Reset catalogue',
    match: (p) => p.startsWith(CATALOGUE_TOOLS.wipe),
  },
]

export default function CatalogueToolsLayout() {
  const { pathname } = useLocation()
  const onHub = pathname === CATALOGUE_TOOLS.hub

  return (
    <div className="admin-catalogue-tools-layout">
      {onHub && (
        <p className="admin-muted page-intro">
          Import, parse, categorise, and maintain the catalogue — separate from the live{' '}
          <Link to={LIVE_CATALOGUE.products}>Catalogue</Link> and{' '}
          <Link to={LIVE_CATALOGUE.categories}>Categories</Link> views.
        </p>
      )}

      {!onHub && (
        <nav className="admin-catalogue-tools-subnav" aria-label="Catalogue tools">
          <Link to={CATALOGUE_TOOLS.hub} className="btn btn-ghost btn-small">
            ← All tools
          </Link>
          {TOOL_NAV.filter((t) => t.to !== CATALOGUE_TOOLS.hub).map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`btn btn-small ${t.match(pathname) ? '' : 'btn-outline'}`}
              aria-current={t.match(pathname) ? 'page' : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <Outlet />
    </div>
  )
}
