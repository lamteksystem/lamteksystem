import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import ProductDetailModal from '@/components/ProductDetailModal'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/listPagination'
import type { CategoryRow, ProductRow } from '@/types/database'

type ViewType = 'grid' | 'list' | 'compact' | 'large' | 'table'
type SortOption = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'sku_asc' | 'sku_desc'
type SortKey = 'name' | 'sku' | 'price' | 'availability'
type SortDir = 'asc' | 'desc'

/** Default page size — matches the shared admin pagers. */
const DEFAULT_PAGE_SIZE: PageSize = 50

/** Persistent prefs (stored in supabase user_preferences — never localStorage per workspace rules). */
const PREF_VIEW = 'products.view'
const PREF_PAGE_SIZE = 'products.pageSize'
const PREF_SORT = 'products.sort'

function sortOptionFromKey(key: SortKey, dir: SortDir): SortOption {
  if (key === 'availability') return 'name_asc'
  if (key === 'price') return dir === 'asc' ? 'price_asc' : 'price_desc'
  if (key === 'sku') return dir === 'asc' ? 'sku_asc' : 'sku_desc'
  return dir === 'asc' ? 'name_asc' : 'name_desc'
}

function keyFromSortOption(opt: SortOption): { key: SortKey; dir: SortDir } {
  switch (opt) {
    case 'name_asc':
      return { key: 'name', dir: 'asc' }
    case 'name_desc':
      return { key: 'name', dir: 'desc' }
    case 'price_asc':
      return { key: 'price', dir: 'asc' }
    case 'price_desc':
      return { key: 'price', dir: 'desc' }
    case 'sku_asc':
      return { key: 'sku', dir: 'asc' }
    case 'sku_desc':
      return { key: 'sku', dir: 'desc' }
  }
}

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
  index,
  onOpenDetail,
}: {
  product: ProductRow
  index: number
  onOpenDetail: (product: ProductRow) => void
}) {
  const availability = getProductAvailabilityMeta(product)
  // Derive a tone from the availability label so the table can colour-code stock status
  // without changing the lib's public shape (the lib is used elsewhere too).
  const availabilityTone: 'good' | 'warn' | 'bad' | 'neutral' = availability.label.startsWith(
    'In stock',
  )
    ? 'good'
    : availability.label.startsWith('Low stock')
      ? 'warn'
      : availability.label.startsWith('Out of stock')
        ? 'bad'
        : 'neutral'
  const openDetail = () => onOpenDetail(product)
  const opts = product.options as Record<string, unknown> | null
  const optionEntries =
    opts && typeof opts === 'object'
      ? (Object.entries(opts).filter(
          ([, v]) => v != null && String(v).trim() !== '',
        ) as [string, string][])
      : []
  return (
    <tr
      className="product-table-row"
      onClick={openDetail}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openDetail()
        }
      }}
    >
      <td className="product-table-cell product-table-rownum">{index + 1}</td>
      <td className="product-table-cell product-table-image">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.image_alt ?? product.name ?? ''}
            loading="lazy"
          />
        ) : (
          <div className="product-table-placeholder">No image</div>
        )}
      </td>
      <td className="product-table-cell product-table-name">
        <button type="button" onClick={openDetail} className="product-table-name-btn">
          {product.name}
        </button>
        {optionEntries.length > 0 && (
          <div className="product-table-row-badges" aria-hidden>
            {optionEntries.slice(0, 4).map(([key, value]) => (
              <span
                key={key}
                className="product-badge"
                title={`${OPTION_LABELS[key] ?? key}: ${value}`}
              >
                {String(value)}
              </span>
            ))}
            {optionEntries.length > 4 && (
              <span className="product-badge product-badge--more" title="More options available">
                +{optionEntries.length - 4}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="product-table-cell product-table-sku">{product.sku ?? '—'}</td>
      <td className="product-table-cell product-table-availability">
        <span
          className={`product-availability product-availability--${availabilityTone}`}
          title={availability.detail ?? availability.label}
        >
          {availability.label}
        </span>
      </td>
      <td className="product-table-cell product-table-price">
        <button type="button" onClick={openDetail} className="product-table-price-btn">
          £{Number(product.unit_price).toFixed(2)}
        </button>
      </td>
      <td
        className="product-table-cell product-table-action"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="btn btn-outline btn-small" onClick={openDetail}>
          View
        </button>
        <Link to="/ordering/start" className="btn btn-small">
          Add
        </Link>
      </td>
    </tr>
  )
}

/**
 * Page navigation: first/prev/numbered/next/last buttons, "Showing X–Y of Z", jump-to-page input,
 * and a page-size selector. Self-contained so the same UI could later be mounted both above and
 * below the list if needed.
 */
function ProductsPagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  scrollTopRef,
}: {
  page: number
  setPage: (next: number) => void
  pageSize: PageSize
  setPageSize: (n: PageSize) => void
  total: number
  scrollTopRef: React.RefObject<HTMLDivElement>
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIdx = Math.min(total, safePage * pageSize)
  const [jump, setJump] = useState<string>('')

  function goto(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages)
    setPage(clamped)
    requestAnimationFrame(() => {
      scrollTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Window of visible page numbers: always show first + last, current ±2 in the middle.
  const pageWindow = useMemo<(number | 'gap')[]>(() => {
    const out: (number | 'gap')[] = []
    const add = (n: number) => {
      if (!out.includes(n) && n >= 1 && n <= totalPages) out.push(n)
    }
    add(1)
    if (safePage - 2 > 2) out.push('gap')
    for (let n = Math.max(2, safePage - 2); n <= Math.min(totalPages - 1, safePage + 2); n++) add(n)
    if (safePage + 2 < totalPages - 1) out.push('gap')
    if (totalPages > 1) add(totalPages)
    return out
  }, [safePage, totalPages])

  return (
    <div className="products-pagination" role="navigation" aria-label="Products pagination">
      <div className="products-pagination-info">
        Showing <strong>{startIdx}</strong>–<strong>{endIdx}</strong> of <strong>{total}</strong>
      </div>
      <div className="products-pagination-nav">
        <button
          type="button"
          className="products-pagination-btn"
          disabled={safePage === 1}
          onClick={() => goto(1)}
          aria-label="First page"
          title="First page"
        >
          «
        </button>
        <button
          type="button"
          className="products-pagination-btn"
          disabled={safePage === 1}
          onClick={() => goto(safePage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          ‹ Prev
        </button>
        {pageWindow.map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="products-pagination-gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`products-pagination-btn${n === safePage ? ' is-current' : ''}`}
              onClick={() => goto(n)}
              aria-current={n === safePage ? 'page' : undefined}
              aria-label={`Page ${n}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="products-pagination-btn"
          disabled={safePage === totalPages}
          onClick={() => goto(safePage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          Next ›
        </button>
        <button
          type="button"
          className="products-pagination-btn"
          disabled={safePage === totalPages}
          onClick={() => goto(totalPages)}
          aria-label="Last page"
          title="Last page"
        >
          »
        </button>
      </div>
      <div className="products-pagination-extras">
        <label className="products-pagination-jump">
          <span>Jump to</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = Number(jump)
                if (Number.isFinite(n) && n >= 1) goto(n)
                setJump('')
              }
            }}
            placeholder={`1–${totalPages}`}
          />
        </label>
        <label className="products-pagination-pagesize">
          <span>Per page</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

export default function Products() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // Default to TABLE view — denser, easier to scan a long catalogue. Hydrated from
  // user_preferences on mount (no localStorage allowed per workspace rules).
  const [viewType, setViewType] = useState<ViewType>('table')
  const [sortBy, setSortBy] = useState<SortOption>('name_asc')
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')
  const [optionFilters, setOptionFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const listTopRef = useRef<HTMLDivElement>(null)
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

  // Hydrate persisted prefs (view, page size, sort). Gate the auto-save effects on prefsLoaded so
  // the initial defaults don't immediately overwrite the stored values.
  useEffect(() => {
    let cancelled = false
    async function loadPrefs() {
      const [v, ps, s] = await Promise.all([
        getUserPreference(PREF_VIEW),
        getUserPreference(PREF_PAGE_SIZE),
        getUserPreference(PREF_SORT),
      ])
      if (cancelled) return
      if (v && ['grid', 'list', 'compact', 'large', 'table'].includes(v)) {
        setViewType(v as ViewType)
      }
      if (ps) {
        const n = Number(ps) as PageSize
        if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) setPageSize(n)
      }
      if (s && SORT_OPTIONS.some((o) => o.value === s)) {
        setSortBy(s as SortOption)
      }
      setPrefsLoaded(true)
    }
    void loadPrefs()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!prefsLoaded) return
    void setUserPreference(PREF_VIEW, viewType)
  }, [prefsLoaded, viewType])

  useEffect(() => {
    if (!prefsLoaded) return
    void setUserPreference(PREF_PAGE_SIZE, String(pageSize))
  }, [prefsLoaded, pageSize])

  useEffect(() => {
    if (!prefsLoaded) return
    void setUserPreference(PREF_SORT, sortBy)
  }, [prefsLoaded, sortBy])

  const displayCategories = useMemo(() => {
    const withProduct = new Set(products.map((p) => p.category_id))
    return categories.filter((c) => !c.parent_id && withProduct.has(c.id))
  }, [categories, products])

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
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

  // Reset to page 1 whenever any filter or sort changes so the user doesn't land on an
  // empty page after narrowing the result set.
  useEffect(() => {
    setPage(1)
  }, [selectedCategory, search, priceMin, priceMax, optionFilters, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageEnd = pageStart + pageSize
  const visible = useMemo(
    () => filtered.slice(pageStart, pageEnd),
    [filtered, pageStart, pageEnd],
  )

  const sortKeyDir = keyFromSortOption(sortBy)
  const requestSort = useCallback(
    (key: SortKey) => {
      if (key === 'availability') return
      const current = keyFromSortOption(sortBy)
      const nextDir: SortDir = current.key === key && current.dir === 'asc' ? 'desc' : 'asc'
      setSortBy(sortOptionFromKey(key, nextDir))
    },
    [sortBy],
  )

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
          <div ref={listTopRef} />
          <table className="products-table products-table--modern">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="product-table-cell product-table-rownum"
                  aria-label="Row number"
                >
                  #
                </th>
                <th scope="col" className="product-table-cell product-table-image">
                  Image
                </th>
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  activeKey={sortKeyDir.key}
                  dir={sortKeyDir.dir}
                  onSort={requestSort}
                  className="product-table-cell product-table-name"
                />
                <SortableHeader
                  label="SKU"
                  sortKey="sku"
                  activeKey={sortKeyDir.key}
                  dir={sortKeyDir.dir}
                  onSort={requestSort}
                  className="product-table-cell product-table-sku"
                />
                <th scope="col" className="product-table-cell product-table-availability">
                  Availability
                </th>
                <SortableHeader
                  label="Price"
                  sortKey="price"
                  activeKey={sortKeyDir.key}
                  dir={sortKeyDir.dir}
                  onSort={requestSort}
                  className="product-table-cell product-table-price"
                />
                <th scope="col" className="product-table-cell product-table-action">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product, i) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  index={pageStart + i}
                  onOpenDetail={setSelectedProduct}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div ref={listTopRef} />
          <div className={`products-grid products-view--${viewType}`}>
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                view={viewType}
                onOpenDetail={setSelectedProduct}
              />
            ))}
          </div>
        </>
      )}
      {!loading && filtered.length > 0 && (
        <ProductsPagination
          page={safePage}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={filtered.length}
          scrollTopRef={listTopRef}
        />
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

/**
 * Sortable column header. Click toggles asc → desc → asc on the selected key.
 * Shows an arrow indicator (▲ / ▼) when the key is active, neutral (↕) when not.
 */
function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = activeKey === sortKey
  const arrow = isActive ? (dir === 'asc' ? '▲' : '▼') : '↕'
  return (
    <th
      scope="col"
      className={`products-table-th-sortable${isActive ? ' is-active' : ''} ${className ?? ''}`}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="products-table-th-btn"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className="products-table-th-arrow" aria-hidden>
          {arrow}
        </span>
      </button>
    </th>
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
