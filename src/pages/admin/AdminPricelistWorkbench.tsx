import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ListPager from '@/components/admin/ListPager'
import { usePermission } from '@/hooks/usePermission'
import { fetchAllCategories } from '@/lib/categoryAdmin'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import {
  applyCategoryToRows,
  autoMapWorkbenchCategories,
  downloadWorkbenchTemplateXlsx,
  parsedToWorkbenchRow,
  publishWorkbenchRows,
  type PricelistSource,
  type PricelistWorkbenchRow,
} from '@/lib/pricelistWorkbench'
import { parseTealburyPricelistWorkbookAsync } from '@/lib/tealburyPricelistParse'
import PricelistSourceImportProgress, {
  type PricelistSourceImportProgressState,
} from '@/components/admin/PricelistSourceImportProgress'
import AdminNoticeModal from '@/components/admin/AdminNoticeModal'
import { useListPagination } from '@/lib/listPagination'
import { deleteRowsByIds } from '@/lib/pricelistWorkbenchRules'
import PricelistWorkbenchSmartPanel from '@/components/admin/PricelistWorkbenchSmartPanel'
import PricelistWorkbenchSection from '@/components/admin/PricelistWorkbenchSection'
import PricelistWorkbenchTable from '@/components/admin/PricelistWorkbenchTable'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import type { CategoryRow } from '@/types/database'

type SourceFilter = 'all' | PricelistSource

