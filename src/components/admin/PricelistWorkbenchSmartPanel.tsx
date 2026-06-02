import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PricelistWorkbenchQuickCommand, {
  type SmartApplyScope,
} from '@/components/admin/PricelistWorkbenchQuickCommand'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import PricelistWorkbenchBulkEditModal from '@/components/admin/PricelistWorkbenchBulkEditModal'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { applyBulkEdit, type BulkEditSpec } from '@/lib/pricelistWorkbenchBulkEdit'
import { getUserPreference, setUserPreference } from '@/lib/userPreferences'
import type { AssemblyPartTypeRow, CategoryRow } from '@/types/database'
import {
  applyRuleToRows,
  describeRule,
  filterRowsByRule,
  parseSmartSelectionPrompt,
  parseStripTextActionParam,
  parseTextCaseActionParam,
  textCaseFieldLabel,
  textCaseModeLabel,
  TEXT_CASE_FIELDS,
  TEXT_CASE_MODES,
  WORKBENCH_RULE_PRESETS,
  type StripTextField,
  type TextCaseField,
  type TextCaseMode,
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
  { value: 'change_text_case', label: 'Change text case' },
  { value: 'select', label: 'Select rows' },
  { value: 'deselect', label: 'Deselect rows' },
  { value: 'set_active', label: 'Set active' },
  { value: 'set_inactive', label: 'Set inactive' },
]

