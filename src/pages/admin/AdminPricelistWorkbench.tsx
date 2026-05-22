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
import { parseTealburyPricelistWorkbook } from '@/lib/tealburyPricelistParse'
import { useListPagination } from '@/lib/listPagination'
import type { CategoryRow } from '@/types/database'

type SourceFilter = 'all' | PricelistSource

export default function AdminPricelistWorkbench() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [rows, setRows] = useState<PricelistWorkbenchRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function ingestWorkbook(file: File, source: PricelistSource) {
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Please choose an .xlsx Excel workbook.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const cats = await fetchAllCategories()
      setCategories(cats)
      const buf = await file.arrayBuffer()
      const { rows: parsed, warnings: w } = parseTealburyPricelistWorkbook(buf)
      if (!parsed.length) {
        setError(
          source === 'tealbury'
            ? 'No Tealbury rows parsed. Expect CODE / H (MM) / PRICE tables on each door-range sheet (Pricelist hub is skipped when range sheets exist).'
            : 'No Lamtek trade rows parsed. Expect kitchen Code/Size/Description tables or bedroom Code/Description layouts.'
        )
        setWarnings(w)
        return
      }
      const workbench = parsed.map((p) => parsedToWorkbenchRow(p, source, cats))
      setRows((prev) => [...prev.filter((r) => r.source !== source), ...workbench])
      setWarnings((prev) => [...prev, ...w.map((line) => `[${source}] ${line}`)])
      setMessage(
        `Loaded ${workbench.length} ${source === 'tealbury' ? 'Tealbury' : 'Lamtek trade'} row(s) from ${file.name}. ` +
          (source === 'tealbury'
            ? 'Each door/range sheet is imported separately; accessories are mapped to Cornice, Plinth, Panels, etc. where possible.'
            : 'Multi-finish columns use the lowest price as unit price.')
      )
      goToPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
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
    setMessage(`Assigned “${cat.name}” to ${ids.size} row(s).`)
    setError(null)
  }

  function runAutoMap(scope: 'all' | 'unassigned') {
    setRows((prev) => autoMapWorkbenchCategories(prev, categories, scope === 'unassigned'))
    setMessage(
      scope === 'unassigned'
        ? 'Auto-mapped categories for rows without an assigned category.'
        : 'Auto-mapped categories for all rows (matched section names to existing categories).'
    )
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
      setMessage(
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
        <h1>Pricelist workbench</h1>
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
      </div>

      <section className="admin-modal-card admin-wipe-section">
        <h2>1. Load workbooks</h2>
        <p className="admin-muted">
          Tealbury: the <strong>Pricelist</strong> sheet uses a door selector (formulas); static prices live on each{' '}
          <strong>door/range sheet</strong> (No Doors, Dawson, Oakham, …) plus an <strong>Accessories</strong> block per
          sheet. Lamtek: one <strong>Pricelist</strong> sheet with kitchen sections and multi-finish price columns.
        </p>
        <div className="admin-pricelist-upload-grid">
          <label className="admin-pricelist-upload-card">
            <span className="admin-pricelist-upload-label">Tealbury customer pricelist (.xlsx)</span>
            <input
              ref={tealburyInputRef}
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ingestWorkbook(f, 'tealbury')
                e.target.value = ''
              }}
            />
            {tealburyCount > 0 ? (
              <span className="admin-muted">{tealburyCount} row(s) loaded</span>
            ) : (
              <span className="admin-muted">Not loaded</span>
            )}
          </label>
          <label className="admin-pricelist-upload-card">
            <span className="admin-pricelist-upload-label">Lamtek trade kitchen pricelist (.xlsx)</span>
            <input
              ref={lamtekInputRef}
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void ingestWorkbook(f, 'lamtek')
                e.target.value = ''
              }}
            />
            {lamtekCount > 0 ? (
              <span className="admin-muted">{lamtekCount} row(s) loaded</span>
            ) : (
              <span className="admin-muted">Not loaded</span>
            )}
          </label>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-small"
            style={{ marginTop: '0.75rem' }}
            disabled={busy}
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
      </section>

      {warnings.length > 0 && (
        <details className="admin-modal-card admin-wipe-section">
          <summary>Parser notices ({warnings.length})</summary>
          <ul className="admin-pricelist-warnings">
            {warnings.slice(0, 40).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {warnings.length > 40 ? <p className="admin-muted">…and {warnings.length - 40} more.</p> : null}
        </details>
      )}

      {rows.length > 0 && (
        <>
          <section className="admin-modal-card admin-wipe-section">
            <h2>2. Filter &amp; bulk tools</h2>
            <div className="admin-pricelist-toolbar">
              <label>
                Search
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
              <label>
                Source
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value as SourceFilter)
                    goToPage(1)
                  }}
                >
                  <option value="all">All ({rows.length})</option>
                  <option value="tealbury">Tealbury ({tealburyCount})</option>
                  <option value="lamtek">Lamtek trade ({lamtekCount})</option>
                </select>
              </label>
              <label>
                Door / range
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
              <label>
                Section
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
              <label className="admin-pricelist-check">
                <input
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => {
                    setOnlyUnassigned(e.target.checked)
                    goToPage(1)
                  }}
                />
                Unassigned only ({unassignedCount})
              </label>
            </div>

            <div className="admin-pricelist-bulk-bar">
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                aria-label="Bulk category"
              >
                <option value="">Bulk assign category…</option>
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
                {categories
                  .filter((c) => c.parent_id && !categoryOptions.parents.some((p) => p.id === c.parent_id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-small"
                disabled={!bulkCategoryId}
                onClick={() => onBulkCategoryApply('filtered')}
              >
                Apply to filtered ({filtered.length})
              </button>
              <button
                type="button"
                className="btn btn-small btn-outline"
                disabled={!bulkCategoryId || filteredSelectedCount === 0}
                onClick={() => onBulkCategoryApply('selected')}
              >
                Apply to selected ({filteredSelectedCount})
              </button>
              <button type="button" className="btn btn-small btn-outline" onClick={() => runAutoMap('unassigned')}>
                Auto-map unassigned
              </button>
              <button type="button" className="btn btn-small btn-outline" onClick={() => runAutoMap('all')}>
                Auto-map all sections
              </button>
              <button
                type="button"
                className="btn btn-small btn-outline"
                onClick={() => toggleSelectAllFiltered(true)}
              >
                Select filtered
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setRows((p) => p.map((r) => ({ ...r, selected: false })))}>
                Clear selection
              </button>
            </div>

            <p className="admin-muted">
              Showing {rangeStart}–{rangeEnd} of {filtered.length} filtered row(s)
              {selectedCount > 0 ? ` · ${selectedCount} selected overall` : ''}
            </p>
          </section>

          <section className="admin-modal-card admin-wipe-section admin-pricelist-table-section">
            <h2>3. Edit products</h2>
            <div className="admin-table-wrap admin-pricelist-table-wrap">
              <table className="admin-table admin-pricelist-table">
                <thead>
                  <tr>
                    <th className="admin-pricelist-th-check">
                      <input
                        type="checkbox"
                        aria-label="Select page"
                        checked={pageItems.length > 0 && pageItems.every((r) => r.selected)}
                        onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      />
                    </th>
                    <th>Source</th>
                    <th>Range</th>
                    <th>Section</th>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>£</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={r.id} className={!r.category_id ? 'admin-pricelist-row--unassigned' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={(e) => patchRow(r.id, { selected: e.target.checked })}
                        />
                      </td>
                      <td>
                        <span
                          className={`admin-pricelist-source admin-pricelist-source--${r.source}`}
                          title={r.catalog_program}
                        >
                          {r.source === 'tealbury' ? 'TB' : 'LK'}
                        </span>
                      </td>
                      <td className="admin-pricelist-range" title={r.door_range}>
                        {r.door_range ? (r.door_range.length > 14 ? `${r.door_range.slice(0, 14)}…` : r.door_range) : '—'}
                      </td>
                      <td className="admin-pricelist-section" title={r.section}>
                        {r.section.length > 28 ? `${r.section.slice(0, 28)}…` : r.section}
                      </td>
                      <td>
                        <input
                          className="admin-pricelist-inline-input"
                          value={r.sku}
                          onChange={(e) => patchRow(r.id, { sku: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="admin-pricelist-inline-input admin-pricelist-inline-input--wide"
                          value={r.name}
                          onChange={(e) => patchRow(r.id, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="admin-pricelist-category-select"
                          value={r.category_id ?? ''}
                          onChange={(e) => {
                            const cat = categories.find((c) => c.id === e.target.value)
                            if (cat) {
                              patchRow(r.id, {
                                category_id: cat.id,
                                category_slug: cat.slug,
                                category_name: cat.name,
                              })
                            } else {
                              patchRow(r.id, { category_id: null })
                            }
                          }}
                        >
                          <option value="">— Assign —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.parent_id ? `— ${c.name}` : c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="admin-pricelist-inline-input admin-pricelist-inline-input--price"
                          value={r.unit_price}
                          onChange={(e) =>
                            patchRow(r.id, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={(e) => patchRow(r.id, { active: e.target.checked })}
                          title="Active"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          </section>

          <section className="admin-modal-card admin-wipe-section">
            <h2>4. Export or publish</h2>
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
          </section>
        </>
      )}

      {message && <p className="admin-message-ok">{message}</p>}
      {error && (
        <pre className="admin-error admin-pricelist-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      )}
    </div>
  )
}
