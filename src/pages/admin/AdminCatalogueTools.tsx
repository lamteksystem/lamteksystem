import { Link } from 'react-router-dom'
import { CATALOGUE_TOOLS, LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'

const TOOL_GROUPS: {
  title: string
  intro: string
  tools: { to: string; title: string; description: string; tone?: 'danger' }[]
}[] = [
  {
    title: 'Pricelist & parser',
    intro: 'Parse supplier workbooks, map rows, and publish into the live catalogue.',
    tools: [
      {
        to: CATALOGUE_TOOLS.pricelistWorkbench,
        title: 'Pricelist workbench',
        description:
          'Import Tealbury or Lamtek trade Excel files, edit rows, assign categories, and publish by SKU.',
      },
    ],
  },
  {
    title: 'Catalogue data',
    intro: 'Bulk update the live product table from spreadsheets and files.',
    tools: [
      {
        to: CATALOGUE_TOOLS.catalogueDataImport,
        title: 'Import & export',
        description: 'Lamtek CSV/XLSX round-trip, Tealbury quick import, and blank-name repair.',
      },
      {
        to: CATALOGUE_TOOLS.catalogueDataAudit,
        title: 'Catalogue audit',
        description: 'Compare a master spreadsheet to live SKUs — missing, extra, and duplicates.',
      },
      {
        to: CATALOGUE_TOOLS.catalogueDataImages,
        title: 'Product images',
        description: 'Image mapping CSV, SKU uploads, and batch assignment.',
      },
      {
        to: CATALOGUE_TOOLS.componentImport,
        title: 'Component import / export',
        description: 'SKU-keyed Lamtek component CSV with dry-run preview.',
      },
      {
        to: CATALOGUE_TOOLS.variantBuilder,
        title: 'Variant matrix builder',
        description: 'Batch-create variants from finish, range, and size axes.',
      },
    ],
  },
  {
    title: 'Categories & taxonomy',
    intro: 'Automated suggestions and Tealbury accessory routing — not the live category list.',
    tools: [
      {
        to: CATALOGUE_TOOLS.smartCategorise,
        title: 'Smart categorise',
        description: 'Review suggestions, apply bulk moves, learning history, and Tealbury rebucket.',
      },
      {
        to: CATALOGUE_TOOLS.parts,
        title: 'Parts registry',
        description: 'Part types used when building complete-unit BOMs on catalogue products.',
      },
    ],
  },
  {
    title: 'Danger zone',
    intro: 'Destructive maintenance — back up first.',
    tools: [
      {
        to: CATALOGUE_TOOLS.wipe,
        title: 'Reset catalogue',
        description: 'Wipe all products, assemblies, and category links for a full rebuild.',
        tone: 'danger',
      },
    ],
  },
]

export default function AdminCatalogueTools() {
  return (
    <div className="admin-catalogue-tools-hub">
      <p className="admin-muted">
        Open the live{' '}
        <Link to={LIVE_CATALOGUE.products}>Catalogue</Link> to browse and edit products, or{' '}
        <Link to={LIVE_CATALOGUE.categories}>Categories</Link> for the active category tree.
      </p>

      {TOOL_GROUPS.map((group) => (
        <section key={group.title} className="admin-catalogue-tools-group card admin-card">
          <h2 className="admin-card-subtitle" style={{ marginTop: 0 }}>
            {group.title}
          </h2>
          <p className="admin-muted">{group.intro}</p>
          <ul className="admin-catalogue-tools-grid">
            {group.tools.map((tool) => (
              <li key={tool.to}>
                <Link
                  to={tool.to}
                  className={`admin-catalogue-tools-card${tool.tone === 'danger' ? ' admin-catalogue-tools-card--danger' : ''}`}
                >
                  <span className="admin-catalogue-tools-card-title">{tool.title}</span>
                  <span className="admin-muted admin-catalogue-tools-card-desc">{tool.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
