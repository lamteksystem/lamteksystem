/**
 * Categories admin hub.
 *
 * Top-level sections (URL: ?section=general|smart|parts, default `general`):
 *   - General categories  → add / rename / delete / move / re-type
 *   - Smart categorise    → suggestions · learning history · settings
 *   - Parts               → complete-unit part type registry
 *
 * The legacy URL `/admin/catalogue/smart-categorise` redirects to this hub with
 * `?section=smart` for backward compatibility.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getCategoryKind } from '@/lib/categoryTaxonomy'
import {
  applySmartCategorySuggestions,
  buildSmartCategorizationSuggestions,
  loadSmartCategoryLearning,
  syncInferredCategoryKinds,
  type SmartCategoryOverride,
  type SmartCategorySuggestion,
} from '@/lib/smartProductCategorize'
import {
  addUserSmartStopWord,
  deleteSmartCategoryToken,
  deleteSmartCategoryTokenEverywhere,
  learningTokens,
  listBuiltInStopWords,
  loadSmartCategoryHistory,
  loadUserSmartStopWords,
  recordSmartCategoryLearning,
  removeUserSmartStopWord,
  resetSmartCategoryLearning,
  setSmartCategoryWeight,
  type LearningIndex,
  type LearningRow,
} from '@/lib/smartCategoryLearning'
import {
  DEFAULT_SMART_CATEGORY_SETTINGS,
  loadSmartCategorySettings,
  saveSmartCategorySettings,
  type SmartCategorySettings,
} from '@/lib/smartCategorySettings'
import { rebucketTealburyAccessories } from '@/lib/tealburyAccessoryRebucket'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'
import AdminAssemblyPartTypesSettings from '@/components/admin/AdminAssemblyPartTypesSettings'
import ListPager from '@/components/admin/ListPager'
import { useListPagination } from '@/lib/listPagination'
import type { CategoryRow, ProductRow } from '@/types/database'

type Section = 'general' | 'smart' | 'parts'
type Tab = 'suggestions' | 'history' | 'settings'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low']

export interface ResultInfo {
  tone: 'success' | 'mixed' | 'error'
  title: string
  lines: string[]
  errors: string[]
}

export default function AdminSmartCategorise() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section') as Section | null
  const tabParam = searchParams.get('tab') as Tab | null
  // Derive section/tab directly from the URL — no separate state + sync effect (would loop
  // because `setSearchParams` from `useSearchParams` is a new reference every render).
  const section: Section =
    sectionParam === 'smart' || sectionParam === 'parts' ? sectionParam : 'general'
  const tab: Tab = tabParam === 'history' || tabParam === 'settings' ? tabParam : 'suggestions'

  const setSection = useCallback(
    (next: Section) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === 'general') params.delete('section')
          else params.set('section', next)
          // Clear sub-tab unless we're moving into smart.
          if (next !== 'smart') params.delete('tab')
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setTab = useCallback(
    (next: Tab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          params.set('section', 'smart')
          if (next === 'suggestions') params.delete('tab')
          else params.set('tab', next)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const [learning, setLearning] = useState<LearningIndex>(new Map())
  const [history, setHistory] = useState<LearningRow[]>([])
  const [userStopWords, setUserStopWords] = useState<string[]>([])
  const [settings, setSettings] = useState<SmartCategorySettings>(DEFAULT_SMART_CATEGORY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ResultInfo | null>(null)

  const refreshLearning = useCallback(async () => {
    const [idx, hist, stops, opts] = await Promise.all([
      loadSmartCategoryLearning(),
      loadSmartCategoryHistory(),
      loadUserSmartStopWords(),
      loadSmartCategorySettings(),
    ])
    setLearning(idx)
    setHistory(hist)
    setUserStopWords(stops)
    setSettings(opts)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prodData }, { data: catData }, pcMap] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchProductCategoryMap(),
    ])
    setProducts((prodData ?? []) as ProductRow[])
    setCategories((catData ?? []) as CategoryRow[])
    setProductCategoryMap(pcMap)
    await refreshLearning()
    setLoading(false)
  }, [refreshLearning])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    // Scroll to top whenever the section/tab changes so the relevant content is in view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [section, tab])

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  return (
    <section className="admin-page admin-smart-categorise-page admin-categories-hub">
      <header className="admin-page-header admin-smart-categorise-header">
        <div>
          <h1>Categories</h1>
          <p className="admin-muted">
            Manage product categories, run smart bulk categorisation, and configure the parts
            registry — all in one place.{' '}
            <Link to="/admin/catalogue">← Back to catalogue</Link>
          </p>
        </div>
      </header>

      <nav className="admin-tabs admin-categories-hub-tabs" aria-label="Categories sections">
        {(
          [
            ['general', 'General categories', categories.length],
            ['smart', 'Smart categorise', history.length],
            ['parts', 'Parts', null],
          ] as [Section, string, number | null][]
        ).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            className={`admin-tab admin-tab--top${section === key ? ' admin-tab--active' : ''}`}
            onClick={() => setSection(key)}
            aria-current={section === key ? 'page' : undefined}
          >
            {label}
            {badge && badge > 0 ? <span className="admin-tab-badge">{badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="admin-smart-categorise-body">
        {loading ? (
          <p className="admin-muted">Loading catalogue…</p>
        ) : section === 'general' ? (
          <CatalogueCategoriesManager
            categories={categories}
            products={products}
            productCategoryMap={productCategoryMap}
            onChanged={loadAll}
            variant="embedded"
          />
        ) : section === 'parts' ? (
          <AdminAssemblyPartTypesSettings embedded />
        ) : (
          <SmartSection
            tab={tab}
            setTab={setTab}
            history={history}
            userStopWords={userStopWords}
            settings={settings}
            onSettingsChanged={setSettings}
            products={products}
            categories={categories}
            categoryById={categoryById}
            learning={learning}
            refreshLearning={refreshLearning}
            loadAll={loadAll}
            setResult={setResult}
          />
        )}
      </div>

      {result && <SmartCategoriseResultModal info={result} onClose={() => setResult(null)} />}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Smart section (suggestions / history / settings sub-tabs)
// ---------------------------------------------------------------------------

interface SmartSectionProps {
  tab: Tab
  setTab: (next: Tab) => void
  history: LearningRow[]
  userStopWords: string[]
  settings: SmartCategorySettings
  onSettingsChanged: (next: SmartCategorySettings) => void
  products: ProductRow[]
  categories: CategoryRow[]
  categoryById: Map<string, CategoryRow>
  learning: LearningIndex
  refreshLearning: () => Promise<void>
  loadAll: () => Promise<void>
  setResult: (r: ResultInfo) => void
}

function SmartSection({
  tab,
  setTab,
  history,
  userStopWords,
  settings,
  onSettingsChanged,
  products,
  categories,
  categoryById,
  learning,
  refreshLearning,
  loadAll,
  setResult,
}: SmartSectionProps) {
  return (
    <div className="admin-smart-categorise-section">
      <nav
        className="admin-tabs admin-smart-categorise-tabs admin-tabs--nested"
        aria-label="Smart categorisation sub-sections"
      >
        {(
          [
            ['suggestions', 'Suggestions'],
            ['history', 'Learning history'],
            ['settings', 'Settings'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`admin-tab${tab === key ? ' admin-tab--active' : ''}`}
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
          >
            {label}
            {key === 'history' && history.length > 0 ? (
              <span className="admin-tab-badge">{history.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="admin-smart-categorise-body">
        {tab === 'suggestions' ? (
          <SuggestionsTab
            products={products}
            categories={categories}
            categoryById={categoryById}
            learning={learning}
            settings={settings}
            onApplied={async () => {
              await refreshLearning()
              await loadAll()
            }}
            setResult={setResult}
          />
        ) : tab === 'history' ? (
          <HistoryTab
            history={history}
            categoryById={categoryById}
            userStopWords={userStopWords}
            ambiguousThreshold={settings.autoAmbiguousThreshold}
            onChange={refreshLearning}
            setResult={setResult}
          />
        ) : (
          <SettingsTab
            categories={categories}
            products={products}
            learning={learning}
            settings={settings}
            onSettingsChanged={onSettingsChanged}
            onChanged={async () => {
              await refreshLearning()
            }}
            setResult={setResult}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suggestions tab
// ---------------------------------------------------------------------------

export interface SuggestionsTabProps {
  products: ProductRow[]
  categories: CategoryRow[]
  categoryById: Map<string, CategoryRow>
  learning: LearningIndex
  /** Settings drive band labels/descriptions used on chips + table badges. */
  settings: SmartCategorySettings
  onApplied: () => Promise<void>
  setResult: (r: ResultInfo) => void
}

