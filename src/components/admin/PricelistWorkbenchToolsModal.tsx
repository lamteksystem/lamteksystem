import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PricelistWorkbenchSmartPanel from '@/components/admin/PricelistWorkbenchSmartPanel'
import WorkbenchSmartPresetsPanel from '@/components/admin/WorkbenchSmartPresetsPanel'
import type { SmartApplyScope } from '@/components/admin/PricelistWorkbenchQuickCommand'
import PricelistWorkbenchBulkActionsPanel, {
  type BulkActionScope,
} from '@/components/admin/PricelistWorkbenchBulkActionsPanel'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { KitActionId } from '@/lib/workbenchSmartPresets'
import {
  applyRuleToRows,
  filterRowsByRule,
  type WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'
import type { CategoryRow, AssemblyPartTypeRow } from '@/types/database'

export type WorkbenchToolsTab = 'presets' | 'command' | 'bulk'

type CategoryOptions = {
  parents: CategoryRow[]
  childrenByParent: Map<string, CategoryRow[]>
}

type Props = {
  initialTab: WorkbenchToolsTab
  initialCommandPrompt?: string
  onClose: () => void
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  onRowsChange: (rows: PricelistWorkbenchRow[]) => void
  onNotify: (message: string, error?: string | null) => void
  onApplyKitAction: (action: KitActionId) => Promise<{ message: string; error?: string }>
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
  { id: 'presets', label: 'Quick fixes' },
  { id: 'command', label: 'AI command' },
  { id: 'bulk', label: 'Bulk actions' },
]

/**
 * Smart controls: preview-first presets, natural-language commands, and bulk tools.
 */
export default function PricelistWorkbenchToolsModal({
  initialTab,
  initialCommandPrompt = '',
  onClose,
  rows,
  filtered,
  categories,
  partTypes,
  onRowsChange,
  onNotify,
  onApplyKitAction,
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
  const [scope, setScope] = useState<SmartApplyScope>('filtered')
  const [commandSeed, setCommandSeed] = useState(initialCommandPrompt)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (initialCommandPrompt) setCommandSeed(initialCommandPrompt)
  }, [initialCommandPrompt])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function runRule(rule: WorkbenchRule, confirmDelete = true) {
    const targetIds =
      scope === 'all'
        ? undefined
        : new Set(
            (scope === 'filtered' ? filtered : rows.filter((r) => r.selected)).map((r) => r.id),
          )
    const pool = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows
    if (!pool.length) {
      onNotify('', scope === 'selected' ? 'No rows selected.' : 'No rows in scope.')
      return
    }
    if (rule.action === 'delete' && confirmDelete) {
      const matched = filterRowsByRule(pool, rule)
      if (
        !window.confirm(
          `Delete ${matched.length} row(s) from the workbench draft? (Does not remove live catalogue until you publish.)`,
        )
      ) {
        return
      }
    }
    const { rows: next, result } = applyRuleToRows(rows, rule, targetIds, categories)
    onRowsChange(next)
    onNotify(result.message)
  }

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
          Smart controls
        </h2>
        <p className="admin-muted admin-modal-intro">
          Preview changes before they touch the draft. Use <strong>Quick fixes</strong> for kits and taxonomy,{' '}
          <strong>AI command</strong> for free-text rules, or <strong>Bulk actions</strong> for select/delete/map.
        </p>
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
          {tab === 'presets' ? (
            <WorkbenchSmartPresetsPanel
              rows={rows}
              filtered={filtered}
              categories={categories}
              scope={scope}
              onScopeChange={setScope}
              onRunRule={runRule}
              onApplyKitAction={onApplyKitAction}
              onOpenAiCommand={(hint) => {
                setCommandSeed(hint)
                setTab('command')
              }}
              onNotify={onNotify}
            />
          ) : tab === 'command' ? (
            <PricelistWorkbenchSmartPanel
              rows={rows}
              filtered={filtered}
              categories={categories}
              partTypes={partTypes}
              onRowsChange={onRowsChange}
              onNotify={onNotify}
              scope={scope}
              onScopeChange={setScope}
              initialPrompt={commandSeed}
              onPromptConsumed={() => setCommandSeed('')}
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
