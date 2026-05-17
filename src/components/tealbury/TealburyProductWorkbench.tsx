import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CategoryRow, ProductRow } from '@/types/database'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import {
  EMPTY_TEALBURY_FILTERS,
  buildTealburyFacets,
  categoryNameById,
  displayProductCode,
  filterTealburyProducts,
  getTealburyPropertiesRows,
  getTealburySpecificationBullets,
  type TealburyFilterState,
} from '@/lib/tealburyProductDisplay'
import TealburyProductDetailPanel from '@/components/tealbury/TealburyProductDetailPanel'
import TealburyStagingBasket, { type StagedLine } from '@/components/tealbury/TealburyStagingBasket'

interface TealburyProductWorkbenchProps {
  products: ProductRow[]
  categories: CategoryRow[]
  cartLineCount: number
  onCommitLines: (lines: { product: ProductRow; quantity: number }[]) => Promise<void>
}

export default function TealburyProductWorkbench({
  products,
  categories,
  cartLineCount,
  onCommitLines,
}: TealburyProductWorkbenchProps) {
  const [filters, setFilters] = useState<TealburyFilterState>(EMPTY_TEALBURY_FILTERS)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedLine[]>([])
  const [committing, setCommitting] = useState(false)
  const [rowQtyById, setRowQtyById] = useState<Record<string, number>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const facets = useMemo(() => buildTealburyFacets(products), [products])
  const catMap = useMemo(() => categoryNameById(categories), [categories])
  const filtered = useMemo(() => filterTealburyProducts(products, filters), [products, filters])
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      if (!p.category_id) continue
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
    }
    return counts
  }, [products])

  const updateFilter = useCallback((patch: Partial<TealburyFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_TEALBURY_FILTERS)
  }, [])

  useEffect(() => {
    if (!statusMessage) return
    const t = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(t)
  }, [statusMessage])

  const addToBasket = useCallback((product: ProductRow, quantity: number) => {
    setStaged((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
        )
      }
      return [...prev, { product, quantity }]
    })
    setStatusMessage(`Added ${quantity} × ${product.name} to basket`)
  }, [])

  const commitBasket = useCallback(async () => {
    if (staged.length === 0) return
    const lineCount = staged.length
    const payload = staged.map((l) => ({ product: l.product, quantity: l.quantity }))
    setCommitting(true)
    try {
      await onCommitLines(payload)
      setStaged([])
      setStatusMessage(`Added ${lineCount} line${lineCount === 1 ? '' : 's'} to your order`)
    } catch (e) {
      console.error(e)
      setStatusMessage('Could not add lines — please try again')
    } finally {
      setCommitting(false)
    }
  }, [onCommitLines, staged])

  return (
    <article className="tb-workbench">
      {statusMessage && (
        <p className="ordering-toast tb-workbench-toast" role="status">
          {statusMessage}
        </p>
      )}

      <aside className="tb-workbench-filters" aria-label="Product filters">
        <h2 className="tb-filters-title">Product search</h2>

        <label className="tb-filter-field">
          <span>Product code</span>
          <input
            type="text"
            value={filters.productCode}
            onChange={(e) => updateFilter({ productCode: e.target.value })}
            placeholder="SKU or trade code"
            autoComplete="off"
          />
        </label>

        <label className="tb-filter-field">
          <span>Range</span>
          <select
            value={filters.categoryId ?? ''}
            onChange={(e) => updateFilter({ categoryId: e.target.value || null })}
          >
            <option value="">All ranges ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {categoryCounts.has(c.id) ? ` (${categoryCounts.get(c.id)})` : ''}
              </option>
            ))}
          </select>
        </label>

        {facets.doorRanges.length > 0 && (
          <label className="tb-filter-field">
            <span>Door range</span>
            <select
              value={filters.doorRange ?? ''}
              onChange={(e) => updateFilter({ doorRange: e.target.value || null })}
            >
              <option value="">All door ranges</option>
              {facets.doorRanges.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}

        {facets.sections.length > 0 && (
          <fieldset className="tb-filter-field tb-filter-checklist">
            <legend>Section</legend>
            <label className="tb-check-row">
              <input
                type="radio"
                name="tb-section"
                checked={filters.section === null}
                onChange={() => updateFilter({ section: null })}
              />
              All sections
            </label>
            {facets.sections.map((s) => (
              <label key={s} className="tb-check-row">
                <input
                  type="radio"
                  name="tb-section"
                  checked={filters.section === s}
                  onChange={() => updateFilter({ section: s })}
                />
                {s}
              </label>
            ))}
          </fieldset>
        )}

        <button type="button" className="btn btn-outline btn-small tb-filter-clear" onClick={clearFilters}>
          Clear filters
        </button>
      </aside>

      <section className="tb-workbench-main" aria-label="Product results">
        <header className="tb-workbench-toolbar">
          <form
            className="tb-search-form"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <input
              type="search"
              className="tb-search-input"
              placeholder="Search products by name, code or description…"
              value={filters.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
            />
            <button type="submit" className="btn btn-small">
              Search
            </button>
            {filters.search.trim() && (
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => updateFilter({ search: '' })}
              >
                Clear
              </button>
            )}
          </form>
          <p className="tb-result-meta">
            <strong>{filtered.length}</strong> product{filtered.length === 1 ? '' : 's'}
            {cartLineCount > 0 && (
              <>
                {' '}
                · <Link to="/ordering/cart">Order cart ({cartLineCount})</Link>
              </>
            )}
          </p>
        </header>

        <div className="tb-table-wrap">
          <table className="tb-product-table">
            <thead>
              <tr>
                <th scope="col" className="tb-col-image">
                  Image
                </th>
                <th scope="col" className="tb-col-code">
                  Code
                </th>
                <th scope="col" className="tb-col-desc">
                  Description
                </th>
                <th scope="col" className="tb-col-spec">
                  Specification
                </th>
                <th scope="col" className="tb-col-props">
                  Properties
                </th>
                <th scope="col" className="tb-col-price">
                  Price
                </th>
                <th scope="col" className="tb-col-qty">
                  Qty
                </th>
                <th scope="col" className="tb-col-action">
                  <span className="visually-hidden">Add</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="tb-table-empty">
                    No products match your filters. Try clearing search or choosing another range.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const isSelected = product.id === selectedProductId
                  const specs = getTealburySpecificationBullets(product)
                  const props = getTealburyPropertiesRows(product)
                  const availability = getProductAvailabilityMeta(product)
                  const qty = rowQtyById[product.id] ?? 1
                  const rangeName = catMap.get(product.category_id)

                  return (
                    <tr
                      key={product.id}
                      className={isSelected ? 'tb-row-selected' : undefined}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <td className="tb-col-image">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="tb-thumb" loading="lazy" />
                        ) : (
                          <span className="tb-thumb tb-thumb--empty">—</span>
                        )}
                      </td>
                      <td className="tb-col-code">
                        <span className="tb-code">{displayProductCode(product)}</span>
                        {rangeName && <span className="tb-label-tag">{rangeName}</span>}
                      </td>
                      <td className="tb-col-desc">
                        <span className="tb-desc-name">{product.name}</span>
                        {product.sku && product.sku !== displayProductCode(product) && (
                          <span className="tb-desc-sku">SKU {product.sku}</span>
                        )}
                      </td>
                      <td className="tb-col-spec">
                        {specs.length > 0 ? (
                          <ul className="tb-spec-list">
                            {specs.slice(0, 3).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="tb-muted">—</span>
                        )}
                      </td>
                      <td className="tb-col-props">
                        {props.length > 0 ? (
                          <table className="tb-mini-props">
                            <tbody>
                              {props.slice(0, 4).map((row) => (
                                <tr key={row.label}>
                                  <th scope="row">{row.label}</th>
                                  <td>{row.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <span className="tb-muted">—</span>
                        )}
                        <span className="tb-avail" title={availability.detail ?? availability.label}>
                          {availability.label}
                        </span>
                      </td>
                      <td className="tb-col-price">
                        <strong>£{Number(product.unit_price).toFixed(2)}</strong>
                        <span className="tb-muted"> ex VAT</span>
                      </td>
                      <td className="tb-col-qty" onClick={(e) => e.stopPropagation()}>
                        <div className="qty-stepper qty-stepper--compact">
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setRowQtyById((prev) => ({
                                ...prev,
                                [product.id]: Math.max(1, (prev[product.id] ?? 1) - 1),
                              }))
                            }
                          >
                            −
                          </button>
                          <input
                            className="qty-stepper-input"
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setRowQtyById((prev) => ({
                                ...prev,
                                [product.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                              }))
                            }}
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setRowQtyById((prev) => ({
                                ...prev,
                                [product.id]: Math.min(99, (prev[product.id] ?? 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="tb-col-action" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => addToBasket(product, qty)}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="tb-workbench-right" aria-label="Details and basket">
        {selectedProduct ? (
          <TealburyProductDetailPanel
            product={selectedProduct}
            categories={categories}
            onClose={() => setSelectedProductId(null)}
            onAddToBasket={addToBasket}
          />
        ) : (
          <section className="tb-detail tb-detail--placeholder">
            <p>Select a product row to view full specification, properties and pricing.</p>
          </section>
        )}

        <TealburyStagingBasket
          lines={staged}
          onQuantityChange={(productId, quantity) => {
            setStaged((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l)))
          }}
          onRemove={(productId) => setStaged((prev) => prev.filter((l) => l.product.id !== productId))}
          onClear={() => setStaged([])}
          onCommit={() => void commitBasket()}
          committing={committing}
        />
      </aside>
    </article>
  )
}
