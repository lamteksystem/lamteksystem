import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import { HorizontalScrollToolbarArrows } from '@/components/admin/HorizontalScrollWithArrows'
import {
  DEFAULT_WORKBENCH_FILTERS,
  type SortDir,
  type WorkbenchSortKey,
  type WorkbenchTableFilters,
} from '@/lib/pricelistWorkbenchFilters'
import type { AssemblyPartTypeRow, CategoryRow } from '@/types/database'

type Props = {
  filters: WorkbenchTableFilters
  onChange: (patch: Partial<WorkbenchTableFilters>) => void
  doorRanges: string[]
  sections: string[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  filteredCount: number
  totalCount: number
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
}

const SORT_OPTIONS: { value: WorkbenchSortKey; label: string }[] = [
  { value: 'sku', label: 'SKU' },
  { value: 'name', label: 'Name' },
  { value: 'section', label: 'Section' },
  { value: 'category_name', label: 'Category' },
  { value: 'unit_price', label: 'List £' },
  { value: 'source', label: 'Catalogue' },
  { value: 'item_kind', label: 'Kind' },
  { value: 'part_type', label: 'Part type' },
]

export default function PricelistWorkbenchTableToolbar({
  filters,
  onChange,
  doorRanges,
  sections,
  categories,
  partTypes,
  filteredCount,
  totalCount,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
}: Props) {
  return (
    <div className="admin-pricelist-table-toolbar">
      <div className="admin-pricelist-table-toolbar-filters">
        <label className="admin-pricelist-toolbar-field admin-pricelist-toolbar-field--search">
          <span className="admin-pricelist-toolbar-label">Search</span>
          <input
            type="search"
            value={filters.search}
            placeholder="SKU, name, section, category…"
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Catalogue</span>
          <select
            value={filters.source}
            onChange={(e) =>
              onChange({ source: e.target.value as WorkbenchTableFilters['source'] })
            }
          >
            <option value="all">All</option>
            <option value="tealbury">Tealbury</option>
            <option value="lamtek">Lamtek</option>
            <option value="uform">Uform</option>
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Door range</span>
          <select value={filters.doorRange} onChange={(e) => onChange({ doorRange: e.target.value })}>
            <option value="">All</option>
            {doorRanges.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Section</span>
          <select value={filters.section} onChange={(e) => onChange({ section: e.target.value })}>
            <option value="">All</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Category</span>
          <select
            value={filters.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Kind</span>
          <select value={filters.itemKind} onChange={(e) => onChange({ itemKind: e.target.value })}>
            <option value="">All</option>
            <option value="complete">Complete</option>
            <option value="component">Component</option>
            <option value="door">Door</option>
            <option value="drawer_front">Drawer front</option>
            <option value="accessory">Accessory</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field">
          <span className="admin-pricelist-toolbar-label">Part type</span>
          <select value={filters.partType} onChange={(e) => onChange({ partType: e.target.value })}>
            <option value="">All</option>
            {partTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-pricelist-toolbar-field admin-pricelist-toolbar-field--sort">
          <span className="admin-pricelist-toolbar-label">Sort</span>
          <div className="admin-pricelist-toolbar-sort-row">
            <select
              value={filters.sortKey}
              onChange={(e) => onChange({ sortKey: e.target.value as WorkbenchSortKey })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filters.sortDir}
              onChange={(e) => onChange({ sortDir: e.target.value as SortDir })}
              aria-label="Sort direction"
            >
              <option value="asc">A→Z</option>
              <option value="desc">Z→A</option>
            </select>
          </div>
        </label>
        <label className="admin-pricelist-toolbar-check">
          <input
            type="checkbox"
            checked={filters.onlyUnassigned}
            onChange={(e) => onChange({ onlyUnassigned: e.target.checked })}
          />
          Unassigned only
        </label>
        <label className="admin-pricelist-toolbar-check" title="Lamtek parts also sold on their own (e.g. carcass)">
          <input
            type="checkbox"
            checked={filters.onlyStandaloneCapable}
            onChange={(e) => onChange({ onlyStandaloneCapable: e.target.checked })}
          />
          Standalone SKU
          <AdminHelpTip text="Rows flagged as sellable on their own (e.g. carcass bought without a complete unit). Uses extra category on publish." />
        </label>
        <button
          type="button"
          className="btn btn-outline btn-small"
          onClick={() => onChange({ ...DEFAULT_WORKBENCH_FILTERS })}
        >
          Reset filters
        </button>
        <HorizontalScrollToolbarArrows
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          onScrollLeft={onScrollLeft}
          onScrollRight={onScrollRight}
          className="admin-pricelist-scroll-arrows"
        />
        <span className="admin-muted admin-pricelist-table-toolbar-count">
          {filteredCount} of {totalCount}
        </span>
      </div>
    </div>
  )
}
