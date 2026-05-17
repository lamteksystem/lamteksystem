import { useMemo, useState } from 'react'
import { normalizeCategorySelection } from '@/lib/productCategories'
import type { CategoryRow } from '@/types/database'

export type ProductCategoryMultiSelectLayout = 'compact' | 'panel'

interface ProductCategoryMultiSelectProps {
  categories: CategoryRow[]
  selectedIds: string[]
  primaryId: string
  onChange: (selectedIds: string[], primaryId: string) => void
  disabled?: boolean
  /** @deprecated Use layout="compact" */
  compact?: boolean
  layout?: ProductCategoryMultiSelectLayout
}

export function ProductCategoryMultiSelect({
  categories,
  selectedIds,
  primaryId,
  onChange,
  disabled,
  compact,
  layout: layoutProp,
}: ProductCategoryMultiSelectProps) {
  const layout: ProductCategoryMultiSelectLayout =
    layoutProp ?? (compact ? 'compact' : 'panel')
  const [search, setSearch] = useState('')

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aSel = selectedIds.includes(a.id) ? 0 : 1
      const bSel = selectedIds.includes(b.id) ? 0 : 1
      if (aSel !== bSel) return aSel - bSel
      return a.name.localeCompare(b.name)
    })
  }, [categories, selectedIds])

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedCategories
    return sortedCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.slug ?? '').toLowerCase().includes(q)
    )
  }, [sortedCategories, search])

  const selectedCategories = useMemo(
    () =>
      selectedIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is CategoryRow => Boolean(c)),
    [selectedIds, categories]
  )

  function emit(ids: string[], primary: string) {
    const normalized = normalizeCategorySelection(ids, primary)
    onChange(normalized.ids, normalized.primary)
  }

  function toggleCategory(categoryId: string) {
    if (disabled) return
    const has = selectedIds.includes(categoryId)
    if (has) {
      const next = selectedIds.filter((id) => id !== categoryId)
      const nextPrimary = categoryId === primaryId ? (next[0] ?? '') : primaryId
      emit(next, nextPrimary)
      return
    }
    const next = [...selectedIds, categoryId]
    emit(next, selectedIds.length === 0 ? categoryId : primaryId || categoryId)
  }

  function setPrimary(categoryId: string) {
    if (disabled || !selectedIds.includes(categoryId)) return
    emit(selectedIds, categoryId)
  }

  function removeCategory(categoryId: string) {
    if (disabled) return
    const next = selectedIds.filter((id) => id !== categoryId)
    const nextPrimary = categoryId === primaryId ? (next[0] ?? '') : primaryId
    emit(next, nextPrimary)
  }

  return (
    <div
      className={`product-category-multi product-category-multi--${layout}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {layout === 'panel' && (
        <div className="product-category-multi-toolbar">
          <label className="product-category-multi-search-label">
            <span className="product-category-multi-sr">Search categories</span>
            <input
              type="search"
              className="admin-input product-category-multi-search"
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={disabled}
              autoFocus
            />
          </label>
          {selectedCategories.length > 0 && (
            <div className="product-category-multi-selected">
              <span className="product-category-multi-selected-label">Selected</span>
              <ul className="product-category-multi-chips" aria-label="Selected categories">
                {selectedCategories.map((c) => (
                  <li key={c.id}>
                    <span className="product-category-multi-chip">
                      {c.name}
                      {c.id === primaryId && selectedIds.length > 1 && (
                        <span className="product-category-multi-chip-primary">Primary</span>
                      )}
                      {!disabled && (
                        <button
                          type="button"
                          className="product-category-multi-chip-remove"
                          aria-label={`Remove ${c.name}`}
                          onClick={() => removeCategory(c.id)}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedIds.length > 1 && (
            <label className="product-category-multi-primary-field">
              <span className="product-category-multi-primary-label">Primary category</span>
              <select
                value={primaryId}
                disabled={disabled}
                onChange={(e) => setPrimary(e.target.value)}
                className="admin-select product-category-multi-primary-select"
              >
                {selectedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="product-category-multi-primary-hint admin-muted">
                Used for pricing rules and exports
              </span>
            </label>
          )}
        </div>
      )}

      <div
        className="product-category-multi-checks"
        role="group"
        aria-label="All categories"
      >
        {filteredCategories.length === 0 ? (
          <p className="admin-muted product-category-multi-empty">No categories match your search.</p>
        ) : (
          filteredCategories.map((c) => {
            const checked = selectedIds.includes(c.id)
            const isPrimary = checked && c.id === primaryId && selectedIds.length > 1
            return (
              <label
                key={c.id}
                className={`product-category-multi-item${checked ? ' product-category-multi-item--checked' : ''}${isPrimary ? ' product-category-multi-item--primary' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleCategory(c.id)}
                />
                <span className="product-category-multi-item-text">
                  <span className="product-category-multi-item-name">{c.name}</span>
                  {c.slug && (
                    <code className="product-category-multi-item-slug">{c.slug}</code>
                  )}
                </span>
              </label>
            )
          })
        )}
      </div>

      {layout === 'compact' && selectedIds.length > 1 && (
        <div className="product-category-multi-primary">
          <span className="product-category-multi-primary-label">Primary:</span>
          <select
            value={primaryId}
            disabled={disabled}
            onChange={(e) => setPrimary(e.target.value)}
            className="admin-select admin-select--sm"
          >
            {selectedIds.map((id) => {
              const cat = categories.find((c) => c.id === id)
              return (
                <option key={id} value={id}>
                  {cat?.name ?? id.slice(0, 8)}
                </option>
              )
            })}
          </select>
        </div>
      )}
    </div>
  )
}
