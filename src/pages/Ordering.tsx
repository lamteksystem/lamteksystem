import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import OrderingWizard from '@/components/OrderingWizard'
import CatalogProductWorkbench from '@/components/catalog/CatalogProductWorkbench'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import { supabase } from '@/lib/supabase'
import { insertAssemblyOrderLines, insertProductOrderLines } from '@/lib/orderLineInsert'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { getOrderProject, type OrderProject } from '@/lib/orderProject'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import { resolveChecklistAssemblyFilters, resolveChecklistCategoryId, type ChecklistHint } from '@/lib/checklistRouting'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { CategoryRow, ProductRow, AssemblyWithLines } from '@/types/database'

type OrderMode = 'component' | 'complete'
const PREF_ORDERING_STATE = 'ordering_last_state_v1'
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
        .eq('catalog_program', CATALOG_PROGRAM.LAMTEK)
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
      const rawAssemblies = (assyData ?? []) as AssemblyWithLines[]
      const assyFiltered = rawAssemblies.filter((a) =>
        (a.assembly_lines ?? []).every((line) => {
          const p = line.product as ProductRow | undefined
          return !p || p.catalog_program !== CATALOG_PROGRAM.TEALBURY
        })
      )
      setAssemblies(assyFiltered)
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
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null)
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

  const commitCatalogPicker = useCallback(
    async (payload: CatalogPickerCommitPayload) => {
      const orderId = await ensureDraftOrder()
      await insertProductOrderLines({
        orderId,
        lines: payload.products,
        customerUserId: effectiveUserId,
      })
      for (const line of payload.assemblies) {
        await insertAssemblyOrderLines({
          orderId,
          assembly: line.assembly,
          quantity: line.quantity,
          customerUserId: effectiveUserId,
        })
      }
      await refresh()
      await refreshLineCount()
      const total = payload.products.length + payload.assemblies.length
      setLastAddedMessage(`Added ${total} line${total === 1 ? '' : 's'} to your order`)
    },
    [effectiveUserId, ensureDraftOrder, refresh, refreshLineCount],
  )

  if (showWizard) {
    return <OrderingWizard />
  }

  if (loading) {
    return (
      <div className="ordering-page">
        <PageNav backTo="/" backLabel="Dashboard" />
        <div className="admin-loading-state" style={{ minHeight: '12rem' }}>
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading catalogue…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ordering-page">
      <PageNav
        backTo={workflowComplete ? '/ordering/start' : '/'}
        backLabel={workflowComplete ? 'Choose manual or Guided Order' : 'Dashboard'}
      />
      <div className="ordering-header">
        <h1>Create order</h1>
        <p className="page-intro">
          {rangeId && displayCategories.find((c) => c.id === rangeId)?.name
            ? `Range: ${displayCategories.find((c) => c.id === rangeId)?.name}. Search the catalogue, stage lines in the basket, then review in the cart.`
            : 'Search the catalogue, stage lines in the basket, then review in the cart.'}
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
              <Link to="/ordering?flow=guided" className="btn btn-outline btn-small" title="Edit project or Guided Order steps">
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
                  {formatOrderReferenceOrFallback(o)} · updated {new Date(o.updated_at).toLocaleDateString()}
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
            <Link to="/ordering/start" className="btn btn-ghost btn-small">
              Change workflow
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

      <CatalogProductWorkbench
        products={products}
        categories={categories}
        assemblies={assemblies}
        allowedCatalogPrograms={[CATALOG_PROGRAM.LAMTEK]}
        customerUserId={effectiveUserId}
        preferencesScope="ordering_lamtek"
        cartLineCount={lineCount}
        cartHref="/ordering/cart"
        initialCategoryId={selectedCategory}
        commitLabel="Add to order"
        linePersistence="immediate"
        addButtonLabel="Add to order"
        onCommit={commitCatalogPicker}
      />
    </div>
  )
}