type Props = {
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
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
  partTypes,
  onRowsChange,
  onNotify,
}: Props) {
  const [scope, setScope] = useState<SmartApplyScope>('filtered')
  const [bulkRows, setBulkRows] = useState<PricelistWorkbenchRow[] | null>(null)
  const [bulkLabel, setBulkLabel] = useState('')
  const [bulkCriteria, setBulkCriteria] = useState('')
  const [savedRules, setSavedRules] = useState<WorkbenchRule[]>([])
  const [builderName, setBuilderName] = useState('')
  const [builderMode, setBuilderMode] = useState<'all' | 'any'>('all')
  const [builderAction, setBuilderAction] = useState<WorkbenchActionType>('delete')
  const [builderActionParam, setBuilderActionParam] = useState('')
  const [builderStripField, setBuilderStripField] = useState<'description' | 'name' | 'sku'>('description')
  const [builderStripText, setBuilderStripText] = useState('')
  const [builderCaseField, setBuilderCaseField] = useState<TextCaseField>('name')
  const [builderCaseMode, setBuilderCaseMode] = useState<TextCaseMode>('sentence')
  const [builderConditions, setBuilderConditions] = useState<WorkbenchCondition[]>([
    { field: 'source', op: 'equals', value: 'tealbury' },
    newCondition(),
  ])
  const [builderOpen, setBuilderOpen] = useState(false)
  const [lastPreview, setLastPreview] = useState<string | null>(null)
  const builderRef = useRef<HTMLDetailsElement>(null)

  const editRuleInBuilder = useCallback((rule: WorkbenchRule) => {
    setBuilderAction(rule.action)
    setBuilderMode(rule.matchMode)
    setBuilderConditions(rule.conditions.length ? rule.conditions : [newCondition()])
    setBuilderName('')
    setBuilderActionParam(rule.action === 'assign_category' ? rule.actionParam ?? '' : '')
    if (rule.action === 'strip_text_from_field') {
      const p = parseStripTextActionParam(rule.actionParam)
      if (p) {
        setBuilderStripField(p.field as StripTextField)
        setBuilderStripText(p.text)
      }
    }
    if (rule.action === 'change_text_case') {
      const c = parseTextCaseActionParam(rule.actionParam)
      if (c) {
        setBuilderCaseField(c.fields[0] ?? 'name')
        setBuilderCaseMode(c.mode)
      }
    }
    setBuilderOpen(true)
    onNotify('Loaded your command into the builder below — adjust the dropdowns and Run.')
    requestAnimationFrame(() =>
      builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }, [onNotify])

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

  function poolForScope(): PricelistWorkbenchRow[] {
    if (scope === 'all') return rows
    if (scope === 'filtered') return filtered
    return rows.filter((r) => r.selected)
  }

  const scopeLabel =
    scope === 'all' ? `all rows (${rows.length})` : scope === 'filtered' ? `current filter (${filtered.length})` : `selected (${rows.filter((r) => r.selected).length})`

  const bulkCriteriaMatchCount = useMemo(() => {
    if (!bulkCriteria.trim()) return null
    const { conditions, matchMode, error } = parseSmartSelectionPrompt(bulkCriteria)
    if (error) return -1
    return filterRowsByRule(poolForScope(), { conditions, matchMode }).length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkCriteria, rows, filtered, scope])

  function openBulkFromScope() {
    const pool = poolForScope()
    if (!pool.length) {
      onNotify('', scope === 'selected' ? 'No rows selected.' : 'No rows in scope.')
      return
    }
    setBulkLabel(scopeLabel)
    setBulkRows(pool)
  }

  function openBulkFromCriteria() {
    const { conditions, matchMode, error } = parseSmartSelectionPrompt(bulkCriteria)
    if (error) {
      onNotify('', error)
      return
    }
    const matched = filterRowsByRule(poolForScope(), { conditions, matchMode })
    if (!matched.length) {
      onNotify('', 'No products matched that criteria in the current scope.')
      return
    }
    setBulkLabel(
      describeRule({ id: '', name: '', conditions, matchMode, action: 'select' }).replace(/^select:\s*/, ''),
    )
    setBulkRows(matched)
  }

  function handleBulkApply(spec: BulkEditSpec, ids: string[]) {
    const { rows: next, changed } = applyBulkEdit(rows, new Set(ids), spec, categories)
    onRowsChange(next)
    onNotify(`Bulk updated ${changed} product(s).`)
  }

  function handleBulkDelete(ids: string[]) {
    const idset = new Set(ids)
    onRowsChange(rows.filter((r) => !idset.has(r.id)))
    onNotify(`Removed ${ids.length} row(s) from the workbench draft.`)
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
    const caseParam =
      builderAction === 'change_text_case' ? `${builderCaseField}:${builderCaseMode}` : undefined
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
            : builderAction === 'change_text_case'
              ? caseParam
              : undefined,
    }
    if (
      !rule.conditions.length &&
      builderAction !== 'strip_text_from_field' &&
      builderAction !== 'change_text_case'
    ) {
      onNotify('', 'Add at least one condition (or use strip text / change case on all rows with no conditions).')
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
          onEditInBuilder={editRuleInBuilder}
        />

        <div className="admin-pricelist-smart-card admin-pricelist-bulk-card">
          <h3>
            Bulk editor
            <AdminHelpTip text="Pick products by criteria (or use the current filter / selection), open them in a pop-up, and change many fields at once — category, sections, kinds, part types, prices, find &amp; replace, text case and more." />
          </h3>
          <p className="admin-muted">
            Select products, then edit them all at once — no line-by-line editing.
          </p>
          <textarea
            className="admin-pricelist-prompt"
            rows={3}
            value={bulkCriteria}
            onChange={(e) => setBulkCriteria(e.target.value)}
            placeholder='e.g. products with the word "panel" in the name'
          />
          {bulkCriteriaMatchCount !== null && (
            <p className="admin-muted admin-pricelist-bulk-count">
              {bulkCriteriaMatchCount < 0
                ? 'Could not read that criteria yet — try e.g. name contains "panel".'
                : `${bulkCriteriaMatchCount} product(s) match in ${scopeLabel}.`}
            </p>
          )}
          <div className="admin-pricelist-smart-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={openBulkFromCriteria}
              disabled={!bulkCriteria.trim()}
            >
              Find &amp; bulk edit
            </button>
            <button type="button" className="btn btn-small btn-outline" onClick={openBulkFromScope}>
              Bulk edit {scopeLabel}
            </button>
          </div>
        </div>

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

      <details
        ref={builderRef}
        className="admin-pricelist-smart-card admin-pricelist-rule-builder"
        open={builderOpen}
        onToggle={(e) => setBuilderOpen((e.target as HTMLDetailsElement).open)}
      >
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
          {builderAction === 'change_text_case' && (
            <>
              <label>
                Field
                <select
                  value={builderCaseField}
                  onChange={(e) => setBuilderCaseField(e.target.value as TextCaseField)}
                >
                  {TEXT_CASE_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {textCaseFieldLabel(f)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Convert to
                <select
                  value={builderCaseMode}
                  onChange={(e) => setBuilderCaseMode(e.target.value as TextCaseMode)}
                >
                  {TEXT_CASE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {textCaseModeLabel(m)}
                    </option>
                  ))}
                </select>
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
                      : builderAction === 'change_text_case'
                        ? `${builderCaseField}:${builderCaseMode}`
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

      {bulkRows && (
        <PricelistWorkbenchBulkEditModal
          rows={bulkRows}
          criteriaLabel={bulkLabel}
          categories={categories}
          partTypes={partTypes}
          onApply={handleBulkApply}
          onDelete={handleBulkDelete}
          onClose={() => setBulkRows(null)}
        />
      )}
    </div>
  )
}
