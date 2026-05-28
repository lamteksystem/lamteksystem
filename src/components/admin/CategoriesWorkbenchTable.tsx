import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import {
  HorizontalScrollWithArrows,
  type HorizontalScrollHandle,
} from '@/components/admin/HorizontalScrollWithArrows'
import ListPager from '@/components/admin/ListPager'
import {
  CATEGORIES_TABLE_COLUMNS,
  categoriesColumnWidth,
  type CategoriesColumnId,
} from '@/lib/categoriesTableColumns'
import {
  DEFAULT_CATEGORIES_FILTERS,
  filterAndSortCategories,
  type CategoriesTableFilters,
} from '@/lib/categoriesWorkbenchFilters'
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import { useListPagination } from '@/lib/listPagination'
import { categoryKindLabel, inferCategoryKindFromName } from '@/lib/categoryTaxonomy'
import { normalizeCategorySlug } from '@/lib/categoryAdmin'
import type { CategoryKind, CategoryRow, CategoryTypeRow } from '@/types/database'

const COLUMN_DEFS = CATEGORIES_TABLE_COLUMNS.map(({ id, label }) => ({ id, label }))
const DEFAULT_VISIBLE = CATEGORIES_TABLE_COLUMNS.map((c) => c.id)

type Props = {
  categories: CategoryRow[]
  categoryTypes: CategoryTypeRow[]
  productCountByCategory: Map<string, number>
  childCountByParent: Map<string, number>
  canEdit: boolean
  busyId: string | null
  onPatch: (id: string, body: Parameters<typeof import('@/lib/categoryAdmin').updateCategory>[1]) => void
  onRemove: (c: CategoryRow) => void
  filters: CategoriesTableFilters
  onFiltersChange: (patch: Partial<CategoriesTableFilters>) => void
}

