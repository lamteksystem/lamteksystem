import { Link } from 'react-router-dom'
import type { CategoryRow } from '@/types/database'
import type { TealburyOrderSetup } from '@/lib/tealburyOrderSetup'

type Props = {
  totalInCatalogue: number
  inKitchenContext: number
  setup: TealburyOrderSetup | null
  categories?: CategoryRow[]
  onClearFilters: () => void
  adminCatalogueHref?: string
}

export default function CatalogKitchenEmptyState({
  totalInCatalogue,
  inKitchenContext,
  setup,
  categories = [],
  onClearFilters,
  adminCatalogueHref = '/admin/catalogue-tools/pricelist-workbench',
}: Props) {
  const rangeName =
    setup?.kitchen_range_id && categories.length
      ? categories.find((c) => c.id === setup.kitchen_range_id)?.name
      : null
  if (totalInCatalogue === 0) {
    return (
      <div className="tb-empty-state card">
        <h3>No products in the live catalogue yet</h3>
        <p>
          Your pricelist workbench draft is not published. Staff need to finish categorising rows in the
          workbench, then <strong>Publish</strong> to the catalogue before customers can build quotes here.
        </p>
        <p>
          <Link to={adminCatalogueHref}>Open pricelist workbench</Link>
        </p>
      </div>
    )
  }

  if (inKitchenContext === 0 && setup?.door_finish) {
    return (
      <div className="tb-empty-state card">
        <h3>Nothing matches this kitchen setup</h3>
        <p>
          The catalogue has {totalInCatalogue} product(s), but none match range{' '}
          <strong>{rangeName ?? 'selected'}</strong> and finish{' '}
          <strong>{setup.door_finish}</strong>. Try <button type="button" className="btn-link" onClick={onClearFilters}>clearing filters</button> or{' '}
          <strong>Change kitchen setup</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="tb-empty-state card">
      <h3>No products match these filters</h3>
      <p>
        Try a section shortcut above (Panels, Plinth, Base units), clear search, or switch to{' '}
        <strong>All</strong> under &ldquo;For this kitchen&rdquo;.
      </p>
      <button type="button" className="btn btn-outline btn-small" onClick={onClearFilters}>
        Clear filters
      </button>
    </div>
  )
}
