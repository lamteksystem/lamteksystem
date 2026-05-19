import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AssemblyWithLines, CategoryRow, ProductRow } from '@/types/database'
import { CATALOG_PROGRAM, type CatalogProgram } from '@/lib/catalogProgram'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import { buildCategoryTreeOptions, countProductsForBrowseOption } from '@/lib/categoryTaxonomy'
import {
  EMPTY_WORKBENCH_FILTERS,
  buildCatalogFacets,
  catalogProgramLabel,
  categoryNameById,
  displayProductCode,
  filterCatalogProducts,
  getPropertiesRows,
  getSpecificationBullets,
  type WorkbenchFilterState,
} from '@/lib/catalogProductDisplay'
import {
  loadFavouriteProductIds,
  loadFilterPresets,
  loadWorkbenchFilters,
  loadWorkbenchLayout,
  saveFavouriteProductIds,
  saveFilterPresets,
  saveWorkbenchFilters,
  saveWorkbenchLayout,
  type SavedFilterPreset,
} from '@/lib/productWorkbenchPrefs'
import { resolveProductPriceBreakdown } from '@/lib/productWorkbenchPricing'
import CatalogProductDetailPanel from '@/components/catalog/CatalogProductDetailPanel'
import CatalogOrderLinesPanel from '@/components/catalog/CatalogOrderLinesPanel'
import CatalogProductStagingBasket, {
  type StagedCatalogLine,
} from '@/components/catalog/CatalogProductStagingBasket'
import { useWorkbenchOrderLines } from '@/hooks/useWorkbenchOrderLines'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { supabase } from '@/lib/supabase'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import AdminProductModal from '@/components/admin/AdminProductModal'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'

type MainTab = 'products' | 'assemblies'
export type CatalogLinePersistence = 'staged' | 'immediate'

interface CatalogProductWorkbenchProps {
  products: ProductRow[]
  categories: CategoryRow[]
  assemblies?: AssemblyWithLines[]
  allowedCatalogPrograms?: CatalogProgram[]
  customerUserId?: string | null
  preferencesScope: string
  orderId?: string | null
  orderLinesRefreshToken?: number
  cartLineCount?: number
  cartHref?: string
  commitLabel?: string
  addButtonLabel?: string
  linePersistence?: CatalogLinePersistence
  showCatalogueSwitcher?: boolean
  embedded?: boolean
  initialCategoryId?: string | null
  onCommit: (payload: CatalogPickerCommitPayload) => Promise<void>
}

