import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATALOGUE_TOOLS, LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'
import ListPager from '@/components/admin/ListPager'
import { usePermission } from '@/hooks/usePermission'
import { fetchAllCategories } from '@/lib/categoryAdmin'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import {
  applyCategoryToRows,
  autoMapWorkbenchCategories,
  downloadWorkbenchTemplateXlsx,
  fillMissingWorkbenchProductNames,
  parsedToWorkbenchRow,
  publishWorkbenchRows,
  type PricelistSource,
  type PricelistWorkbenchRow,
} from '@/lib/pricelistWorkbench'
import { applyBomToCompleteProduct } from '@/lib/completeUnitBomApply'
import { parseTealburyPricelistWorkbookAsync } from '@/lib/tealburyPricelistParse'
import {
  autoAssignDoorRangeCategories,
  bootstrapTealburyCatalogueCategories,
  enrichWorkbenchRowsMetadata,
  TEALBURY_DOOR_RANGES,
} from '@/lib/tealburyCatalogueBuild'
import {
  parseUformSpecJsonBundle,
  uformProductsToWorkbenchRows,
} from '@/lib/uformSpecParse'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { supabase } from '@/lib/supabase'
import PricelistSourceImportProgress, {
  type PricelistSourceImportProgressState,
} from '@/components/admin/PricelistSourceImportProgress'
import AdminNoticeModal from '@/components/admin/AdminNoticeModal'
import { useListPagination } from '@/lib/listPagination'
import { deleteRowsByIds } from '@/lib/pricelistWorkbenchRules'
import PricelistWorkbenchSmartPanel from '@/components/admin/PricelistWorkbenchSmartPanel'
import PricelistWorkbenchSection from '@/components/admin/PricelistWorkbenchSection'
import PricelistWorkbenchTable from '@/components/admin/PricelistWorkbenchTable'
import PricelistWorkbenchTableToolbar from '@/components/admin/PricelistWorkbenchTableToolbar'
import {
  DEFAULT_WORKBENCH_FILTERS,
  filterAndSortWorkbenchRows,
  type WorkbenchTableFilters,
} from '@/lib/pricelistWorkbenchFilters'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import { clearWorkbenchDraft, loadWorkbenchDraft, saveWorkbenchDraft } from '@/lib/pricelistWorkbenchDraft'
import type { WorkbenchWarning } from '@/lib/pricelistWorkbenchWarnings'
import PricelistWorkbenchWarningsPanel from '@/components/admin/PricelistWorkbenchWarningsPanel'
import WorkbenchActionReportModal, {
  type WorkbenchActionReport,
} from '@/components/admin/WorkbenchActionReportModal'
import type { CategoryRow } from '@/types/database'

