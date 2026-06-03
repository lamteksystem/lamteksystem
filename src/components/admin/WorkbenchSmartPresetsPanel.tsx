import { useCallback, useMemo, useState } from 'react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { SmartApplyScope } from '@/components/admin/PricelistWorkbenchQuickCommand'
import { KIT_LABEL, KIT_TOOLTIP } from '@/lib/kitTerminology'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { RuleSimulationResult, WorkbenchRule } from '@/lib/pricelistWorkbenchRules'
import {
  WORKBENCH_SMART_PRESETS,
  previewKitAction,
  previewRulePreset,
  type KitActionId,
  type KitActionPreview,
  type SmartPreset,
  type SmartPresetCategory,
} from '@/lib/workbenchSmartPresets'
import type { CategoryRow } from '@/types/database'

type Props = {
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  scope: SmartApplyScope
  onScopeChange: (scope: SmartApplyScope) => void
  onRunRule: (rule: WorkbenchRule, confirmDelete?: boolean) => void
  onApplyKitAction: (action: KitActionId) => Promise<{ message: string; error?: string }>
  onOpenAiCommand?: (promptHint: string) => void
  onNotify: (message: string, error?: string | null) => void
}

const CATEGORY_LABELS: Record<SmartPresetCategory, string> = {
  taxonomy: 'Categories & sold-as',
  kit: `${KIT_LABEL} & gaps`,
  cleanup: 'Cleanup',
}

