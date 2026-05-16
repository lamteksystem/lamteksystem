import type { CategoryRow } from '@/types/database'

interface ProductCategoryMultiSelectProps {
  categories: CategoryRow[]
  selectedIds: string[]
  primaryId: string
  onChange: (selectedIds: string[], primaryId: string) => void
  disabled?: boolean
  compact?: boolean
}

export function ProductCategoryMultiSelect({
  categories,
  selectedIds,
  primaryId,
  onChange,
  disabled,
  compact,
}: ProductCategoryMultiSelectProps) {
  function toggleCategory(categoryId: string) {
    if (disabled) return
    const has = selectedIds.includes(categoryId)
    if (has) {
      const next = selectedIds.filter((id) => id !== categoryId)
      const nextPrimary = categoryId === primaryId ? (next[0] ?? '') : primaryId
      onChange(next, nextPrimary)
      return
    }
    const next = [...selectedIds, categoryId]
    onChange(next, primaryId || categoryId)
  }

  function setPrimary(categoryId: string) {
    if (disabled || !selectedIds.includes(categoryId)) return
    onChange(selectedIds, categoryId)
  }

  return (
    <div
      className={`product-category-multi${compact ? ' product-category-multi--compact' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="product-category-multi-checks" role="group" aria-label="Categories">
        {categories.map((c) => {
          const checked = selectedIds.includes(c.id)
          return (
            <label key={c.id} className="product-category-multi-item">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleCategory(c.id)}
              />
              <span>{c.name}</span>
            </label>
          )
        })}
      </div>
      {selectedIds.length > 1 && (
        <div className="product-category-multi-primary">
          <span className="product-category-multi-primary-label">Primary (for pricing &amp; export):</span>
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