export default function AdminPricelistWorkbench() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [rows, setRows] = useState<PricelistWorkbenchRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<
    Partial<Record<PricelistSource, PricelistSourceImportProgressState>>
  >({})
  const [message, setMessage] = useState<string | null>(null)
  const [messageTitle, setMessageTitle] = useState('Done')
  const [error, setError] = useState<string | null>(null)

  function showSuccess(title: string, text: string) {
    setMessageTitle(title)
    setMessage(text)
    setError(null)
  }

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [doorFilter, setDoorFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [search, setSearch] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState('')

  const tealburyInputRef = useRef<HTMLInputElement>(null)
  const lamtekInputRef = useRef<HTMLInputElement>(null)

  const loadCategories = useCallback(async () => {
    const cats = await fetchAllCategories()
    setCategories(cats)
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (doorFilter && r.door_range !== doorFilter) return false
      if (sectionFilter && r.section !== sectionFilter) return false
      if (onlyUnassigned && r.category_id) return false
      if (!q) return true
      return (
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q)
      )
    })
  }, [rows, sourceFilter, doorFilter, sectionFilter, onlyUnassigned, search])

  const {
    pageItems,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(filtered, { defaultPageSize: 50 })

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
    () => (['tealbury', 'lamtek'] as const).some((s) => isSourceImporting(s)),
    [isSourceImporting]
  )

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

      const workbench = parsed.map((p) => parsedToWorkbenchRow(p, source, cats))
      setRows((prev) => [...prev.filter((r) => r.source !== source), ...workbench])
      setWarnings((prev) => [...prev, ...w.map((line) => `[${source}] ${line}`)])
      showSuccess(
        'Import complete',
        `Loaded ${workbench.length} ${source === 'tealbury' ? 'Tealbury' : 'Lamtek trade'} row(s) from ${file.name}. ` +
          (source === 'tealbury'
            ? 'Each door/range sheet is imported separately; accessories are mapped to Cornice, Plinth, Panels, etc. where possible.'
            : 'Multi-finish columns use the lowest price as unit price.')
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
    if (
      !window.confirm(
        scope === 'selected'
          ? `Publish ${selectedCount} selected product(s) to the catalogue (upsert by SKU)?`
          : `Publish all ${rows.length} draft row(s) to the catalogue (upsert by SKU)?`
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
  const unassignedCount = rows.filter((r) => !r.category_id).length

  return (
    <div className="admin-page admin-pricelist-workbench">
      <div className="admin-page-header">
        <h1>
          Pricelist workbench
          <AdminHelpTip text="Import Tealbury and Lamtek trade Excel pricelists, edit and categorize rows, then export template.xlsx or publish to the live catalogue by SKU." />
        </h1>
        <p className="page-intro">
          Build a full product list from the <strong>Tealbury customer pricelist</strong> (per door/range sheets +
          accessories) and the <strong>Lamtek trade kitchen pricelist</strong>. Edit rows, assign categories in bulk,
          then export the portal template or publish to the catalogue. Output columns match{' '}
          <code>template.xlsx</code> (category_slug, category_name, name, sku, unit_price, …).
        </p>
        <p className="admin-muted" style={{ marginTop: '-0.5rem' }}>
          <Link to="/admin/catalogue/categories">Categories</Link> ·{' '}
          <Link to="/admin/catalogue/components/import">Component import</Link> ·{' '}
          <Link to="/admin/catalogue">Catalogue</Link>
        </p>
        {rows.length > 0 && (
          <p className="admin-pricelist-stats">
            {rows.length} draft row(s) · {tealburyCount} Tealbury · {lamtekCount} Lamtek · {unassignedCount} unassigned
          </p>
        )}
      </div>

      <PricelistWorkbenchSection
        id="workbench-load"
        title="1. Load workbooks"
        summary="Upload Tealbury and/or Lamtek trade .xlsx files"
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
          <ul className="admin-pricelist-warnings">
            {warnings.slice(0, 40).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {warnings.length > 40 ? <p className="admin-muted">…and {warnings.length - 40} more.</p> : null}
        </PricelistWorkbenchSection>
      )}

      {rows.length > 0 && (
        <>
          <PricelistWorkbenchSection
            id="workbench-table"
            title="2. Edit products"
            summary={`${filtered.length} filtered · page ${currentPage} of ${totalPages}`}
            tip="Resize and show/hide columns via the gear control. Scroll left/right with the arrow buttons or the scrollbar under the table. Double-click cells to edit."
            defaultOpen
            badge={filtered.length}
          >
            <PricelistWorkbenchTable
              pageItems={pageItems}
              categories={categories}
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
            title="3. Filter, bulk actions & smart commands"
            summary="Narrow the list, assign categories, delete rows, or run plain-English commands"
            tip="Bulk actions apply to filtered rows or ticked selection. Smart commands can assign categories, clean names, delete, and more."
            defaultOpen={false}
          >
            <div className="admin-pricelist-tools-layout">
              <div className="admin-pricelist-panel admin-pricelist-panel--filters">
                <h3>
                  Filters
                  <AdminHelpTip text="Filters affect the table and most bulk actions. Selection checkboxes persist across pages." />
                </h3>
                <div className="admin-pricelist-filter-grid">
                  <label className="admin-pricelist-field admin-pricelist-field--wide">
                    <span>
                      Search
                      <AdminHelpTip text="Matches SKU, product name, section label, or assigned category name." />
                    </span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        goToPage(1)
                      }}
                      placeholder="SKU, name, section…"
                    />
                  </label>
                  <label className="admin-pricelist-field">
                    <span>Source</span>
                    <select
                      value={sourceFilter}
                      onChange={(e) => {
                        setSourceFilter(e.target.value as SourceFilter)
                        goToPage(1)
                      }}
                    >
                      <option value="all">All ({rows.length})</option>
                      <option value="tealbury">Tealbury ({tealburyCount})</option>
                      <option value="lamtek">Lamtek ({lamtekCount})</option>
                    </select>
                  </label>
                  <label className="admin-pricelist-field">
                    <span>Door / range</span>
                    <select
                      value={doorFilter}
                      onChange={(e) => {
                        setDoorFilter(e.target.value)
                        goToPage(1)
                      }}
                    >
                      <option value="">All ranges</option>
                      {doorRanges.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-pricelist-field">
                    <span>Section</span>
                    <select
                      value={sectionFilter}
                      onChange={(e) => {
                        setSectionFilter(e.target.value)
                        goToPage(1)
                      }}
                    >
                      <option value="">All sections</option>
                      {sections.slice(0, 200).map((s) => (
                        <option key={s} value={s}>
                          {s.length > 48 ? `${s.slice(0, 48)}…` : s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-pricelist-field admin-pricelist-field--check">
                    <input
                      type="checkbox"
                      checked={onlyUnassigned}
                      onChange={(e) => {
                        setOnlyUnassigned(e.target.checked)
                        goToPage(1)
                      }}
                    />
                    <span>
                      Unassigned only ({unassignedCount})
                      <AdminHelpTip text="Show only rows without a portal category — useful before bulk assign or publish." />
                    </span>
                  </label>
                </div>
                <p className="admin-muted admin-pricelist-filter-summary">
                  Table shows {rangeStart}–{rangeEnd} of {filtered.length} filtered
                  {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
                </p>
              </div>

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
      {error && (
        <pre className="admin-error admin-pricelist-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      )}
    </div>
  )
}
