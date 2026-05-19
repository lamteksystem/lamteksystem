/**
 * Dedicated full-page Smart Categorisation tool.
 *
 * Three tabs:
 *   1. Suggestions — review & apply heuristic suggestions, with per-row category override.
 *   2. History — what the system has learnt from previous corrections.
 *   3. Settings — confidence thresholds, default page size, reset learning, retrain.
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
  type SmartCategorySuggestion,
} from '@/lib/smartProductCategorize'
import {
  loadSmartCategoryHistory,
  resetSmartCategoryLearning,
  recordSmartCategoryLearning,
  type LearningIndex,
  type LearningRow,
} from '@/lib/smartCategoryLearning'
import { rebucketTealburyAccessories } from '@/lib/tealburyAccessoryRebucket'
import type { CategoryRow, ProductRow } from '@/types/database'

type Tab = 'suggestions' | 'history' | 'settings'
type ConfidenceLevel = 'low' | 'medium' | 'high'

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low']
const PAGE_SIZE_OPTIONS = [20, 50, 100, 250, 500] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

interface ResultInfo {
  tone: 'success' | 'mixed' | 'error'
  title: string
  lines: string[]
  errors: string[]
}

export default function AdminSmartCategorise() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(tabParam ?? 'suggestions')

  useEffect(() => {
    if (tabParam !== tab) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('tab', tab)
          return next
        },
        { replace: true },
      )
    }
  }, [tab, tabParam, setSearchParams])

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [learning, setLearning] = useState<LearningIndex>(new Map())
  const [history, setHistory] = useState<LearningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ResultInfo | null>(null)

  const refreshLearning = useCallback(async () => {
    const [idx, hist] = await Promise.all([loadSmartCategoryLearning(), loadSmartCategoryHistory()])
    setLearning(idx)
    setHistory(hist)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
    ])
    setProducts((prodData ?? []) as ProductRow[])
    setCategories((catData ?? []) as CategoryRow[])
    await refreshLearning()
    setLoading(false)
  }, [refreshLearning])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    // Scroll to top whenever tabs change so the relevant section is in view.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [tab])

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  return (
    <section className="admin-page admin-smart-categorise-page">
      <header className="admin-page-header admin-smart-categorise-header">
        <div>
          <h1>Smart categorisation</h1>
          <p className="admin-muted">
            Review heuristic suggestions, teach the system the right answers, and track what it has
            learnt over time.{' '}
            <Link to="/admin/catalogue">← Back to catalogue</Link>
          </p>
        </div>
      </header>

      <nav className="admin-tabs admin-smart-categorise-tabs" aria-label="Smart categorisation sections">
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
        {loading ? (
          <p className="admin-muted">Loading catalogue…</p>
        ) : tab === 'suggestions' ? (
          <SuggestionsTab
            products={products}
            categories={categories}
            categoryById={categoryById}
            learning={learning}
            onApplied={async () => {
              await refreshLearning()
              await loadAll()
            }}
            setResult={setResult}
          />
        ) : tab === 'history' ? (
          <HistoryTab history={history} categoryById={categoryById} onChange={refreshLearning} setResult={setResult} />
        ) : (
          <SettingsTab
            categories={categories}
            products={products}
            onChanged={async () => {
              await refreshLearning()
            }}
            setResult={setResult}
          />
        )}
      </div>

      {result && <ResultModal info={result} onClose={() => setResult(null)} />}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Suggestions tab
// ---------------------------------------------------------------------------

function SuggestionsTab({
  products,
  categories,
  categoryById,
  learning,
  onApplied,
  setResult,
}: {
  products: ProductRow[]
  categories: CategoryRow[]
  categoryById: Map<string, CategoryRow>
  learning: LearningIndex
  onApplied: () => Promise<void>
  setResult: (r: ResultInfo) => void
}) {
  const [confidenceFilter, setConfidenceFilter] = useState<Record<ConfidenceLevel, boolean>>({
    high: true,
    medium: true,
    low: false,
  })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map())
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
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

  const totalPages = Math.max(1, Math.ceil(suggestions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const pageSuggestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return suggestions.slice(start, start + pageSize)
  }, [suggestions, currentPage, pageSize])

  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selected.has(s.productId)),
    [suggestions, selected],
  )

  const pageSelectedCount = pageSuggestions.filter((s) => selected.has(s.productId)).length
  const allOnPageSelected = pageSuggestions.length > 0 && pageSelectedCount === pageSuggestions.length

  function toggleConfidence(level: ConfidenceLevel) {
    setConfidenceFilter((prev) => ({ ...prev, [level]: !prev[level] }))
    setPage(1)
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

  function setOverride(productId: string, categoryId: string) {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(productId, categoryId)
      return next
    })
  }

  function clearOverride(productId: string) {
    setOverrides((prev) => {
      if (!prev.has(productId)) return prev
      const next = new Map(prev)
      next.delete(productId)
      return next
    })
  }

  function goToPage(n: number) {
    const clamped = Math.max(1, Math.min(totalPages, Math.floor(n) || 1))
    setPage(clamped)
  }

  async function applySelected() {
    if (selectedSuggestions.length === 0) return
    setApplying(true)
    try {
      const overriddenCount = selectedSuggestions.filter((s) => overrides.has(s.productId)).length
      const { applied, errors } = await applySmartCategorySuggestions(selectedSuggestions, overrides)
      const lines: string[] = [
        `Re-categorised ${applied} product${applied === 1 ? '' : 's'}.`,
        `${selectedSuggestions.length - applied} skipped.`,
      ]
      if (overriddenCount > 0) {
        lines.push(
          `${overriddenCount} used your manual override${overriddenCount === 1 ? '' : 's'} — the system has learnt from those for next time.`,
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
              title={
                level === 'high'
                  ? 'Strong match — the system is very confident'
                  : level === 'medium'
                    ? 'Likely match — review before applying'
                    : 'Weak match — usually needs manual correction'
              }
            >
              <input
                type="checkbox"
                checked={confidenceFilter[level]}
                onChange={() => toggleConfidence(level)}
                disabled={applying}
              />
              <span className={`admin-badge admin-badge--${level}`}>{level}</span>
            </label>
          ))}
        </fieldset>

        <label className="admin-smart-categorise-search">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Product name or SKU"
          />
        </label>

        <label className="admin-smart-categorize-pagesize">
          Per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as PageSize)
              setPage(1)
            }}
            disabled={applying}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
              const targetId = overrides.get(s.productId) ?? s.suggestedCategoryId
              const targetCategory = categoryById.get(targetId)
              const isOverridden = overrides.has(s.productId)
              const isSameCategory = currentCategory?.id === targetId
              const isLearned = s.learningBoost >= 0.04
              const program = product?.catalog_program

              const rowTooltip = isOverridden
                ? `You changed the suggestion. On Apply: move "${s.productName}" from "${currentCategory?.name ?? 'Uncategorised'}" to "${targetCategory?.name ?? 'selected category'}". The system will learn this correction.`
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
                      <select
                        className="admin-smart-categorize-target-select"
                        value={targetId}
                        onChange={(e) => {
                          const next = e.target.value
                          if (next === s.suggestedCategoryId) clearOverride(s.productId)
                          else setOverride(s.productId, next)
                        }}
                        aria-label="Change suggested category"
                        title={
                          isOverridden
                            ? 'You have overridden the suggestion. Choose another, or click Reset to go back.'
                            : 'Click to override the system\'s suggestion'
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
                      {isOverridden && (
                        <button
                          type="button"
                          className="admin-link-button"
                          onClick={() => clearOverride(s.productId)}
                          title="Reset to the original suggestion"
                        >
                          Reset
                        </button>
                      )}
                      {isSameCategory && (
                        <span
                          className="admin-smart-categorize-noop"
                          title="This row will not change anything because the suggested category is the same as the current one."
                        >
                          no change
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-badge admin-badge--${s.confidence}`}
                      title={`Match score: ${Math.round(s.score * 100)}%`}
                    >
                      {s.confidence}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {suggestions.length > pageSize && (
        <div className="admin-smart-categorize-pager" role="navigation" aria-label="Suggestion pages">
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <span className="admin-smart-categorize-page-input">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => goToPage(Number(pageInput))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  goToPage(Number(pageInput))
                }
              }}
              aria-label="Go to page"
            />
            of <strong>{totalPages}</strong>
          </span>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next ›
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            »
          </button>
          <span className="admin-muted admin-smart-categorize-page-range">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, suggestions.length)} of {suggestions.length}
          </span>
        </div>
      )}

      <div className="admin-smart-categorise-actions">
        <Link to="/admin/catalogue" className="btn btn-outline">
          Back to catalogue
        </Link>
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
  onChange,
  setResult,
}: {
  history: LearningRow[]
  categoryById: Map<string, CategoryRow>
  onChange: () => Promise<void>
  setResult: (r: ResultInfo) => void
}) {
  const [resetting, setResetting] = useState(false)

  const byCategory = useMemo(() => {
    const map = new Map<string, LearningRow[]>()
    for (const row of history) {
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
  }, [history])

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

  return (
    <div className="admin-smart-categorise-history">
      <p className="admin-callout admin-callout--info">
        Every time you apply a smart categorisation — or override one — the system records which
        words (tokens) from the product name correlate with which category. Stronger weights mean
        the system is more confident. Below is a snapshot of everything it has learnt so far.
      </p>

      <div className="admin-smart-categorise-history-actions">
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={resetting || history.length === 0}
          onClick={() => void reset()}
          title="Wipe everything the smart categorise tool has been taught"
        >
          {resetting ? 'Resetting…' : 'Reset all learning'}
        </button>
      </div>

      {byCategory.length === 0 ? (
        <p className="admin-muted">
          No learning recorded yet. Apply some suggestions on the <strong>Suggestions</strong> tab and
          the system will start remembering which words map to which category.
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
                </header>
                <ul className="admin-smart-categorise-history-tokens">
                  {group.rows.slice(0, 30).map((row) => (
                    <li
                      key={`${row.token}-${row.category_id}`}
                      title={
                        row.last_learned_at
                          ? `Last reinforced ${new Date(row.last_learned_at).toLocaleString()}`
                          : 'Learned'
                      }
                    >
                      <span className="admin-smart-categorise-token">{row.token}</span>
                      <span className="admin-smart-categorise-token-weight">×{row.weight}</span>
                    </li>
                  ))}
                  {group.rows.length > 30 && (
                    <li className="admin-muted">…and {group.rows.length - 30} more</li>
                  )}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab({
  categories,
  products,
  onChanged,
  setResult,
}: {
  categories: CategoryRow[]
  products: ProductRow[]
  onChanged: () => Promise<void>
  setResult: (r: ResultInfo) => void
}) {
  const [retraining, setRetraining] = useState(false)
  const [resetting, setResetting] = useState(false)

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
        Configure how the smart categorisation tool behaves. Confidence bands are based on a match
        score from <code>0.0</code> to <code>1.0</code> — adjust them only if the defaults give too
        many false positives or miss obvious matches.
      </p>

      <div className="admin-smart-categorise-settings-grid">
        <section className="card admin-smart-categorise-setting-card">
          <h3>Catalogue overview</h3>
          <dl className="admin-smart-categorise-stats-grid">
            <dt>Categories</dt>
            <dd>{categoryCount}</dd>
            <dt>Categorised products</dt>
            <dd>
              {categorisedProducts}{' '}
              <span className="admin-muted">({Math.round((categorisedProducts / Math.max(1, products.length)) * 100)}%)</span>
            </dd>
            <dt>Uncategorised products</dt>
            <dd>{uncategorisedProducts}</dd>
          </dl>
        </section>

        <section className="card admin-smart-categorise-setting-card">
          <h3>Confidence bands</h3>
          <p className="admin-muted">
            These thresholds determine how each suggestion is labelled. They are currently fixed at
            the values below; future versions will let you tune them per program.
          </p>
          <table className="admin-smart-categorise-thresholds">
            <thead>
              <tr>
                <th>Band</th>
                <th>Score ≥</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="admin-badge admin-badge--high">high</span>
                </td>
                <td>0.75</td>
                <td>Strong word/phrase overlap with the category — safe to apply in bulk.</td>
              </tr>
              <tr>
                <td>
                  <span className="admin-badge admin-badge--medium">medium</span>
                </td>
                <td>0.50</td>
                <td>Plausible match — review before applying.</td>
              </tr>
              <tr>
                <td>
                  <span className="admin-badge admin-badge--low">low</span>
                </td>
                <td>0.35</td>
                <td>Weak signal — usually needs manual correction.</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="card admin-smart-categorise-setting-card">
          <h3>Learning</h3>
          <p className="admin-muted">
            The system gets better the more you use it. Each accepted or overridden suggestion adds{' '}
            <code>+1</code> to the weight of every meaningful token in the product name against the
            chosen category.
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
                : `Re-train from ${categorisedProducts} categorised product${categorisedProducts === 1 ? '' : 's'}`}
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
// Shared result modal
// ---------------------------------------------------------------------------

function ResultModal({ info, onClose }: { info: ResultInfo; onClose: () => void }) {
  const icon = info.tone === 'success' ? '✓' : info.tone === 'mixed' ? '!' : '×'
  return (
    <div
      className="admin-modal-overlay admin-modal-overlay--nested"
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
