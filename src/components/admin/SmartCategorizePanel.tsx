import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoryRow, ProductRow } from '@/types/database'
import {
  applySmartCategorySuggestions,
  buildSmartCategorizationSuggestions,
  syncInferredCategoryKinds,
  type SmartCategorySuggestion,
} from '@/lib/smartProductCategorize'
import { rebucketTealburyAccessories } from '@/lib/tealburyAccessoryRebucket'

interface SmartCategorizePanelProps {
  products: ProductRow[]
  categories: CategoryRow[]
  onApplied: () => void
  onClose: () => void
}

interface ResultInfo {
  tone: 'success' | 'mixed' | 'error'
  title: string
  lines: string[]
  errors: string[]
}

const PAGE_SIZE = 50

export default function SmartCategorizePanel({
  products,
  categories,
  onApplied,
  onClose,
}: SmartCategorizePanelProps) {
  const [minConfidence, setMinConfidence] = useState<'medium' | 'high'>('medium')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [syncingKinds, setSyncingKinds] = useState(false)
  const [rebucketing, setRebucketing] = useState(false)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [result, setResult] = useState<ResultInfo | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    modalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const suggestions = useMemo(() => {
    const all = buildSmartCategorizationSuggestions(products, categories)
    if (minConfidence === 'high') return all.filter((s) => s.confidence === 'high')
    return all.filter((s) => s.confidence === 'high' || s.confidence === 'medium')
  }, [products, categories, minConfidence])

  const totalPages = Math.max(1, Math.ceil(suggestions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const pageSuggestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return suggestions.slice(start, start + PAGE_SIZE)
  }, [suggestions, currentPage])

  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selected.has(s.productId)),
    [suggestions, selected],
  )

  const pageSelectedCount = pageSuggestions.filter((s) => selected.has(s.productId)).length
  const allOnPageSelected = pageSuggestions.length > 0 && pageSelectedCount === pageSuggestions.length

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

  function selectAllAcrossPages() {
    setSelected(new Set(suggestions.map((s) => s.productId)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function toggleOne(s: SmartCategorySuggestion) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(s.productId)) next.delete(s.productId)
      else next.add(s.productId)
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
      const { applied, errors } = await applySmartCategorySuggestions(selectedSuggestions)
      const lines = [
        `Re-categorised ${applied} product${applied === 1 ? '' : 's'}.`,
        `${selectedSuggestions.length - applied} skipped.`,
      ]
      setResult({
        tone: errors.length === 0 ? 'success' : applied > 0 ? 'mixed' : 'error',
        title: errors.length === 0 ? 'Categorisation applied' : 'Applied with some errors',
        lines,
        errors,
      })
      setSelected(new Set())
      onApplied()
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
      onApplied()
    } finally {
      setSyncingKinds(false)
    }
  }

  async function splitTealburyAccessories() {
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
      onApplied()
    } finally {
      setRebucketing(false)
    }
  }

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="smart-cat-title">
      <div className="admin-modal card admin-smart-categorize-modal" ref={modalRef}>
        <header className="admin-modal-header">
          <h2 id="smart-cat-title">Smart categorise products</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="admin-muted admin-smart-categorize-intro">
          Reads product names and descriptions and suggests the best matching category. Review before
          applying — nothing changes until you confirm.
        </p>

        <div className="admin-smart-categorize-toolbar">
          <label>
            Minimum confidence
            <select
              value={minConfidence}
              onChange={(e) => {
                setMinConfidence(e.target.value as 'medium' | 'high')
                setPage(1)
              }}
              disabled={applying}
            >
              <option value="medium">Medium and high</option>
              <option value="high">High only</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-outline btn-small"
            disabled={syncingKinds}
            onClick={() => void syncKinds()}
          >
            {syncingKinds ? 'Syncing…' : 'Sync category types'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-small"
            disabled={rebucketing}
            onClick={() => void splitTealburyAccessories()}
            title="Move Tealbury accessory items into Cornice & Pelmet, Plinth, Panels, Mouldings, Posts"
          >
            {rebucketing ? 'Splitting Tealbury accessories…' : 'Split Tealbury accessories'}
          </button>
        </div>

        <div className="admin-smart-categorize-stats">
          <strong>{suggestions.length}</strong> suggestion{suggestions.length === 1 ? '' : 's'} ·{' '}
          <strong>{selected.size}</strong> selected
          {suggestions.length > 0 && (
            <>
              <span className="admin-smart-categorize-sep">·</span>
              <button
                type="button"
                className="admin-link-button"
                onClick={selectAllAcrossPages}
                disabled={selected.size === suggestions.length}
              >
                Select all {suggestions.length}
              </button>
              <span className="admin-smart-categorize-sep">·</span>
              <button
                type="button"
                className="admin-link-button"
                onClick={clearSelection}
                disabled={selected.size === 0}
              >
                Clear selection
              </button>
            </>
          )}
        </div>

        {suggestions.length > 0 && (
          <label className="admin-filter-check">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={(e) => togglePageAll(e.target.checked)}
            />
            Select all on this page ({pageSuggestions.length})
          </label>
        )}

        <ul className="admin-smart-categorize-list">
          {pageSuggestions.length === 0 ? (
            <li className="admin-muted" style={{ padding: '0.75rem' }}>
              No suggestions at this confidence level.
            </li>
          ) : (
            pageSuggestions.map((s) => (
              <li key={s.productId}>
                <label className="admin-smart-categorize-row">
                  <input
                    type="checkbox"
                    checked={selected.has(s.productId)}
                    onChange={() => toggleOne(s)}
                  />
                  <span className="admin-smart-categorize-product" title={s.productName}>
                    {s.productName}
                  </span>
                  <span className="admin-smart-categorize-arrow">→</span>
                  <span className="admin-smart-categorize-target">{s.suggestedCategoryName}</span>
                  <span className={`admin-badge admin-badge--${s.confidence}`}>{s.confidence}</span>
                </label>
              </li>
            ))
          )}
        </ul>

        {suggestions.length > PAGE_SIZE && (
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
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, suggestions.length)} of {suggestions.length}
            </span>
          </div>
        )}

        <footer className="admin-modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
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
        </footer>
      </div>

      {result && (
        <ResultModal
          info={result}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  )
}

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
