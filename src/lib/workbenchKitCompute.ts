/**
 * Plan, run, and summarise unit-kit (BOM) bulk compute for the workbench.
 */
import { bulkComputeDraftBom, hasWorkbenchBom, mergeWorkbenchRowPatch } from '@/lib/workbenchBom'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { HingeBrand } from '@/lib/tealburyOrderSetup'

const UNIT_SECTION =
  /high[\s-]*line|drawer[\s-]*line|wall\s*unit|base\s*unit|tower|multidrawer|larder|corner|appliance|wine/i
const PANEL_LIKE = /\b(end\s*)?panel\b|plinth|cornice|pelmet\b/i

/** Tealbury row sold as complete that is a kitchen unit (not a panel/trim mis-tagged as complete). */
export function isTealburyKitchenUnitComplete(row: PricelistWorkbenchRow): boolean {
  if (row.source !== 'tealbury' || row.item_kind !== 'complete') return false
  const hay = `${row.section} ${row.name} ${row.trade_code} ${row.sku}`.toLowerCase()
  if (PANEL_LIKE.test(hay) && !UNIT_SECTION.test(hay)) return false
  if (/^18mmpln/i.test(row.trade_code || row.sku)) return false
  return true
}

export function listKitComputeTargets(
  rows: PricelistWorkbenchRow[],
  mode: 'all' | 'selected',
): PricelistWorkbenchRow[] {
  const pool = rows.filter(isTealburyKitchenUnitComplete)
  if (mode === 'selected') return pool.filter((r) => r.selected)
  return pool
}

export type KitComputePlan = {
  mode: 'all' | 'selected'
  total: number
  withKit: number
  missingKit: number
  misTaggedPanels: number
  explanation: string
  sampleUnits: { label: string; detail: string }[]
  sampleMisTagged: { label: string; detail: string }[]
}

export function buildKitComputePlan(rows: PricelistWorkbenchRow[], mode: 'all' | 'selected'): KitComputePlan {
  const allCompletes = rows.filter((r) => r.source === 'tealbury' && r.item_kind === 'complete')
  const targets = listKitComputeTargets(rows, mode)
  const misTagged = allCompletes.filter((r) => !isTealburyKitchenUnitComplete(r))
  const withKit = targets.filter((r) => hasWorkbenchBom(r)).length

  const missing = targets.filter((r) => !hasWorkbenchBom(r))
  const sampleUnits = [...missing, ...targets.filter((r) => hasWorkbenchBom(r))]
    .slice(0, 6)
    .map((r) => ({
      label: r.trade_code?.trim() || r.sku.replace(/\s*·.*/, '').trim(),
      detail: `${r.door_range || '—'} · ${r.section?.slice(0, 32) || '—'} · kit ${hasWorkbenchBom(r) ? 'will refresh' : 'will compute'}`,
    }))

  const explanation =
    mode === 'all'
      ? `This builds a parts list (carcass, door, hinges, etc.) on each Tealbury kitchen unit sold as “complete”. It uses Lamtek + UFORM rows already in this draft. End panels and trim are not included — run “Infer part types” if you still see panels listed as completes.`
      : `This builds unit kits only on ticked Tealbury kitchen units (not panels/trim).`

  return {
    mode,
    total: targets.length,
    withKit,
    missingKit: targets.length - withKit,
    misTaggedPanels: misTagged.length,
    explanation,
    sampleUnits,
    sampleMisTagged: misTagged.slice(0, 4).map((r) => ({
      label: r.trade_code || r.sku.slice(0, 24),
      detail: `${r.name.slice(0, 40)} — sold-as complete but looks like a panel/trim row`,
    })),
  }
}

export type KitComputeRunResult = {
  ok: number
  failed: number
  notes: string[]
  rows: PricelistWorkbenchRow[]
  failureSamples: { label: string; detail: string }[]
}