export default function AdminPricelistWorkbench() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const partTypesHook = useAssemblyPartTypes(true)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [rows, setRows] = useState<PricelistWorkbenchRow[]>([])
  const [warnings, setWarnings] = useState<WorkbenchWarning[]>([])
  const [setupAction, setSetupAction] = useState<string | null>(null)
  const [actionReport, setActionReport] = useState<WorkbenchActionReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<
    Partial<Record<PricelistSource, PricelistSourceImportProgressState>>
  >({})
  const [message, setMessage] = useState<string | null>(null)
  const [messageTitle, setMessageTitle] = useState('Done')
  const [error, setError] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const skipNextSaveRef = useRef(true)

  function showSuccess(title: string, text: string) {
    setMessageTitle(title)
    setMessage(text)
    setError(null)
  }

  const [tableFilters, setTableFilters] = useState<WorkbenchTableFilters>(DEFAULT_WORKBENCH_FILTERS)
  const [bulkCategoryId, setBulkCategoryId] = useState('')

  function patchTableFilters(patch: Partial<WorkbenchTableFilters>) {
    setTableFilters((prev) => ({ ...prev, ...patch }))
  }

  const tealburyInputRef = useRef<HTMLInputElement>(null)
  const lamtekInputRef = useRef<HTMLInputElement>(null)
  const uformJsonInputRef = useRef<HTMLInputElement>(null)

  const loadCategories = useCallback(async () => {
    const cats = await fetchAllCategories()
    setCategories(cats)
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const draft = await loadWorkbenchDraft()
        if (cancelled) return
        if (draft.rows.length) {
          setRows(enrichWorkbenchRowsMetadata(draft.rows))
        }
        if (draft.warnings.length) setWarnings(draft.warnings)
        setDraftUpdatedAt(draft.updated_at)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) {
          skipNextSaveRef.current = true
          setDraftLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftLoaded) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    const timer = window.setTimeout(() => {
      setDraftSaving(true)
      void saveWorkbenchDraft(rows, warnings)
        .then(() => setDraftUpdatedAt(new Date().toISOString()))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setDraftSaving(false))
    }, 600)
    return () => window.clearTimeout(timer)
  }, [rows, warnings, draftLoaded])

  const doorRanges = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.door_range) set.add(r.door_range)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const sections = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.section) set.add(r.section)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = useMemo(
    () => filterAndSortWorkbenchRows(rows, tableFilters),
    [rows, tableFilters],
  )

  const {
    pageItems,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(filtered, { defaultPageSize: 50, resetDeps: [tableFilters] })

  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows])
  const filteredSelectedCount = useMemo(() => filtered.filter((r) => r.selected).length, [filtered])

  const clearImportProgress = useCallback((source: PricelistSource, delayMs = 0) => {
    const run = () => {
      setImportProgress((prev) => {
        if (!prev[source]) return prev
        const next = { ...prev }
        delete next[source]
        return next
      })
    }
    if (delayMs > 0) window.setTimeout(run, delayMs)
    else run()
  }, [])

  const setSourceImportProgress = useCallback(
    (source: PricelistSource, percent: number, label: string, fileName: string) => {
      setImportProgress((prev) => ({
        ...prev,
        [source]: { percent, label, fileName },
      }))
    },
    []
  )

  const isSourceImporting = useCallback(
    (source: PricelistSource) => {
      const p = importProgress[source]
      return p != null && p.percent < 100
    },
    [importProgress]
  )

  const anyImporting = useMemo(
    () => (['tealbury', 'lamtek', 'uform'] as const).some((s) => isSourceImporting(s)),
    [isSourceImporting]
  )

  async function runBootstrapCategories() {
    setSetupAction('categories')
    setBusy(true)
    setError(null)
    try {
      const res = await bootstrapTealburyCatalogueCategories()
      await loadCategories()
      const lines = [
        res.created.length ? `Created: ${res.created.join(', ')}` : null,
        res.existing.length ? `Already present: ${res.existing.join(', ')}` : null,
        ...res.errors,
      ].filter((x): x is string => !!x)
      setActionReport({
        title: 'Categories ready',
        summary:
          res.created.length > 0
            ? `Created ${res.created.length} categor${res.created.length === 1 ? 'y' : 'ies'} with correct parent links where applicable.`
            : 'No new categories were needed — your taxonomy already includes Accessories, its sub-categories, and Drawer Fronts.',
        lines,
        variant: res.errors.length ? 'warn' : 'ok',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setSetupAction(null)
    }
  }

  async function ingestUformJson(file: File) {
    setError(null)
    setMessage(null)
    setSourceImportProgress('uform', 10, 'Reading JSON…', file.name)
    try {
      const text = await file.text()
      const bundle = JSON.parse(text) as unknown
      const products = parseUformSpecJsonBundle(bundle)
      if (!products.length) {
        setError('No products in JSON. Run npm run catalogue:parse-uform-specs after adding PDFs to Pricelists and Specifications/uform/specs/')
        clearImportProgress('uform')
        return
      }
      const workbench = enrichWorkbenchRowsMetadata(uformProductsToWorkbenchRows(products))
      const withCats = autoAssignDoorRangeCategories(workbench, categories)
      setRows((prev) => [...prev.filter((r) => r.source !== 'uform'), ...withCats])
      showSuccess('UFORM spec import', `Loaded ${withCats.length} door/trim row(s) from ${file.name}. Prices are 0 until you add them later.`)
      setSourceImportProgress('uform', 100, 'Complete', file.name)
      clearImportProgress('uform', 2000)
      goToPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      clearImportProgress('uform')
    }
  }

  async function runInferPartTypes() {
    setSetupAction('infer')
    setBusy(true)
    setError(null)
    try {
      await new Promise((r) => window.setTimeout(r, 120))
      const before = rows.length
      const next = enrichWorkbenchRowsMetadata(rows)
      setRows(next)
      const kinds = new Map<string, number>()
      for (const r of next) {
        const k = r.item_kind || 'other'
        kinds.set(k, (kinds.get(k) ?? 0) + 1)
      }
      setActionReport({
        title: 'Part types inferred',
        summary: `Updated kind and part type on ${before} workbench row(s).`,
        lines: [...kinds.entries()].map(([k, n]) => `${k}: ${n} row(s)`),
        variant: 'ok',
      })
    } finally {
      setBusy(false)
      setSetupAction(null)
    }
  }

  async function applyBomsToSelectedCompletes() {
    const targets = rows.filter((r) => r.selected && r.source === 'tealbury' && r.item_kind === 'complete')
    if (!targets.length) {
      setError('Select one or more Tealbury complete-unit rows (checkbox), then try again.')
      return
    }
    if (
      !window.confirm(
        `Apply standard BOM template to ${targets.length} complete unit(s)?\n\nThis only works on units already published to the live catalogue, with Lamtek/Uform components published too. Your catalogue is still in workbench draft until you Publish.`
      )
    ) {
      return
    }
    setSetupAction('bom')
    setBusy(true)
    setError(null)
    const notes: string[] = []
    let ok = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        const row = targets[i]
        const { data: product } = await supabase.from('products').select('*').eq('sku', row.sku.trim()).maybeSingle()
        if (!product) {
          notes.push(`${row.sku}: not in live catalogue — use Publish first`)
          continue
        }
        const res = await applyBomToCompleteProduct({
          completeProduct: product,
          tradeCode: row.trade_code || row.sku,
          doorRange: row.door_range,
          section: row.section,
          replaceExisting: true,
        })
        if (res.error) notes.push(`${row.sku}: ${res.error}`)
        else {
          ok++
          if (res.warnings.length) notes.push(`${row.sku}: ${res.warnings.join('; ')}`)
        }
        if (i % 3 === 0) await new Promise((r) => window.setTimeout(r, 0))
      }
      setActionReport({
        title: ok > 0 ? 'BOM apply finished' : 'BOM could not be applied',
        summary:
          ok > 0
            ? `Linked BOM lines on ${ok} of ${targets.length} published complete unit(s).`
            : `None of the ${targets.length} selected unit(s) are in the live catalogue yet. Publish from section 3, then run this again.`,
        lines: notes,
        variant: ok > 0 ? 'ok' : 'warn',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setSetupAction(null)
    }
  }

  async function ingestWorkbook(file: File, source: PricelistSource) {
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Please choose an .xlsx Excel workbook.')
      return
    }
    setError(null)
    setMessage(null)
    setSourceImportProgress(source, 2, 'Preparing import…', file.name)
    try {
      const cats = await fetchAllCategories()
      setCategories(cats)
      setSourceImportProgress(source, 8, 'Loading categories…', file.name)

      const buf = await file.arrayBuffer()
      setSourceImportProgress(source, 12, 'Reading Excel file…', file.name)

      const { rows: parsed, warnings: w } = await parseTealburyPricelistWorkbookAsync(buf, (p) => {
        const mapped = 12 + Math.round(p.percent * 0.72)
        setSourceImportProgress(source, mapped, p.label, file.name)
      })

      if (!parsed.length) {
        setError(
          source === 'tealbury'
            ? 'No Tealbury rows parsed. Expect CODE / H (MM) / PRICE tables on each door-range sheet (Pricelist hub is skipped when range sheets exist).'
            : 'No Lamtek trade rows parsed. Expect kitchen Code/Size/Description tables or bedroom Code/Description layouts.'
        )
        setWarnings(w)
        clearImportProgress(source)
        return
      }

      setSourceImportProgress(source, 88, `Building ${parsed.length} workbench row(s)…`, file.name)
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })

      const workbench = enrichWorkbenchRowsMetadata(
        fillMissingWorkbenchProductNames(parsed.map((p) => parsedToWorkbenchRow(p, source, cats))),
      )
      setRows((prev) => [...prev.filter((r) => r.source !== source), ...workbench])
      setWarnings((prev) => [...prev, ...w])
      showSuccess(
        'Import complete',
        `Loaded ${workbench.length} ${source === 'tealbury' ? 'Tealbury' : 'Lamtek trade'} row(s) from ${file.name}. ` +
          (source === 'tealbury'
            ? 'Each door/range sheet is imported separately. Categories are only filled when a matching category already exists in your catalogue — otherwise assign them yourself before publish.'
            : 'Multi-finish columns use the lowest price as unit price. Categories match existing names only.')
      )
      setSourceImportProgress(source, 100, `Complete — ${workbench.length} row(s) loaded`, file.name)
      goToPage(1)
      clearImportProgress(source, 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      clearImportProgress(source)
    }
  }

  function patchRow(id: string, patch: Partial<PricelistWorkbenchRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function toggleSelectAllOnPage(checked: boolean) {
    const ids = new Set(pageItems.map((r) => r.id))
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: checked } : r)))
  }

  function toggleSelectAllFiltered(checked: boolean) {
    const ids = new Set(filtered.map((r) => r.id))
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, selected: checked } : r)))
  }

  function onBulkCategoryApply(scope: 'selected' | 'filtered') {
    const cat = categories.find((c) => c.id === bulkCategoryId)
    if (!cat) {
      setError('Choose a category for bulk assign.')
      return
    }
    const ids = new Set(
      (scope === 'selected' ? rows.filter((r) => r.selected) : filtered).map((r) => r.id)
    )
    if (!ids.size) {
      setError(scope === 'selected' ? 'No rows selected.' : 'No rows in current filter.')
      return
    }
    setRows((prev) => applyCategoryToRows(prev, ids, cat))
    showSuccess('Category assigned', `Assigned “${cat.name}” to ${ids.size} row(s).`)
  }

  function runAutoMap(scope: 'all' | 'unassigned') {
    setRows((prev) => autoMapWorkbenchCategories(prev, categories, scope === 'unassigned'))
    showSuccess(
      'Auto-map complete',
      scope === 'unassigned'
        ? 'Auto-mapped categories for rows without an assigned category.'
        : 'Auto-mapped categories for all rows (matched section names to existing categories).'
    )
  }

  function deleteRow(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    if (!window.confirm(`Remove “${row.sku || row.name}” from the workbench?`)) return
    setRows((prev) => deleteRowsByIds(prev, new Set([id])))
    showSuccess('Row removed', 'Row removed from workbench.')
  }

  function deleteBulk(scope: 'selected' | 'filtered') {
    const targets = scope === 'selected' ? rows.filter((r) => r.selected) : filtered
    if (!targets.length) {
      setError(scope === 'selected' ? 'No rows selected.' : 'No rows in current filter.')
      return
    }
    if (
      !window.confirm(
        `Remove ${targets.length} row(s) from the workbench draft? This does not delete live catalogue products.`
      )
    ) {
      return
    }
    const ids = new Set(targets.map((r) => r.id))
    setRows((prev) => deleteRowsByIds(prev, ids))
    showSuccess('Rows removed', `Removed ${targets.length} row(s) from workbench.`)
  }

  function notifySmart(message: string, err?: string | null) {
    if (err) {
      setError(err)
      setMessage(null)
      return
    }
    setError(null)
    if (message) showSuccess('Command complete', message)
  }

  async function runPublish(scope: 'all' | 'selected') {
    const targets = scope === 'selected' ? rows.filter((r) => r.selected) : rows
    const unassigned = targets.filter((r) => !r.category_id).length
    const unassignedNote =
      unassigned > 0
        ? `\n\n${unassigned} row(s) have no category and will be published as uncategorised. Assign categories in Categories or use Smart categorise later.`
        : ''
    if (
      !window.confirm(
        (scope === 'selected'
          ? `Publish ${selectedCount} selected product(s) to the catalogue (upsert by SKU)?`
          : `Publish all ${rows.length} draft row(s) to the catalogue (upsert by SKU)?`) + unassignedNote,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await publishWorkbenchRows(rows, { onlySelected: scope === 'selected' })
      showSuccess(
        'Publish complete',
        `Publish complete: ${res.inserted} inserted, ${res.updated} updated, ${res.skipped} skipped.` +
          (res.errors.length ? ` ${res.errors.length} message(s) — see details below.` : '')
      )
      if (res.errors.length) setError(res.errors.slice(0, 12).join('\n'))
      await loadCategories()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const categoryOptions = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id)
    const childrenByParent = new Map<string, CategoryRow[]>()
    for (const c of categories) {
      if (!c.parent_id) continue
      const list = childrenByParent.get(c.parent_id) ?? []
      list.push(c)
      childrenByParent.set(c.parent_id, list)
    }
    return { parents, childrenByParent }
  }, [categories])

  if (permLoading) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="admin-page">
        <h1>Pricelist workbench</h1>
        <p className="admin-error">You don&rsquo;t have permission to edit the catalogue.</p>
      </div>
    )
  }

  const tealburyCount = rows.filter((r) => r.source === 'tealbury').length
  const lamtekCount = rows.filter((r) => r.source === 'lamtek').length
  const uformCount = rows.filter((r) => r.source === 'uform').length
  const unassignedCount = rows.filter((r) => !r.category_id).length

  return (
    <div className="admin-page admin-pricelist-workbench">
      <div className="admin-page-header">
        <h1>
          Pricelist workbench
          <AdminHelpTip text="Import Tealbury and Lamtek trade Excel pricelists, edit and categorize rows, then export template.xlsx or publish to the live catalogue by SKU." />
        </h1>
        <p className="page-intro">
          Build the <strong>Tealbury Complete</strong> catalogue visually: Lamtek <strong>components</strong> (carcasses,
          hinges, drawers), Tealbury <strong>complete units</strong> (one row per sellable kitchen), and UFORM{' '}
          <strong>doors &amp; trim</strong> from spec PDFs. Assign categories and part types, publish (prices can stay at
          0), then apply standard BOMs to link complete units to their parts.
        </p>
        <p className="admin-muted" style={{ marginTop: '-0.5rem' }}>
          <Link to={LIVE_CATALOGUE.categories}>Categories</Link> ·{' '}
          <Link to={CATALOGUE_TOOLS.componentImport}>Component import</Link> ·{' '}
          <Link to={LIVE_CATALOGUE.products}>Catalogue</Link> ·{' '}
          <Link to={CATALOGUE_TOOLS.hub}>All tools</Link>
        </p>
        {rows.length > 0 && (
          <p className="admin-pricelist-stats">
            {rows.length} draft row(s) · {lamtekCount} Lamtek · {uformCount} UFORM · {tealburyCount} Tealbury complete
            · {unassignedCount} unassigned
          </p>
        )}
      </div>

      <PricelistWorkbenchSection
        id="workbench-setup"
        title="0. Catalogue setup"
        summary="Optional helpers before you publish"
        tip="Imports stay in this workbench until you click Publish. Live catalogue products are not changed by uploading spreadsheets here."
        defaultOpen={rows.length === 0}
      >
        <p className="admin-callout admin-callout--info">
          <strong>Draft only.</strong> Rows here are staged in the database until you publish. The live customer
          catalogue is updated only from section 3 (Publish). Assign each row to an existing category (Carcasses,
          Doors, Accessories → Cutlery Trays, etc.) — imports never create new categories automatically.
          {draftUpdatedAt ? (
            <>
              {' '}
              Draft last saved {new Date(draftUpdatedAt).toLocaleString()}
              {draftSaving ? ' (saving…)' : ''}.
            </>
          ) : null}
        </p>
        <p className="admin-muted">
          Tealbury door ranges in spreadsheets: {TEALBURY_DOOR_RANGES.join(' · ')}. UFORM PDF specs:{' '}
          <code>Pricelists and Specifications/uform/specs/</code> → <code>npm run catalogue:parse-uform-specs</code>{' '}
          → import JSON below.
        </p>
        <div className="admin-pricelist-action-row" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <span className="admin-pricelist-setup-action">
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => void runBootstrapCategories()}
            >
              {setupAction === 'categories' ? 'Working…' : 'Ensure Accessories categories'}
            </button>
            <AdminHelpTip text="Creates only the Accessories parent plus Cutlery Trays, Lighting, and Misc if missing. Does not add spreadsheet section categories or door-range categories." />
          </span>
          <span className="admin-pricelist-setup-action">
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || !rows.length}
              onClick={() => void runInferPartTypes()}
            >
              {setupAction === 'infer' ? 'Inferring…' : 'Infer part types on all rows'}
            </button>
            <AdminHelpTip text="Guesses BOM part type (unit, hinge, door, …) and row kind (complete vs component) from section/name text. Use before publish and before applying BOMs." />
          </span>
          <span className="admin-pricelist-setup-action">
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || !rows.some((r) => r.selected && r.source === 'tealbury')}
              onClick={() => void applyBomsToSelectedCompletes()}
            >
              {setupAction === 'bom' ? 'Applying BOM…' : 'Apply BOM to selected Tealbury completes'}
            </button>
            <AdminHelpTip text="BOM = Bill of Materials: the list of Lamtek parts (carcass, hinges, doors, etc.) that make up one Tealbury complete unit. This links published complete products to component SKUs using the default high-line base template." />
          </span>
        </div>
      </PricelistWorkbenchSection>

      <PricelistWorkbenchSection
        id="workbench-load"
        title="1. Load workbooks"
        summary="Upload Lamtek, Tealbury, and/or UFORM spec JSON"
        tip="Re-importing a source replaces only that source’s rows. Tealbury skips the Pricelist hub sheet when door-range sheets exist."
        defaultOpen={rows.length === 0}
      >
        <p className="admin-muted">
          Tealbury: the <strong>Pricelist</strong> sheet uses a door selector (formulas); static prices live on each{' '}
          <strong>door/range sheet</strong> (No Doors, Dawson, Oakham, …) plus an <strong>Accessories</strong> block per
          sheet. Lamtek: one <strong>Pricelist</strong> sheet with kitchen sections and multi-finish price columns.
        </p>
        <div className="admin-pricelist-upload-grid">
          <label className="admin-pricelist-upload-card">
            <span className="admin-pricelist-upload-label">
              Tealbury customer pricelist (.xlsx)
              <AdminHelpTip text="Customer-facing Tealbury workbook with one sheet per door range plus accessories blocks." />
            </span>
            <input
              ref={tealburyInputRef}
              type="file"
              accept=".xlsx"
              disabled={isSourceImporting('tealbury')}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ingestWorkbook(f, 'tealbury')
                e.target.value = ''
              }}
            />
            <PricelistSourceImportProgress progress={importProgress.tealbury} />
            {tealburyCount > 0 && !isSourceImporting('tealbury') ? (
              <span className="admin-muted">{tealburyCount} row(s) loaded</span>
            ) : !importProgress.tealbury ? (
              <span className="admin-muted">Not loaded</span>
            ) : null}
          </label>
          <label className="admin-pricelist-upload-card">
            <span className="admin-pricelist-upload-label">
              Lamtek trade kitchen pricelist (.xlsx)
              <AdminHelpTip text="Lamtek trade matrix; multi-finish columns use the lowest price as list price and ~75% as Lamtek cost." />
            </span>
            <input
              ref={lamtekInputRef}
              type="file"
              accept=".xlsx"
              disabled={isSourceImporting('lamtek')}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ingestWorkbook(f, 'lamtek')
                e.target.value = ''
              }}
            />
            <PricelistSourceImportProgress progress={importProgress.lamtek} />
            {lamtekCount > 0 && !isSourceImporting('lamtek') ? (
              <span className="admin-muted">{lamtekCount} row(s) loaded</span>
            ) : !importProgress.lamtek ? (
              <span className="admin-muted">Not loaded</span>
            ) : null}
          </label>
          <label className="admin-pricelist-upload-card">
            <span className="admin-pricelist-upload-label">
              UFORM spec products (.json)
              <AdminHelpTip text="Generated by npm run catalogue:parse-uform-specs from PDFs in Pricelists and Specifications/uform/specs/. Doors, plinth, cornice, panels per range." />
            </span>
            <input
              ref={uformJsonInputRef}
              type="file"
              accept=".json,application/json"
              disabled={isSourceImporting('uform')}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ingestUformJson(f)
                e.target.value = ''
              }}
            />
            <PricelistSourceImportProgress progress={importProgress.uform} />
            {uformCount > 0 && !isSourceImporting('uform') ? (
              <span className="admin-muted">{uformCount} row(s) loaded</span>
            ) : !importProgress.uform ? (
              <span className="admin-muted">Not loaded</span>
            ) : null}
          </label>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-small"
            style={{ marginTop: '0.75rem' }}
            disabled={busy || anyImporting}
            onClick={() => {
              if (window.confirm('Clear all draft rows from the workbench?')) {
                setRows([])
                setWarnings([])
                setMessage(null)
                setError(null)
                void clearWorkbenchDraft()
              }
            }}
          >
            Clear workbench
          </button>
        )}
      </PricelistWorkbenchSection>

      {warnings.length > 0 && (
        <PricelistWorkbenchSection
          id="workbench-warnings"
          title={`Parser notices (${warnings.length})`}
          tip="Non-fatal import messages from the Excel parser (skipped rows, ambiguous codes, etc.)."
          defaultOpen={false}
        >
          <PricelistWorkbenchWarningsPanel warnings={warnings} />
        </PricelistWorkbenchSection>
      )}

      {rows.length > 0 && (
        <>
          <PricelistWorkbenchSection
            id="workbench-table"
            title="2. Edit products"
            summary={`${filtered.length} filtered · page ${currentPage} of ${totalPages}`}
            tip="Resize and show/hide columns via the gear control. Hover the side arrows to auto-scroll. Double-click cells to edit."
            defaultOpen
            badge={filtered.length}
          >
            <PricelistWorkbenchTableToolbar
              filters={tableFilters}
              onChange={patchTableFilters}
              doorRanges={doorRanges}
              sections={sections}
              categories={categories}
              partTypes={partTypesHook.types}
              filteredCount={filtered.length}
              totalCount={rows.length}
            />
            <PricelistWorkbenchTable
              pageItems={pageItems}
              categories={categories}
              partTypes={partTypesHook.types}
              allSelectedOnPage={pageItems.length > 0 && pageItems.every((r) => r.selected)}
              onToggleSelectAllOnPage={toggleSelectAllOnPage}
              onPatchRow={patchRow}
              onDeleteRow={deleteRow}
            />
            <ListPager
              totalItems={filtered.length}
              totalPages={totalPages}
              currentPage={currentPage}
              pageSize={pageSize}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
              itemLabel="rows"
            />
          </PricelistWorkbenchSection>

          <PricelistWorkbenchSection
            id="workbench-tools"
            title="3. Bulk actions & smart commands"
            summary="Assign categories, delete rows, or run plain-English commands on the filtered list"
            tip="Use the search and filters in section 2. Bulk actions apply to filtered rows or ticked selection."
            defaultOpen={false}
          >
            <div className="admin-pricelist-tools-layout">
              <p className="admin-muted admin-pricelist-filter-summary">
                Table shows {rangeStart}–{rangeEnd} of {filtered.length} filtered
                {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
              </p>
              <div className="admin-pricelist-panel admin-pricelist-panel--bulk">
                <h3>
                  Selection &amp; bulk actions
                  <AdminHelpTip text="Select rows with checkboxes, then apply category, delete, or smart commands to filtered or selected rows only." />
                </h3>
                <div className="admin-pricelist-action-group">
                  <span className="admin-pricelist-action-label">Selection</span>
                  <div className="admin-pricelist-action-row">
                    <button type="button" className="btn btn-small btn-outline" onClick={() => toggleSelectAllFiltered(true)}>
                      Select filtered ({filtered.length})
                    </button>
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => setRows((p) => p.map((r) => ({ ...r, selected: false })))}>
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
                      disabled={filtered.length === 0}
                      onClick={() => deleteBulk('filtered')}
                    >
                      Delete filtered ({filtered.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger-outline"
                      disabled={filteredSelectedCount === 0}
                      onClick={() => deleteBulk('selected')}
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
                      onClick={() => onBulkCategoryApply('filtered')}
                    >
                      Apply to filtered
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-outline"
                      disabled={!bulkCategoryId || filteredSelectedCount === 0}
                      onClick={() => onBulkCategoryApply('selected')}
                    >
                      Apply to selected
                    </button>
                  </div>
                  <div className="admin-pricelist-action-row">
                    <button
                      type="button"
                      className="btn btn-small btn-outline"
                      title="Match section headings to existing category names"
                      onClick={() => runAutoMap('unassigned')}
                    >
                      Auto-map unassigned
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-outline"
                      title="Re-run auto-map on every row"
                      onClick={() => runAutoMap('all')}
                    >
                      Auto-map all
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-pricelist-panel admin-pricelist-panel--smart">
                <h3>Smart commands</h3>
                <PricelistWorkbenchSmartPanel
                  rows={rows}
                  filtered={filtered}
                  categories={categories}
                  onRowsChange={setRows}
                  onNotify={notifySmart}
                />
              </div>
            </div>
          </PricelistWorkbenchSection>

          <PricelistWorkbenchSection
            id="workbench-export"
            title="4. Export or publish"
            summary="Download template.xlsx or upsert live catalogue by SKU"
            tip="Export is safe preview. Publish writes to Supabase — Tealbury and Lamtek program tags are preserved per row."
            defaultOpen={false}
          >
            <p className="admin-muted">
              <strong>Export</strong> downloads rows in the same shape as your template.xlsx.{' '}
              <strong>Publish</strong> upserts into the live catalogue by SKU (
              {CATALOG_PROGRAM.TEALBURY} / {CATALOG_PROGRAM.LAMTEK} program preserved).
            </p>
            <div className="admin-page-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => downloadWorkbenchTemplateXlsx(rows)}
              >
                Download template XLSX (all {rows.length})
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy || filtered.length === 0}
                onClick={() => downloadWorkbenchTemplateXlsx(filtered, `catalogue-filtered-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              >
                Download filtered ({filtered.length})
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void runPublish('selected')}>
                Publish selected
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void runPublish('all')}>
                Publish all rows
              </button>
            </div>
          </PricelistWorkbenchSection>
        </>
      )}

      <AdminNoticeModal
        open={!!message}
        title={messageTitle}
        message={message ?? ''}
        variant="success"
        onClose={() => setMessage(null)}
      />
      <WorkbenchActionReportModal report={actionReport} onClose={() => setActionReport(null)} />
      {error && (
        <pre className="admin-error admin-pricelist-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      )}
    </div>
  )
}
