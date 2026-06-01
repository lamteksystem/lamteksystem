import { useState } from 'react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { CategoryRow } from '@/types/database'

export type BulkActionScope = 'selected' | 'filtered'

type CategoryOptions = {
  parents: CategoryRow[]
  childrenByParent: Map<string, CategoryRow[]>
}

type Props = {
  filteredCount: number
  filteredSelectedCount: number
  categoryOptions: CategoryOptions
  onSelectFiltered: () => void
  onClearSelection: () => void
  onDeleteFiltered: () => void
  onDeleteSelected: () => void
  onAssignCategory: (categoryId: string, scope: BulkActionScope) => void
  onAutoMap: (scope: 'all' | 'unassigned') => void
}

/**
 * Selection, category assignment, delete and auto-map controls. Lives inside the
 * workbench tools modal so the table itself stays uncluttered.
 */
export default function PricelistWorkbenchBulkActionsPanel({
  filteredCount,
  filteredSelectedCount,
  categoryOptions,
  onSelectFiltered,
  onClearSelection,
  onDeleteFiltered,
  onDeleteSelected,
  onAssignCategory,
  onAutoMap,
}: Props) {
  const [bulkCategoryId, setBulkCategoryId] = useState('')

  return (
    <div className="admin-pricelist-panel admin-pricelist-panel--bulk">
      <div className="admin-pricelist-action-group">
        <span className="admin-pricelist-action-label">Selection</span>
        <div className="admin-pricelist-action-row">
          <button type="button" className="btn btn-small btn-outline" onClick={onSelectFiltered}>
            Select filtered ({filteredCount})
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={onClearSelection}>
            Clear selection
          </button>
        </div>
      </div>

      <div className="admin-pricelist-action-group">
        <span className="admin-pricelist-action-label">Delete from workbench</span>
        <div className="admin-pricelist-action-row">
          <button
            type="button"
            className="btn btn-small btn-danger-outline"
            disabled={filteredCount === 0}
            onClick={onDeleteFiltered}
          >
            Delete filtered ({filteredCount})
          </button>
          <button
            type="button"
            className="btn btn-small btn-danger-outline"
            disabled={filteredSelectedCount === 0}
            onClick={onDeleteSelected}
          >
            Delete selected ({filteredSelectedCount})
          </button>
        </div>
      </div>

      <div className="admin-pricelist-action-group">
        <span className="admin-pricelist-action-label">
          Assign category
          <AdminHelpTip text="Pick a portal category, then apply to all filtered rows or only ticked rows. Does not publish until you use Export/Publish." />
        </span>
        <div className="admin-pricelist-action-row admin-pricelist-action-row--category">
          <select
            value={bulkCategoryId}
            onChange={(e) => setBulkCategoryId(e.target.value)}
            aria-label="Assign category"
          >
            <option value="">Choose category to assign…</option>
            {categoryOptions.parents.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.id}>{p.name}</option>
                {(categoryOptions.childrenByParent.get(p.id) ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    — {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-small"
            disabled={!bulkCategoryId}
            onClick={() => onAssignCategory(bulkCategoryId, 'filtered')}
          >
            Apply to filtered
          </button>
          <button
            type="button"
            className="btn btn-small btn-outline"
            disabled={!bulkCategoryId || filteredSelectedCount === 0}
            onClick={() => onAssignCategory(bulkCategoryId, 'selected')}
          >
            Apply to selected
          </button>
        </div>
        <div className="admin-pricelist-action-row">
          <button
            type="button"
            className="btn btn-small btn-outline"
            title="Match section headings to existing category names"
            onClick={() => onAutoMap('unassigned')}
          >
            Auto-map unassigned
          </button>
          <button
            type="button"
            className="btn btn-small btn-outline"
            title="Re-run auto-map on every row"
            onClick={() => onAutoMap('all')}
          >
            Auto-map all
          </button>
        </div>
      </div>
    </div>
  )
}
