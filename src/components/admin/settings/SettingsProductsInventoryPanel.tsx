import { Link } from 'react-router-dom'
import AdminAssemblyPartTypesSettings from '@/components/admin/AdminAssemblyPartTypesSettings'
import { CATALOGUE_TOOLS, LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'

/** Settings → Products & inventory: part types registry + catalogue tool shortcuts. */
export default function SettingsProductsInventoryPanel() {
  return (
    <div className="admin-settings-panel admin-settings-products">
      <fieldset className="admin-settings-fieldset">
        <legend>Catalogue tools</legend>
        <p className="admin-settings-panel-intro">
          Bulk import, variant matrix builder, and smart categorise live under Product &amp; category
          tools. Use them for large catalogue updates; day-to-day edits stay on the live catalogue.
        </p>
        <ul className="admin-settings-link-list">
          <li>
            <Link to="/admin/catalogue">Live catalogue</Link> — edit products, prices, and BOM
          </li>
          <li>
            <Link to={LIVE_CATALOGUE.categories}>Manage categories</Link> — full-screen category tree
          </li>
          <li>
            <Link to={CATALOGUE_TOOLS.smartCategorise}>Smart categorise</Link> — bulk assign categories
            from learning
          </li>
          <li>
            <Link to={CATALOGUE_TOOLS.componentImport}>Component CSV import</Link> — SKU-keyed upsert with
            dry-run
          </li>
          <li>
            <Link to={CATALOGUE_TOOLS.variantBuilder}>Variant builder</Link> — matrix SKUs from patterns
          </li>
          <li>
            <Link to={CATALOGUE_TOOLS.wipe}>Catalogue wipe</Link> — destructive reset (requires
            confirmation)
          </li>
        </ul>
      </fieldset>

      <AdminAssemblyPartTypesSettings embedded />
    </div>
  )
}
