import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CatalogueTealburyImportBlock from '@/components/admin/CatalogueTealburyImportBlock'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { repairEmptyCatalogueProductNames } from '@/lib/catalogProductRepair'
import { supabase } from '@/lib/supabase'
import { fetchAllProducts } from '@/lib/supabaseFetchAll'
import { usePermission } from '@/hooks/usePermission'
import {
  buildExportRows,
  downloadCsv,
  downloadXlsx,
  parseCsvFile,
  parseXlsxFile,
  runCatalogueAudit,
  parseImageMappingCsv,
  matchImageRowsToProducts,
  type CatalogueImportRow,
  type ImportResult,
  type CatalogueAuditResult,
  type ImageMappingRow,
  type ImageMatchResult,
} from '@/lib/catalogue-import-export'
import type { CategoryRow, ProductRow } from '@/types/database'

type DataTab = 'import' | 'audit' | 'images'

const LAMTEK_PRODUCT_IMAGES_LINK = 'https://www.lamtek.co.uk/products'

export default function AdminCatalogueToolsCatalogueData() {
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: DataTab =
    tabParam === 'audit' || tabParam === 'images' ? tabParam : 'import'

  function setTab(next: DataTab) {
    if (next === 'import') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: next }, { replace: true })
  }

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [nameRepairing, setNameRepairing] = useState(false)
  const [nameRepairMessage, setNameRepairMessage] = useState<string | null>(null)
  const [auditResult, setAuditResult] = useState<CatalogueAuditResult | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageAssignResult, setImageAssignResult] = useState<{ updated: number; skipped: string[] } | null>(null)
  const [imageMappingRows, setImageMappingRows] = useState<ImageMappingRow[] | null>(null)
  const [imageMatchResults, setImageMatchResults] = useState<ImageMatchResult[] | null>(null)
  const [imageMatchThreshold, setImageMatchThreshold] = useState(0.8)
  const [imageAssignSaving, setImageAssignSaving] = useState(false)
  const [imageApplyAllSaving, setImageApplyAllSaving] = useState(false)
  const [imageReviewModalIndex, setImageReviewModalIndex] = useState<number | null>(null)
  const [imageReviewOverrideProductIds, setImageReviewOverrideProductIds] = useState<Set<string>>(new Set())
  const csvInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const auditFileRef = useRef<HTMLInputElement>(null)
  const productImagesInputRef = useRef<HTMLInputElement>(null)
  const imageMappingCsvRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [catRes, allProducts] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchAllProducts(),
    ])
    setCategories(catRes.data ?? [])
    setProducts(allProducts)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function runImport(rows: CatalogueImportRow[]): Promise<ImportResult> {
    const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] }
    const slugToId = new Map<string, string>(
      (await supabase.from('categories').select('id, slug')).data?.map((c) => [c.slug, c.id]) ?? [],
    )
    const nameToId = new Map(
      (await supabase.from('categories').select('id, name')).data?.map((c) => [
        c.name.trim().toLowerCase(),
        c.id,
      ]) ?? [],
    )

    for (const row of rows) {
      const catSlug = (row.category_slug || '').trim()
      let catId = catSlug ? slugToId.get(catSlug) ?? null : null
      if (!catId && row.category_name?.trim()) {
        catId = nameToId.get(row.category_name.trim().toLowerCase()) ?? null
      }
      const payload = {
        category_id: catId,
        name: row.name.slice(0, 255),
        description: row.description || null,
        sku: row.sku || null,
        unit_price: Math.max(0, row.unit_price),
        active: row.active,
        sort_order: 0,
        image_url: row.image_url || null,
        image_alt: row.image_alt || null,
        is_stock: row.is_stock !== false,
      }

      if (row.sku) {
        const { data: existing } = await supabase.from('products').select('id').eq('sku', row.sku).maybeSingle()
        if (existing) {
          const { error: upErr } = await supabase.from('products').update(payload).eq('id', existing.id)
          if (upErr) result.errors.push(`Update ${row.sku}: ${upErr.message}`)
          else result.updated++
          continue
        }
      }

      const { error: insErr } = await supabase.from('products').insert(payload)
      if (insErr) {
        result.errors.push(`Insert ${row.name}: ${insErr.message}`)
        result.skipped++
      } else {
        result.inserted++
      }
    }
    return result
  }

  function handleExportCsv() {
    const rows = buildExportRows(products, categories)
    downloadCsv(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleExportXlsx() {
    const rows = buildExportRows(products, categories)
    downloadXlsx(rows, `catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseCsvFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleImportXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await parseXlsxFile(file)
      const result = await runImport(rows)
      setImportResult(result)
      await load()
    } catch (err) {
      setImportResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : 'Import failed'],
      })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function repairEmptyProductNames() {
    if (
      !window.confirm(
        'Fill blank product names from their description or SKU (e.g. Tealbury Item: lines)? This updates the database.',
      )
    ) {
      return
    }
    setNameRepairing(true)
    setNameRepairMessage(null)
    try {
      const r = await repairEmptyCatalogueProductNames({ catalog_program: CATALOG_PROGRAM.TEALBURY })
      setNameRepairMessage(
        r.errors.length
          ? `Updated ${r.updated} name(s); ${r.errors.length} error(s).`
          : `Updated ${r.updated} blank name(s); ${r.skipped} already had names.`,
      )
      if (r.updated > 0) await load()
    } finally {
      setNameRepairing(false)
    }
  }

  async function handleAuditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAuditLoading(true)
    setAuditResult(null)
    try {
      const rows = file.name.toLowerCase().endsWith('.csv')
        ? await parseCsvFile(file)
        : await parseXlsxFile(file)
      setAuditResult(runCatalogueAudit(rows, products.map((p) => ({ id: p.id, sku: p.sku }))))
    } finally {
      setAuditLoading(false)
      e.target.value = ''
    }
  }

  async function handleProductImagesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setImageUploading(true)
    setImageAssignResult(null)
    const uploadedPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const { error } = await supabase.storage.from('product-images').upload(safeName, file, { upsert: true })
      if (error) {
        setImageAssignResult({ updated: 0, skipped: [`${file.name}: ${error.message}`] })
        setImageUploading(false)
        e.target.value = ''
        return
      }
      uploadedPaths.push(safeName)
    }
    let updated = 0
    const skipped: string[] = []
    for (const path of uploadedPaths) {
      const base = path.replace(/\.[^.]+$/, '')
      const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path)
      const url = publicUrlData.publicUrl
      const match = products.find((p) => p.sku && p.sku.trim().toLowerCase() === base.toLowerCase())
      if (match) {
        const { error: upErr } = await supabase
          .from('products')
          .update({ image_url: url, image_alt: match.name })
          .eq('id', match.id)
        if (!upErr) updated++
        else skipped.push(`${path}: ${upErr.message}`)
      } else {
        skipped.push(`${path} (no product with SKU "${base}")`)
      }
    }
    setImageAssignResult({ updated, skipped })
    setImageUploading(false)
    e.target.value = ''
    if (updated > 0) await load()
  }

  async function handleImageMappingCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageAssignResult(null)
    try {
      const rows = await parseImageMappingCsv(file)
      setImageMappingRows(rows)
      setImageMatchResults(matchImageRowsToProducts(products, rows, imageMatchThreshold))
    } catch (err) {
      setImageMatchResults(null)
      setImageMappingRows(null)
      setImageAssignResult({
        updated: 0,
        skipped: [err instanceof Error ? err.message : 'Failed to parse CSV'],
      })
    }
  }

  function rerunImageMatching() {
    if (!imageMappingRows?.length) return
    setImageMatchResults(matchImageRowsToProducts(products, imageMappingRows, imageMatchThreshold))
  }

  function openImageReviewModal(index: number) {
    setImageReviewModalIndex(index)
    const r = imageMatchResults?.[index]
    setImageReviewOverrideProductIds(new Set((r?.products ?? []).map((p) => p.id)))
  }

  async function saveImageAssignment() {
    const idx = imageReviewModalIndex
    const r = idx != null ? imageMatchResults?.[idx] : null
    if (idx == null || !r || imageAssignSaving) return
    const productIds = imageReviewOverrideProductIds.size
      ? Array.from(imageReviewOverrideProductIds)
      : r.products.map((p) => p.id)
    if (!productIds.length) {
      setImageReviewModalIndex(null)
      return
    }
    setImageAssignSaving(true)
    const { error } = await supabase
      .from('products')
      .update({
        image_url: r.imageUrl,
        image_alt: products.find((p) => p.id === productIds[0])?.name ?? null,
      })
      .in('id', productIds)
    setImageAssignSaving(false)
    setImageReviewModalIndex(null)
    if (!error) {
      await load()
      setImageMatchResults((prev) => {
        if (!prev) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          products: products.filter((p) => productIds.includes(p.id)),
          status: 'matched',
        }
        return next
      })
    }
  }

  async function applyAllImageAssignments() {
    if (!imageMatchResults?.length || imageApplyAllSaving) return
    setImageApplyAllSaving(true)
    let updated = 0
    for (const r of imageMatchResults) {
      if (r.status !== 'matched' || !r.products.length) continue
      const productIds = r.products.map((p) => p.id)
      const { error } = await supabase
        .from('products')
        .update({ image_url: r.imageUrl, image_alt: r.products[0]?.name ?? null })
        .in('id', productIds)
      if (!error) updated += productIds.length
    }
    setImageApplyAllSaving(false)
    if (updated > 0) await load()
  }

  if (loading) {
    return <p className="admin-muted">Loading catalogue data…</p>
  }

  return (
    <div className="admin-catalogue-tools-data">
      <div className="admin-catalogue-tabs" role="tablist" aria-label="Catalogue data tools">
        {(
          [
            ['import', 'Import & export'],
            ['audit', 'Audit'],
            ['images', 'Images'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`btn btn-small ${tab === key ? '' : 'btn-outline'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'import' && (
        <div className="admin-catalogue-import-export card admin-card" style={{ marginTop: '1rem' }}>
          <h2>Import &amp; export</h2>
          <p className="admin-muted">
            Standard portal format: same columns as export. Updates products by SKU. Categories must already exist when
            provided; rows with unknown categories import as uncategorised.
          </p>
          <div className="admin-import-export-actions">
            <div className="admin-export-buttons">
              <span className="admin-export-label">Export:</span>
              <button type="button" className="btn btn-outline btn-small" onClick={handleExportCsv}>
                Download CSV
              </button>
              <button type="button" className="btn btn-outline btn-small" onClick={handleExportXlsx}>
                Download XLSX
              </button>
            </div>
            <div className="admin-import-buttons">
              <span className="admin-export-label">Import:</span>
              <label className="btn btn-outline btn-small">
                {importing ? 'Importing…' : 'From CSV'}
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="admin-file-input"
                  disabled={importing}
                  onChange={handleImportCsv}
                />
              </label>
              <label className="btn btn-outline btn-small">
                {importing ? '…' : 'From XLS/XLSX'}
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="admin-file-input"
                  disabled={importing}
                  onChange={handleImportXlsx}
                />
              </label>
            </div>
          </div>
          <p className="admin-import-hint">
            Columns: category_slug, category_name, name, description, sku, unit_price, active, image_url, image_alt,
            is_stock.
          </p>
          <p className="admin-import-hint" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-small"
              disabled={nameRepairing || !canEditCatalogue}
              onClick={() => void repairEmptyProductNames()}
            >
              {nameRepairing ? 'Repairing names…' : 'Fix blank Tealbury product names'}
            </button>
            {nameRepairMessage ? <span className="admin-muted"> {nameRepairMessage}</span> : null}
          </p>
          {importResult && (
            <div className={`admin-import-result ${importResult.errors.length ? 'has-errors' : ''}`}>
              <strong>Result:</strong> {importResult.inserted} inserted, {importResult.updated} updated,{' '}
              {importResult.skipped} skipped.
              {importResult.errors.length > 0 && (
                <ul className="admin-import-errors">
                  {importResult.errors.slice(0, 10).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                  {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
          <hr className="admin-catalogue-tab-divider" style={{ margin: '1.25rem 0', border: 0, borderTop: '1px solid var(--admin-border, #e5e7eb)' }} />
          <CatalogueTealburyImportBlock />
        </div>
      )}

      {tab === 'audit' && (
        <div className="card admin-card admin-catalogue-audit" style={{ marginTop: '1rem' }}>
          <h2>Catalogue audit</h2>
          <p className="admin-muted">
            Upload your master spreadsheet (CSV or XLSX with the same columns as export). Compares by SKU.
          </p>
          <div className="admin-audit-actions">
            <label className="btn btn-outline btn-small">
              {auditLoading ? 'Running…' : 'Run audit (CSV or XLSX)'}
              <input
                ref={auditFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="admin-file-input"
                disabled={auditLoading}
                onChange={handleAuditFile}
              />
            </label>
          </div>
          {auditResult && (
            <div className="admin-audit-result">
              <p>
                <strong>Summary:</strong> File SKUs: {auditResult.fileSkuCount} · DB products:{' '}
                {auditResult.dbProductCount}
              </p>
              <div className="admin-audit-sections">
                <div className="admin-audit-section">
                  <h3>Missing in DB ({auditResult.missingInDb.length})</h3>
                  {auditResult.missingInDb.length === 0 ? (
                    <p className="admin-muted">None.</p>
                  ) : (
                    <ul className="admin-audit-list">
                      {auditResult.missingInDb.slice(0, 50).map((sku) => (
                        <li key={sku}>
                          <code>{sku}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="admin-audit-section">
                  <h3>Extra in DB ({auditResult.extraInDb.length})</h3>
                  {auditResult.extraInDb.length === 0 ? (
                    <p className="admin-muted">None.</p>
                  ) : (
                    <ul className="admin-audit-list">
                      {auditResult.extraInDb.slice(0, 50).map((sku) => (
                        <li key={sku}>
                          <code>{sku}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="admin-audit-section">
                  <h3>Duplicate SKUs ({auditResult.duplicateSkus.length})</h3>
                  {auditResult.duplicateSkus.length === 0 ? (
                    <p className="admin-muted">None.</p>
                  ) : (
                    <ul className="admin-audit-list">
                      {auditResult.duplicateSkus.slice(0, 30).map((d) => (
                        <li key={d.sku}>
                          <code>{d.sku}</code> — {d.count} row(s)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'images' && (
        <div className="card admin-card admin-product-images-card" style={{ marginTop: '1rem' }}>
          <h2>Product images</h2>
          <p className="admin-muted">
            Lamtek product reference:{' '}
            <a href={LAMTEK_PRODUCT_IMAGES_LINK} target="_blank" rel="noopener noreferrer">
              Open Lamtek product reference
            </a>
            .
          </p>
          <div className="admin-product-images-section">
            <h3>Image mapping from CSV</h3>
            <div className="admin-product-images-upload">
              <input
                ref={imageMappingCsvRef}
                type="file"
                accept=".csv"
                className="admin-file-input"
                onChange={handleImageMappingCsvSelect}
              />
            </div>
            {imageMatchResults != null && imageMatchResults.length > 0 && (
              <>
                <div className="admin-image-match-controls">
                  <label>
                    Match threshold
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.1"
                      value={imageMatchThreshold}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        setImageMatchThreshold(v)
                        if (imageMappingRows?.length) {
                          setImageMatchResults(matchImageRowsToProducts(products, imageMappingRows, v))
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={rerunImageMatching}>
                    Re-run matching
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={imageApplyAllSaving}
                    onClick={() => void applyAllImageAssignments()}
                  >
                    {imageApplyAllSaving ? 'Applying…' : 'Apply all matched'}
                  </button>
                </div>
                <div className="admin-image-match-list">
                  {imageMatchResults.map((r, idx) => (
                    <div key={idx} className={`admin-image-match-row admin-image-match-row--${r.status}`}>
                      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => openImageReviewModal(idx)}>
                        {r.status === 'matched' ? 'Review' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="admin-product-images-section">
            <h3>Upload images by SKU</h3>
            <input
              ref={productImagesInputRef}
              type="file"
              accept="image/*"
              multiple
              className="admin-file-input"
              disabled={imageUploading}
              onChange={handleProductImagesUpload}
            />
          </div>
          {imageAssignResult && (
            <div className="admin-import-result">
              <strong>Result:</strong> {imageAssignResult.updated} updated.
            </div>
          )}
        </div>
      )}

      {imageReviewModalIndex != null && imageMatchResults?.[imageReviewModalIndex] && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(ev) => ev.target === ev.currentTarget && setImageReviewModalIndex(null)}
        >
          <div className="admin-modal admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h2>Assign image</h2>
            <button type="button" className="admin-btn" disabled={imageAssignSaving} onClick={() => void saveImageAssignment()}>
              Save
            </button>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setImageReviewModalIndex(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
