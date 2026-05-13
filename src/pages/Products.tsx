import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import ProductDetailModal from '@/components/ProductDetailModal'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import type { CategoryRow, ProductRow } from '@/types/database'

type ViewType = 'grid' | 'list' | 'compact' | 'large' | 'table'
type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'sku_asc' | 'sku_desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'sku_asc', label: 'SKU A–Z' },
  { value: 'sku_desc', label: 'SKU Z–A' },
]

const OPTION_LABELS: Record<string, string> = {
  finish: 'Finish',
  style: 'Style',
  colour: 'Colour',
  color: 'Colour',
  material: 'Material',
  thickness: 'Thickness',
}

/** Flatten product options into a single searchable string */
function getOptionsSearchString(options: Record<string, unknown> | null): string {
  if (!options || typeof options !== 'object') return ''
  return Object.values(options)
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).toLowerCase())
    .join(' ')
}

/** Check if product matches search query (name, SKU, description, options) */
function productMatchesSearch(p: ProductRow, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.trim().toLowerCase()
  const name = (p.name ?? '').toLowerCase()
  const sku = (p.sku ?? '').toLowerCase()
  const desc = (p.description ?? '').toLowerCase()
  const optionsStr = getOptionsSearchString(p.options as Record<string, unknown>)
  return (
    name.includes(lower) ||
    sku.includes(lower) ||
    desc.includes(lower) ||
    optionsStr.includes(lower)
  )
}

/** Render product options (finish, style, colour, etc.) as small badges */
function ProductBadges({ options }: { options: Record<string, unknown> | null }) {
  if (!options || typeof options !== 'object') return null
  const entries = Object.entries(options).filter(
    ([, v]) => v != null && String(v).trim() !== ''
  ) as [string, string][]
  if (entries.length === 0) return null
  return (
    <div className="product-badges">
      {entries.map(([key, value]) => (
        <span key={key} className="product-badge" title={`${OPTION_LABELS[key] ?? key}: ${value}`}>
          {String(value)}
        </span>
      ))}
    </div>
  )
}

