import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { fetchProductCategoryMap } from '@/lib/productCategories'
import {
  applyImportPlan,
  buildComponentExportRows,
  buildImportPlan,
  COMPONENT_HEADERS,
  downloadComponentCsv,
  downloadComponentTemplateXlsx,
  downloadComponentXlsx,
  parseComponentFile,
  type ImportApplyResult,
  type ImportPlan,
  type ParseResult,
} from '@/lib/componentCsv'
import type { CategoryRow, ProductRow } from '@/types/database'

export default function AdminComponentImport() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const partTypesHook = useAssemblyPartTypes(true)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productCategoryMap, setProductCategoryMap] = useState<Map<string, string[]>>(new Map())
  const [dataLoading, setDataLoading] = useState(true)

  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const reload = useCallback(async () => {
    setDataLoading(true)
    const [prodRes, catRes, pcMap] = await Promise.all([
      supabase.from('products').select('*').order('sku').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchProductCategoryMap(),
    ])
    setProducts((prodRes.data ?? []) as ProductRow[])
    setCategories((catRes.data ?? []) as CategoryRow[])
    setProductCategoryMap(pcMap)
    setDataLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const exportRows = useMemo(
    () => buildComponentExportRows(products, categories, productCategoryMap),
    [products, categories, productCategoryMap]
  )

  async function onFileChosen(file: File | null) {
    setParseResult(null)
    setPlan(null)
    setApplyResult(null)
    if (!file) return
    const result = await parseComponentFile(file)
    setParseResult(result)
    if (result.rows.length === 0) return
    const built = buildImportPlan(result.rows, products, categories, partTypesHook.types)
    setPlan(built)
  }

  async function onApply() {
    if (!plan) return
    setApplying(true)
    try {
      const res = await applyImportPlan(plan)
      setApplyResult(res)
      await reload()
      if (res.created > 0 || res.updated > 0) {
        const refreshed = buildImportPlan(
          plan.rows.filter((r) => r.action !== 'error'),
          // After reload, existing products is the new set
          products,
          categories,
          partTypesHook.types
        )
        setPlan(refreshed)
      }
    } finally {
      setApplying(false)
    }
  }

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
        <div className="admin-page-header">
          <h1>Component import</h1>
        </div>
        <p className="admin-error">You don&rsquo;t have permission to edit the catalogue.</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Component import / export</h1>
        <p className="page-intro">
          Round-trip your component catalogue via spreadsheet. Edit rows in Excel/Google Sheets,
          save as CSV or XLSX, and re-upload here — rows are matched by <code>sku</code> and
          upserted (existing rows update in place, new rows are created).
        </p>
      </div>

      <section className="admin-modal-card admin-wipe-section">
        <h2>1. Get a template or export current data</h2>
        <p>
          The template includes example rows for a carcass and a door so you can see the expected
          shape. The current-data export lets you bulk-edit existing components and re-import.
        </p>
        <div className="admin-page-actions-row">
          <button
            type="button"
            className="btn"
            onClick={() => downloadComponentTemplateXlsx()}
            disabled={dataLoading}
          >
            Download blank template (XLSX)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => downloadComponentXlsx(exportRows)}
            disabled={dataLoading || exportRows.length === 0}
          >
            Export current components ({exportRows.length}) as XLSX
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => downloadComponentCsv(exportRows)}
            disabled={dataLoading || exportRows.length === 0}
          >
            Export as CSV
          </button>
        </div>
        <details style={{ marginTop: '1rem' }}>
          <summary>Column reference</summary>
          <ul>
            {(COMPONENT_HEADERS as readonly string[]).map((h) => (
              <li key={h}>
                <code>{h}</code>
              </li>
            ))}
          </ul>
          <p className="admin-muted">
            <code>categories</code> is pipe-separated (<code>Base units|Dawson</code>).{' '}
            <code>part_type</code> must match a code defined in Settings → Parts. <code>range</code>{' '}
            must match a category with kind <code>door_range</code>.
          </p>
        </details>
      </section>

      <section className="admin-modal-card admin-wipe-section">
        <h2>2. Upload and preview</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => void onFileChosen(e.target.files?.[0] ?? null)}
          disabled={dataLoading}
        />
        {parseResult && parseResult.errors.length > 0 && (
          <div className="admin-error" style={{ marginTop: '0.75rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Parse errors ({parseResult.errors.length}):</strong>
            </p>
            <ul style={{ marginBottom: 0 }}>
              {parseResult.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Row {e.rowNumber}: {e.message}
                </li>
              ))}
              {parseResult.errors.length > 20 && <li>…and {parseResult.errors.length - 20} more</li>}
            </ul>
          </div>
        )}
        {parseResult && parseResult.unknownHeaders.length > 0 && (
          <p className="admin-muted" style={{ marginTop: '0.5rem' }}>
            Unknown header(s) ignored: {parseResult.unknownHeaders.join(', ')}
          </p>
        )}
      </section>

      {plan && (
        <section className="admin-modal-card admin-wipe-section">
          <h2>3. Dry-run preview</h2>
          <p>
            <strong>{plan.totals.create}</strong> new components will be created,{' '}
            <strong>{plan.totals.update}</strong> existing will be updated,{' '}
            <strong>{plan.totals.error}</strong> rows have errors and will be skipped.
          </p>
          {plan.unknownPartTypes.length > 0 && (
            <p className="admin-muted">
              Unknown part types: {plan.unknownPartTypes.join(', ')}. Add them in{' '}
              <Link to="/admin/settings?tab=products">Settings → Parts</Link>.
            </p>
          )}
          {plan.unknownCategories.length > 0 && (
            <p className="admin-muted">
              Unknown categories: {plan.unknownCategories.join(', ')}. Add them in{' '}
              <Link to="/admin/catalogue/categories">Categories</Link> ·{' '}
              <Link to="/admin/catalogue-tools">Product &amp; category tools</Link>.
            </p>
          )}
          {plan.unknownRanges.length > 0 && (
            <p className="admin-muted">
              Unknown ranges: {plan.unknownRanges.join(', ')}. Add them as categories with kind{' '}
              <code>door_range</code>.
            </p>
          )}

          <div className="admin-table-scroll" style={{ marginTop: '0.75rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Action</th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Part type</th>
                  <th>Categories</th>
                  <th>Range</th>
                  <th>Price</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 200).map((r) => (
                  <tr key={`${r.rowNumber}-${r.sku}`} className={r.action === 'error' ? 'admin-error' : undefined}>
                    <td>{r.rowNumber}</td>
                    <td>{r.action}</td>
                    <td>
                      <code>{r.sku}</code>
                    </td>
                    <td>{r.name}</td>
                    <td>{r.part_type || '—'}</td>
                    <td>{r.categories || '—'}</td>
                    <td>{r.range || '—'}</td>
                    <td>£{r.unit_price.toFixed(2)}</td>
                    <td>{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.rows.length > 200 && (
              <p className="admin-muted">Showing first 200 of {plan.rows.length} rows.</p>
            )}
          </div>

          <div className="admin-page-actions-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => void onApply()}
              disabled={applying || plan.totals.create + plan.totals.update === 0}
            >
              {applying
                ? 'Applying…'
                : `Apply ${plan.totals.create + plan.totals.update} change(s)`}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setParseResult(null)
                setPlan(null)
                setApplyResult(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              disabled={applying}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      {applyResult && (
        <section className="admin-message-ok admin-modal-card admin-wipe-section">
          <p style={{ marginTop: 0 }}>
            <strong>Import complete.</strong> Created: {applyResult.created}. Updated:{' '}
            {applyResult.updated}. Failed: {applyResult.failed}.
          </p>
          {applyResult.failures.length > 0 && (
            <details>
              <summary>{applyResult.failures.length} failure(s)</summary>
              <ul>
                {applyResult.failures.map((f, i) => (
                  <li key={i}>
                    <code>{f.sku}</code>: {f.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="admin-page-actions-row">
            <Link to="/admin/catalogue" className="btn">
              View catalogue
            </Link>
            <Link to="/admin/catalogue-tools/components/variant-builder" className="btn btn-outline">
              Open variant matrix builder
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
