import { useCallback, useEffect, useState } from 'react'
import PricelistWorkbenchQuickCommand, {
  type SmartApplyScope,
} from '@/components/admin/PricelistWorkbenchQuickCommand'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import type { CategoryRow } from '@/types/database'
import {
  applyRuleToRows,
  describeRule,
  filterRowsByRule,
  WORKBENCH_RULE_PRESETS,
  type WorkbenchActionType,
  type WorkbenchCondition,
  type WorkbenchConditionOp,
  type WorkbenchMatchField,
  type WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'

const RULES_PREF_KEY = 'pricelist_workbench_rules_v1'

export type { SmartApplyScope } from '@/components/admin/PricelistWorkbenchQuickCommand'

const FIELD_OPTIONS: { value: WorkbenchMatchField; label: string }[] = [
  { value: 'source', label: 'Source (tealbury/lamtek)' },
  { value: 'door_range', label: 'Door / range' },
  { value: 'section', label: 'Section' },
  { value: 'sku', label: 'SKU' },
  { value: 'name', label: 'Name' },
  { value: 'category_name', label: 'Category name' },
  { value: 'description', label: 'Description' },
  { value: 'cost_price', label: 'Lamtek cost price' },
  { value: 'unit_price', label: 'List / sell price' },
  { value: 'category', label: 'Category (unassigned)' },
]

const OP_OPTIONS: { value: WorkbenchConditionOp; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'sku_appears_in_name', label: 'SKU appears in name' },
  { value: 'unassigned', label: 'is unassigned' },
  { value: 'empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
]

const ACTION_OPTIONS: { value: WorkbenchActionType; label: string }[] = [
  { value: 'delete', label: 'Delete from workbench' },
  { value: 'assign_category', label: 'Assign category' },
  { value: 'remove_sku_from_name', label: 'Remove SKU from name' },
  { value: 'strip_text_from_field', label: 'Remove text from field' },
  { value: 'select', label: 'Select rows' },
  { value: 'deselect', label: 'Deselect rows' },
  { value: 'set_active', label: 'Set active' },
  { value: 'set_inactive', label: 'Set inactive' },
]

type Props = {
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  onRowsChange: (rows: PricelistWorkbenchRow[]) => void
  onNotify: (message: string, error?: string | null) => void
}

function newCondition(): WorkbenchCondition {
  return { field: 'door_range', op: 'contains', value: '' }
}

function parseSavedRules(json: string | null): WorkbenchRule[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as WorkbenchRule[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function PricelistWorkbenchSmartPanel({
  rows,
  filtered,
  categories,
  onRowsChange,
  onNotify,
}: Props) {
  const [scope, setScope] = useState<SmartApplyScope>('filtered')
  const [savedRules, setSavedRules] = useState<WorkbenchRule[]>([])
  const [builderName, setBuilderName] = useState('')
  const [builderMode, setBuilderMode] = useState<'all' | 'any'>('all')
  const [builderAction, setBuilderAction] = useState<WorkbenchActionType>('delete')
  const [builderActionParam, setBuilderActionParam] = useState('')
  const [builderStripField, setBuilderStripField] = useState<'description' | 'name' | 'sku'>('description')
  const [builderStripText, setBuilderStripText] = useState('')
  const [builderConditions, setBuilderConditions] = useState<WorkbenchCondition[]>([
    { field: 'source', op: 'equals', value: 'tealbury' },
    newCondition(),
  ])
  const [lastPreview, setLastPreview] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const raw = await getUserPreference(RULES_PREF_KEY)
      setSavedRules(parseSavedRules(raw))
    })()
  }, [])

  const persistRules = useCallback(async (rules: WorkbenchRule[]) => {
    setSavedRules(rules)
    await setUserPreference(RULES_PREF_KEY, JSON.stringify(rules))
  }, [])

  function resolveTargetIds(): Set<string> | undefined {
    if (scope === 'all') return undefined
    if (scope === 'filtered') return new Set(filtered.map((r) => r.id))
    const sel = rows.filter((r) => r.selected)
    return new Set(sel.map((r) => r.id))
  }

  function runRule(rule: WorkbenchRule, confirmDelete = true) {
    const targetIds = resolveTargetIds()
    const pool = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows
    if (!pool.length) {
      onNotify('', scope === 'selected' ? 'No rows selected.' : 'No rows in scope.')
      return
    }
    if (rule.action === 'delete' && confirmDelete) {
      const matchedRows = filterRowsByRule(pool, rule)
      if (
        !window.confirm(
          `Delete ${matchedRows.length} row(s) from the workbench draft? (Does not remove live catalogue until you publish.)`
        )
      ) {
        return
      }
    }
    if (rule.action === 'assign_category' && !rule.actionParam?.trim()) {
      onNotify('', 'Assign category needs a category name (use the rule builder or quote it in the command).')
      return
    }
    if (rule.action === 'strip_text_from_field' && !rule.actionParam?.includes(':')) {
      onNotify('', 'Remove text needs a field and phrase (e.g. description:Section:).')
      return
    }
    finishRun(rule, targetIds)
  }

  function finishRun(rule: WorkbenchRule, targetIds?: Set<string>) {
    const { rows: next, result } = applyRuleToRows(rows, rule, targetIds, categories)
    onRowsChange(next)
    setLastPreview(describeRule(rule))
    onNotify(result.message)
  }

  function saveBuilderRule() {
    const name = builderName.trim() || describeRule({
      id: '',
      name: '',
      conditions: builderConditions,
      matchMode: builderMode,
      action: builderAction,
    })
    const filteredConditions = builderConditions.filter(
      (c) =>
        c.op === 'sku_appears_in_name' ||
        c.op === 'unassigned' ||
        c.value.trim() ||
        c.op === 'empty' ||
        c.op === 'not_empty'
    )
    const stripParam =
      builderAction === 'strip_text_from_field' && builderStripText.trim()
        ? `${builderStripField}:${builderStripText.trim()}`
        : undefined
    const rule: WorkbenchRule = {
      id: `saved-${Date.now()}`,
      name: name.slice(0, 120),
      conditions: filteredConditions,
      matchMode: builderMode,
      action: builderAction,
      actionParam:
        builderAction === 'assign_category'
          ? builderActionParam.trim()
          : builderAction === 'strip_text_from_field'
            ? stripParam
            : undefined,
    }
    if (!rule.conditions.length && builderAction !== 'strip_text_from_field') {
      onNotify('', 'Add at least one condition (or use strip text on all rows with no conditions).')
      return
    }
    if (builderAction === 'strip_text_from_field' && !stripParam) {
      onNotify('', 'Enter the text to remove from the field.')
      return
    }
    void persistRules([...savedRules, rule])
    onNotify(`Saved rule “${rule.name}”.`)
  }

  function deleteSavedRule(id: string) {
    void persistRules(savedRules.filter((r) => r.id !== id))
  }

  return (
    <div className="admin-pricelist-smart">
      <div className="admin-pricelist-smart-scope">
        <span className="admin-pricelist-smart-scope-label">
          Apply commands to
          <AdminHelpTip text="Filtered = current search/filters. Selected = ticked rows only. All = entire workbench draft." />
        </span>
        <label>
          <input type="radio" name="smart-scope" checked={scope === 'filtered'} onChange={() => setScope('filtered')} />
          Current filter ({filtered.length})
        </label>
        <label>
          <input type="radio" name="smart-scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />
          Selected only ({rows.filter((r) => r.selected).length})
        </label>
        <label>
          <input type="radio" name="smart-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
          All rows ({rows.length})
        </label>
      </div>

      <div className="admin-pricelist-smart-grid">
        <PricelistWorkbenchQuickCommand
          rows={rows}
          filtered={filtered}
          categories={categories}
          scope={scope}
          onRunRule={runRule}
          onNotify={onNotify}
        />

        <div className="admin-pricelist-smart-card">
          <h3>Presets</h3>
          <ul className="admin-pricelist-preset-list">
            {WORKBENCH_RULE_PRESETS.map((preset) => (
              <li key={preset.id}>
                <div>
                  <strong>{preset.name}</strong>
                  <p className="admin-muted">{describeRule(preset)}</p>
                </div>
                <button type="button" className="btn btn-small btn-outline" onClick={() => runRule(preset)}>
                  Run
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="admin-pricelist-smart-card admin-pricelist-rule-builder">
        <summary>Rule builder (save &amp; re-run)</summary>
        <div className="admin-pricelist-builder-form">
          <label>
            Rule name
            <input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="My cleanup rule" />
          </label>
          <label>
            Match
            <select value={builderMode} onChange={(e) => setBuilderMode(e.target.value as 'all' | 'any')}>
              <option value="all">All conditions (AND)</option>
              <option value="any">Any condition (OR)</option>
            </select>
          </label>
          <label>
            Then
            <select value={builderAction} onChange={(e) => setBuilderAction(e.target.value as WorkbenchActionType)}>
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {builderAction === 'assign_category' && (
            <label>
              Category name
              <input
                value={builderActionParam}
                onChange={(e) => setBuilderActionParam(e.target.value)}
                placeholder="e.g. Base units"
                list="workbench-category-suggestions"
              />
              <datalist id="workbench-category-suggestions">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
          )}
          {builderAction === 'strip_text_from_field' && (
            <>
              <label>
                Field
                <select
                  value={builderStripField}
                  onChange={(e) => setBuilderStripField(e.target.value as 'description' | 'name' | 'sku')}
                >
                  <option value="description">Description</option>
                  <option value="name">Name</option>
                  <option value="sku">SKU</option>
                </select>
              </label>
              <label>
                Text to remove
                <input
                  value={builderStripText}
                  onChange={(e) => setBuilderStripText(e.target.value)}
                  placeholder='e.g. Section:'
                />
              </label>
            </>
          )}
        </div>
        <div className="admin-pricelist-conditions">
          {builderConditions.map((c, i) => (
            <div key={i} className="admin-pricelist-condition-row">
              <select
                value={c.field}
                onChange={(e) => {
                  const next = [...builderConditions]
                  next[i] = { ...c, field: e.target.value as WorkbenchMatchField }
                  setBuilderConditions(next)
                }}
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={c.op}
                onChange={(e) => {
                  const next = [...builderConditions]
                  next[i] = { ...c, op: e.target.value as WorkbenchConditionOp }
                  setBuilderConditions(next)
                }}
              >
                {OP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={c.value}
                disabled={
                  c.op === 'sku_appears_in_name' ||
                  c.op === 'unassigned' ||
                  c.op === 'empty' ||
                  c.op === 'not_empty'
                }
                onChange={(e) => {
                  const next = [...builderConditions]
                  next[i] = { ...c, value: e.target.value }
                  setBuilderConditions(next)
                }}
                placeholder="Value"
              />
              <button
                type="button"
                className="btn btn-small btn-ghost"
                aria-label="Remove condition"
                onClick={() => setBuilderConditions(builderConditions.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-small btn-outline" onClick={() => setBuilderConditions([...builderConditions, newCondition()])}>
            + Add condition
          </button>
        </div>
        <div className="admin-pricelist-smart-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={() =>
              runRule({
                id: 'draft',
                name: builderName || 'Draft rule',
                conditions: builderConditions,
                matchMode: builderMode,
                action: builderAction,
                actionParam:
                  builderAction === 'assign_category'
                    ? builderActionParam
                    : builderAction === 'strip_text_from_field' && builderStripText.trim()
                      ? `${builderStripField}:${builderStripText.trim()}`
                      : undefined,
              })
            }
          >
            Run without saving
          </button>
          <button type="button" className="btn btn-small btn-outline" onClick={saveBuilderRule}>
            Save rule
          </button>
        </div>
      </details>

      {savedRules.length > 0 && (
        <div className="admin-pricelist-smart-card">
          <h3>Saved rules</h3>
          <ul className="admin-pricelist-preset-list">
            {savedRules.map((rule) => (
              <li key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <p className="admin-muted">{describeRule(rule)}</p>
                </div>
                <div className="admin-pricelist-preset-actions">
                  <button type="button" className="btn btn-small btn-outline" onClick={() => runRule(rule)}>
                    Run
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => deleteSavedRule(rule.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastPreview && <p className="admin-muted">Last run: {lastPreview}</p>}
    </div>
  )
}