export default function CatalogProductWorkbench({
  products,
  categories,
  assemblies = [],
  allowedCatalogPrograms = [CATALOG_PROGRAM.LAMTEK],
  customerUserId,
  preferencesScope,
  orderId = null,
  orderLinesRefreshToken = 0,
  cartLineCount = 0,
  cartHref = '/ordering/cart',
  commitLabel = 'Add to order',
  addButtonLabel = 'Add to order',
  linePersistence = 'staged',
  showCatalogueSwitcher = false,
  embedded = false,
  initialCategoryId = null,
  onCommit,
}: CatalogProductWorkbenchProps) {
  const [filters, setFilters] = useState<WorkbenchFilterState>({
    ...EMPTY_WORKBENCH_FILTERS,
    categoryId: initialCategoryId,
  })
  const [mainTab, setMainTab] = useState<MainTab>('products')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedCatalogLine[]>([])
  const [committing, setCommitting] = useState(false)
  const [rowQtyById, setRowQtyById] = useState<Record<string, number>>({})
  const [assemblyQtyById, setAssemblyQtyById] = useState<Record<string, number>>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [favouriteIds, setFavouriteIds] = useState<string[]>([])
  const [filterPresets, setFilterPresets] = useState<SavedFilterPreset[]>([])
  const [sellPriceByProductId, setSellPriceByProductId] = useState<Record<string, number>>({})
  const [prefsReady, setPrefsReady] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightPaneOpen, setRightPaneOpen] = useState(true)
  const [layoutReady, setLayoutReady] = useState(false)
  const immediate = linePersistence === 'immediate'
  const { lines: orderLines, loading: orderLinesLoading, reload: reloadOrderLines } =
    useWorkbenchOrderLines(immediate ? orderId : null, orderLinesRefreshToken)

  // Admin inline editing — gated on catalogue.edit permission. When admin saves a
  // product or edits categories from inside the workbench we refetch products and
  // categories from supabase and store them in the override state below, so the
  // ordering screen reflects the change immediately without the parent reloading.
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const [productsOverride, setProductsOverride] = useState<ProductRow[] | null>(null)
  const [categoriesOverride, setCategoriesOverride] = useState<CategoryRow[] | null>(null)
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const {
    types: assemblyPartTypes,
    labels: assemblyPartTypeLabels,
    reload: reloadAssemblyPartTypes,
  } = useAssemblyPartTypes(canEditCatalogue)

  // When the parent passes new products/categories (e.g. the user navigates to a
  // different range or program) drop any local override so we read the fresh data.
  useEffect(() => {
    setProductsOverride(null)
  }, [products])
  useEffect(() => {
    setCategoriesOverride(null)
  }, [categories])

  // Lazy-load the multi-category map only once admin can edit. Used by AdminProductModal.
  useEffect(() => {
    if (!canEditCatalogue) return
    let cancelled = false
    void fetchProductCategoryMap().then((map) => {
      if (!cancelled) setProductCategoryMap(map)
    })
    return () => {
      cancelled = true
    }
  }, [canEditCatalogue])

  // Esc closes the manage-categories modal. (AdminProductModal handles its own keys.)
  useEffect(() => {
    if (!managingCategories) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setManagingCategories(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [managingCategories])

  const effectiveProducts = productsOverride ?? products
  const effectiveCategories = categoriesOverride ?? categories

  const refreshCatalogueFromDb = useCallback(async () => {
    const [{ data: prodData }, { data: catData }, pcMap] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchProductCategoryMap(),
    ])
    setProductsOverride((prodData ?? []) as ProductRow[])
    setCategoriesOverride((catData ?? []) as CategoryRow[])
    setProductCategoryMap(pcMap)
  }, [])

  const favouriteSet = useMemo(() => new Set(favouriteIds), [favouriteIds])

  const scopeProducts = useMemo(() => {
    const allowed = new Set(allowedCatalogPrograms)
    return effectiveProducts.filter((p) => !p.catalog_program || allowed.has(p.catalog_program))
  }, [effectiveProducts, allowedCatalogPrograms])

  const facets = useMemo(() => buildCatalogFacets(scopeProducts), [scopeProducts])
  const catMap = useMemo(() => categoryNameById(effectiveCategories), [effectiveCategories])
  const filtered = useMemo(
    () => filterCatalogProducts(scopeProducts, filters, favouriteSet, effectiveCategories),
    [scopeProducts, filters, favouriteSet, effectiveCategories],
  )
  const browseOptions = useMemo(
    () => buildCategoryTreeOptions(effectiveCategories, filters.browseMode),
    [effectiveCategories, filters.browseMode],
  )
  const selectedProduct = useMemo(
    () => effectiveProducts.find((p) => p.id === selectedProductId) ?? null,
    [effectiveProducts, selectedProductId],
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const opt of browseOptions) {
      counts.set(
        opt.id,
        countProductsForBrowseOption(scopeProducts, effectiveCategories, filters.browseMode, opt.id),
      )
    }
    return counts
  }, [browseOptions, scopeProducts, effectiveCategories, filters.browseMode])

  const updateFilter = useCallback((patch: Partial<WorkbenchFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ ...EMPTY_WORKBENCH_FILTERS, categoryId: initialCategoryId })
  }, [initialCategoryId])

  useEffect(() => {
    let cancelled = false
    void loadWorkbenchLayout().then((layout) => {
      if (cancelled) return
      setLeftCollapsed(layout.leftCollapsed)
      setRightPaneOpen(layout.rightPaneOpen)
      setLayoutReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!layoutReady) return
    void saveWorkbenchLayout({ leftCollapsed, rightPaneOpen })
  }, [layoutReady, leftCollapsed, rightPaneOpen])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [savedFilters, favs, presets] = await Promise.all([
        loadWorkbenchFilters(preferencesScope),
        loadFavouriteProductIds(preferencesScope),
        loadFilterPresets(preferencesScope),
      ])
      if (cancelled) return
      setFilters({
        ...EMPTY_WORKBENCH_FILTERS,
        ...savedFilters,
        browseMode: savedFilters.browseMode ?? 'category',
        categoryId: initialCategoryId,
      })
      setFavouriteIds(favs)
      setFilterPresets(presets)
      setPrefsReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [preferencesScope, initialCategoryId])

  useEffect(() => {
    if (!prefsReady) return
    const t = window.setTimeout(() => {
      void saveWorkbenchFilters(preferencesScope, filters)
    }, 400)
    return () => window.clearTimeout(t)
  }, [filters, preferencesScope, prefsReady])

  useEffect(() => {
    if (!statusMessage) return
    const t = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(t)
  }, [statusMessage])

  useEffect(() => {
    if (!customerUserId || filtered.length === 0) return
    let cancelled = false
    const slice = filtered.slice(0, 40)
    void (async () => {
      const entries = await Promise.all(
        slice.map(async (p) => {
          const b = await resolveProductPriceBreakdown({ product: p, customerUserId })
          return [p.id, b.sellPrice] as const
        }),
      )
      if (cancelled) return
      setSellPriceByProductId((prev) => {
        const next = { ...prev }
        for (const [id, price] of entries) next[id] = price
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [filtered, customerUserId])

  const toggleFavourite = useCallback(
    (productId: string) => {
      setFavouriteIds((prev) => {
        const next = prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
        void saveFavouriteProductIds(preferencesScope, next)
        return next
      })
    },
    [preferencesScope],
  )

  const productUnitPrice = useCallback(
    (product: ProductRow) => sellPriceByProductId[product.id] ?? Number(product.unit_price),
    [sellPriceByProductId],
  )

  const persistPayload = useCallback(
    async (payload: CatalogPickerCommitPayload, successMessage: string) => {
      setCommitting(true)
      try {
        await onCommit(payload)
        if (immediate) await reloadOrderLines()
        setStatusMessage(successMessage)
      } catch (e) {
        console.error(e)
        setStatusMessage('Could not add line — please try again')
      } finally {
        setCommitting(false)
      }
    },
    [immediate, onCommit, reloadOrderLines],
  )

  const addProductToBasket = useCallback(
    (product: ProductRow, quantity: number) => {
      if (linePersistence === 'immediate') {
        void persistPayload(
          { products: [{ product, quantity }], assemblies: [] },
          `Added ${quantity} × ${product.name} to order`,
        )
        return
      }
      const unitPrice = productUnitPrice(product)
      setStaged((prev) => {
        const existing = prev.find((l) => l.kind === 'product' && l.product.id === product.id)
        if (existing && existing.kind === 'product') {
          return prev.map((l) =>
            l.id === existing.id ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
          )
        }
        return [
          ...prev,
          { kind: 'product', id: `p-${product.id}`, product, quantity, unitPrice },
        ]
      })
      setStatusMessage(`Added ${quantity} × ${product.name} to selection — confirm below`)
    },
    [linePersistence, persistPayload, productUnitPrice],
  )

  const addAssemblyToBasket = useCallback(
    (assembly: AssemblyWithLines, quantity: number) => {
      if (linePersistence === 'immediate') {
        void persistPayload(
          { products: [], assemblies: [{ assembly, quantity }] },
          `Added ${quantity} × ${assembly.name} to order`,
        )
        return
      }
      const unitPrice = (assembly.assembly_lines ?? []).reduce((sum, line) => {
        const product = line.product as ProductRow | undefined
        return sum + (product ? line.quantity * Number(product.unit_price) : 0)
      }, 0)
      setStaged((prev) => {
        const existing = prev.find((l) => l.kind === 'assembly' && l.assembly.id === assembly.id)
        if (existing && existing.kind === 'assembly') {
          return prev.map((l) =>
            l.id === existing.id ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
          )
        }
        return [
          ...prev,
          { kind: 'assembly', id: `a-${assembly.id}`, assembly, quantity, unitPrice },
        ]
      })
      setStatusMessage(`Added ${quantity} × ${assembly.name} to selection — confirm below`)
    },
    [linePersistence, persistPayload],
  )

  const commitBasket = useCallback(async () => {
    if (staged.length === 0) return
    const lineCount = staged.length
    const payload: CatalogPickerCommitPayload = {
      products: staged
        .filter((l): l is StagedCatalogLine & { kind: 'product' } => l.kind === 'product')
        .map((l) => ({ product: l.product, quantity: l.quantity })),
      assemblies: staged
        .filter((l): l is StagedCatalogLine & { kind: 'assembly' } => l.kind === 'assembly')
        .map((l) => ({ assembly: l.assembly, quantity: l.quantity })),
    }
    setCommitting(true)
    try {
      await onCommit(payload)
      setStaged([])
      setStatusMessage(`Added ${lineCount} line${lineCount === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      setStatusMessage('Could not add lines — please try again')
    } finally {
      setCommitting(false)
    }
  }, [onCommit, staged])

  const filteredAssemblies = useMemo(() => {
    if (!filters.search.trim()) return assemblies
    const q = filters.search.trim().toLowerCase()
    return assemblies.filter((a) => {
      const name = (a.name ?? '').toLowerCase()
      const desc = (a.description ?? '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [assemblies, filters.search])

  function saveCurrentFiltersAsPreset() {
    const name = window.prompt('Name this filter preset')
    if (!name?.trim()) return
    const preset: SavedFilterPreset = {
      id: `preset-${Date.now()}`,
      name: name.trim(),
      filters: { ...filters },
    }
    const next = [...filterPresets, preset]
    setFilterPresets(next)
    void saveFilterPresets(preferencesScope, next)
  }

  const workbenchClass = [
    'tb-workbench',
    embedded ? 'tb-workbench--embedded' : '',
    leftCollapsed ? 'tb-workbench--filters-collapsed' : '',
    !rightPaneOpen ? 'tb-workbench--right-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={workbenchClass}>
      {statusMessage && (
        <p className="ordering-toast tb-workbench-toast" role="status">
          {statusMessage}
        </p>
      )}

      <aside className="tb-workbench-filters" aria-label="Product filters">
        <div className="tb-pane-toolbar tb-pane-toolbar--filters">
          <h2 className="tb-filters-title">Product search</h2>
          <button
            type="button"
            className="tb-pane-toggle"
            onClick={() => setLeftCollapsed((v) => !v)}
            aria-expanded={!leftCollapsed}
            aria-label={leftCollapsed ? 'Expand filters' : 'Collapse filters'}
            title={leftCollapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {leftCollapsed ? '»' : '«'}
          </button>
        </div>
        {!leftCollapsed && (
        <>

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

        <fieldset className="tb-filter-field tb-filter-browse-mode">
          <legend>Browse by</legend>
          <label className="tb-check-row">
            <input
              type="radio"
              name="tb-browse-mode"
              checked={filters.browseMode === 'category'}
              onChange={() => updateFilter({ browseMode: 'category', categoryId: null })}
            />
            Category
          </label>
          <label className="tb-check-row">
            <input
              type="radio"
              name="tb-browse-mode"
              checked={filters.browseMode === 'range'}
              onChange={() => updateFilter({ browseMode: 'range', categoryId: null })}
            />
            Kitchen range
          </label>
        </fieldset>

        <label className="tb-filter-field">
          <span className="tb-filter-field-label">
            {filters.browseMode === 'range' ? 'Kitchen range' : 'Category'}
            {canEditCatalogue && (
              <button
                type="button"
                className="tb-admin-inline-action"
                title="Admin · add, rename, delete or re-type categories"
                onClick={() => setManagingCategories(true)}
              >
                Manage…
              </button>
            )}
          </span>
          <select
            value={filters.categoryId ?? ''}
            onChange={(e) => updateFilter({ categoryId: e.target.value || null })}
          >
            <option value="">
              {filters.browseMode === 'range'
                ? `All ranges (${scopeProducts.length})`
                : `All categories (${scopeProducts.length})`}
            </option>
            {browseOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.depth > 0 ? '— ' : ''}
                {opt.label}
                {categoryCounts.has(opt.id) ? ` (${categoryCounts.get(opt.id)})` : ''}
              </option>
            ))}
          </select>
          {filters.browseMode === 'range' ? (
            <p className="tb-filter-hint">
              Door families plus cross-range groups (wirework, accessories, units, etc.).
            </p>
          ) : (
            <p className="tb-filter-hint">Product types such as doors, handles, panels and units.</p>
          )}
        </label>

        {filters.browseMode === 'category' && facets.doorRanges.length > 0 && (
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

        {showCatalogueSwitcher && allowedCatalogPrograms.length > 1 && (
          <label className="tb-filter-field">
            <span>Catalogue</span>
            <select
              value={filters.catalogProgram ?? ''}
              onChange={(e) =>
                updateFilter({
                  catalogProgram: (e.target.value || null) as CatalogProgram | null,
                })
              }
            >
              <option value="">All catalogues</option>
              {allowedCatalogPrograms.map((prog) => (
                <option key={prog} value={prog}>
                  {catalogProgramLabel(prog)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="tb-check-row tb-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => updateFilter({ inStockOnly: e.target.checked })}
          />
          In stock only
        </label>
        <label className="tb-check-row tb-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.favouritesOnly}
            onChange={(e) => updateFilter({ favouritesOnly: e.target.checked })}
          />
          Favourites only
        </label>

        {filterPresets.length > 0 && (
          <label className="tb-filter-field">
            <span>Saved filters</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                const preset = filterPresets.find((p) => p.id === id)
                if (preset) setFilters(preset.filters)
                e.target.value = ''
              }}
            >
              <option value="">Load preset…</option>
              {filterPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" className="btn btn-outline btn-small" onClick={saveCurrentFiltersAsPreset}>
          Save filters
        </button>
        <button type="button" className="btn btn-outline btn-small tb-filter-clear" onClick={clearFilters}>
          Clear filters
        </button>
        </>
        )}
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
          {!rightPaneOpen && (
            <button
              type="button"
              className="btn btn-outline btn-small tb-pane-reopen"
              onClick={() => setRightPaneOpen(true)}
            >
              Show order panel
              {(immediate ? orderLines.length : cartLineCount) > 0
                ? ` (${immediate ? orderLines.length : cartLineCount})`
                : ''}
            </button>
          )}
          <p className="tb-result-meta">
            <strong>{mainTab === 'products' ? filtered.length : filteredAssemblies.length}</strong>{' '}
            {mainTab === 'products' ? 'product' : 'unit'}
            {(mainTab === 'products' ? filtered.length : filteredAssemblies.length) === 1 ? '' : 's'}
          </p>
        </header>

        <div className="tb-workbench-tabs">
          <button
            type="button"
            className={mainTab === 'products' ? 'active' : ''}
            onClick={() => setMainTab('products')}
          >
            Products
          </button>
          {assemblies.length > 0 && (
            <button
              type="button"
              className={mainTab === 'assemblies' ? 'active' : ''}
              onClick={() => setMainTab('assemblies')}
            >
              Complete units
            </button>
          )}
        </div>

        {mainTab === 'products' ? (
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
                  const specs = getSpecificationBullets(product)
                  const props = getPropertiesRows(product)
                  const sell = productUnitPrice(product)
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
                        <span className="tb-avail" title={availability.detail ?? availability.label}>
                          {availability.label}
                        </span>
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
                          <span className="tb-props-summary" title={props.map((r) => `${r.label}: ${r.value}`).join(' · ')}>
                            {props
                              .slice(0, 3)
                              .map((row) => `${row.label}: ${row.value}`)
                              .join(' · ')}
                          </span>
                        ) : (
                          <span className="tb-muted">—</span>
                        )}
                      </td>
                      <td className="tb-col-price">
                        <strong>£{sell.toFixed(2)}</strong>
                        <span className="tb-muted"> ex VAT</span>
                        {sell < Number(product.unit_price) && (
                          <span className="tb-muted tb-price-was"> was £{Number(product.unit_price).toFixed(2)}</span>
                        )}
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
                        <div className="tb-row-actions">
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => addProductToBasket(product, qty)}
                          >
                            Add
                          </button>
                          {canEditCatalogue && (
                            <button
                              type="button"
                              className="tb-admin-row-edit"
                              title={`Edit "${product.name}" (admin)`}
                              aria-label={`Edit ${product.name}`}
                              onClick={() => setEditingProduct(product)}
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="tb-table-wrap">
          <table className="tb-product-table">
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Description</th>
                <th scope="col">Price</th>
                <th scope="col">Qty</th>
                <th scope="col"><span className="visually-hidden">Add</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredAssemblies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tb-table-empty">No complete units match your search.</td>
                </tr>
              ) : (
                filteredAssemblies.map((assembly) => {
                  const unitPrice = (assembly.assembly_lines ?? []).reduce((sum, line) => {
                    const product = line.product as ProductRow | undefined
                    return sum + (product ? line.quantity * Number(product.unit_price) : 0)
                  }, 0)
                  const qty = assemblyQtyById[assembly.id] ?? 1
                  return (
                    <tr key={assembly.id}>
                      <td><strong>{assembly.name}</strong></td>
                      <td>{assembly.description ?? '—'}</td>
                      <td>
                        <strong>£{unitPrice.toFixed(2)}</strong>
                        <span className="tb-muted"> ex VAT</span>
                      </td>
                      <td>
                        <div className="qty-stepper qty-stepper--compact">
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Math.max(1, (prev[assembly.id] ?? 1) - 1),
                              }))
                            }
                          >
                            −
                          </button>
                          <input
                            className="qty-stepper-input"
                            value={qty}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                              }))
                            }}
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() =>
                              setAssemblyQtyById((prev) => ({
                                ...prev,
                                [assembly.id]: Math.min(99, (prev[assembly.id] ?? 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <button type="button" className="btn btn-small" onClick={() => addAssemblyToBasket(assembly, qty)}>
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
        )}
      </section>

      {rightPaneOpen && (
      <aside className="tb-workbench-right" aria-label="Order and product details">
        <div className="tb-right-pane-toolbar">
          <span className="tb-right-pane-toolbar-label">Order panel</span>
          <button
            type="button"
            className="tb-pane-toggle tb-pane-toggle--detail"
            onClick={() => setRightPaneOpen(false)}
            title="Hide order panel"
          >
            Hide panel
          </button>
        </div>
        {selectedProduct && mainTab === 'products' ? (
            <CatalogProductDetailPanel
              product={selectedProduct}
              categories={effectiveCategories}
              customerUserId={customerUserId}
              isFavourite={favouriteSet.has(selectedProduct.id)}
              onToggleFavourite={() => toggleFavourite(selectedProduct.id)}
              onClose={() => setSelectedProductId(null)}
              onAddToBasket={addProductToBasket}
              addButtonLabel={addButtonLabel}
              adding={committing}
              onAdminEdit={canEditCatalogue ? () => setEditingProduct(selectedProduct) : undefined}
            />
          ) : (
            <section className="tb-detail tb-detail--placeholder">
              <p>Select a product row to view specification, properties and customer pricing.</p>
            </section>
          )}

        {immediate ? (
          <CatalogOrderLinesPanel
            lines={orderLines}
            loading={orderLinesLoading}
            cartHref={cartHref}
          />
        ) : (
          <CatalogProductStagingBasket
            lines={staged}
            linePersistence={linePersistence}
            cartLineCount={cartLineCount}
            cartHref={cartHref}
            commitLabel={commitLabel}
            onQuantityChange={(lineId, quantity) => {
              setStaged((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity } : l)))
            }}
            onRemove={(lineId) => setStaged((prev) => prev.filter((l) => l.id !== lineId))}
            onClear={() => setStaged([])}
            onCommit={() => void commitBasket()}
            committing={committing}
          />
        )}
      </aside>
      )}

      {canEditCatalogue && editingProduct && (
        <AdminProductModal
          key={editingProduct.id}
          product={editingProduct}
          categories={effectiveCategories}
          productCategoryMap={productCategoryMap}
          canEditCatalogue
          partTypes={assemblyPartTypes}
          partTypeLabels={assemblyPartTypeLabels}
          allProducts={effectiveProducts}
          onClose={() => setEditingProduct(null)}
          onSaved={() => void refreshCatalogueFromDb()}
          onCategoriesChange={(next) => setCategoriesOverride(next)}
          onPartTypesChange={() => void reloadAssemblyPartTypes()}
          onProductSaved={(productId, categoryIds, primary) => {
            setProductCategoryMap((prev) => {
              const next = new Map(prev)
              next.set(productId, categoryIds)
              return next
            })
            setProductsOverride((prev) => {
              const base = prev ?? products
              return base.map((p) => (p.id === productId ? { ...p, category_id: primary } : p))
            })
            setEditingProduct((prev) =>
              prev && prev.id === productId ? { ...prev, category_id: primary } : prev,
            )
          }}
        />
      )}

      {canEditCatalogue && managingCategories && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workbench-categories-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setManagingCategories(false)
          }}
        >
          <div className="admin-modal card tb-categories-modal">
            <header className="tb-categories-modal-header">
              <div>
                <h2 id="workbench-categories-modal-title">Manage categories</h2>
                <p className="admin-muted tb-categories-modal-sub">
                  Add, rename, re-parent, or delete categories. Changes apply to the ordering
                  screen immediately.
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setManagingCategories(false)}
                aria-label="Close manage categories"
              >
                ×
              </button>
            </header>
            <div className="tb-categories-modal-body">
              <CatalogueCategoriesManager
                categories={effectiveCategories}
                products={effectiveProducts}
                productCategoryMap={productCategoryMap}
                onChanged={() => void refreshCatalogueFromDb()}
                variant="embedded"
              />
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