export function SuggestionsTab({
  products,
  categories,
  categoryById,
  learning,
  settings,
  onApplied,
  setResult,
}: SuggestionsTabProps) {
  const [confidenceFilter, setConfidenceFilter] = useState<Record<ConfidenceLevel, boolean>>({
    high: true,
    medium: true,
    low: false,
  })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Per-row overrides. The `primary` is the main category for the product (overrides
  // the heuristic suggestion when present), and `additional` holds extra categories
  // the product should also appear in.
  const [overrides, setOverrides] = useState<
    Map<string, { primary?: string; additional: string[] }>
  >(new Map())
  const [applying, setApplying] = useState(false)
  const [syncingKinds, setSyncingKinds] = useState(false)
  const [rebucketing, setRebucketing] = useState(false)

  const productById = useMemo(() => {
    const map = new Map<string, ProductRow>()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const overrideCategoryOptions = useMemo(() => {
    return [...categories]
      .filter((c) => getCategoryKind(c) !== 'door_range')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])

  const allSuggestions = useMemo(
    () => buildSmartCategorizationSuggestions(products, categories, learning),
    [products, categories, learning],
  )

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allSuggestions.filter((s) => {
      if (!confidenceFilter[s.confidence]) return false
      if (!q) return true
      return s.productName.toLowerCase().includes(q) || (productById.get(s.productId)?.sku ?? '').toLowerCase().includes(q)
    })
  }, [allSuggestions, confidenceFilter, search, productById])

  const {
    pageItems: pageSuggestions,
    totalItems: suggestionTotal,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(suggestions, {
    resetDeps: [search, confidenceFilter.high, confidenceFilter.medium, confidenceFilter.low],
  })

  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selected.has(s.productId)),
    [suggestions, selected],
  )

  const pageSelectedCount = pageSuggestions.filter((s) => selected.has(s.productId)).length
  const allOnPageSelected = pageSuggestions.length > 0 && pageSelectedCount === pageSuggestions.length

  function toggleConfidence(level: ConfidenceLevel) {
    setConfidenceFilter((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  function togglePageAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const s of pageSuggestions) {
        if (checked) next.add(s.productId)
        else next.delete(s.productId)
      }
      return next
    })
  }

  function toggleOne(s: SmartCategorySuggestion) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(s.productId)) next.delete(s.productId)
      else next.add(s.productId)
      return next
    })
  }

  // UX paper-cut: previously the user had to change the category AND also tick the row's checkbox
  // before Apply. The obvious gesture "I'm tweaking this row" already implies "include this row in
  // the next Apply", so we auto-tick on every override mutation. The user can still untick.
  function autoSelect(productId: string) {
    setSelected((prev) => {
      if (prev.has(productId)) return prev
      const next = new Set(prev)
      next.add(productId)
      return next
    })
  }

  function setPrimaryOverride(productId: string, categoryId: string) {
    setOverrides((prev) => {
      const next = new Map(prev)
      const current = next.get(productId) ?? { additional: [] }
      next.set(productId, {
        primary: categoryId,
        // Drop the new primary from `additional` if it was there.
        additional: current.additional.filter((id) => id !== categoryId),
      })
      return next
    })
    autoSelect(productId)
  }

  function clearPrimaryOverride(productId: string) {
    setOverrides((prev) => {
      const current = prev.get(productId)
      if (!current) return prev
      const next = new Map(prev)
      if (current.additional.length === 0) {
        next.delete(productId)
      } else {
        next.set(productId, { primary: undefined, additional: current.additional })
      }
      return next
    })
  }

  function addAdditionalCategory(productId: string, categoryId: string, suggestedId: string) {
    if (!categoryId) return
    setOverrides((prev) => {
      const next = new Map(prev)
      const current = next.get(productId) ?? { additional: [] }
      const effectivePrimary = current.primary ?? suggestedId
      // Don't add the same category twice, and don't add the primary as an extra.
      if (categoryId === effectivePrimary || current.additional.includes(categoryId)) return prev
      next.set(productId, {
        primary: current.primary,
        additional: [...current.additional, categoryId],
      })
      return next
    })
    autoSelect(productId)
  }

  function removeAdditionalCategory(productId: string, categoryId: string) {
    setOverrides((prev) => {
      const current = prev.get(productId)
      if (!current) return prev
      const filtered = current.additional.filter((id) => id !== categoryId)
      const next = new Map(prev)
      if (!current.primary && filtered.length === 0) {
        next.delete(productId)
      } else {
        next.set(productId, { primary: current.primary, additional: filtered })
      }
      return next
    })
    autoSelect(productId)
  }

  async function applySelected() {
    if (selectedSuggestions.length === 0) return
    setApplying(true)
    try {
      // Convert per-row overrides to the SmartCategoryOverride shape the apply
      // function expects. We always send an object so additional ids ride along.
      const applyOverrides = new Map<string, SmartCategoryOverride>()
      for (const s of selectedSuggestions) {
        const o = overrides.get(s.productId)
        if (!o) continue
        applyOverrides.set(s.productId, {
          primary: o.primary ?? s.suggestedCategoryId,
          additional: o.additional,
        })
      }

      const overriddenCount = selectedSuggestions.filter((s) => {
        const o = overrides.get(s.productId)
        return !!(o && (o.primary || o.additional.length > 0))
      }).length

      const multiCount = selectedSuggestions.filter((s) => {
        const o = overrides.get(s.productId)
        return !!(o && o.additional.length > 0)
      }).length

      const { applied, errors } = await applySmartCategorySuggestions(
        selectedSuggestions,
        applyOverrides,
      )
      const lines: string[] = [
        `Re-categorised ${applied} product${applied === 1 ? '' : 's'}.`,
        `${selectedSuggestions.length - applied} skipped.`,
      ]
      if (overriddenCount > 0) {
        lines.push(
          `${overriddenCount} used your manual override${overriddenCount === 1 ? '' : 's'} — the system has learnt from those for next time.`,
        )
      }
      if (multiCount > 0) {
        lines.push(
          `${multiCount} product${multiCount === 1 ? ' was' : 's were'} assigned to multiple categories.`,
        )
      }
      setResult({
        tone: errors.length === 0 ? 'success' : applied > 0 ? 'mixed' : 'error',
        title: errors.length === 0 ? 'Categorisation applied' : 'Applied with some errors',
        lines,
        errors,
      })
      setSelected(new Set())
      setOverrides(new Map())
      await onApplied()
    } finally {
      setApplying(false)
    }
  }

  async function syncKinds() {
    setSyncingKinds(true)
    try {
      const n = await syncInferredCategoryKinds(categories)
      setResult({
        tone: 'success',
        title: 'Category types synced',
        lines: [
          n === 0
            ? 'All category types were already correct — nothing to update.'
            : `Updated category type on ${n} categor${n === 1 ? 'y' : 'ies'}.`,
        ],
        errors: [],
      })
      await onApplied()
    } finally {
      setSyncingKinds(false)
    }
  }

  async function splitTealbury() {
    setRebucketing(true)
    try {
      const summary = await rebucketTealburyAccessories()
      const lines = [
        summary.ensured === 0
          ? 'All 5 accessory categories already exist.'
          : `Created ${summary.ensured} new categor${summary.ensured === 1 ? 'y' : 'ies'} (Cornice & Pelmet, Plinth, Panels, Mouldings, Posts).`,
        summary.reassigned === 0
          ? 'No products needed reassigning — Tealbury accessories already in the right buckets.'
          : `Re-assigned ${summary.reassigned} Tealbury product${summary.reassigned === 1 ? '' : 's'} into the new accessory categories.`,
        `Skipped ${summary.skipped} product${summary.skipped === 1 ? '' : 's'} (not a Tealbury accessory).`,
      ]
      setResult({
        tone: summary.errors.length === 0 ? 'success' : summary.reassigned > 0 ? 'mixed' : 'error',
        title:
          summary.errors.length === 0
            ? 'Tealbury accessories split'
            : 'Split completed with some errors',
        lines,
        errors: summary.errors,
      })
      await onApplied()
    } finally {
      setRebucketing(false)
    }
  }

  return (
    <div className="admin-smart-categorise-suggestions">
      <p className="admin-callout admin-callout--info admin-smart-categorise-help">
        <strong>How this works:</strong> the system reads each product's name, description and SKU,
        compares it to your category names, and proposes the closest match. Each row below shows{' '}
        <em>the product's <strong>current</strong> category</em> and{' '}
        <em>the system's <strong>suggested</strong> category</em>. Tick the rows you agree with and
        press Apply — nothing changes until you confirm. If a suggestion is wrong, pick the right
        category from the dropdown; the system learns from your corrections.
      </p>

      <div className="admin-smart-categorise-toolbar">
        <fieldset className="admin-smart-categorize-confidence">
          <legend>Show confidence</legend>
          {CONFIDENCE_LEVELS.map((level) => (
            <label
              key={level}
              className={`admin-confidence-chip admin-confidence-chip--${level}`}
              title={settings.bands[level].description}
            >
              <input
                type="checkbox"
                checked={confidenceFilter[level]}
                onChange={() => toggleConfidence(level)}
                disabled={applying}
              />
              <span className={`admin-badge admin-badge--${level}`}>
                {settings.bands[level].label || level}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="admin-smart-categorise-search">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product name or SKU"
          />
        </label>

        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={syncingKinds}
          onClick={() => void syncKinds()}
          title="Re-flag categories as door-range / universal / product-type based on their names"
        >
          {syncingKinds ? 'Syncing…' : 'Sync category types'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={rebucketing}
          onClick={() => void splitTealbury()}
          title="Move Tealbury accessory items into Cornice & Pelmet, Plinth, Panels, Mouldings, Posts"
        >
          {rebucketing ? 'Splitting Tealbury accessories…' : 'Split Tealbury accessories'}
        </button>
      </div>

      <div className="admin-smart-categorize-stats">
        <strong>{suggestions.length}</strong> suggestion{suggestions.length === 1 ? '' : 's'} match the filters ·{' '}
        <strong>{selected.size}</strong> selected
        {suggestions.length > 0 && (
          <>
            <span className="admin-smart-categorize-sep">·</span>
            <button
              type="button"
              className="admin-link-button"
              onClick={() => setSelected(new Set(suggestions.map((s) => s.productId)))}
              disabled={selected.size === suggestions.length}
            >
              Select all {suggestions.length}
            </button>
            <span className="admin-smart-categorize-sep">·</span>
            <button
              type="button"
              className="admin-link-button"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Clear selection
            </button>
          </>
        )}
      </div>

      <table className="admin-smart-categorise-table">
        <thead>
          <tr>
            <th scope="col" className="admin-smart-categorise-th-check" title="Tick to include this row in the next Apply">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(e) => togglePageAll(e.target.checked)}
                aria-label="Select all on this page"
                disabled={pageSuggestions.length === 0}
              />
            </th>
            <th scope="col" title="The product, with program (Lamtek/Tealbury) and SKU">
              Product
            </th>
            <th scope="col" title="The category this product is in right now">
              Current category
            </th>
            <th scope="col" aria-hidden="true">
              →
            </th>
            <th scope="col" title="The category the system suggests. Click to override.">
              Suggested category
            </th>
            <th scope="col" title="How sure the system is about this suggestion">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody>
          {pageSuggestions.length === 0 ? (
            <tr>
              <td colSpan={6} className="admin-muted admin-smart-categorise-empty">
                No suggestions match your filters. Try enabling Low confidence, or clear the search.
              </td>
            </tr>
          ) : (
            pageSuggestions.map((s) => {
              const product = productById.get(s.productId)
              const currentCategory = s.currentCategoryId ? categoryById.get(s.currentCategoryId) : null
              const override = overrides.get(s.productId)
              const primaryId = override?.primary ?? s.suggestedCategoryId
              const additionalIds = override?.additional ?? []
              const targetCategory = categoryById.get(primaryId)
              const isPrimaryOverridden = !!override?.primary
              const hasExtras = additionalIds.length > 0
              const isOverridden = isPrimaryOverridden || hasExtras
              const isSameCategory = currentCategory?.id === primaryId && !hasExtras
              const isLearned = s.learningBoost >= 0.04
              const program = product?.catalog_program
              const totalCategoriesForRow = 1 + additionalIds.length

              const rowTooltip = isOverridden
                ? hasExtras
                  ? `On Apply: assign "${s.productName}" to ${totalCategoriesForRow} categor${totalCategoriesForRow === 1 ? 'y' : 'ies'} (primary: "${targetCategory?.name ?? 'selected'}"). The system will learn from your choice.`
                  : `You changed the suggestion. On Apply: move "${s.productName}" from "${currentCategory?.name ?? 'Uncategorised'}" to "${targetCategory?.name ?? 'selected category'}". The system will learn this correction.`
                : isSameCategory
                  ? `The system thinks "${s.productName}" is already in the right category. Applying will not change anything.`
                  : `On Apply: move "${s.productName}" from "${currentCategory?.name ?? 'Uncategorised'}" to "${targetCategory?.name ?? s.suggestedCategoryName}".`

              return (
                <tr
                  key={s.productId}
                  className={`admin-smart-categorise-tr${isOverridden ? ' admin-smart-categorise-tr--overridden' : ''}${isSameCategory ? ' admin-smart-categorise-tr--noop' : ''}`}
                  title={rowTooltip}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.productId)}
                      onChange={() => toggleOne(s)}
                      aria-label={`Select ${s.productName}`}
                    />
                  </td>
                  <td>
                    <div className="admin-smart-categorise-product-cell">
                      <div className="admin-smart-categorise-product-tags">
                        {program && (
                          <span
                            className={`admin-program-badge admin-program-badge--${
                              program === CATALOG_PROGRAM.TEALBURY ? 'tealbury' : 'lamtek'
                            }`}
                          >
                            {program === CATALOG_PROGRAM.TEALBURY ? 'Tealbury' : 'Lamtek'}
                          </span>
                        )}
                        {product?.sku && (
                          <span className="admin-smart-categorize-sku" title={`SKU: ${product.sku}`}>
                            {product.sku}
                          </span>
                        )}
                        {isLearned && (
                          <span
                            className="admin-program-badge admin-program-badge--learned"
                            title={`This suggestion was reinforced by ${Math.round(s.learningBoost * 25)} prior correction(s) on similar products.`}
                          >
                            Learnt
                          </span>
                        )}
                      </div>
                      <div className="admin-smart-categorise-product-name" title={s.productName}>
                        {s.productName}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-smart-categorize-pill admin-smart-categorize-pill--current${
                        !currentCategory ? ' admin-smart-categorize-pill--empty' : ''
                      }`}
                      title={
                        currentCategory
                          ? `Current category: ${currentCategory.name}`
                          : 'This product has no category assigned yet.'
                      }
                    >
                      {currentCategory ? currentCategory.name : 'Uncategorised'}
                    </span>
                  </td>
                  <td className="admin-smart-categorise-arrow-cell" aria-hidden="true">
                    →
                  </td>
                  <td>
                    <div
                      className={`admin-smart-categorize-target-wrap${
                        isOverridden ? ' admin-smart-categorize-target-wrap--overridden' : ''
                      }${isSameCategory ? ' admin-smart-categorize-target-wrap--noop' : ''}`}
                    >
                      <div className="admin-smart-categorize-target-primary">
                        <span
                          className="admin-smart-categorize-primary-tag"
                          title="Primary category — this is the main bucket the product will sit in."
                        >
                          Primary
                        </span>
                        <select
                          className="admin-smart-categorize-target-select"
                          value={primaryId}
                          onChange={(e) => {
                            const nextId = e.target.value
                            if (nextId === s.suggestedCategoryId) clearPrimaryOverride(s.productId)
                            else setPrimaryOverride(s.productId, nextId)
                          }}
                          aria-label="Change primary category"
                          title={
                            isPrimaryOverridden
                              ? 'You have overridden the primary suggestion. Choose another, or click Reset to go back.'
                              : "Click to override the system's suggested primary category"
                          }
                        >
                          {!overrideCategoryOptions.some((c) => c.id === s.suggestedCategoryId) && (
                            <option value={s.suggestedCategoryId}>
                              {s.suggestedCategoryName} (suggested)
                            </option>
                          )}
                          {overrideCategoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id === s.suggestedCategoryId ? `${c.name} (suggested)` : c.name}
                            </option>
                          ))}
                        </select>
                        {isPrimaryOverridden && (
                          <button
                            type="button"
                            className="admin-link-button"
                            onClick={() => clearPrimaryOverride(s.productId)}
                            title="Reset to the original suggestion"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="admin-smart-categorize-extras">
                        {additionalIds.map((id) => {
                          const extra = categoryById.get(id)
                          if (!extra) return null
                          return (
                            <span
                              key={id}
                              className="admin-smart-categorize-extra-chip"
                              title={`Also assign to ${extra.name}. Click × to remove.`}
                            >
                              {extra.name}
                              <button
                                type="button"
                                className="admin-smart-categorize-extra-remove"
                                onClick={() => removeAdditionalCategory(s.productId, id)}
                                aria-label={`Remove ${extra.name} from extra categories`}
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                        <select
                          className="admin-smart-categorize-extra-add"
                          value=""
                          onChange={(e) => {
                            const id = e.target.value
                            if (id) addAdditionalCategory(s.productId, id, s.suggestedCategoryId)
                            // Reset to placeholder after picking so the select stays usable.
                            e.target.value = ''
                          }}
                          title="Add another category — the product will appear in the primary plus all extras."
                          aria-label="Add another category"
                        >
                          <option value="">+ Add another…</option>
                          {overrideCategoryOptions
                            .filter(
                              (c) =>
                                c.id !== primaryId && !additionalIds.includes(c.id),
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {isSameCategory && !hasExtras && (
                        <span
                          className="admin-smart-categorize-noop"
                          title="This row will not change anything because the suggested category is the same as the current one."
                        >
                          no change
                        </span>
                      )}
                      {hasExtras && (
                        <span
                          className="admin-smart-categorize-multi-note"
                          title={`This product will be assigned to ${totalCategoriesForRow} categories: 1 primary + ${additionalIds.length} extra.`}
                        >
                          {totalCategoriesForRow} categor{totalCategoriesForRow === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--${s.confidence}`}
                      title={`${settings.bands[s.confidence].description}\n\nMatch score: ${Math.round(
                        s.score * 100,
                      )}%`}
                    >
                      {settings.bands[s.confidence].label || s.confidence}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

            <ListPager
        totalItems={suggestionTotal}
        totalPages={totalPages}
        currentPage={currentPage}
        pageSize={pageSize}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPageChange={goToPage}
        onPageSizeChange={setPageSize}
        disabled={applying}
        itemLabel={suggestionTotal === 1 ? 'suggestion' : 'suggestions'}
        ariaLabel="Suggestion pages"
      />

            {/* Sticky action bar — pinned to the bottom of the viewport so Apply is always
                reachable, no matter how many suggestions are on screen. Becomes "armed" (highlighted)
                the moment the user has something selected. */}
            <div
              className={`admin-smart-categorise-actions admin-smart-categorise-actions--sticky${
                selectedSuggestions.length > 0 ? ' admin-smart-categorise-actions--armed' : ''
              }`}
            >
        <Link to="/admin/catalogue" className="btn btn-outline">
          Back to catalogue
        </Link>
        <span className="admin-smart-categorise-actions-summary">
          {selectedSuggestions.length === 0 ? (
            <span className="admin-muted">Tick rows to enable apply</span>
          ) : (
            <>
              <strong>{selectedSuggestions.length}</strong> row
              {selectedSuggestions.length === 1 ? '' : 's'} selected
            </>
          )}
        </span>
        <button
          type="button"
          className="btn"
          disabled={applying || selectedSuggestions.length === 0}
          onClick={() => void applySelected()}
        >
          {applying
            ? 'Applying…'
            : selectedSuggestions.length === 0
              ? 'Apply selected'
              : `Apply ${selectedSuggestions.length} categorisation${selectedSuggestions.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History tab
// ---------------------------------------------------------------------------

function HistoryTab({
  history,
  categoryById,
  userStopWords,
  ambiguousThreshold,
  onChange,
  setResult,
}: {
  history: LearningRow[]
  categoryById: Map<string, CategoryRow>
  userStopWords: string[]
  ambiguousThreshold: number
  onChange: () => Promise<void>
  setResult: (r: ResultInfo) => void
}) {
  const [resetting, setResetting] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [showAmbiguousOnly, setShowAmbiguousOnly] = useState(false)
  const [newStopWord, setNewStopWord] = useState('')
  const [pruneWeight, setPruneWeight] = useState(1)

  const builtInStopWords = useMemo(() => listBuiltInStopWords(), [])

  // How many distinct categories has each token been learned against?
  // Tokens with 2+ categories are "ambiguous" (likely too generic, e.g. "18mm").
  const tokenCategoryCount = useMemo(() => {
    const counts = new Map<string, number>()
    const seen = new Map<string, Set<string>>()
    for (const row of history) {
      const set = seen.get(row.token) ?? new Set<string>()
      set.add(row.category_id)
      seen.set(row.token, set)
    }
    for (const [token, set] of seen) counts.set(token, set.size)
    return counts
  }, [history])

  const ambiguousTokens = useMemo(() => {
    const list: { token: string; categories: number; totalWeight: number }[] = []
    const totalsByToken = new Map<string, number>()
    for (const row of history) {
      totalsByToken.set(row.token, (totalsByToken.get(row.token) ?? 0) + (row.weight ?? 0))
    }
    for (const [token, categories] of tokenCategoryCount) {
      if (categories >= ambiguousThreshold)
        list.push({ token, categories, totalWeight: totalsByToken.get(token) ?? 0 })
    }
    return list.sort(
      (a, b) => b.categories - a.categories || b.totalWeight - a.totalWeight || a.token.localeCompare(b.token),
    )
  }, [history, tokenCategoryCount, ambiguousThreshold])

  const byCategory = useMemo(() => {
    const map = new Map<string, LearningRow[]>()
    for (const row of history) {
      if (filter && !row.token.toLowerCase().includes(filter.trim().toLowerCase())) continue
      if (
        showAmbiguousOnly &&
        (tokenCategoryCount.get(row.token) ?? 0) < ambiguousThreshold
      )
        continue
      const bucket = map.get(row.category_id) ?? []
      bucket.push(row)
      map.set(row.category_id, bucket)
    }
    return [...map.entries()]
      .map(([categoryId, rows]) => ({
        categoryId,
        rows: rows.sort((a, b) => b.weight - a.weight),
        totalWeight: rows.reduce((acc, r) => acc + (r.weight ?? 0), 0),
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight)
  }, [history, filter, showAmbiguousOnly, tokenCategoryCount, ambiguousThreshold])

  async function reset() {
    if (
      !window.confirm(
        'Wipe all learning? The system will forget every correction it has been taught so far. This cannot be undone.',
      )
    )
      return
    setResetting(true)
    try {
      const { deleted, error } = await resetSmartCategoryLearning()
      setResult({
        tone: error ? 'error' : 'success',
        title: error ? 'Could not reset learning' : 'Learning reset',
        lines: error
          ? []
          : [
              deleted === 0
                ? 'Nothing was stored — there was nothing to delete.'
                : `Removed ${deleted} learned token mapping${deleted === 1 ? '' : 's'}.`,
            ],
        errors: error ? [error] : [],
      })
      await onChange()
    } finally {
      setResetting(false)
    }
  }

  async function nudgeWeight(row: LearningRow, delta: number) {
    const key = `weight:${row.token}:${row.category_id}`
    setBusyKey(key)
    try {
      const next = Math.max(0, (row.weight ?? 0) + delta)
      const { error } = await setSmartCategoryWeight(row.token, row.category_id, next)
      if (error) {
        setResult({ tone: 'error', title: 'Could not update weight', lines: [], errors: [error] })
      }
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  async function deleteToken(row: LearningRow) {
    const key = `delete:${row.token}:${row.category_id}`
    setBusyKey(key)
    try {
      const { error } = await deleteSmartCategoryToken(row.token, row.category_id)
      if (error) {
        setResult({ tone: 'error', title: 'Could not delete token', lines: [], errors: [error] })
      }
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  async function ignoreEverywhere(token: string) {
    if (
      !window.confirm(
        `Ignore "${token}" everywhere? This removes every learned row for this token AND adds it to the ignore list so it won't be learned again. You can remove it from the ignore list later.`,
      )
    )
      return
    const key = `ignore:${token}`
    setBusyKey(key)
    try {
      const [{ deleted, error: delError }, { error: stopError }] = await Promise.all([
        deleteSmartCategoryTokenEverywhere(token),
        addUserSmartStopWord(token),
      ])
      const errors = [delError, stopError].filter((e): e is string => Boolean(e))
      setResult({
        tone: errors.length ? 'error' : 'success',
        title: errors.length ? 'Could not ignore everywhere' : `Ignoring "${token}"`,
        lines: errors.length
          ? []
          : [
              `Removed ${deleted} learned row${deleted === 1 ? '' : 's'} for "${token}".`,
              `Added "${token}" to the ignore list — future training will skip it.`,
            ],
        errors,
      })
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  async function addStopWordSubmit() {
    const raw = newStopWord.trim().toLowerCase()
    if (!raw) return
    const key = `add-stop:${raw}`
    setBusyKey(key)
    try {
      const { error } = await addUserSmartStopWord(raw)
      if (error) {
        setResult({ tone: 'error', title: 'Could not add ignore word', lines: [], errors: [error] })
      } else {
        setNewStopWord('')
      }
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  async function removeStopWord(token: string) {
    const key = `rm-stop:${token}`
    setBusyKey(key)
    try {
      const { error } = await removeUserSmartStopWord(token)
      if (error) {
        setResult({ tone: 'error', title: 'Could not remove ignore word', lines: [], errors: [error] })
      }
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  // Bulk: ignore every ambiguous token (learned for ≥ threshold categories) in one shot.
  // Each token is deleted from every category's learning AND added to the user ignore list.
  async function ignoreAllAmbiguous() {
    if (ambiguousTokens.length === 0) return
    if (
      !window.confirm(
        `Ignore all ${ambiguousTokens.length} ambiguous tokens (learned in ${ambiguousThreshold}+ categories)? They will be removed from every category's learning AND added to the ignore list so they can't be re-learned. This cannot be undone.`,
      )
    )
      return
    const key = 'bulk-ignore-ambig'
    setBusyKey(key)
    try {
      let removedRows = 0
      const errors: string[] = []
      for (const a of ambiguousTokens) {
        const [{ deleted, error: delError }, { error: stopError }] = await Promise.all([
          deleteSmartCategoryTokenEverywhere(a.token),
          addUserSmartStopWord(a.token),
        ])
        removedRows += deleted
        if (delError) errors.push(`${a.token}: ${delError}`)
        if (stopError) errors.push(`${a.token} (ignore list): ${stopError}`)
      }
      setResult({
        tone: errors.length ? (removedRows > 0 ? 'mixed' : 'error') : 'success',
        title: errors.length ? 'Ignore all ambiguous — partial' : 'Ambiguous tokens cleaned',
        lines: [
          `Cleaned ${ambiguousTokens.length} ambiguous token${ambiguousTokens.length === 1 ? '' : 's'}.`,
          `Removed ${removedRows} learned row${removedRows === 1 ? '' : 's'} in total.`,
          `Added ${ambiguousTokens.length} token${ambiguousTokens.length === 1 ? '' : 's'} to the ignore list.`,
        ],
        errors,
      })
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  // Bulk: delete every learned row whose weight is ≤ the chosen threshold. Useful after a noisy
  // re-train: prune the long tail of tokens that only landed once or twice so they stop being
  // counted toward scoring at all.
  async function pruneLowWeight() {
    const cutoff = Math.max(1, Math.floor(pruneWeight))
    const targets = history.filter((r) => (r.weight ?? 0) <= cutoff)
    if (targets.length === 0) {
      setResult({
        tone: 'mixed',
        title: 'Nothing to prune',
        lines: [`No learned rows have weight ≤ ${cutoff}.`],
        errors: [],
      })
      return
    }
    if (
      !window.confirm(
        `Delete ${targets.length} learned row${targets.length === 1 ? '' : 's'} whose weight is ≤ ${cutoff}? This removes only those specific token→category mappings — the ignore list is not touched. This cannot be undone.`,
      )
    )
      return
    const key = 'bulk-prune'
    setBusyKey(key)
    try {
      const errors: string[] = []
      let removed = 0
      for (const row of targets) {
        const { error } = await deleteSmartCategoryToken(row.token, row.category_id)
        if (error) errors.push(`${row.token}: ${error}`)
        else removed += 1
      }
      setResult({
        tone: errors.length ? (removed > 0 ? 'mixed' : 'error') : 'success',
        title: errors.length ? 'Prune — partial' : 'Low-weight rows pruned',
        lines: [
          `Removed ${removed} of ${targets.length} learned row${targets.length === 1 ? '' : 's'} at weight ≤ ${cutoff}.`,
        ],
        errors,
      })
      await onChange()
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="admin-smart-categorise-history">
      <p className="admin-callout admin-callout--info">
        <strong>How to read these cards:</strong> each card lists one category and the tokens that
        have been learned for it. Each token says <em>"when the product name or description contains
        this token, add this weight to the category's score."</em> Use the controls on a chip to fine-tune
        what the system has learnt:
        {' '}<kbd>−</kbd>/<kbd>+</kbd> nudges the weight, <kbd>×</kbd> deletes just that mapping,
        and <strong>Ignore everywhere</strong> removes the token from <em>all</em> categories and adds
        it to the ignore list so it can&apos;t be learned again. Tokens flagged{' '}
        <span className="admin-smart-categorise-ambig-pill admin-smart-categorise-ambig-pill--inline">ambiguous</span>{' '}
        have been learned against 2+ categories — they&apos;re probably too generic (e.g.{' '}
        <code>18mm</code>, <code>oak</code>) and worth cleaning up.
      </p>

      {ambiguousTokens.length > 0 && (
        <section className="card admin-smart-categorise-ambig-panel">
          <header className="admin-smart-categorise-ambig-header">
            <h3>
              <span className="admin-smart-categorise-ambig-pill">ambiguous</span> tokens (
              {ambiguousTokens.length})
            </h3>
            <p className="admin-muted">
              These tokens were learned for {ambiguousThreshold}+ different categories (configurable
              under <em>Settings → Heuristic</em>). They probably shouldn&apos;t influence scoring —
              clean them up with <strong>Ignore everywhere</strong>, or use the toolbar&apos;s{' '}
              <strong>Ignore all ambiguous</strong> shortcut.
            </p>
          </header>
          <ul className="admin-smart-categorise-ambig-list">
            {ambiguousTokens.slice(0, 30).map((a) => (
              <li key={a.token}>
                <span className="admin-smart-categorise-token">{a.token}</span>
                <span className="admin-muted">
                  · learned in {a.categories} categories · total weight {a.totalWeight}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-xsmall"
                  disabled={busyKey === `ignore:${a.token}`}
                  onClick={() => void ignoreEverywhere(a.token)}
                  title={`Remove "${a.token}" from every category's learning AND add it to the ignore list`}
                >
                  {busyKey === `ignore:${a.token}` ? 'Ignoring…' : 'Ignore everywhere'}
                </button>
              </li>
            ))}
            {ambiguousTokens.length > 30 && (
              <li className="admin-muted">…and {ambiguousTokens.length - 30} more</li>
            )}
          </ul>
        </section>
      )}

      <div className="admin-smart-categorise-history-actions">
        <label className="admin-inline-field">
          <span>Filter tokens</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="e.g. 18mm, oak…"
          />
        </label>
        <label className="admin-check-row">
          <input
            type="checkbox"
            checked={showAmbiguousOnly}
            onChange={(e) => setShowAmbiguousOnly(e.target.checked)}
          />
          Show ambiguous only
        </label>
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={busyKey === 'bulk-ignore-ambig' || ambiguousTokens.length === 0}
          onClick={() => void ignoreAllAmbiguous()}
          title={`Ignore every token currently learned in ${ambiguousThreshold}+ categories`}
        >
          {busyKey === 'bulk-ignore-ambig'
            ? 'Ignoring…'
            : `Ignore all ambiguous (${ambiguousTokens.length})`}
        </button>
        <label className="admin-inline-field">
          <span>Prune at weight ≤</span>
          <input
            type="number"
            min={1}
            max={9}
            value={pruneWeight}
            onChange={(e) => setPruneWeight(Math.max(1, Math.min(9, Number(e.target.value) || 1)))}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={busyKey === 'bulk-prune' || history.length === 0}
          onClick={() => void pruneLowWeight()}
          title={`Delete every learned row with weight ≤ ${pruneWeight}`}
        >
          {busyKey === 'bulk-prune' ? 'Pruning…' : 'Prune low-weight rows'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-small admin-danger"
          disabled={resetting || history.length === 0}
          onClick={() => void reset()}
          title="Wipe everything the smart categorise tool has been taught"
        >
          {resetting ? 'Resetting…' : 'Reset all learning'}
        </button>
      </div>

      {byCategory.length === 0 ? (
        <p className="admin-muted">
          {history.length === 0
            ? 'No learning recorded yet. Apply some suggestions on the Suggestions tab and the system will start remembering which words map to which category.'
            : 'No tokens match your filter.'}
        </p>
      ) : (
        <ul className="admin-smart-categorise-history-list">
          {byCategory.map((group) => {
            const category = categoryById.get(group.categoryId)
            return (
              <li key={group.categoryId} className="card admin-smart-categorise-history-group">
                <header>
                  <h3>
                    {category?.name ?? 'Unknown category'}
                    <span className="admin-muted">
                      {' '}· {group.rows.length} token{group.rows.length === 1 ? '' : 's'} · total weight {group.totalWeight}
                    </span>
                  </h3>
                  <p className="admin-muted admin-smart-categorise-card-hint">
                    When a product&apos;s name/description contains any of these tokens, the system
                    adds the chip&apos;s weight to <strong>{category?.name ?? 'this category'}</strong>&apos;s
                    score during ranking.
                  </p>
                </header>
                <ul className="admin-smart-categorise-history-tokens">
                  {group.rows.map((row) => {
                    const ambiguous =
                      (tokenCategoryCount.get(row.token) ?? 0) >= ambiguousThreshold
                    return (
                      <li
                        key={`${row.token}-${row.category_id}`}
                        className={`admin-smart-categorise-token-chip${
                          ambiguous ? ' admin-smart-categorise-token-chip--ambig' : ''
                        }`}
                        title={
                          row.last_learned_at
                            ? `Last reinforced ${new Date(row.last_learned_at).toLocaleString()}${
                                ambiguous
                                  ? `\n\nAmbiguous: this token has been learned for ${tokenCategoryCount.get(row.token)} categories.`
                                  : ''
                              }`
                            : 'Learned'
                        }
                      >
                        <span className="admin-smart-categorise-token">{row.token}</span>
                        {ambiguous && (
                          <span className="admin-smart-categorise-ambig-pill" aria-label="Ambiguous token">
                            ambig.
                          </span>
                        )}
                        <button
                          type="button"
                          className="admin-smart-categorise-token-nudge"
                          aria-label={`Decrease weight of ${row.token}`}
                          title="Lower the weight (−1)"
                          disabled={busyKey === `weight:${row.token}:${row.category_id}`}
                          onClick={() => void nudgeWeight(row, -1)}
                        >
                          −
                        </button>
                        <span className="admin-smart-categorise-token-weight">×{row.weight}</span>
                        <button
                          type="button"
                          className="admin-smart-categorise-token-nudge"
                          aria-label={`Increase weight of ${row.token}`}
                          title="Raise the weight (+1)"
                          disabled={busyKey === `weight:${row.token}:${row.category_id}`}
                          onClick={() => void nudgeWeight(row, +1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="admin-smart-categorise-token-del"
                          aria-label={`Delete learned mapping ${row.token} → ${category?.name ?? row.category_id}`}
                          title="Delete just this token from this category"
                          disabled={busyKey === `delete:${row.token}:${row.category_id}`}
                          onClick={() => void deleteToken(row)}
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          className="admin-smart-categorise-token-ignore"
                          title={`Remove "${row.token}" from every category and add it to the ignore list`}
                          disabled={busyKey === `ignore:${row.token}`}
                          onClick={() => void ignoreEverywhere(row.token)}
                        >
                          Ignore everywhere
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      <section className="card admin-smart-categorise-stop-panel">
        <header>
          <h3>Ignore list</h3>
          <p className="admin-muted">
            Tokens in this list are skipped by the smart categoriser when scoring AND when learning.
            The system ships with a built-in list of very generic words. Add your own (e.g. <code>18mm</code>,
            common dimensions, finishes) to keep learning focused on tokens that actually identify a
            category.
          </p>
        </header>

        <form
          className="admin-smart-categorise-stop-form"
          onSubmit={(e) => {
            e.preventDefault()
            void addStopWordSubmit()
          }}
        >
          <input
            type="text"
            value={newStopWord}
            onChange={(e) => setNewStopWord(e.target.value)}
            placeholder="Add a token to ignore (lowercase)"
            maxLength={64}
            aria-label="New ignore token"
          />
          <button type="submit" className="btn btn-small" disabled={!newStopWord.trim()}>
            Add to ignore list
          </button>
        </form>

        <div className="admin-smart-categorise-stop-groups">
          <div>
            <h4>Your ignore words ({userStopWords.length})</h4>
            {userStopWords.length === 0 ? (
              <p className="admin-muted">None yet. Add one above or use <strong>Ignore everywhere</strong> on any chip.</p>
            ) : (
              <ul className="admin-smart-categorise-stop-list">
                {userStopWords.map((token) => (
                  <li key={token}>
                    <span className="admin-smart-categorise-token">{token}</span>
                    <button
                      type="button"
                      className="admin-smart-categorise-token-del"
                      aria-label={`Remove ${token} from ignore list`}
                      title={`Remove "${token}" from the ignore list — it will be learnable again`}
                      disabled={busyKey === `rm-stop:${token}`}
                      onClick={() => void removeStopWord(token)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4>Built-in ignore words ({builtInStopWords.length})</h4>
            <p className="admin-muted">
              Always skipped. To override (i.e. <em>start</em> learning one of these), edit{' '}
              <code>BUILT_IN_STOP_WORD_SET</code> in <code>src/lib/smartCategoryLearning.ts</code>.
            </p>
            <ul className="admin-smart-categorise-stop-list admin-smart-categorise-stop-list--readonly">
              {builtInStopWords.map((token) => (
                <li key={token}>
                  <span className="admin-smart-categorise-token">{token}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

interface SettingsTabProps {
  categories: CategoryRow[]
  products: ProductRow[]
  /** Learning index — used by the distribution preview to score the catalogue accurately. */
  learning: LearningIndex
  settings: SmartCategorySettings
  onSettingsChanged: (next: SmartCategorySettings) => void
  onChanged: () => Promise<void>
  setResult: (r: ResultInfo) => void
}

function SettingsTab({
  categories,
  products,
  learning,
  settings,
  onSettingsChanged,
  onChanged,
  setResult,
}: SettingsTabProps) {
  const [retraining, setRetraining] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [draft, setDraft] = useState<SmartCategorySettings>(settings)
  const [savingSettings, setSavingSettings] = useState(false)
  const [previewText, setPreviewText] = useState('')

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  )

  const previewTokens = useMemo(() => {
    if (!previewText.trim()) return []
    return learningTokens(previewText)
  }, [previewText])

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const { error, settings: next } = await saveSmartCategorySettings(draft)
      if (error) {
        setResult({ tone: 'error', title: 'Could not save settings', lines: [], errors: [error] })
        return
      }
      onSettingsChanged(next)
      setResult({
        tone: 'success',
        title: 'Settings saved',
        lines: [
          'The new heuristic settings are now in effect for scoring, learning and tokenisation.',
        ],
        errors: [],
      })
    } finally {
      setSavingSettings(false)
    }
  }

  function resetDraftToDefaults() {
    setDraft(DEFAULT_SMART_CATEGORY_SETTINGS)
  }

  async function retrainFromExisting() {
    if (
      !window.confirm(
        `Re-train the system from all ${products.filter((p) => p.category_id).length} currently-categorised products? This adds tokens from each product's name & description to the learning store, weighted +1 per match.`,
      )
    )
      return
    setRetraining(true)
    try {
      let trained = 0
      for (const p of products) {
        if (!p.category_id) continue
        const text = [p.name, p.description, p.sku].filter(Boolean).join(' ')
        await recordSmartCategoryLearning(text, p.category_id)
        trained += 1
      }
      setResult({
        tone: 'success',
        title: 'Re-training complete',
        lines: [
          `Re-trained on ${trained} categorised product${trained === 1 ? '' : 's'}.`,
          `The system will now use these patterns when suggesting categories for similar items.`,
        ],
        errors: [],
      })
      await onChanged()
    } finally {
      setRetraining(false)
    }
  }

  async function reset() {
    if (
      !window.confirm(
        'Wipe all learning? The system will forget every correction it has been taught so far. This cannot be undone.',
      )
    )
      return
    setResetting(true)
    try {
      const { deleted, error } = await resetSmartCategoryLearning()
      setResult({
        tone: error ? 'error' : 'success',
        title: error ? 'Could not reset learning' : 'Learning reset',
        lines: error
          ? []
          : [`Removed ${deleted} learned token mapping${deleted === 1 ? '' : 's'}.`],
        errors: error ? [error] : [],
      })
      await onChanged()
    } finally {
      setResetting(false)
    }
  }

  const categoryCount = categories.length
  const categorisedProducts = products.filter((p) => p.category_id).length
  const uncategorisedProducts = products.length - categorisedProducts

  return (
    <div className="admin-smart-categorise-settings">
      <p className="admin-callout admin-callout--info">
        Tune how the smart categorisation tool scores products, learns from corrections and breaks
        text into tokens. Changes apply globally and take effect immediately after Save.
      </p>

      <form
        className="admin-smart-settings-form"
        onSubmit={(e) => {
          e.preventDefault()
          void saveSettings()
        }}
      >
        <div className="admin-smart-settings-grid">
          {/* ----------- Confidence bands ----------- */}
          <section className="card admin-smart-categorise-setting-card admin-smart-bands-card">
            <h3>Confidence bands</h3>
            <p className="admin-muted">
              Each suggestion gets a final score from <code>0.0</code> to <code>1.0</code>. Below{' '}
              <strong>min score</strong> the suggestion is dropped entirely. The three bands below
              let you label, document and gate the rest however your team works.
            </p>

            <label className="admin-smart-settings-field admin-smart-bands-minscore">
              <span className="admin-smart-settings-label">
                Min score <small>(suggestions below this are not returned)</small>
              </span>
              <div className="admin-smart-settings-slider-row">
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  value={draft.minScore}
                  onChange={(e) => setDraft((d) => ({ ...d, minScore: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  value={draft.minScore}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      minScore: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                    }))
                  }
                  className="admin-smart-settings-num"
                />
              </div>
            </label>

            <ul className="admin-smart-bands-list">
              {(
                [
                  {
                    key: 'low' as const,
                    title: 'Low band',
                    badgeClass: 'admin-badge--low',
                    threshold: draft.minScore,
                    nextThreshold: draft.mediumThreshold,
                    hint: 'Score from min-score up to (but not including) the medium threshold.',
                    onThresholdChange: undefined,
                  },
                  {
                    key: 'medium' as const,
                    title: 'Medium band',
                    badgeClass: 'admin-badge--medium',
                    threshold: draft.mediumThreshold,
                    nextThreshold: draft.highThreshold,
                    hint: 'Score ≥ the medium threshold and below the high threshold.',
                    onThresholdChange: (n: number) =>
                      setDraft((d) => ({ ...d, mediumThreshold: n })),
                  },
                  {
                    key: 'high' as const,
                    title: 'High band',
                    badgeClass: 'admin-badge--high',
                    threshold: draft.highThreshold,
                    nextThreshold: 1,
                    hint: 'Score ≥ the high threshold (top of the scale, 1.0).',
                    onThresholdChange: (n: number) =>
                      setDraft((d) => ({ ...d, highThreshold: n })),
                  },
                ] as const
              ).map((b) => {
                const cfg = draft.bands[b.key]
                return (
                  <li key={b.key} className={`admin-smart-band-row admin-smart-band-row--${b.key}`}>
                    <header className="admin-smart-band-row-head">
                      <span className={`admin-badge ${b.badgeClass}`}>{cfg.label || b.key}</span>
                      <strong className="admin-smart-band-row-title">{b.title}</strong>
                      <span className="admin-muted admin-smart-band-row-range">
                        {b.threshold.toFixed(2)} –{' '}
                        {b.nextThreshold === 1 ? '1.00' : `<${b.nextThreshold.toFixed(2)}`}
                      </span>
                    </header>

                    <div className="admin-smart-band-row-grid">
                      <label className="admin-smart-settings-field">
                        <span className="admin-smart-settings-label">
                          Label <small>(text shown on the chip)</small>
                        </span>
                        <input
                          type="text"
                          maxLength={32}
                          value={cfg.label}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              bands: {
                                ...d.bands,
                                [b.key]: { ...d.bands[b.key], label: e.target.value },
                              },
                            }))
                          }
                          placeholder={b.key}
                        />
                      </label>

                      {b.onThresholdChange ? (
                        <label className="admin-smart-settings-field">
                          <span className="admin-smart-settings-label">
                            Threshold{' '}
                            <small>
                              (score ≥ this → <strong>{cfg.label || b.key}</strong>)
                            </small>
                          </span>
                          <div className="admin-smart-settings-slider-row">
                            <input
                              type="range"
                              min={0.1}
                              max={0.99}
                              step={0.01}
                              value={b.threshold}
                              onChange={(e) => b.onThresholdChange?.(Number(e.target.value))}
                            />
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={b.threshold}
                              onChange={(e) =>
                                b.onThresholdChange?.(
                                  Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                                )
                              }
                              className="admin-smart-settings-num"
                            />
                          </div>
                        </label>
                      ) : (
                        <div className="admin-smart-band-row-rangefixed">
                          <span className="admin-smart-settings-label">
                            Range start <small>(matches min score above)</small>
                          </span>
                          <p className="admin-muted admin-smart-band-row-rangenote">{b.hint}</p>
                        </div>
                      )}

                      <label className="admin-smart-settings-field admin-smart-band-row-desc">
                        <span className="admin-smart-settings-label">
                          Description <small>(tooltip + reviewer guidance)</small>
                        </span>
                        <textarea
                          rows={2}
                          maxLength={240}
                          value={cfg.description}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              bands: {
                                ...d.bands,
                                [b.key]: { ...d.bands[b.key], description: e.target.value },
                              },
                            }))
                          }
                          placeholder={`What '${cfg.label || b.key}' means in your workflow`}
                        />
                      </label>

                      <label className="admin-check-row admin-smart-band-row-auto">
                        <input
                          type="checkbox"
                          checked={cfg.autoApply}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              bands: {
                                ...d.bands,
                                [b.key]: { ...d.bands[b.key], autoApply: e.target.checked },
                              },
                            }))
                          }
                        />
                        <span>
                          <strong>Include in bulk-apply</strong>{' '}
                          <small className="admin-muted">
                            — when on, future <em>Apply confident</em> shortcuts may include this
                            band.
                          </small>
                        </span>
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Live distribution preview — see <DistributionPreview/> below */}
            <DistributionPreview
              draft={draft}
              products={products}
              categories={categories}
              learning={learning}
            />

            {draft.minScore > draft.mediumThreshold ||
            draft.mediumThreshold > draft.highThreshold ? (
              <p className="admin-callout admin-callout--warn">
                Thresholds will be auto-clamped on save so that min ≤ medium ≤ high.
              </p>
            ) : null}
          </section>

          {/* ----------- Tokenisation ----------- */}
          <section className="card admin-smart-categorise-setting-card">
            <h3>Tokenisation</h3>
            <p className="admin-muted">
              How product names + descriptions are broken into tokens for learning and matching.
              Stricter rules = fewer noisy tokens like <code>18mm</code>.
            </p>

            <label className="admin-smart-settings-field">
              <span className="admin-smart-settings-label">
                Min token length <small>(tokens shorter than this are dropped)</small>
              </span>
              <input
                type="number"
                min={1}
                max={12}
                value={draft.minTokenLength}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    minTokenLength: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                  }))
                }
              />
            </label>

            <label className="admin-smart-settings-field">
              <span className="admin-smart-settings-label">
                Ignore short numeric tokens shorter than{' '}
                <small>(0 = disabled · 5 catches "18mm", "910mm")</small>
              </span>
              <input
                type="number"
                min={0}
                max={12}
                value={draft.ignoreShortNumericBelow}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    ignoreShortNumericBelow: Math.max(0, Math.min(12, Number(e.target.value) || 0)),
                  }))
                }
              />
            </label>

            <label className="admin-smart-settings-field">
              <span className="admin-smart-settings-label">
                Auto-ambiguous threshold{' '}
                <small>(token learned in this many categories = flagged + bulk-cleanable)</small>
              </span>
              <input
                type="number"
                min={2}
                max={20}
                value={draft.autoAmbiguousThreshold}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    autoAmbiguousThreshold: Math.max(2, Math.min(20, Number(e.target.value) || 2)),
                  }))
                }
              />
            </label>
          </section>

          {/* ----------- Learning behaviour ----------- */}
          <section className="card admin-smart-categorise-setting-card">
            <h3>Learning behaviour</h3>
            <p className="admin-muted">
              How learned corrections influence scoring. Turn either switch off to freeze behaviour
              while you tune (e.g. to compare suggestions without/with learning).
            </p>

            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={draft.learningEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, learningEnabled: e.target.checked }))}
              />
              <span>
                <strong>Record corrections</strong>{' '}
                <small className="admin-muted">— when off, new "Apply" actions don&apos;t update the learning store.</small>
              </span>
            </label>

            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={draft.boostEnabled}
                onChange={(e) => setDraft((d) => ({ ...d, boostEnabled: e.target.checked }))}
              />
              <span>
                <strong>Use learning to boost scoring</strong>{' '}
                <small className="admin-muted">— when off, suggestions are based on name overlap only.</small>
              </span>
            </label>

            <label className="admin-smart-settings-field">
              <span className="admin-smart-settings-label">
                Boost per learned weight{' '}
                <small>(score points added per learned weight unit)</small>
              </span>
              <div className="admin-smart-settings-slider-row">
                <input
                  type="range"
                  min={0.005}
                  max={0.2}
                  step={0.005}
                  value={draft.learningBoostPerWeight}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      learningBoostPerWeight: Number(e.target.value),
                    }))
                  }
                />
                <span className="admin-smart-settings-value">
                  {draft.learningBoostPerWeight.toFixed(3)}
                </span>
              </div>
            </label>

            <label className="admin-smart-settings-field">
              <span className="admin-smart-settings-label">
                Boost cap <small>(maximum total boost from learning per category)</small>
              </span>
              <div className="admin-smart-settings-slider-row">
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  value={draft.learningBoostCap}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, learningBoostCap: Number(e.target.value) }))
                  }
                />
                <span className="admin-smart-settings-value">
                  {draft.learningBoostCap.toFixed(2)}
                </span>
              </div>
            </label>
          </section>
        </div>

        <div className="admin-smart-settings-form-actions">
          <button
            type="submit"
            className="btn"
            disabled={!dirty || savingSettings}
            title={dirty ? 'Save settings' : 'No changes to save'}
          >
            {savingSettings ? 'Saving…' : dirty ? 'Save settings' : 'Saved'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            disabled={savingSettings}
            onClick={() => setDraft(settings)}
          >
            Discard changes
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            disabled={savingSettings}
            onClick={resetDraftToDefaults}
            title="Reset every knob on this page to the factory default"
          >
            Reset to factory defaults
          </button>
        </div>
      </form>

      <div className="admin-smart-categorise-settings-grid">
        {/* ----------- Diagnostics / token preview ----------- */}
        <section className="card admin-smart-categorise-setting-card admin-smart-settings-diagnostics">
          <h3>Token preview</h3>
          <p className="admin-muted">
            Paste a product name (or name + description) below to see exactly which tokens the
            current settings would learn or score against. Useful for verifying tokenisation rules
            after you tweak the knobs above.
          </p>
          <textarea
            className="admin-smart-settings-diag-input"
            rows={3}
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder='e.g. "B100 — 1000mm — Base Unit · Standard Base Units"'
          />
          {previewTokens.length > 0 ? (
            <>
              <p className="admin-muted admin-smart-settings-diag-summary">
                <strong>{previewTokens.length}</strong> token
                {previewTokens.length === 1 ? '' : 's'} would be considered for learning + scoring:
              </p>
              <ul className="admin-smart-categorise-history-tokens admin-smart-settings-diag-tokens">
                {previewTokens.map((t) => (
                  <li key={t} className="admin-smart-categorise-token-chip">
                    <span className="admin-smart-categorise-token">{t}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : previewText.trim() ? (
            <p className="admin-callout admin-callout--warn">
              Every token in this text was dropped by the current rules (likely too short, in the
              ignore list, or matched the short-numeric rule). Try lowering the min token length.
            </p>
          ) : null}
        </section>

        {/* ----------- Catalogue stats ----------- */}
        <section className="card admin-smart-categorise-setting-card">
          <h3>Catalogue overview</h3>
          <dl className="admin-smart-categorise-stats-grid">
            <dt>Categories</dt>
            <dd>{categoryCount}</dd>
            <dt>Categorised products</dt>
            <dd>
              {categorisedProducts}{' '}
              <span className="admin-muted">
                ({Math.round((categorisedProducts / Math.max(1, products.length)) * 100)}%)
              </span>
            </dd>
            <dt>Uncategorised products</dt>
            <dd>{uncategorisedProducts}</dd>
          </dl>
        </section>

        {/* ----------- Heavy actions ----------- */}
        <section className="card admin-smart-categorise-setting-card">
          <h3>Re-train &amp; reset</h3>
          <p className="admin-muted">
            The system gets better the more you use it. Each accepted or overridden suggestion adds{' '}
            <code>+1</code> to the weight of every meaningful token in the product name against the
            chosen category. Use these tools to rebuild or wipe that knowledge.
          </p>
          <div className="admin-smart-categorise-actions admin-smart-categorise-actions--inline">
            <button
              type="button"
              className="btn btn-outline btn-small"
              disabled={retraining}
              onClick={() => void retrainFromExisting()}
              title="Walk every already-categorised product and add tokens to the learning store"
            >
              {retraining
                ? 'Re-training…'
                : `Re-train from ${categorisedProducts} categorised product${
                    categorisedProducts === 1 ? '' : 's'
                  }`}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small admin-danger"
              disabled={resetting}
              onClick={() => void reset()}
              title="Wipe everything the smart categorise tool has been taught"
            >
              {resetting ? 'Resetting…' : 'Reset all learning'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Distribution preview — used by SettingsTab to visualise band carve-up
// ---------------------------------------------------------------------------

/**
 * Renders a live preview of how the draft thresholds + min-score would carve up
 * the current catalogue. We call the same `buildSmartCategorizationSuggestions`
 * the Suggestions tab uses, then bucket the resulting scores against the *draft*
 * thresholds (not the persisted ones) so the admin can see the impact before
 * Save. Products that wouldn't be suggested at all (no signal, or already in
 * the right place) are reported as "no change".
 */
function DistributionPreview({
  draft,
  products,
  categories,
  learning,
}: {
  draft: SmartCategorySettings
  products: ProductRow[]
  categories: CategoryRow[]
  learning: LearningIndex
}) {
  // Compute raw scores once; recompute only when products/categories/learning change.
  // Bucketing then becomes a cheap synchronous threshold compare on every slider drag.
  const rawScores = useMemo(() => {
    const sugs = buildSmartCategorizationSuggestions(products, categories, learning)
    return sugs.map((s) => s.score)
  }, [products, categories, learning])

  const distribution = useMemo(() => {
    let low = 0
    let medium = 0
    let high = 0
    let belowMin = 0
    for (const s of rawScores) {
      if (s < draft.minScore) belowMin += 1
      else if (s >= draft.highThreshold) high += 1
      else if (s >= draft.mediumThreshold) medium += 1
      else low += 1
    }
    const noChange = Math.max(0, products.length - rawScores.length)
    const total = products.length || 1
    return {
      total: products.length,
      noChange,
      belowMin,
      low,
      medium,
      high,
      pct: (n: number) => Math.round((n / total) * 100),
    }
  }, [rawScores, draft.minScore, draft.mediumThreshold, draft.highThreshold, products.length])

  const segments = [
    {
      key: 'high',
      label: draft.bands.high.label || 'High',
      n: distribution.high,
      cls: 'admin-smart-bands-seg--high',
    },
    {
      key: 'medium',
      label: draft.bands.medium.label || 'Medium',
      n: distribution.medium,
      cls: 'admin-smart-bands-seg--medium',
    },
    {
      key: 'low',
      label: draft.bands.low.label || 'Low',
      n: distribution.low,
      cls: 'admin-smart-bands-seg--low',
    },
    { key: 'below', label: 'Dropped', n: distribution.belowMin, cls: 'admin-smart-bands-seg--below' },
    { key: 'noop', label: 'No change', n: distribution.noChange, cls: 'admin-smart-bands-seg--noop' },
  ]

  return (
    <div className="admin-smart-bands-dist">
      <header className="admin-smart-bands-dist-head">
        <h4>Distribution preview</h4>
        <span className="admin-muted">
          With these thresholds, here&apos;s how the {distribution.total} product
          {distribution.total === 1 ? '' : 's'} in the catalogue would be carved up if you ran a
          smart-categorise pass right now.
        </span>
      </header>

      <div
        className="admin-smart-bands-dist-bar"
        role="img"
        aria-label={`Distribution: ${segments
          .filter((s) => s.n > 0)
          .map((s) => `${s.label} ${s.n}`)
          .join(', ')}`}
      >
        {segments.map((s) => {
          const pct = distribution.total > 0 ? (s.n / distribution.total) * 100 : 0
          if (pct <= 0) return null
          return (
            <span
              key={s.key}
              className={`admin-smart-bands-seg ${s.cls}`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.n} (${distribution.pct(s.n)}%)`}
            />
          )
        })}
      </div>

      <ul className="admin-smart-bands-dist-legend">
        {segments.map((s) => (
          <li key={s.key} className={s.cls}>
            <span className="admin-smart-bands-seg-swatch" aria-hidden="true" />
            <span className="admin-smart-bands-seg-label">{s.label}</span>
            <strong className="admin-smart-bands-seg-count">{s.n}</strong>
            <span className="admin-muted">({distribution.pct(s.n)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared result modal
// ---------------------------------------------------------------------------

export function SmartCategoriseResultModal({ info, onClose }: { info: ResultInfo; onClose: () => void }) {
  const icon = info.tone === 'success' ? '✓' : info.tone === 'mixed' ? '!' : '×'
  return (
    // `--top` anchors the result modal to the top of the viewport. Without it the modal centred
    // and on long Suggestions screens it ended up below the fold — users missed the confirmation.
    <div
      className="admin-modal-overlay admin-modal-overlay--nested admin-modal-overlay--top"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="smart-cat-result-title"
    >
      <div className={`admin-modal card admin-result-modal admin-result-modal--${info.tone}`}>
        <header className="admin-result-modal-header">
          <span className={`admin-result-icon admin-result-icon--${info.tone}`} aria-hidden="true">
            {icon}
          </span>
          <h3 id="smart-cat-result-title">{info.title}</h3>
        </header>
        <ul className="admin-result-modal-lines">
          {info.lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
        {info.errors.length > 0 && (
          <details className="admin-result-modal-errors" open={info.tone === 'error'}>
            <summary>
              {info.errors.length} error{info.errors.length === 1 ? '' : 's'}
            </summary>
            <ul>
              {info.errors.slice(0, 20).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
              {info.errors.length > 20 && <li>…and {info.errors.length - 20} more.</li>}
            </ul>
          </details>
        )}
        <footer className="admin-result-modal-footer">
          <button type="button" className="btn" onClick={onClose} autoFocus>
            OK
          </button>
        </footer>
      </div>
    </div>
  )
}
