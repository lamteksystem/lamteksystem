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
  bestPromptSuggestion,
  buildPromptAssist,
  type PromptAssistResult,
  type PromptAssistSuggestion,
} from '@/lib/pricelistWorkbenchPromptAssist'
import {
  describeRule,
  parseSmartCommandLoose,
  parseSmartCommandPrompt,
  simulateRuleOnRows,
  type RuleSimulationResult,
  type WorkbenchRule,
} from '@/lib/pricelistWorkbenchRules'
import { buildAiContext, parseCommandWithAi } from '@/lib/pricelistWorkbenchAi'
import type { CategoryRow } from '@/types/database'
export type SmartApplyScope = 'all' | 'filtered' | 'selected'

type Props = {
  rows: PricelistWorkbenchRow[]
  filtered: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  scope: SmartApplyScope
  /** When true, interpret commands with the AI model first (falls back to offline). */
  aiEnabled: boolean
  onRunRule: (rule: WorkbenchRule, confirmDelete?: boolean) => void
  onNotify: (message: string, error?: string | null) => void
  /** Hand the best-guess rule to the dropdown builder so the user can fix it in place. */
  onEditInBuilder?: (rule: WorkbenchRule) => void
}

type FlowPhase = 'idle' | 'simulated' | 'approved' | 'refining'

