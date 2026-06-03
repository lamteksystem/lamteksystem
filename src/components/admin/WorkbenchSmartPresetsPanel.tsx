import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { SmartApplyScope } from '@/components/admin/PricelistWorkbenchQuickCommand'
import { KIT_LABEL, KIT_TOOLTIP } from '@/lib/kitTerminology'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { RuleSimulationResult, WorkbenchRule } from '@/lib/pricelistWorkbenchRules'
import {
  buildKitComputePlan,
  buildKitComputeResultPreview,
  type KitComputeRunResult,
} from '@/lib/workbenchKitCompute'
import {
  WORKBENCH_SMART_PRESETS,
  previewKitAction,
  previewRulePreset,
  type KitActionId,
  type KitActionPreview,
  type KitTroubleshootId,
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
  onComputeUnitKits: (
    mode: 'all' | 'selected',
    onProgress: (done: number, total: number, label?: string) => void,
  ) => Promise<KitComputeRunResult>
  onTroubleshoot?: (id: KitTroubleshootId) => void
  onOpenAiCommand?: (promptHint: string) => void
  onNotify: (message: string, error?: string | null) => void
}

const CATEGORY_LABELS: Record<SmartPresetCategory, string> = {
  taxonomy: 'Categories & sold-as',
  kit: `${KIT_LABEL} & gaps`,
  cleanup: 'Cleanup',
}

const COMPUTE_ACTIONS = new Set<KitActionId>(['compute_kits_all', 'compute_kits_selected'])

