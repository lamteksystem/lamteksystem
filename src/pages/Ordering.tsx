import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import OrderingWizard from '@/components/OrderingWizard'
import ProductDetailModal from '@/components/ProductDetailModal'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { getOrderProject, type OrderProject } from '@/lib/orderProject'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import { resolveChecklistAssemblyFilters, resolveChecklistCategoryId, type ChecklistHint } from '@/lib/checklistRouting'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import type { CategoryRow, ProductRow, AssemblyWithLines } from '@/types/database'

type OrderMode = 'component' | 'complete'
const PREF_ORDERING_STATE = 'ordering_last_state_v1'
const PREF_ORDERING_VIEW = 'ordering_view_v1'

export default function Ordering() {
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type')
  const rangeId = searchParams.get('range')
  const modeParam = searchParams.get('mode') as OrderMode | null
  const prefillSearch = (searchParams.get('search') ?? '').trim()
  const prefillAssemblySearch = (searchParams.get('assemblySearch') ?? '').trim()
  const checklistHint = (searchParams.get('checklist') ?? '').trim() as ChecklistHint | ''
  const suggestionsRaw = (searchParams.get('suggestions') ?? '').trim()
  const suggestionIndex = Number(searchParams.get('suggestionIndex') ?? '0') || 0
  const flowGuided = searchParams.get('flow') === 'guided'
  const workflowComplete = type === 'stock' && rangeId && (modeParam === 'component' || modeParam === 'complete')
  const showWizard = flowGuided && (!type || (type === 'stock' && (!rangeId || !modeParam)))
  const hasExplicitGuidance =
    Boolean(modeParam || rangeId || prefillSearch || prefillAssemblySearch || checklistHint || suggestionsRaw)

  const { draftOrder, draftOrders, setActiveDraftOrder, createDraftOrder, duplicateDraftOrder, refresh, ensureDraftOrder } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const [project, setProject] = useState<OrderProject | null>(null)
  const [mode, setMode] = useState<OrderMode>(modeParam ?? 'component')
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [assemblies, setAssemblies] = useState<AssemblyWithLines[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(rangeId || null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [addingAssembly, setAddingAssembly] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [prefHydrated, setPrefHydrated] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .order('name')
      setCategories(catData ?? [])
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order')
        .order('name')
      setProducts(prodData ?? [])
      const { data: assyData } = await supabase
        .from('assemblies')
        .select(`
          *,
          assembly_lines (
            id,
            assembly_id,
            product_id,
            quantity,
            sort_order,
            product:products (*)
          )
        `)
        .eq('active', true)
        .order('sort_order')
        .order('width_mm', { nullsFirst: false })
      setAssemblies((assyData ?? []) as AssemblyWithLines[])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!draftOrder?.id) {
      setProject(null)
      return
    }
    getOrderProject(draftOrder.id).then(setProject).catch(() => setProject(null))
  }, [draftOrder?.id])

  const [searchQuery, setSearchQuery] = useState('')
  const [assemblyTypeFilter, setAssemblyTypeFilter] = useState<string>('')
  const [assemblyCollectionFilter, setAssemblyCollectionFilter] = useState<string>('')
  const [assemblySearch, setAssemblySearch] = useState('')
  const [addQuantity, setAddQuantity] = useState(1)
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null)
  const [productQtyById, setProductQtyById] = useState<Record<string, number>>({})
  const [assemblyQtyById, setAssemblyQtyById] = useState<Record<string, number>>({})
  const [viewType, setViewType] = useState<'grid' | 'compact' | 'large' | 'list'>('grid')
  useEffect(() => {
    if (modeParam) setMode(modeParam)
    if (rangeId) setSelectedCategory(rangeId)
  }, [modeParam, rangeId])

  useEffect(() => {
    let cancelled = false
    async function hydrateFromPrefs() {
      if (hasExplicitGuidance) {
        if (!cancelled) setPrefHydrated(true)
        return
      }
      const raw = await getUserPreference(PREF_ORDERING_STATE)
      if (!raw || cancelled) {
        if (!cancelled) setPrefHydrated(true)
        return
      }
      try {
        const parsed = JSON.parse(raw) as {
          mode?: OrderMode
          selectedCategory?: string | null
          searchQuery?: string
          assemblyTypeFilter?: string
          assemblyCollectionFilter?: string
          assemblySearch?: string
        }
        if (parsed.mode === 'component' || parsed.mode === 'complete') setMode(parsed.mode)
        if (typeof parsed.selectedCategory === 'string' || parsed.selectedCategory === null) setSelectedCategory(parsed.selectedCategory ?? null)
        if (typeof parsed.searchQuery === 'string') setSearchQuery(parsed.searchQuery)
        if (typeof parsed.assemblyTypeFilter === 'string') setAssemblyTypeFilter(parsed.assemblyTypeFilter)
        if (typeof parsed.assemblyCollectionFilter === 'string') setAssemblyCollectionFilter(parsed.assemblyCollectionFilter)
        if (typeof parsed.assemblySearch === 'string') setAssemblySearch(parsed.assemblySearch)
      } catch {
        // Ignore malformed user preference.
      } finally {
        if (!cancelled) setPrefHydrated(true)
      }
    }
    hydrateFromPrefs()
    return () => {
      cancelled = true
    }
  }, [hasExplicitGuidance])

  useEffect(() => {
    let cancelled = false
    getUserPreference(PREF_ORDERING_VIEW)
      .then((raw) => {
        if (cancelled) return
        if (raw === 'grid' || raw === 'compact' || raw === 'large' || raw === 'list') setViewType(raw)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setUserPreference(PREF_ORDERING_VIEW, viewType).catch(() => {})
  }, [viewType])

  useEffect(() => {
    if (!prefillSearch) return
    setSearchQuery(prefillSearch)
  }, [prefillSearch])

  useEffect(() => {
    if (!prefillAssemblySearch) return
    setAssemblySearch(prefillAssemblySearch)
  }, [prefillAssemblySearch])

  useEffect(() => {
    if (!checklistHint) return
    if (mode !== 'component') return
    if (rangeId) return
    if (selectedCategory) return
    if (categories.length === 0) return
    const resolved = resolveChecklistCategoryId(categories, checklistHint)
    if (resolved) setSelectedCategory(resolved)
  }, [checklistHint, mode, rangeId, selectedCategory, categories])

  useEffect(() => {
    if (!checklistHint) return
    if (mode !== 'complete') return
    if (assemblies.length === 0) return
    if (assemblyTypeFilter || assemblyCollectionFilter) return
    const resolved = resolveChecklistAssemblyFilters(assemblies, checklistHint)
    if (resolved.unitType) setAssemblyTypeFilter(resolved.unitType)
    if (resolved.collectionSlug) setAssemblyCollectionFilter(resolved.collectionSlug)
  }, [checklistHint, mode, assemblies, assemblyTypeFilter, assemblyCollectionFilter])

  useEffect(() => {
    if (!prefHydrated) return
    if (hasExplicitGuidance) return
    const payload = JSON.stringify({
      mode,
      selectedCategory,
      searchQuery,
      assemblyTypeFilter,
      assemblyCollectionFilter,
      assemblySearch,
    })
    setUserPreference(PREF_ORDERING_STATE, payload).catch(() => {})
  }, [
    prefHydrated,
    hasExplicitGuidance,
    mode,
    selectedCategory,
    searchQuery,
    assemblyTypeFilter,
    assemblyCollectionFilter,
    assemblySearch,
  ])

  const guidanceActive = Boolean(checklistHint || prefillSearch || prefillAssemblySearch)
  const suggestions = useMemo(() => suggestionsRaw.split('|').map((s) => s.trim()).filter(Boolean), [suggestionsRaw])

  function clearGuidance() {
    setSearchQuery('')
    setAssemblySearch('')
    setAssemblyTypeFilter('')
    setAssemblyCollectionFilter('')
    if (!rangeId) setSelectedCategory(null)

    const next = new URLSearchParams(searchParams)
    next.delete('checklist')
    next.delete('search')
    next.delete('assemblySearch')
    next.delete('suggestions')
    next.delete('suggestionIndex')
    setSearchParams(next, { replace: true })
  }

  async function restoreOrderingDefaults() {
    setMode('component')
    setSelectedCategory(rangeId || null)
    setSearchQuery('')
    setAssemblySearch('')
    setAssemblyTypeFilter('')
    setAssemblyCollectionFilter('')

    const next = new URLSearchParams(searchParams)
    next.delete('checklist')
    next.delete('search')
    next.delete('assemblySearch')
    next.delete('suggestions')
    next.delete('suggestionIndex')
    next.delete('mode')
    setSearchParams(next, { replace: true })

    await setUserPreference(
      PREF_ORDERING_STATE,
      JSON.stringify({
        mode: 'component',
        selectedCategory: rangeId || null,
        searchQuery: '',
        assemblyTypeFilter: '',
        assemblyCollectionFilter: '',
        assemblySearch: '',
      })
    )
  }

  function tryNextSuggestion() {
    if (suggestions.length < 2) return
    const nextIndex = (suggestionIndex + 1) % suggestions.length
    const term = suggestions[nextIndex] ?? ''
    const next = new URLSearchParams(searchParams)
    next.set('suggestionIndex', String(nextIndex))
    if (mode === 'complete') {
      next.set('assemblySearch', term)
    } else {
      next.set('search', term)
    }
    setSearchParams(next, { replace: true })
  }

  const displayCategories = categories.filter((c) => !c.parent_id)
  const rangeCategoryIds = rangeId
    ? [rangeId, ...categories.filter((c) => c.parent_id === rangeId).map((c) => c.id)]
    : null
  const rangeSlug = rangeId ? (categories.find((c) => c.id === rangeId)?.slug ?? '').toLowerCase() : ''
  const filteredAssemblies = assemblies.filter((a) => {
    if (workflowComplete && rangeSlug) {
      const aSlug = (a.collection_slug ?? '').toLowerCase()
      if (aSlug !== rangeSlug) return false
    }
    if (assemblyTypeFilter && a.unit_type !== assemblyTypeFilter) return false
    if (assemblyCollectionFilter && (a.collection_slug ?? '') !== assemblyCollectionFilter) return false
    if (assemblySearch.trim()) {
      const q = assemblySearch.trim().toLowerCase()
      const name = (a.name ?? '').toLowerCase()
      const desc = (a.description ?? '').toLowerCase()
      if (!name.includes(q) && !desc.includes(q)) return false
    }
    return true
  })
  const assemblyCollections = [...new Set(assemblies.map((a) => (a.collection_slug ?? '')).filter(Boolean))].sort()
  const productsInCategory = (rangeCategoryIds
    ? products.filter((p) => rangeCategoryIds.includes(p.category_id))
    : selectedCategory
      ? products.filter((p) => p.category_id === selectedCategory)
      : products
  ).filter((p) => {
    if (workflowComplete) {
      if (p.is_stock === false) return false
    }
    return true
  }).filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    )
  })

  async function addToCart(product: ProductRow, quantity?: number) {
    const qty = quantity ?? addQuantity
    setAdding(product.id)
    try {
      const orderId = await ensureDraftOrder()
      const productSnapshot = {
        name: product.name,
        description: product.description,
        sku: product.sku,
        image_url: product.image_url,
      }
      const { error } = await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: product.id,
        product_snapshot: productSnapshot,
        quantity: qty,
        unit_price: product.unit_price,
        options: product.options ?? {},
      })
      if (error) throw error
      await updateOrderTotals(orderId)
      await refresh()
      const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', orderId)
      setLineCount(count ?? 0)
      setLastAddedMessage(`Added ${qty} × ${product.name}`)
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(null)
    }
  }

  async function addAssemblyToCart(assembly: AssemblyWithLines, quantity?: number) {
    const qty = quantity ?? addQuantity
    setAddingAssembly(assembly.id)
    try {
      const orderId = await ensureDraftOrder()
      const lines = assembly.assembly_lines ?? []
      if (lines.length === 0) return
      const inserts = lines.flatMap((line) => {
        const product = line.product as ProductRow
        if (!product) return []
        const productSnapshot = {
          name: product.name,
          description: product.description,
          sku: product.sku,
          image_url: product.image_url,
        }
        return {
          order_id: orderId,
          product_id: product.id,
          product_snapshot: productSnapshot,
          quantity: line.quantity * qty,
          unit_price: product.unit_price,
          options: product.options ?? {},
        }
      })
      const { error } = await supabase.from('order_lines').insert(inserts)
      if (error) throw error
      await updateOrderTotals(orderId)
      await refresh()
      const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', orderId)
      setLineCount(count ?? 0)
      setLastAddedMessage(`Added ${qty} × ${assembly.name}`)
    } catch (e) {
      console.error(e)
    } finally {
      setAddingAssembly(null)
    }
  }

  function assemblyTotal(assembly: AssemblyWithLines): number {
    const lines = assembly.assembly_lines ?? []
    return lines.reduce((sum, line) => {
      const product = line.product as ProductRow
      return sum + (product ? line.quantity * Number(product.unit_price) : 0)
    }, 0)
  }

  async function updateOrderTotals(orderId: string) {
    if (!effectiveUserId) return
    await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: effectiveUserId })
  }

  const [lineCount, setLineCount] = useState(0)
  const refreshLineCount = useCallback(async () => {
    if (!draftOrder?.id) {
      setLineCount(0)
      return
    }
    const { count } = await supabase
      .from('order_lines')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', draftOrder.id)
    setLineCount(count ?? 0)
  }, [draftOrder?.id])

  useEffect(() => {
    refreshLineCount()
  }, [refreshLineCount])

  useEffect(() => {
    if (!lastAddedMessage) return
    const t = window.setTimeout(() => setLastAddedMessage(null), 2500)
    return () => window.clearTimeout(t)
  }, [lastAddedMessage])

  if (showWizard) {
    return <OrderingWizard />
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="ordering-page">
      <PageNav backTo={workflowComplete ? "/ordering?flow=guided" : "/"} backLabel={workflowComplete ? "Change order type or range" : "Dashboard"} />
      <div className="ordering-header">
        <h1>Create order</h1>
        <p className="page-intro">
          {rangeId && displayCategories.find((c) => c.id === rangeId)?.name
            ? `Range: ${displayCategories.find((c) => c.id === rangeId)?.name} · ${mode === 'component' ? 'Components' : 'Complete units'}. Add items below and review in the cart.`
            : 'Add items below and review in the cart.'}
        </p>
        {guidanceActive && (
          <div className="ordering-guidance-banner">
            <span>
              Checklist guidance applied
              {prefillSearch ? ' · product search prefilled' : ''}
              {prefillAssemblySearch ? ' · unit search prefilled' : ''}
              {checklistHint ? ' · relevant filters/category selected' : ''}
            </span>
            <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {suggestions.length > 1 && (
                <button type="button" className="btn btn-outline btn-small" onClick={tryNextSuggestion} title="Cycle to another suggested search term">
                  Try next suggestion
                </button>
              )}
              <button type="button" className="btn btn-outline btn-small" onClick={clearGuidance}>
                Clear guidance
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => { restoreOrderingDefaults().catch(() => {}) }}
                title="Reset current filters/search and saved ordering defaults"
              >
                Restore defaults
              </button>
            </div>
          </div>
        )}
        {lastAddedMessage && (
          <div className="ordering-added-banner">
            <span>{lastAddedMessage}</span>
            <Link to="/ordering/cart" className="btn btn-small btn-outline">
              View cart →
            </Link>
          </div>
        )}
        {project && (
          <div className="card" style={{ padding: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong>Project</strong>{' '}
                <span className="admin-muted">
                  · {project.room_type}
                  {' · '}
                  {project.delivery_method === 'collect' ? 'collection' : `delivery${project.postcode ? ` (${project.postcode})` : ''}`}
                </span>
                {project.site_notes ? (
                  <div className="admin-muted" style={{ marginTop: '0.25rem' }}>
                    {project.site_notes}
                  </div>
                ) : null}
              </div>
              <Link to="/ordering?flow=guided" className="btn btn-outline btn-small" title="Edit guided setup">
                Edit
              </Link>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            <span className="admin-muted" style={{ fontSize: '0.9rem' }}>Basket</span>
            <select
              value={draftOrder?.id ?? ''}
              onChange={(e) => setActiveDraftOrder(e.target.value || null)}
              aria-label="Select basket"
            >
              {draftOrders.length === 0 ? <option value="">(none)</option> : null}
              {draftOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {(o.reference?.trim() || o.id.slice(0, 8))} · updated {new Date(o.updated_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-small" onClick={() => createDraftOrder()}>
            New basket
          </button>
          {draftOrder?.id && (
            <button type="button" className="btn btn-outline btn-small" onClick={() => duplicateDraftOrder(draftOrder.id)}>
              Duplicate
            </button>
          )}
          <Link to="/ordering/baskets" className="btn btn-outline btn-small">
            Manage baskets
          </Link>
          {workflowComplete && (
            <Link to="/ordering?flow=guided" className="btn btn-ghost btn-small">
              Change workflow
            </Link>
          )}
          {!workflowComplete && (
            <Link to="/ordering?flow=guided" className="btn btn-ghost btn-small">
              Guided order (type &amp; range)
            </Link>
          )}
          <Link to="/ordering/mto" className="btn btn-outline">
            Made to measure →
          </Link>
          <Link to="/ordering/cart" className="btn btn-success">
            Cart {lineCount > 0 ? `(${lineCount})` : ''} →
          </Link>
        </div>
      </div>

      {lineCount > 0 && (
        <Link to="/ordering/cart" className="cart-fab" aria-label={`Open cart (${lineCount} items)`}>
          Cart <span className="cart-fab-badge" aria-hidden>{lineCount}</span>
        </Link>
      )}

      <div className="ordering-mode-tabs">
        <button
          type="button"
          className={mode === 'component' ? 'active' : ''}
          onClick={() => setMode('component')}
        >
          Component
        </button>
        <button
          type="button"
          className={mode === 'complete' ? 'active' : ''}
          onClick={() => setMode('complete')}
        >
          Complete units
        </button>
      </div>

      <div className="ordering-view-toolbar">
        <span className="admin-muted" style={{ fontSize: '0.9rem' }}>View</span>
        <div className="products-view-toggle" role="group" aria-label="Ordering view type">
          <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} aria-pressed={viewType === 'grid'} title="Grid">
            Grid
          </button>
          <button type="button" className={viewType === 'list' ? 'active' : ''} onClick={() => setViewType('list')} aria-pressed={viewType === 'list'} title="List">
            List
          </button>
          <button type="button" className={viewType === 'compact' ? 'active' : ''} onClick={() => setViewType('compact')} aria-pressed={viewType === 'compact'} title="Compact">
            Compact
          </button>
          <button type="button" className={viewType === 'large' ? 'active' : ''} onClick={() => setViewType('large')} aria-pressed={viewType === 'large'} title="Large">
            Large
          </button>
        </div>
      </div>

      {mode === 'complete' ? (
        <>
          <div className="ordering-toolbar">
            <label className="ordering-qty-label">
              Default add qty
              <select
                value={addQuantity}
                onChange={(e) => setAddQuantity(Number(e.target.value))}
                className="ordering-qty-select"
                title="Default quantity (you can change per item on each card)"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {assemblyCollections.length > 1 && (
              <label className="ordering-filter-label">
                Collection
                <select
                  value={assemblyCollectionFilter}
                  onChange={(e) => setAssemblyCollectionFilter(e.target.value)}
                  className="ordering-filter-select"
                >
                  <option value="">All</option>
                  {assemblyCollections.map((slug) => (
                    <option key={slug} value={slug}>{slug.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="ordering-filter-label">
              Unit type
              <select
                value={assemblyTypeFilter}
                onChange={(e) => setAssemblyTypeFilter(e.target.value)}
                className="ordering-filter-select"
              >
                <option value="">All</option>
                <option value="base_unit">Base</option>
                <option value="wall_unit">Wall</option>
                <option value="tall_unit">Tall</option>
              </select>
            </label>
            <label className="ordering-search-wrap">
              <span className="ordering-filter-label">Search</span>
              <div className="ordering-search-row">
                <input
                  type="search"
                  placeholder="Search complete units…"
                  value={assemblySearch}
                  onChange={(e) => setAssemblySearch(e.target.value)}
                  className="ordering-search-input"
                />
                {assemblySearch.trim() && (
                  <button
                    type="button"
                    className="ordering-search-clear"
                    onClick={() => setAssemblySearch('')}
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </label>
          </div>
        <div className={`ordering-grid products-view--${viewType}`}>
          {filteredAssemblies.length === 0 ? (
            <div className="card">
              <p>{assemblies.length === 0 ? 'No complete units loaded.' : 'No units match the current filters or search.'}</p>
            </div>
          ) : (
            filteredAssemblies.map((assembly) => (
              <div key={assembly.id} className="card product-card">
                <div className="product-card-image">
                  {assembly.image_url ? (
                    <img src={assembly.image_url} alt={assembly.name} />
                  ) : (
                    <div className="product-card-placeholder">Complete unit</div>
                  )}
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-name">{assembly.name}</h3>
                  {assembly.description && (
                    <p className="product-card-desc">{assembly.description}</p>
                  )}
                  {assembly.width_mm != null && (
                    <span className="product-card-sku">{assembly.width_mm}mm</span>
                  )}
                  <div className="product-card-footer">
                    <span className="product-card-price">£{assemblyTotal(assembly).toFixed(2)}</span>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        className="qty-stepper-btn"
                        aria-label={`Decrease quantity for ${assembly.name}`}
                        onClick={() => {
                          setAssemblyQtyById((prev) => {
                            const cur = prev[assembly.id] ?? addQuantity
                            const next = Math.max(1, cur - 1)
                            return { ...prev, [assembly.id]: next }
                          })
                        }}
                        disabled={addingAssembly === assembly.id}
                      >
                        −
                      </button>
                      <input
                        className="qty-stepper-input"
                        inputMode="numeric"
                        aria-label={`Quantity for ${assembly.name}`}
                        value={assemblyQtyById[assembly.id] ?? addQuantity}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          setAssemblyQtyById((prev) => ({ ...prev, [assembly.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1 }))
                        }}
                        disabled={addingAssembly === assembly.id}
                      />
                      <button
                        type="button"
                        className="qty-stepper-btn"
                        aria-label={`Increase quantity for ${assembly.name}`}
                        onClick={() => {
                          setAssemblyQtyById((prev) => {
                            const cur = prev[assembly.id] ?? addQuantity
                            const next = Math.min(99, cur + 1)
                            return { ...prev, [assembly.id]: next }
                          })
                        }}
                        disabled={addingAssembly === assembly.id}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => addAssemblyToCart(assembly, assemblyQtyById[assembly.id] ?? addQuantity)}
                      disabled={addingAssembly === assembly.id}
                    >
                      {addingAssembly === assembly.id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </>
      ) : (
        <>
          <div className="ordering-toolbar">
            <label className="ordering-qty-label">
              Default add qty
              <select value={addQuantity} onChange={(e) => setAddQuantity(Number(e.target.value))} className="ordering-qty-select" title="Quantity to add when clicking Add">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          {displayCategories.length > 0 && (
            <div className="ordering-tabs">
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
          )}

          <div className="ordering-search-wrap">
            <div className="ordering-search-row">
              <input
                type="search"
                placeholder="Search products by name or SKU…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ordering-search-input"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="ordering-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className={`ordering-grid products-view--${viewType}`}>
            {productsInCategory.length === 0 ? (
              <div className="card">
                <p>No products loaded yet. Add categories and products in Supabase to see them here.</p>
                <p className="downloads-placeholder">
                  Products can include name, description, SKU, unit price, and image. Use the <code>products</code> and <code>categories</code> tables.
                </p>
              </div>
            ) : (
              productsInCategory.map((product) => {
                const availability = getProductAvailabilityMeta(product)
                const openDetail = () => setSelectedProduct(product)
                return (
                  <div key={product.id} className="card product-card product-card--clickable">
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
                        <img src={product.image_url} alt={product.image_alt ?? product.name} />
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
                      {product.description && (
                        <p className="product-card-desc">{product.description}</p>
                      )}
                      {product.options && typeof product.options === 'object' && Object.keys(product.options as object).length > 0 && (
                        <div className="product-badges">
                          {(Object.entries(product.options as Record<string, unknown>).filter(([, v]) => v != null && String(v).trim() !== '') as [string, string][]).map(([key, value]) => (
                            <span key={key} className="product-badge" title={`${key}: ${value}`}>{String(value)}</span>
                          ))}
                        </div>
                      )}
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
                        <div className="qty-stepper">
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            aria-label={`Decrease quantity for ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setProductQtyById((prev) => {
                                const cur = prev[product.id] ?? addQuantity
                                const next = Math.max(1, cur - 1)
                                return { ...prev, [product.id]: next }
                              })
                            }}
                            disabled={adding === product.id}
                          >
                            −
                          </button>
                          <input
                            className="qty-stepper-input"
                            inputMode="numeric"
                            aria-label={`Quantity for ${product.name}`}
                            value={productQtyById[product.id] ?? addQuantity}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              setProductQtyById((prev) => ({ ...prev, [product.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1 }))
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={adding === product.id}
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            aria-label={`Increase quantity for ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setProductQtyById((prev) => {
                                const cur = prev[product.id] ?? addQuantity
                                const next = Math.min(99, cur + 1)
                                return { ...prev, [product.id]: next }
                              })
                            }}
                            disabled={adding === product.id}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={(e) => { e.stopPropagation(); addToCart(product, productQtyById[product.id] ?? addQuantity); }}
                          disabled={adding === product.id}
                        >
                          {adding === product.id ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={setSelectedProduct}
          onAddToCart={(p, qty) => addToCart(p, qty)}
        />
      )}
    </div>
  )
}