export default function CategoriesWorkbenchTable({
  categories,
  categoryTypes,
  productCountByCategory,
  childCountByParent,
  canEdit,
  busyId,
  onPatch,
  onRemove,
  filters,
  onFiltersChange,
}: Props) {
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
  const { columnDefs, visibleIds, setColumnVisible, setColumnOrder, resetToDefault, isVisible, order } =
    useColumnVisibility('categories-workbench', COLUMN_DEFS, DEFAULT_VISIBLE)
  const { widths: columnWidths, setWidth, persistWidths } = useColumnWidths('admin-categories')
  const [resizingColId, setResizingColId] = useState<string | null>(null)
  const resizeStartRef = useRef({ x: 0, width: 0 })
  const columnWidthsRef = useRef(columnWidths)
  columnWidthsRef.current = columnWidths
  const scrollRef = useRef<HorizontalScrollHandle>(null)

  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )

  const filtered = useMemo(
    () => filterAndSortCategories(categories, filters, productCountByCategory),
    [categories, filters, productCountByCategory],
  )

  const {
    pageItems,
    totalItems: filteredTotal,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(filtered, { resetDeps: [filters], defaultPageSize: 50 })

  const visibleCols = useMemo(
    () =>
      order
        .map((id) => CATEGORIES_TABLE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is (typeof CATEGORIES_TABLE_COLUMNS)[number] => !!c && isVisible(c.id)),
    [order, isVisible],
  )

  const tableWidthPx = useMemo(
    () => visibleCols.reduce((sum, c) => sum + categoriesColumnWidth(c.id, columnWidths), 0),
    [visibleCols, columnWidths],
  )

  useEffect(() => {
    if (!resizingColId) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current.x
      const col = CATEGORIES_TABLE_COLUMNS.find((c) => c.id === resizingColId)
      const min = col?.minWidth ?? 60
      setWidth(resizingColId, Math.max(min, resizeStartRef.current.width + delta))
    }
    const onUp = () => {
      setResizingColId(null)
      void persistWidths(columnWidthsRef.current)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [resizingColId, setWidth, persistWidths])

  const renderHeader = useCallback(
    (colId: CategoriesColumnId) => {
      const col = CATEGORIES_TABLE_COLUMNS.find((c) => c.id === colId)!
      const w = categoriesColumnWidth(colId, columnWidths)
      return (
        <th key={colId} style={{ width: w, minWidth: w }} title={col.tip}>
          <span className="admin-th-label">{col.label}</span>
          {colId !== 'actions' ? (
            <span
              className="admin-th-resizer"
              role="separator"
              aria-label={`Resize ${col.label} column`}
              onMouseDown={(e) => {
                e.preventDefault()
                resizeStartRef.current = { x: e.clientX, width: w }
                setResizingColId(colId)
              }}
            />
          ) : null}
        </th>
      )
    },
    [columnWidths],
  )

  return (
    <>
      <div className="admin-pricelist-table-toolbar">
        <div className="admin-pricelist-table-toolbar-filters">
          <label className="admin-pricelist-toolbar-field admin-pricelist-toolbar-field--search">
            <span className="admin-pricelist-toolbar-label">Search</span>
            <input
              type="search"
              value={filters.search}
              placeholder="Name or slug…"
              onChange={(e) => onFiltersChange({ search: e.target.value })}
            />
          </label>
          <label className="admin-pricelist-toolbar-field">
            <span className="admin-pricelist-toolbar-label">Parent</span>
            <select
              value={filters.parentId}
              onChange={(e) => onFiltersChange({ parentId: e.target.value })}
            >
              <option value="">All</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-pricelist-toolbar-field">
            <span className="admin-pricelist-toolbar-label">Type</span>
            <select value={filters.kind} onChange={(e) => onFiltersChange({ kind: e.target.value })}>
              <option value="">All</option>
              {categoryTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-pricelist-toolbar-field">
            <span className="admin-pricelist-toolbar-label">Products</span>
            <select
              value={filters.hasProducts}
              onChange={(e) =>
                onFiltersChange({
                  hasProducts: e.target.value as CategoriesTableFilters['hasProducts'],
                })
              }
            >
              <option value="all">All</option>
              <option value="yes">Has products</option>
              <option value="no">Empty</option>
            </select>
          </label>
          <label className="admin-pricelist-toolbar-field admin-pricelist-toolbar-field--sort">
            <span className="admin-pricelist-toolbar-label">Sort</span>
            <div className="admin-pricelist-toolbar-sort-row">
              <select
                value={filters.sortKey}
                onChange={(e) =>
                  onFiltersChange({ sortKey: e.target.value as CategoriesTableFilters['sortKey'] })
                }
              >
                <option value="name">Name</option>
                <option value="slug">Slug</option>
                <option value="parent">Parent</option>
                <option value="type">Type</option>
                <option value="products">Products</option>
              </select>
              <select
                value={filters.sortDir}
                onChange={(e) =>
                  onFiltersChange({ sortDir: e.target.value as CategoriesTableFilters['sortDir'] })
                }
              >
                <option value="asc">A→Z</option>
                <option value="desc">Z→A</option>
              </select>
            </div>
          </label>
          <label className="admin-pricelist-toolbar-check">
            <input
              type="checkbox"
              checked={filters.topLevelOnly}
              onChange={(e) => onFiltersChange({ topLevelOnly: e.target.checked })}
            />
            Top level only
          </label>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => onFiltersChange({ ...DEFAULT_CATEGORIES_FILTERS })}
          >
            Reset filters
          </button>
        </div>
        <div className="admin-pricelist-table-toolbar-scroll">
          <ColumnSettings
            columnDefs={columnDefs}
            visibleIds={visibleIds}
            setColumnVisible={setColumnVisible}
            order={order}
            setColumnOrder={setColumnOrder}
            resetToDefault={resetToDefault}
            tooltip="Show, hide, and reorder category columns."
          />
          <span className="admin-muted admin-pricelist-table-toolbar-count">
            {filteredTotal} of {categories.length}
          </span>
        </div>
      </div>

      {filteredTotal === 0 ? (
        <p className="admin-muted">No categories match your filters.</p>
      ) : (
        <>
          <HorizontalScrollWithArrows
            ref={scrollRef}
            overlayArrows
            className="admin-horizontal-scroll-wrap--pricelist-table admin-horizontal-scroll-wrap--categories"
            innerClassName="admin-pricelist-table-scroll"
            contentStyle={{ minWidth: tableWidthPx }}
          >
            <div
              className="admin-table-wrap admin-catalogue-categories-table-wrap"
              style={{ width: tableWidthPx, minWidth: tableWidthPx }}
            >
              <table
                className="admin-table admin-catalogue-categories-table admin-catalogue-categories-table--resizable admin-table--sticky-header"
                style={{ width: tableWidthPx, minWidth: tableWidthPx }}
              >
                <thead>
                  <tr>{visibleCols.map((c) => renderHeader(c.id as CategoriesColumnId))}</tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => {
                    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
                    const kind = (c.category_kind ?? inferCategoryKindFromName(c.name)) as CategoryKind
                    const productCount = productCountByCategory.get(c.id) ?? 0
                    const childCount = childCountByParent.get(c.id) ?? 0
                    const isBusy = busyId === c.id
                    const hasReferences = productCount > 0 || childCount > 0
                    return (
                      <tr
                        key={c.id}
                        className={isBusy ? 'admin-catalogue-categories-row--busy' : undefined}
                      >
                        {visibleCols.map((col) => {
                          const w = categoriesColumnWidth(col.id, columnWidths)
                          switch (col.id) {
                            case 'name':
                              return (
                                <td key={col.id} style={{ width: w, minWidth: w }}>
                                  {canEdit ? (
                                    <input
                                      type="text"
                                      defaultValue={c.name}
                                      disabled={isBusy}
                                      onBlur={(e) => {
                                        const v = e.target.value.trim()
                                        if (v && v !== c.name) onPatch(c.id, { name: v })
                                      }}
                                      aria-label={`Rename ${c.name}`}
                                    />
                                  ) : (
                                    c.name
                                  )}
                                </td>
                              )
                            case 'slug':
                              return (
                                <td key={col.id} style={{ width: w, minWidth: w }}>
                                  {canEdit && editingSlugId === c.id ? (
                                    <input
                                      type="text"
                                      className="admin-catalogue-categories-slug-input"
                                      defaultValue={c.slug}
                                      autoFocus
                                      disabled={isBusy}
                                      onBlur={(e) => {
                                        setEditingSlugId(null)
                                        const next = normalizeCategorySlug(e.target.value)
                                        if (next && next !== c.slug) onPatch(c.id, { slug: next })
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                        if (e.key === 'Escape') setEditingSlugId(null)
                                      }}
                                    />
                                  ) : (
                                    <code
                                      className={`admin-catalogue-categories-slug${canEdit ? ' admin-catalogue-categories-slug--editable' : ''}`}
                                      onDoubleClick={
                                        canEdit && !isBusy ? () => setEditingSlugId(c.id) : undefined
                                      }
                                    >
                                      {c.slug}
                                    </code>
                                  )}
                                </td>
                              )
                            case 'parent':
                              return (
                                <td key={col.id} style={{ width: w, minWidth: w }}>
                                  {canEdit ? (
                                    <select
                                      defaultValue={c.parent_id ?? ''}
                                      disabled={isBusy}
                                      onChange={(e) =>
                                        onPatch(c.id, { parent_id: e.target.value || null })
                                      }
                                    >
                                      <option value="">Top level</option>
                                      {parents
                                        .filter((p) => p.id !== c.id)
                                        .map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        ))}
                                    </select>
                                  ) : parent ? (
                                    parent.name
                                  ) : (
                                    <span className="admin-muted">Top level</span>
                                  )}
                                </td>
                              )
                            case 'type':
                              return (
                                <td key={col.id} style={{ width: w, minWidth: w }}>
                                  {canEdit ? (
                                    <select
                                      defaultValue={kind}
                                      disabled={isBusy}
                                      onChange={(e) =>
                                        onPatch(c.id, { category_kind: e.target.value })
                                      }
                                    >
                                      {categoryTypes.map((t) => (
                                        <option key={t.code} value={t.code}>
                                          {t.label}
                                          {!t.active ? ' (hidden)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    categoryKindLabel(kind, categoryTypes)
                                  )}
                                </td>
                              )
                            case 'products':
                              return (
                                <td
                                  key={col.id}
                                  className="admin-catalogue-categories-count"
                                  style={{ width: w, minWidth: w }}
                                >
                                  {productCount}
                                </td>
                              )
                            case 'subs':
                              return (
                                <td
                                  key={col.id}
                                  className="admin-catalogue-categories-count"
                                  style={{ width: w, minWidth: w }}
                                >
                                  {childCount}
                                </td>
                              )
                            case 'actions':
                              return (
                                <td key={col.id} style={{ width: w, minWidth: w }}>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="admin-link-button admin-danger"
                                      disabled={isBusy}
                                      onClick={() => onRemove(c)}
                                      title={
                                        hasReferences
                                          ? `Delete — ${productCount} product(s), ${childCount} sub(s)`
                                          : undefined
                                      }
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </td>
                              )
                            default:
                              return <td key={col.id} />
                          }
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </HorizontalScrollWithArrows>
          <ListPager
            totalItems={filteredTotal}
            totalPages={totalPages}
            currentPage={currentPage}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            itemLabel={filteredTotal === 1 ? 'category' : 'categories'}
            ariaLabel="Category list"
          />
        </>
      )}
    </>
  )
}
