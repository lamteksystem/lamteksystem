import { useCallback, useEffect, useState } from 'react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import {
  defaultPromptPresetName,
  loadPromptPresets,
  savePromptPresets,
  type SavedPromptPreset,
} from '@/lib/pricelistWorkbenchPromptPresets'
import {
  parseSmartCommandPrompt,
  simulateRuleOnRows,
  type RuleSimulationResult,
  type WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'
import type { CategoryRow } from '@/types/database'
export type SmartApplyScope = 'all' | 'filtered' | 'selected'

type Props = {
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  scope: SmartApplyScope
  onRunRule: (rule: WorkbenchRule, confirmDelete?: boolean) => void
  onNotify: (message: string, error?: string | null) => void
}

type FlowPhase = 'idle' | 'simulated' | 'approved' | 'refining'

export default function PricelistWorkbenchQuickCommand({
  rows,
  filtered,
  categories,
  scope,
  onRunRule,
  onNotify,
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<FlowPhase>('idle')
  const [simulation, setSimulation] = useState<RuleSimulationResult | null>(null)
  const [pendingRule, setPendingRule] = useState<WorkbenchRule | null>(null)
  const [promptPresets, setPromptPresets] = useState<SavedPromptPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [refineAddition, setRefineAddition] = useState('')

  useEffect(() => {
    void (async () => {
      setPromptPresets(await loadPromptPresets())
    })()
  }, [])

  const resetFlow = useCallback(() => {
    setPhase('idle')
    setSimulation(null)
    setPendingRule(null)
    setShowSaveForm(false)
    setRefineAddition('')
  }, [])

  function resolveTargetIds(): Set<string> | undefined {
    if (scope === 'all') return undefined
    if (scope === 'filtered') return new Set(filtered.map((r) => r.id))
    const sel = rows.filter((r) => r.selected)
    return new Set(sel.map((r) => r.id))
  }

  function parsePromptOrNotify(): WorkbenchRule | null {
    const { rule, error } = parseSmartCommandPrompt(prompt)
    if (!rule || error) {
      onNotify('', error ?? 'Could not parse command.')
      return null
    }
    return rule
  }

  function runSimulation() {
    const rule = parsePromptOrNotify()
    if (!rule) return
    const targetIds = resolveTargetIds()
    const poolSize =
      scope === 'all' ? rows.length : scope === 'filtered' ? filtered.length : rows.filter((r) => r.selected).length
    if (!poolSize) {
      onNotify('', scope === 'selected' ? 'No rows selected.' : 'No rows in scope.')
      return
    }
    const sim = simulateRuleOnRows(rows, rule, targetIds, categories)
    setPendingRule(rule)
    setSimulation(sim)
    setPhase('simulated')
    setShowSaveForm(false)
    setRefineAddition('')
  }

  function runWithoutTest() {
    const rule = parsePromptOrNotify()
    if (!rule) return
    resetFlow()
    onRunRule(rule)
  }

  function applyRefineAndRetest() {
    const extra = refineAddition.trim()
    const nextPrompt = extra ? (prompt.trim() ? `${prompt.trim()} ${extra}` : extra) : prompt.trim()
    setPrompt(nextPrompt)
    setRefineAddition('')
    if (!nextPrompt) return
    const { rule, error } = parseSmartCommandPrompt(nextPrompt)
    if (!rule || error) {
      resetFlow()
      onNotify('', error ?? 'Could not parse command.')
      return
    }
    const targetIds = resolveTargetIds()
    const sim = simulateRuleOnRows(rows, rule, targetIds, categories)
    setPendingRule(rule)
    setSimulation(sim)
    setPhase('simulated')
    setShowSaveForm(false)
  }

  async function saveAsPreset() {
    const name = presetName.trim() || defaultPromptPresetName(prompt)
    if (!prompt.trim()) {
      onNotify('', 'Enter a command before saving.')
      return
    }
    const preset: SavedPromptPreset = {
      id: `prompt-${Date.now()}`,
      name: name.slice(0, 120),
      prompt: prompt.trim(),
      createdAt: new Date().toISOString(),
    }
    const next = [...promptPresets, preset]
    setPromptPresets(next)
    await savePromptPresets(next)
    setShowSaveForm(false)
    resetFlow()
    onNotify(`Saved preset “${preset.name}”.`)
  }

  async function deletePreset(id: string) {
    const next = promptPresets.filter((p) => p.id !== id)
    setPromptPresets(next)
    await savePromptPresets(next)
  }

  function loadPreset(p: SavedPromptPreset) {
    setPrompt(p.prompt)
    resetFlow()
  }

  function confirmAndRun() {
    if (!pendingRule) return
    const rule = pendingRule
    resetFlow()
    onRunRule(rule)
  }

  function onPromptChange(value: string) {
    setPrompt(value)
    if (phase !== 'idle') resetFlow()
  }

  return (
    <div className="admin-pricelist-smart-card admin-pricelist-quick-command">
      <h3>
        Quick command
        <AdminHelpTip text="Write plain English, test with a dry-run simulation, confirm it looks right, then run once or save as a preset. Nothing changes until you run on the draft." />
      </h3>
      <p className="admin-muted">
        Describe filters and action in one sentence. Use <strong>Test simulation</strong> to preview matches and
        sample changes before applying.
      </p>

      {promptPresets.length > 0 && (
        <div className="admin-pricelist-prompt-presets-bar">
          <label className="admin-pricelist-prompt-presets-label">
            Saved prompts
            <select
              className="admin-pricelist-prompt-presets-select"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value
                e.target.value = ''
                const p = promptPresets.find((x) => x.id === id)
                if (p) loadPreset(p)
              }}
            >
              <option value="">Load a saved prompt…</option>
              {promptPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <textarea
        className="admin-pricelist-prompt"
        rows={4}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder='e.g. Remove the word "Section:" from the description of each product'
      />

      <div className="admin-pricelist-smart-actions">
        <button type="button" className="btn btn-small" onClick={runSimulation} disabled={!prompt.trim()}>
          Test simulation
        </button>
        <button type="button" className="btn btn-small btn-outline" onClick={runWithoutTest} disabled={!prompt.trim()}>
          Run without testing
        </button>
      </div>

      {simulation && phase !== 'idle' && (
        <div className="admin-pricelist-simulation" role="region" aria-label="Command simulation preview">
          <h4>Simulation preview</h4>
          <p className="admin-muted admin-pricelist-simulation-parse">
            <strong>Interpreted as:</strong> {simulation.interpretedAs}
          </p>
          <ul className="admin-pricelist-simulation-stats">
            <li>
              <span>Scope</span> {simulation.poolSize} row(s)
            </li>
            <li>
              <span>Matched</span> {simulation.matched}
            </li>
            <li>
              <span>Would change</span> {simulation.wouldChange}
            </li>
          </ul>
          <p className="admin-pricelist-simulation-message">{simulation.message}</p>
          {simulation.warnings.map((w) => (
            <p key={w} className="admin-pricelist-simulation-warning">
              {w}
            </p>
          ))}
          {simulation.samples.length > 0 && (
            <div className="admin-pricelist-simulation-samples-wrap">
              <p className="admin-pricelist-simulation-samples-title">
                Sample rows {simulation.matched > simulation.samples.length
                  ? `(showing ${simulation.samples.length} of ${simulation.matched})`
                  : ''}
              </p>
              <ul className="admin-pricelist-simulation-samples">
                {simulation.samples.map((s, i) => (
                  <li key={`${s.sku}-${i}`}>
                    <strong>{s.sku}</strong>
                    <span className="admin-muted">{s.name}</span>
                    <em>{s.detail}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phase === 'simulated' && (
            <div className="admin-pricelist-simulation-outcome">
              <p>Did this simulation match what you wanted?</p>
              <div className="admin-pricelist-smart-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    setPhase('approved')
                    setPresetName(defaultPromptPresetName(prompt))
                  }}
                >
                  Yes, looks right
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-outline"
                  onClick={() => {
                    resetFlow()
                    onNotify('', 'Adjust the command and run Test simulation again.')
                  }}
                >
                  No, needs changes
                </button>
              </div>
            </div>
          )}

          {phase === 'approved' && !showSaveForm && (
            <div className="admin-pricelist-simulation-followup">
              <p>Command confirmed. What would you like to do?</p>
              <div className="admin-pricelist-smart-actions">
                <button type="button" className="btn btn-small" onClick={confirmAndRun}>
                  Run on draft now
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-outline"
                  onClick={() => {
                    setPresetName(defaultPromptPresetName(prompt))
                    setShowSaveForm(true)
                  }}
                >
                  Save as preset
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    setPhase('refining')
                    setShowSaveForm(false)
                  }}
                >
                  Refine command
                </button>
              </div>
            </div>
          )}

          {phase === 'refining' && (
            <div className="admin-pricelist-simulation-refine">
              <p className="admin-muted">Add more detail to your command, then re-test.</p>
              <label>
                Add to command
                <textarea
                  className="admin-pricelist-prompt admin-pricelist-prompt--refine"
                  rows={2}
                  value={refineAddition}
                  onChange={(e) => setRefineAddition(e.target.value)}
                  placeholder='e.g. only for Tealbury rows in section "HIGHLINE"'
                />
              </label>
              <div className="admin-pricelist-smart-actions">
                <button type="button" className="btn btn-small" onClick={applyRefineAndRetest}>
                  Update &amp; re-test
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setPhase('approved')}>
                  Cancel refine
                </button>
              </div>
            </div>
          )}

          {showSaveForm && (
            <div className="admin-pricelist-simulation-save">
              <label>
                Preset name
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Name for this command"
                />
              </label>
              <div className="admin-pricelist-smart-actions">
                <button type="button" className="btn btn-small" onClick={() => void saveAsPreset()}>
                  Save preset
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setShowSaveForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {promptPresets.length > 0 && (
        <details className="admin-pricelist-prompt-presets-details">
          <summary>Manage saved prompts ({promptPresets.length})</summary>
          <ul className="admin-pricelist-preset-list">
            {promptPresets.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <p className="admin-muted">{p.prompt}</p>
                </div>
                <div className="admin-pricelist-preset-actions">
                  <button type="button" className="btn btn-small btn-outline" onClick={() => loadPreset(p)}>
                    Load
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => void deletePreset(p.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