export default function WorkbenchSmartPresetsPanel({
  rows,
  filtered,
  categories,
  scope,
  onScopeChange,
  onRunRule,
  onApplyKitAction,
  onComputeUnitKits,
  onTroubleshoot,
  onOpenAiCommand,
  onNotify,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rulePreview, setRulePreview] = useState<RuleSimulationResult | null>(null)
  const [kitPreview, setKitPreview] = useState<KitActionPreview | null>(null)
  const [applying, setApplying] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

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

  const scrollToPreview = useCallback(() => {
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

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
      scrollToPreview()
    },
    [rows, scopeRows, categories, targetIds, scrollToPreview],
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

  useEffect(() => {
    if ((rulePreview || kitPreview) && activeId) scrollToPreview()
  }, [rulePreview, kitPreview, activeId, scrollToPreview])

  async function pushToDraft() {
    if (!activePreset) return

    if (activePreset.kind === 'rule') {
      setApplying(true)
      try {
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
      } finally {
        setApplying(false)
      }
      return
    }

    if (!kitPreview?.canApply && kitPreview?.phase !== 'result') {
      onNotify('', kitPreview?.warnings[0] ?? 'Cannot apply this action.')
      return
    }

    if (
      activePreset.kind === 'kit_action' &&
      COMPUTE_ACTIONS.has(activePreset.action) &&
      kitPreview?.phase === 'plan'
    ) {
      const mode = activePreset.action === 'compute_kits_all' ? 'all' : 'selected'
      const plan = buildKitComputePlan(rows, mode)
      setApplying(true)
      setKitPreview((prev) =>
        prev
          ? {
              ...prev,
              phase: 'running',
              progress: { done: 0, total: plan.total, label: 'Starting…' },
            }
          : prev,
      )
      scrollToPreview()
      try {
        const run = await onComputeUnitKits(mode, (done, total, label) => {
          setKitPreview((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'running',
                  progress: { done, total, label },
                }
              : prev,
          )
        })
        const resultPreview = buildKitComputeResultPreview(run, plan)
        setKitPreview({
          action: activePreset.action,
          title: activePreset.title,
          summary: `${run.ok} kit(s) stored · ${run.failed} failed`,
          affected: plan.total,
          ok: run.ok,
          failed: run.failed,
          phase: 'result',
          explanation: resultPreview.explanation,
          stats: resultPreview.stats,
          samples: resultPreview.samples,
          warnings: run.failed > 0 ? [`${run.failed} unit(s) still have no kit — see samples below.`] : [],
          troubleshoot: resultPreview.troubleshoot as KitActionPreview['troubleshoot'],
          canApply: false,
        })
        scrollToPreview()
        onNotify(`Unit kits: ${run.ok} stored, ${run.failed} could not be built.`)
      } catch (e) {
        onNotify('', e instanceof Error ? e.message : String(e))
        setKitPreview(previewKitAction(activePreset.action, rows, scopeRows, categories))
      } finally {
        setApplying(false)
      }
      return
    }

    if (kitPreview?.phase === 'result') {
      setActiveId(null)
      setKitPreview(null)
      return
    }

    setApplying(true)
    try {
      const res = await onApplyKitAction(activePreset.action)
      if (res.error) onNotify('', res.error)
      else onNotify(res.message)
      setActiveId(null)
      setKitPreview(null)
    } finally {
      setApplying(false)
    }
  }

  const pushLabel =
    kitPreview?.phase === 'running'
      ? 'Computing…'
      : kitPreview?.phase === 'result'
        ? 'Done — close'
        : activePreset?.kind === 'kit_action' && activePreset.action && COMPUTE_ACTIONS.has(activePreset.action)
          ? 'Compute & save to draft'
          : 'Push to draft'

  return (
    <div className="workbench-smart-presets">
      <div className="admin-pricelist-smart-scope">
        <span className="admin-pricelist-smart-scope-label">
          Scope
          <AdminHelpTip text="Category rules respect this scope. Unit kit compute always runs on all kitchen units (or selected units only)." />
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
        Click a preset to <strong>preview</strong> (scrolls down). {KIT_LABEL} = parts list for a sellable kitchen
        unit ({KIT_TOOLTIP})
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
        <div
          ref={previewRef}
          className="admin-pricelist-simulation workbench-smart-presets-preview"
          role="region"
          aria-label="Command preview"
        >
          <h4>
            {kitPreview?.phase === 'result' ? 'Results' : 'Preview'} — {activePreset.title}
          </h4>

          {kitPreview?.phase === 'running' && kitPreview.progress && (
            <div className="workbench-kit-progress">
              <div className="workbench-readiness-bar__track" aria-hidden>
                <span
                  className="workbench-readiness-bar__fill"
                  style={{
                    width: `${kitPreview.progress.total ? Math.round((kitPreview.progress.done / kitPreview.progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="admin-muted">
                Computing kits… <strong>{kitPreview.progress.done}</strong> / {kitPreview.progress.total}
                {kitPreview.progress.label ? ` — ${kitPreview.progress.label}` : ''}
              </p>
            </div>
          )}

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
            </>
          )}

          {kitPreview && kitPreview.phase !== 'running' && (
            <>
              <p className="workbench-preview-explanation">{kitPreview.explanation}</p>
              <p className="admin-muted">{kitPreview.summary}</p>

              {kitPreview.stats.length > 0 && (
                <dl className="workbench-readiness-stats">
                  {kitPreview.stats.map((s) => (
                    <div key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {kitPreview.warnings.map((w) => (
                <p key={w} className="admin-pricelist-simulation-warning">
                  {w}
                </p>
              ))}

              {kitPreview.samples.length > 0 && (
                <>
                  <p className="admin-pricelist-simulation-samples-title">
                    {kitPreview.phase === 'result' ? 'Outcome samples' : 'Example units (not panels)'}
                  </p>
                  <ul className="admin-pricelist-simulation-samples workbench-kit-sample-list">
                    {kitPreview.samples.map((s, i) => (
                      <li
                        key={i}
                        className={
                          s.tone === 'fail'
                            ? 'workbench-kit-sample--fail'
                            : s.tone === 'ok'
                              ? 'workbench-kit-sample--ok'
                              : undefined
                        }
                      >
                        <strong>{s.label}</strong> <span className="admin-muted">{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {kitPreview.troubleshoot.length > 0 && onTroubleshoot && (
                <div className="admin-pricelist-simulation-troubleshoot">
                  <p className="admin-pricelist-simulation-samples-title">Troubleshoot</p>
                  <div className="workbench-smart-troubleshoot-actions">
                    {kitPreview.troubleshoot.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="btn btn-small btn-outline"
                        disabled={applying}
                        onClick={() => onTroubleshoot(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="admin-pricelist-smart-actions workbench-smart-presets-apply">
            <button
              type="button"
              className="btn"
              disabled={
                applying ||
                kitPreview?.phase === 'running' ||
                (rulePreview
                  ? rulePreview.wouldChange === 0
                  : kitPreview?.phase === 'plan'
                    ? !kitPreview?.canApply
                    : false)
              }
              onClick={() => void pushToDraft()}
            >
              {applying ? 'Working…' : pushLabel}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={applying && kitPreview?.phase === 'running'}
              onClick={() => {
                if (activePreset.kind === 'kit_action' && kitPreview) {
                  setKitPreview(previewKitAction(activePreset.action, rows, scopeRows, categories))
                  return
                }
                setActiveId(null)
                setRulePreview(null)
                setKitPreview(null)
              }}
            >
              {kitPreview?.phase === 'result' ? 'Close' : 'Back'}
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