export default function WorkbenchSmartPresetsPanel({
  rows,
  filtered,
  categories,
  scope,
  onScopeChange,
  onRunRule,
  onApplyKitAction,
  onOpenAiCommand,
  onNotify,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rulePreview, setRulePreview] = useState<RuleSimulationResult | null>(null)
  const [kitPreview, setKitPreview] = useState<KitActionPreview | null>(null)
  const [applying, setApplying] = useState(false)

  const scopeRows = useMemo(() => {
    if (scope === 'all') return rows
    if (scope === 'filtered') return filtered
    return rows.filter((r) => r.selected)
  }, [scope, rows, filtered])

  const targetIds = useMemo(() => {
    if (scope === 'all') return undefined
    return new Set(scopeRows.map((r) => r.id))
  }, [scope, scopeRows])

  const activePreset = WORKBENCH_SMART_PRESETS.find((p) => p.id === activeId) ?? null

  const runPreview = useCallback(
    (preset: SmartPreset) => {
      setActiveId(preset.id)
      if (preset.kind === 'rule') {
        setKitPreview(null)
        setRulePreview(previewRulePreset(preset, rows, scopeRows, categories, targetIds))
      } else {
        setRulePreview(null)
        setKitPreview(previewKitAction(preset.action, rows, scopeRows, categories))
      }
    },
    [rows, scopeRows, categories, targetIds],
  )

  const grouped = useMemo(() => {
    const map = new Map<SmartPresetCategory, SmartPreset[]>()
    for (const p of WORKBENCH_SMART_PRESETS) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return map
  }, [])

  async function pushToDraft() {
    if (!activePreset) return
    setApplying(true)
    try {
      if (activePreset.kind === 'rule') {
        if (rulePreview && rulePreview.wouldChange === 0) {
          onNotify('', 'Nothing would change — adjust scope or pick another preset.')
          return
        }
        if (activePreset.rule.action === 'delete') {
          onRunRule(activePreset.rule, true)
        } else {
          onRunRule(activePreset.rule, false)
        }
        setActiveId(null)
        setRulePreview(null)
        return
      }
      if (!kitPreview?.canApply) {
        onNotify('', kitPreview?.warnings[0] ?? 'Cannot apply this action.')
        return
      }
      const res = await onApplyKitAction(activePreset.action)
      if (res.error) onNotify('', res.error)
      else onNotify(res.message)
      setActiveId(null)
      setKitPreview(null)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="workbench-smart-presets">
      <div className="admin-pricelist-smart-scope">
        <span className="admin-pricelist-smart-scope-label">
          Scope
          <AdminHelpTip text="Presets and kit actions apply only within this scope. Use Preview before pushing to the draft." />
        </span>
        <label>
          <input
            type="radio"
            name="preset-scope"
            checked={scope === 'filtered'}
            onChange={() => onScopeChange('filtered')}
          />
          Filter ({filtered.length})
        </label>
        <label>
          <input
            type="radio"
            name="preset-scope"
            checked={scope === 'selected'}
            onChange={() => onScopeChange('selected')}
          />
          Selected ({rows.filter((r) => r.selected).length})
        </label>
        <label>
          <input
            type="radio"
            name="preset-scope"
            checked={scope === 'all'}
            onChange={() => onScopeChange('all')}
          />
          All ({rows.length})
        </label>
      </div>

      <p className="admin-muted">
        Pick a preset, <strong>Preview</strong> to see before/after, then <strong>Push to draft</strong> when it
        looks right. {KIT_LABEL} = component list for a complete unit ({KIT_TOOLTIP})
      </p>

      {[...grouped.entries()].map(([cat, presets]) => (
        <section key={cat} className="workbench-smart-presets-group">
          <h3 className="workbench-smart-presets-group-title">{CATEGORY_LABELS[cat]}</h3>
          <ul className="workbench-smart-presets-list">
            {presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`workbench-smart-preset-card${activeId === p.id ? ' is-active' : ''}`}
                  onClick={() => runPreview(p)}
                >
                  <strong>{p.title}</strong>
                  <span className="admin-muted">{p.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {activePreset && (rulePreview || kitPreview) && (
        <div className="admin-pricelist-simulation workbench-smart-presets-preview" role="region">
          <h4>Preview — {activePreset.title}</h4>

          {rulePreview && (
            <>
              <p className="admin-muted">
                <strong>Runs as:</strong> {rulePreview.interpretedAs}
              </p>
              <ul className="admin-pricelist-simulation-stats">
                <li>
                  <span>Matched</span> {rulePreview.matched}
                </li>
                <li>
                  <span>Would change</span> {rulePreview.wouldChange}
                </li>
              </ul>
              <p>{rulePreview.message}</p>
              {rulePreview.warnings.map((w) => (
                <p key={w} className="admin-pricelist-simulation-warning">
                  {w}
                </p>
              ))}
              {rulePreview.samples.length > 0 && (
                <ul className="admin-pricelist-simulation-samples">
                  {rulePreview.samples.map((s, i) => (
                    <li key={`${s.sku}-${i}`} className="admin-pricelist-simulation-sample">
                      <div className="admin-pricelist-simulation-diff">
                        <div className="admin-pricelist-simulation-diff-row admin-pricelist-simulation-diff-row--before">
                          <span className="admin-pricelist-simulation-diff-label">Before</span>
                          <span className="admin-pricelist-simulation-diff-value">{s.before}</span>
                        </div>
                        <div className="admin-pricelist-simulation-diff-row admin-pricelist-simulation-diff-row--after">
                          <span className="admin-pricelist-simulation-diff-label">After</span>
                          <span className="admin-pricelist-simulation-diff-value">{s.after}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {rulePreview.wouldChange === 0 && activePreset.kind === 'rule' && activePreset.promptHint && onOpenAiCommand && (
                <div className="admin-pricelist-simulation-troubleshoot">
                  <p>Nothing matched in this scope. Try AI command with a broader filter:</p>
                  <button
                    type="button"
                    className="btn btn-small btn-outline"
                    onClick={() => onOpenAiCommand(activePreset.promptHint!)}
                  >
                    Open in AI command →
                  </button>
                </div>
              )}
            </>
          )}

          {kitPreview && (
            <>
              <p>{kitPreview.summary}</p>
              {kitPreview.warnings.map((w) => (
                <p key={w} className="admin-pricelist-simulation-warning">
                  {w}
                </p>
              ))}
              {kitPreview.samples.length > 0 && (
                <ul className="admin-pricelist-simulation-samples">
                  {kitPreview.samples.map((s, i) => (
                    <li key={i}>
                      <strong>{s.label}</strong> <span className="admin-muted">{s.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="admin-pricelist-smart-actions workbench-smart-presets-apply">
            <button
              type="button"
              className="btn"
              disabled={
                applying ||
                (rulePreview ? rulePreview.wouldChange === 0 && activePreset.kind === 'rule' : !kitPreview?.canApply)
              }
              onClick={() => void pushToDraft()}
            >
              {applying ? 'Applying…' : 'Push to draft'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setActiveId(null)
                setRulePreview(null)
                setKitPreview(null)
              }}
            >
              Cancel
            </button>
            {activePreset.kind === 'rule' && activePreset.promptHint && onOpenAiCommand && (
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => onOpenAiCommand(activePreset.promptHint!)}
              >
                Tweak in AI command
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