function ProductCard({
  product,
  view,
  onOpenDetail,
}: {
  product: ProductRow
  view: ViewType
  onOpenDetail: (product: ProductRow) => void
}) {
  const opts = product.options as Record<string, unknown>
  const availability = getProductAvailabilityMeta(product)
  const openDetail = () => onOpenDetail(product)
  return (
    <div
      key={product.id}
      className={`card product-card product-card--browse product-card--${view} product-card--clickable`}
    >
      <button
        type="button"
        className="product-card-click-layer"
        onClick={openDetail}
        aria-label={`View details for ${product.name}`}
      />
      <div
        className="product-card-image product-card-trigger"
        onClick={openDetail}
        onKeyDown={(e) => e.key === 'Enter' && openDetail()}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${product.name}`}
      >
        {product.image_url ? (
          <img src={product.image_url} alt={product.image_alt ?? product.name ?? ''} />
        ) : (
          <div className="product-card-placeholder">No image</div>
        )}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-name product-card-trigger">
          <button type="button" onClick={openDetail} className="product-card-name-btn">
            {product.name}
          </button>
        </h3>
        {product.description && view !== 'compact' && (
          <p className="product-card-desc">{product.description}</p>
        )}
        <ProductBadges options={opts} />
        {product.sku && <span className="product-card-sku">SKU: {product.sku}</span>}
        <div className="product-badges">
          <span className="product-badge" title={availability.detail ?? availability.label}>
            {availability.label}
          </span>
        </div>
        <div className="product-card-footer">
          <button
            type="button"
            onClick={openDetail}
            className="product-card-price product-card-trigger"
            aria-label={`View details – £${Number(product.unit_price).toFixed(2)}`}
          >
            £{Number(product.unit_price).toFixed(2)}
          </button>
          <Link to="/ordering/start" className="btn btn-small" onClick={(e) => e.stopPropagation()}>
            Add to order
          </Link>
        </div>
      </div>
    </div>
  )
}

function ProductTableRow({
  product,
  onOpenDetail,
}: {
  product: ProductRow
  onOpenDetail: (product: ProductRow) => void
}) {
  const availability = getProductAvailabilityMeta(product)
  const openDetail = () => onOpenDetail(product)
  return (
    <tr className="product-table-row" onClick={openDetail}>
      <td className="product-table-cell product-table-image">
        {product.image_url ? (
          <img src={product.image_url} alt={product.image_alt ?? product.name ?? ''} />
        ) : (
          <div className="product-table-placeholder">—</div>
        )}
      </td>
      <td className="product-table-cell product-table-name">
        <button type="button" onClick={openDetail} className="product-table-name-btn">
          {product.name}
        </button>
      </td>
      <td className="product-table-cell product-table-sku">{product.sku ?? '—'}</td>
      <td className="product-table-cell">{availability.label}</td>
      <td className="product-table-cell product-table-desc">
        {product.description ? (
          <span title={product.description}>{product.description.slice(0, 80)}{product.description.length > 80 ? '…' : ''}</span>
        ) : (
          '—'
        )}
      </td>
      <td className="product-table-cell product-table-price">
        <button type="button" onClick={openDetail} className="product-table-price-btn">
          £{Number(product.unit_price).toFixed(2)}
        </button>
      </td>
      <td className="product-table-cell product-table-action" onClick={(e) => e.stopPropagation()}>
        <Link to="/ordering/start" className="btn btn-small">
          Add to order
        </Link>
      </td>
    </tr>
  )
}

export default function Products() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewType, setViewType] = useState<ViewType>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')
  const [optionFilters, setOptionFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const location = useLocation()
  const stateCategoryId = (location.state as { categoryId?: string } | null)?.categoryId

  useEffect(() => {
    if (stateCategoryId && categories.some((c) => c.id === stateCategoryId)) {
      setSelectedCategory(stateCategoryId)
    }
  }, [stateCategoryId, categories])

  useEffect(() => {
    async function load() {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order').order('name'),
        supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .eq('catalog_program', CATALOG_PROGRAM.LAMTEK)
          .order('sort_order')
          .order('name'),
      ])
      setCategories(catRes.data ?? [])
      setProducts(prodRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const displayCategories = useMemo(() => {
    const withProduct = new Set(products.map((p) => p.category_id))
    return categories.filter((c) => !c.parent_id && withProduct.has(c.id))
  }, [categories, products])

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const inCategory = !selectedCategory || p.category_id === selectedCategory
      if (!inCategory) return false
      if (!productMatchesSearch(p, search)) return false
      const price = Number(p.unit_price)
      if (priceMin !== '' && !Number.isNaN(Number(priceMin)) && price < Number(priceMin)) return false
      if (priceMax !== '' && !Number.isNaN(Number(priceMax)) && price > Number(priceMax)) return false
      const opts = p.options as Record<string, unknown> | null
      if (opts && typeof opts === 'object') {
        for (const [key, selectedValue] of Object.entries(optionFilters)) {
          if (!selectedValue) continue
          const productValue = opts[key]
          if (productValue == null || String(productValue).trim() === '') return false
          if (String(productValue).toLowerCase() !== selectedValue.toLowerCase()) return false
        }
      }
      return true
    })

    const cmp = (a: ProductRow, b: ProductRow): number => {
      switch (sortBy) {
        case 'name_asc':
          return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
        case 'name_desc':
          return (b.name ?? '').localeCompare(a.name ?? '', undefined, { sensitivity: 'base' })
        case 'price_asc':
          return Number(a.unit_price) - Number(b.unit_price)
        case 'price_desc':
          return Number(b.unit_price) - Number(a.unit_price)
        case 'sku_asc':
          return (a.sku ?? '').localeCompare(b.sku ?? '', undefined, { sensitivity: 'base' })
        case 'sku_desc':
          return (b.sku ?? '').localeCompare(a.sku ?? '', undefined, { sensitivity: 'base' })
        default:
          return 0
      }
    }
    return [...list].sort(cmp)
  }, [products, selectedCategory, search, priceMin, priceMax, optionFilters, sortBy])

  const optionFacets = useMemo(() => {
    const list = products.filter((p) => {
      const inCategory = !selectedCategory || p.category_id === selectedCategory
      if (!inCategory) return false
      return productMatchesSearch(p, search)
    })
    const facets: Record<string, Set<string>> = {}
    for (const p of list) {
      const opts = p.options as Record<string, unknown> | null
      if (!opts || typeof opts !== 'object') continue
      for (const [key, value] of Object.entries(opts)) {
        if (value == null || String(value).trim() === '') continue
        if (!facets[key]) facets[key] = new Set()
        facets[key].add(String(value).trim())
      }
    }
    const result: Record<string, string[]> = {}
    for (const [key, set] of Object.entries(facets)) {
      result[key] = [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }
    return result
  }, [products, selectedCategory, search])

  const hasActiveFilters =
    selectedCategory != null ||
    search.trim() !== '' ||
    priceMin !== '' ||
    priceMax !== '' ||
    Object.values(optionFilters).some(Boolean)

  function clearAllFilters() {
    setSelectedCategory(null)
    setSearch('')
    setPriceMin('')
    setPriceMax('')
    setOptionFilters({})
  }

  function setOptionFilter(label: string, value: string) {
    setOptionFilters((prev) => {
      const next = { ...prev }
      if (!value) {
        delete next[label]
      } else {
        next[label] = value
      }
      return next
    })
  }

  return (
    <div className="products-page">
      <PageNav backTo="/" backLabel="Dashboard" />
      <div className="products-page-header">
        <h1>Our products</h1>
        <p className="page-intro">
          Door ranges, cabinets, handles, lighting, and accessories. Filter by category or search, then add items from the Create order page.
        </p>
        <Link to="/ordering/start" className="btn">Create order →</Link>
      </div>

      <div className="products-filters">
        <div className="products-filter-group">
          <span className="products-filter-label">Category</span>
          <div className="products-filter-tabs">
            <button
              type="button"
              className={selectedCategory === null ? 'active' : ''}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {displayCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={selectedCategory === c.id ? 'active' : ''}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="products-search-group">
          <span className="products-filter-label">Search</span>
          <div className="products-search-row">
            <input
              type="search"
              placeholder="Name, SKU, description, finish, style…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="products-search-input"
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                className="products-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`btn btn-ghost products-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          {showFilters ? 'Hide filters' : 'More filters'}
        </button>
        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost products-clear-filters" onClick={clearAllFilters}>
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="products-advanced-filters">
          <div className="products-filter-group products-price-range">
            <span className="products-filter-label">Price range</span>
            <div className="products-price-inputs">
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="Min £"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="products-price-input"
              />
              <span className="products-price-sep">–</span>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="Max £"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="products-price-input"
              />
            </div>
          </div>
          {Object.entries(optionFacets).map(([optionKey, values]) => (
            <div key={optionKey} className="products-filter-group">
              <span className="products-filter-label">{OPTION_LABELS[optionKey] ?? optionKey}</span>
              <select
                value={optionFilters[optionKey] ?? ''}
                onChange={(e) => setOptionFilter(optionKey, e.target.value)}
                className="products-option-select"
              >
                <option value="">Any {OPTION_LABELS[optionKey] ?? optionKey}</option>
                {values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="products-toolbar">
        <span className="products-result-count">
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
        </span>
        <div className="products-view-sort">
          <span className="products-filter-label">View</span>
          <div className="products-view-toggle" role="group" aria-label="View type">
            <button
              type="button"
              className={viewType === 'grid' ? 'active' : ''}
              onClick={() => setViewType('grid')}
              title="Grid view"
              aria-pressed={viewType === 'grid'}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={viewType === 'list' ? 'active' : ''}
              onClick={() => setViewType('list')}
              title="List view"
              aria-pressed={viewType === 'list'}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={viewType === 'compact' ? 'active' : ''}
              onClick={() => setViewType('compact')}
              title="Compact view"
              aria-pressed={viewType === 'compact'}
            >
              <CompactIcon />
            </button>
            <button
              type="button"
              className={viewType === 'large' ? 'active' : ''}
              onClick={() => setViewType('large')}
              title="Large view"
              aria-pressed={viewType === 'large'}
            >
              <LargeIcon />
            </button>
            <button
              type="button"
              className={viewType === 'table' ? 'active' : ''}
              onClick={() => setViewType('table')}
              title="Table view"
              aria-pressed={viewType === 'table'}
            >
              <TableIcon />
            </button>
          </div>
        </div>
        <label className="products-sort-wrap">
          <span className="products-filter-label">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="products-sort-select"
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card products-empty">
          <p>No products match. Try changing the category, search, or filters.</p>
          <Link to="/ordering/start">Go to Create order</Link>
        </div>
      ) : viewType === 'table' ? (
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th scope="col" className="product-table-cell product-table-image">Image</th>
                <th scope="col" className="product-table-cell product-table-name">Name</th>
                <th scope="col" className="product-table-cell product-table-sku">SKU</th>
                <th scope="col" className="product-table-cell">Availability</th>
                <th scope="col" className="product-table-cell product-table-desc">Description</th>
                <th scope="col" className="product-table-cell product-table-price">Price</th>
                <th scope="col" className="product-table-cell product-table-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  onOpenDetail={setSelectedProduct}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`products-grid products-view--${viewType}`}>
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              view={viewType}
              onOpenDetail={setSelectedProduct}
            />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={setSelectedProduct}
        />
      )}
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function CompactIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="4" />
      <rect x="3" y="10" width="18" height="4" />
      <rect x="3" y="16" width="18" height="4" />
    </svg>
  )
}

function LargeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="14" y1="3" x2="14" y2="21" />
    </svg>
  )
}
