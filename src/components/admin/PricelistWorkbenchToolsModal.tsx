import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PricelistWorkbenchSmartPanel from '@/components/admin/PricelistWorkbenchSmartPanel'
import PricelistWorkbenchBulkActionsPanel, {
  type BulkActionScope,
} from '@/components/admin/PricelistWorkbenchBulkActionsPanel'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { CategoryRow, AssemblyPartTypeRow } from '@/types/database'

export type WorkbenchToolsTab = 'smart' | 'bulk'

type CategoryOptions = {
  parents: CategoryRow[]
  childrenByParent: Map<string, CategoryRow[]>
}

type Props = {
  initialTab: WorkbenchToolsTab
  onClose: () => void
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  onRowsChange: (rows: PricelistWorkbenchRow[]) => void
  onNotify: (message: string, error?: string | null) => void
  // Bulk actions
  filteredSelectedCount: number
  categoryOptions: CategoryOptions
  onSelectFiltered: () => void
  onClearSelection: () => void
  onDeleteFiltered: () => void
  onDeleteSelected: () => void
  onAssignCategory: (categoryId: string, scope: BulkActionScope) => void
  onAutoMap: (scope: 'all' | 'unassigned') => void
}

const TABS: { id: WorkbenchToolsTab; label: string }[] = [
  { id: 'smart', label: 'AI command & rules' },
  { id: 'bulk', label: 'Bulk actions' },
]

/**
 * Houses every "power" tool for the workbench (natural-language AI command, bulk
 * editor, presets, rule builder, and quick bulk actions) inside a single modal so
 * the editable table stays clean. Triggered by buttons above the table.
 */
export default function PricelistWorkbenchToolsModal({
  initialTab,
  onClose,
  rows,
  filtered,
  categories,
  partTypes,
  onRowsChange,
  onNotify,
  filteredSelectedCount,
  categoryOptions,
  onSelectFiltered,
  onClearSelection,
  onDeleteFiltered,
  onDeleteSelected,
  onAssignCategory,
  onAutoMap,
}: Props) {
  const [tab, setTab] = useState<WorkbenchToolsTab>(initialTab)

  // Bubble-phase listener: a nested bulk-edit modal (capture + stopPropagation)
  // closes first and prevents this from also closing.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const modalTree = (
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbench-tools-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="admin-modal card admin-modal--workbench-tools" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="workbench-tools-title" className="admin-modal-title">
          Product tools
        </h2>
        <div className="admin-workbench-tools-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`admin-workbench-tools-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-workbench-tools-body">
          {tab === 'smart' ? (
            <PricelistWorkbenchSmartPanel
              rows={rows}
              filtered={filtered}
              categories={categories}
              partTypes={partTypes}
              onRowsChange={onRowsChange}
              onNotify={onNotify}
            />
          ) : (
            <PricelistWorkbenchBulkActionsPanel
              filteredCount={filtered.length}
              filteredSelectedCount={filteredSelectedCount}
              categoryOptions={categoryOptions}
              onSelectFiltered={onSelectFiltered}
              onClearSelection={onClearSelection}
              onDeleteFiltered={onDeleteFiltered}
              onDeleteSelected={onDeleteSelected}
              onAssignCategory={onAssignCategory}
              onAutoMap={onAutoMap}
            />
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
