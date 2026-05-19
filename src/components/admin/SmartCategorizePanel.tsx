import { useMemo, useState } from 'react'
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
  const [message, setMessage] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    const all = buildSmartCategorizationSuggestions(products, categories)
    if (minConfidence === 'high') return all.filter((s) => s.confidence === 'high')
    return all.filter((s) => s.confidence === 'high' || s.confidence === 'medium')
  }, [products, categories, minConfidence])

  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selected.has(s.productId)),
    [suggestions, selected],
  )

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(suggestions.map((s) => s.productId)) : new Set())
  }

  function toggleOne(s: SmartCategorySuggestion) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(s.productId)) next.delete(s.productId)
      else next.add(s.productId)
      return next
    })
  }

  async function applySelected() {
    if (selectedSuggestions.length === 0) return
    setApplying(true)
    setMessage(null)
    try {
      const { applied, errors } = await applySmartCategorySuggestions(selectedSuggestions)
      setMessage(
        errors.length > 0
          ? `Applied ${applied} suggestion(s). ${errors.length} error(s): ${errors.slice(0, 2).join('; ')}`
          : `Applied ${applied} categorisation suggestion(s).`,
      )
      onApplied()
    } finally {
      setApplying(false)
    }
  }

  async function syncKinds() {
    setSyncingKinds(true)
    setMessage(null)
    try {
      const n = await syncInferredCategoryKinds(categories)
      setMessage(`Updated category type on ${n} categor${n === 1 ? 'y' : 'ies'}.`)
      onApplied()
    } finally {
      setSyncingKinds(false)
    }
  }

  async function splitTealburyAccessories() {
    setRebucketing(true)
    setMessage(null)
    try {
      const summary = await rebucketTealburyAccessories()
      const parts = [
        `Created ${summary.ensured} categor${summary.ensured === 1 ? 'y' : 'ies'}`,
        `Re-assigned ${summary.reassigned} product${summary.reassigned === 1 ? '' : 's'}`,
        `Skipped ${summary.skipped}`,
      ]
      if (summary.errors.length > 0) {
        parts.push(`${summary.errors.length} error(s): ${summary.errors.slice(0, 2).join('; ')}`)
      }
      setMessage(parts.join(' · '))
      onApplied()
    } finally {
      setRebucketing(false)
    }
  }

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="smart-cat-title">
      <div className="admin-modal card admin-smart-categorize-modal">
        <header className="admin-modal-header">
          <h2 id="smart-cat-title">Smart categorise products</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="admin-muted admin-smart-categorize-intro">
          Reads product names and descriptions, then suggests the best matching category (doors, handles,
          wirework, kitchen ranges, etc.). Review before applying — nothing changes until you confirm.
        </p>
        {message ? (
          <p className="admin-message-ok" role="status">
            {message}
          </p>
        ) : null}
        <div className="admin-smart-categorize-toolbar">
          <label>
            Minimum confidence
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(e.target.value as 'medium' | 'high')}
              disabled={applying}
            >
              <option value="medium">Medium and high</option>
              <option value="high">High only</option>
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-small" disabled={syncingKinds} onClick={() => void syncKinds()}>
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
        <p className="admin-muted">
          {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'} · {selected.size} selected
        </p>
        {suggestions.length > 0 && (
          <label className="admin-filter-check">
            <input
              type="checkbox"
              checked={selected.size === suggestions.length}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all
          </label>
        )}
        <ul className="admin-smart-categorize-list">
          {suggestions.length === 0 ? (
            <li className="admin-muted">No suggestions at this confidence level.</li>
          ) : (
            suggestions.slice(0, 200).map((s) => (
              <li key={s.productId}>
                <label className="admin-smart-categorize-row">
                  <input
                    type="checkbox"
                    checked={selected.has(s.productId)}
                    onChange={() => toggleOne(s)}
                  />
                  <span className="admin-smart-categorize-product">{s.productName}</span>
                  <span className="admin-smart-categorize-arrow">→</span>
                  <span className="admin-smart-categorize-target">{s.suggestedCategoryName}</span>
                  <span className={`admin-badge admin-badge--${s.confidence}`}>{s.confidence}</span>
                </label>
              </li>
            ))
          )}
        </ul>
        {suggestions.length > 200 ? (
          <p className="admin-muted">Showing first 200 of {suggestions.length} suggestions.</p>
        ) : null}
        <footer className="admin-modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={applying || selectedSuggestions.length === 0}
            onClick={() => void applySelected()}
          >
            {applying ? 'Applying…' : `Apply ${selectedSuggestions.length} selected`}
          </button>
        </footer>
      </div>
    </div>
  )
}