export async function runKitComputeWithProgress(
  rows: PricelistWorkbenchRow[],
  targets: PricelistWorkbenchRow[],
  opts: {
    hingeBrand?: HingeBrand
    onProgress: (done: number, total: number, label?: string) => void
    batchSize?: number
  },
): Promise<KitComputeRunResult> {
  const total = targets.length
  const batchSize = opts.batchSize ?? 40
  const notes: string[] = []
  let ok = 0
  let failed = 0
  const rowMap = new Map(rows.map((r) => [r.id, r]))

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize)
    const currentRows = [...rowMap.values()]
    const res = bulkComputeDraftBom(batch, currentRows, opts.hingeBrand ?? 'titus')
    ok += res.ok
    failed += res.failed
    if (notes.length < 30) notes.push(...res.notes.slice(0, Math.max(0, 30 - notes.length)))
    for (const [id, patch] of res.patches) {
      const prev = rowMap.get(id)
      if (prev) rowMap.set(id, mergeWorkbenchRowPatch(prev, patch))
    }
    const done = Math.min(i + batch.length, total)
    const last = batch[batch.length - 1]
    opts.onProgress(
      done,
      total,
      last ? `${last.trade_code || last.sku} · ${last.door_range || '—'}` : undefined,
    )
    await new Promise((r) => window.setTimeout(r, 0))
  }

  const failureSamples = notes.slice(0, 8).map((n) => {
    const [label, ...rest] = n.split(':')
    return { label: label.trim(), detail: rest.join(':').trim() || 'Could not resolve kit' }
  })

  return {
    ok,
    failed,
    notes,
    rows: [...rowMap.values()],
    failureSamples,
  }
}

export function buildKitComputeResultPreview(
  run: KitComputeRunResult,
  plan: KitComputePlan,
): {
  explanation: string
  stats: { label: string; value: string }[]
  samples: { label: string; detail: string; tone: 'ok' | 'warn' | 'fail' }[]
  troubleshoot: { id: string; label: string }[]
} {
  const stats = [
    { label: 'Kitchen units processed', value: String(plan.total) },
    { label: 'Kits stored', value: String(run.ok) },
    { label: 'Could not build kit', value: String(run.failed) },
  ]
  if (plan.misTaggedPanels > 0) {
    stats.push({ label: 'Panels still marked complete', value: String(plan.misTaggedPanels) })
  }

  const explanation =
    run.failed > 0
      ? `${run.ok} unit(s) now have a kit on the row. ${run.failed} failed — usually “No Doors” ranges, missing Lamtek carcass sizes, or missing UFORM door sizes. Use the actions below to fix groups of issues, then run compute again.`
      : `${run.ok} unit(s) now have a stored kit. Publish will copy these to live assemblies when component SKUs exist.`

  const samples: { label: string; detail: string; tone: 'ok' | 'warn' | 'fail' }[] = []
  if (run.ok > 0) {
    samples.push({
      label: 'Success',
      detail: `${run.ok} kitchen unit kit(s) saved on draft rows`,
      tone: 'ok',
    })
  }
  for (const f of run.failureSamples) {
    samples.push({ ...f, tone: 'fail' })
  }

  const troubleshoot: { id: string; label: string }[] = []
  if (run.failed > 0) {
    troubleshoot.push({ id: 'open_validation', label: 'Open pre-publish validation (gap groups)' })
    troubleshoot.push({ id: 'clone_uform', label: 'Clone UFORM door sizes to missing ranges' })
    troubleshoot.push({ id: 'select_no_doors', label: 'Select “No Doors” completes' })
    troubleshoot.push({ id: 'infer_types', label: 'Infer part types (fix panels → accessory)' })
  }
  if (plan.misTaggedPanels > 0) {
    troubleshoot.push({ id: 'assign_panels', label: 'Bulk assign Panels category' })
  }
  troubleshoot.push({ id: 'filter_failed', label: 'Filter table: kit column empty' })

  return { explanation, stats, samples, troubleshoot }
}
