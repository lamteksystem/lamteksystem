/**
 * Smart Categorise quick-access modal.
 *
 * Lightweight wrapper around the shared `SuggestionsTab` used on the dedicated
 * `/admin/catalogue/smart-categorise` page. Opened from the catalogue toolbar so
 * staff can run a quick categorisation pass without leaving the catalogue.
 *
 * For History + Settings (retrain, reset learning, confidence thresholds, etc.)
 * the modal links to the dedicated page via "Open full page".
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SuggestionsTab,
  SmartCategoriseResultModal,
  type ResultInfo,
} from '@/pages/admin/AdminSmartCategorise'
import {
  loadSmartCategoryLearning,
  loadUserSmartStopWords,
  type LearningIndex,
} from '@/lib/smartCategoryLearning'
import {
  DEFAULT_SMART_CATEGORY_SETTINGS,
  loadSmartCategorySettings,
  type SmartCategorySettings,
} from '@/lib/smartCategorySettings'
import type { CategoryRow, ProductRow } from '@/types/database'

interface SmartCategoriseModalProps {
  open: boolean
  onClose: () => void
  products: ProductRow[]
  categories: CategoryRow[]
  /** Called after suggestions are applied so the parent catalogue can refresh. */
  onApplied: () => Promise<void> | void
}

export default function SmartCategoriseModal({
  open,
  onClose,
  products,
  categories,
  onApplied,
}: SmartCategoriseModalProps) {
  const [learning, setLearning] = useState<LearningIndex>(new Map())
  const [settings, setSettings] = useState<SmartCategorySettings>(DEFAULT_SMART_CATEGORY_SETTINGS)
  const [loadingLearning, setLoadingLearning] = useState(false)
  const [result, setResult] = useState<ResultInfo | null>(null)

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const refreshLearning = useCallback(async () => {
    setLoadingLearning(true)
    try {
      // Refresh all three caches the heuristic depends on (learning, stop-words, settings) before
      // we compute suggestions so they reflect any tweaks made on the Settings or History tabs.
      const [idx, , opts] = await Promise.all([
        loadSmartCategoryLearning(),
        loadUserSmartStopWords(),
        loadSmartCategorySettings(),
      ])
      setLearning(idx)
      setSettings(opts)
    } finally {
      setLoadingLearning(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshLearning()
  }, [open, refreshLearning])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-categorise-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="admin-modal card admin-smart-categorise-modal">
        <header className="admin-smart-categorise-modal-header">
          <div>
            <h2 id="smart-categorise-modal-title">Smart categorise</h2>
            <p className="admin-muted admin-smart-categorise-modal-sub">
              Review and apply category suggestions for your products.{' '}
              <Link to="/admin/catalogue-tools/smart-categorise" onClick={onClose}>
                Open full page
              </Link>{' '}
              for learning history and advanced settings.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Close smart categorise"
          >
            Ã—
          </button>
        </header>

        <div className="admin-smart-categorise-modal-body">
          {loadingLearning ? (
            <p className="admin-muted">Loading suggestionsâ€¦</p>
          ) : (
            <SuggestionsTab
              products={products}
              categories={categories}
              categoryById={categoryById}
              learning={learning}
              settings={settings}
              onApplied={async () => {
                await refreshLearning()
                await onApplied()
              }}
              setResult={setResult}
            />
          )}
        </div>

        {result && (
          <SmartCategoriseResultModal info={result} onClose={() => setResult(null)} />
        )}
      </div>
    </div>
  )
}