export default function PricelistWorkbenchQuickCommand({
  rows,
  filtered,
  categories,
  scope,
  aiEnabled,
  onRunRule,
  onNotify,
  onEditInBuilder,
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<FlowPhase>('idle')
  const [simulation, setSimulation] = useState<RuleSimulationResult | null>(null)
  const [pendingRule, setPendingRule] = useState<WorkbenchRule | null>(null)
  const [promptPresets, setPromptPresets] = useState<SavedPromptPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [refineAddition, setRefineAddition] = useState('')
  const [assist, setAssist] = useState<PromptAssistResult | null>(null)
  const [highlightedFix, setHighlightedFix] = useState<PromptAssistSuggestion | null>(null)
  /** Best-guess rule shown when the strict parser couldn't fully understand the prompt. */
  const [fallbackRule, setFallbackRule] = useState<WorkbenchRule | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  /** Whether the last interpretation came from the AI model (vs offline parser). */
  const [interpretedViaAi, setInterpretedViaAi] = useState(false)

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
    setAssist(null)
    setHighlightedFix(null)
    setFallbackRule(null)
    setInterpretedViaAi(false)
  }, [])

  function offerBuilderFallback() {
    if (!onEditInBuilder) return false
    const loose = parseSmartCommandLoose(prompt)
    setFallbackRule(loose.rule)
    setPhase('idle')
    setSimulation(null)
    return true
  }

  function applySimulationResult(
    rule: WorkbenchRule,
    sim: RuleSimulationResult,
    promptText: string = prompt
  ) {
    const targetIds = resolveTargetIds()
    const assistResult = buildPromptAssist(promptText, rule, sim, rows, targetIds, categories)
    const best = bestPromptSuggestion(assistResult)
    setPendingRule(rule)
    setSimulation(sim)
    setAssist(assistResult)
    setHighlightedFix(
      assistResult.needsAttention && best && best.simulation.wouldChange > 0 ? best : null
    )
    setPhase('simulated')
    setShowSaveForm(false)
    setRefineAddition('')
  }

  function applySuggestion(sug: PromptAssistSuggestion) {
    setPrompt(sug.canonicalPrompt)
    applySimulationResult(sug.rule, sug.simulation, sug.canonicalPrompt)
    if (sug.simulation.wouldChange > 0) {
      setPhase('approved')
      setPresetName(defaultPromptPresetName(sug.canonicalPrompt))
    }
  }

  function resolveTargetIds(): Set<string> | undefined {
    if (scope === 'all') return undefined
    if (scope === 'filtered') return new Set(filtered.map((r) => r.id))
    const sel = rows.filter((r) => r.selected)
    return new Set(sel.map((r) => r.id))
  }

  /**
   * Resolve the prompt to a rule. With AI on, ask the model first; if it's
   * unavailable, offline, or returns nothing usable, fall back to the offline
   * parser. Returns null when even the offline parser can't understand it.
   */
  async function resolveRule(): Promise<{ rule: WorkbenchRule | null; error?: string; viaAi: boolean }> {
    if (aiEnabled) {
      setAiThinking(true)
      try {
        const ctx = buildAiContext(rows, categories.map((c) => c.name))
        const ai = await parseCommandWithAi(prompt, ctx)
        if (ai.rule) return { rule: ai.rule, viaAi: true }
      } finally {
        setAiThinking(false)
      }
    }
    const { rule, error } = parseSmartCommandPrompt(prompt)
    return { rule, error, viaAi: false }
  }

  async function runSimulation() {
    if (!prompt.trim()) return
    const { rule, error, viaAi } = await resolveRule()
    if (!rule) {
      if (!offerBuilderFallback()) onNotify('', error ?? 'Could not parse command.')
      return
    }
    setFallbackRule(null)
    setInterpretedViaAi(viaAi)
    const targetIds = resolveTargetIds()
    const poolSize =
      scope === 'all' ? rows.length : scope === 'filtered' ? filtered.length : rows.filter((r) => r.selected).length
    if (!poolSize) {
      onNotify('', scope === 'selected' ? 'No rows selected.' : 'No rows in scope.')
      return
    }
    const sim = simulateRuleOnRows(rows, rule, targetIds, categories)
    applySimulationResult(rule, sim)
  }

  async function runWithoutTest() {
    if (!prompt.trim()) return
    const { rule, error } = await resolveRule()
    if (!rule) {
      if (!offerBuilderFallback()) onNotify('', error ?? 'Could not parse command.')
      return
    }
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
    applySimulationResult(rule, sim)
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
        <AdminHelpTip text="Test simulation dry-runs your command. If the parser misread it or nothing would change, the assistant suggests a repaired command — apply the fix and re-test until rows would update." />
      </h3>
      <p className="admin-muted">
        Describe filters and action in one sentence. <strong>Test simulation</strong> checks the result and
        troubleshoots automatically when the command would not work as intended.
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
        placeholder={
          'Write it however you like, e.g.\n' +
          '• Change the text in the name and description that is in capitals to Sentence case\n' +
          '• Remove the word "Section:" from the description of each product\n' +
          '• Assign category "Base units" to all unassigned Tealbury rows'
        }
      />

      <div className="admin-pricelist-smart-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => void runSimulation()}
          disabled={!prompt.trim() || aiThinking}
        >
          {aiThinking ? 'Thinking…' : 'Test simulation'}
        </button>
        <button
          type="button"
          className="btn btn-small btn-outline"
          onClick={() => void runWithoutTest()}
          disabled={!prompt.trim() || aiThinking}
        >
          Run without testing
        </button>
        {aiEnabled && <span className="admin-pricelist-ai-badge">✨ AI on</span>}
      </div>

      {fallbackRule && onEditInBuilder && (
        <div className="admin-pricelist-fallback" role="region" aria-label="Command needs adjusting">
          <h4>I couldn&rsquo;t fully read that — here&rsquo;s my best guess</h4>
          <p className="admin-muted">
            Interpreted as: <strong>{describeRule(fallbackRule)}</strong>. Load it into the dropdown
            builder below to fix the action or filters, then run — no need to come back to chat.
          </p>
          <div className="admin-pricelist-smart-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                onEditInBuilder(fallbackRule)
                setFallbackRule(null)
              }}
            >
              Adjust with dropdowns →
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setFallbackRule(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {simulation && phase !== 'idle' && (
        <div className="admin-pricelist-simulation" role="region" aria-label="Command simulation preview">
          <h4>Simulation preview</h4>
          <p className="admin-muted admin-pricelist-simulation-parse">
            <strong>Interpreted as:</strong> {simulation.interpretedAs}
            {interpretedViaAi ? <span className="admin-pricelist-ai-badge"> ✨ via AI</span> : null}
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
                  <li key={`${s.sku}-${i}`} className="admin-pricelist-simulation-sample">
                    <div className="admin-pricelist-simulation-sample-head">
                      <strong>{s.sku}</strong>
                      <span className="admin-muted">{s.name}</span>
                      <span className="admin-pricelist-simulation-sample-field">{s.fieldLabel}</span>
                    </div>
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
            </div>
          )}

          {assist?.needsAttention && (
            <div className="admin-pricelist-simulation-troubleshoot">
              <h4>Assistant — command would not work as written</h4>
              <ul className="admin-pricelist-simulation-diagnosis">
                {assist.diagnosis.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {highlightedFix && (
                <div className="admin-pricelist-simulation-fix-card admin-pricelist-simulation-fix-card--primary">
                  <p className="admin-pricelist-simulation-fix-title">Suggested fix</p>
                  <p className="admin-muted">{highlightedFix.reason}</p>
                  <p className="admin-pricelist-simulation-parse">
                    <strong>Would run as:</strong> {describeRule(highlightedFix.rule)}
                  </p>
                  <p className="admin-pricelist-simulation-fix-stats">
                    Would change <strong>{highlightedFix.simulation.wouldChange}</strong> of{' '}
                    {highlightedFix.simulation.poolSize} row(s) in scope
                  </p>
                  <div className="admin-pricelist-smart-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => applySuggestion(highlightedFix)}
                    >
                      Apply fix &amp; continue
                    </button>
                  </div>
                </div>
              )}
              {assist.suggestions.length > 1 && (
                <div className="admin-pricelist-simulation-alt-fixes">
                  <p className="admin-pricelist-simulation-samples-title">Other options</p>
                  <ul className="admin-pricelist-simulation-fix-list">
                    {assist.suggestions
                      .filter((s) => s.id !== highlightedFix?.id)
                      .map((sug) => (
                        <li key={sug.id}>
                          <div>
                            <strong>{sug.label}</strong>
                            <p className="admin-muted">{sug.reason}</p>
                            <p className="admin-muted">
                              {describeRule(sug.rule)} — would change {sug.simulation.wouldChange} row(s)
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-small btn-outline"
                            onClick={() => applySuggestion(sug)}
                          >
                            Try this
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div className="admin-pricelist-smart-actions">
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setPhase('refining')}>
                  Edit command manually
                </button>
              </div>
            </div>
          )}

          {phase === 'simulated' && !assist?.needsAttention && simulation.wouldChange > 0 && (
            <div className="admin-pricelist-simulation-outcome">
              <p>Simulation looks good — ready to apply.</p>
              <div className="admin-pricelist-smart-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    setPhase('approved')
                    setPresetName(defaultPromptPresetName(prompt))
                  }}
                >
                  Continue — run or save
                </button>
                <button type="button" className="btn btn-small btn-outline" onClick={() => setPhase('refining')}>
                  Refine command
                </button>
              </div>
            </div>
          )}

          {phase === 'simulated' && !assist?.needsAttention && simulation.wouldChange === 0 && (
            <div className="admin-pricelist-simulation-outcome">
              <p>No rows would change. Adjust filters or wording, then test again.</p>
              <div className="admin-pricelist-smart-actions">
                {onEditInBuilder && pendingRule && (
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onEditInBuilder(pendingRule)}
                  >
                    Adjust with dropdowns →
                  </button>
                )}
                <button type="button" className="btn btn-small btn-outline" onClick={() => setPhase('refining')}>
                  Refine command
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
