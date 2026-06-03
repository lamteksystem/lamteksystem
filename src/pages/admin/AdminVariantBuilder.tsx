import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatUnknownError } from '@/lib/formatError'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import PartTypeSelectWithAdd from '@/components/admin/PartTypeSelectWithAdd'
import { loadWorkbenchDraft, saveWorkbenchDraft } from '@/lib/pricelistWorkbenchDraft'
import { type PricelistSource, type PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import { enrichWorkbenchRowMetadata } from '@/lib/tealburyCatalogueBuild'
import {
  applyVariantTemplate,
  buildFinishPriceMatrix,
  cheapestFinishPrice,
  finishCode,
  rangeCode,
  type FinishOption,
} from '@/lib/variantGenerator'
import type { CategoryRow } from '@/types/database'

/**
 * Variant Matrix Builder: type each base SKU once, tick the finishes/ranges/sizes,
 * and the system creates concrete component rows for every combination.
 *
 * Patterns support these placeholders:
 *   {SIZE}      from the Size axis
 *   {RANGE}     from the Range axis (full range name)
 *   {RANGE_CODE} short code derived from range name (DAW, NOR, OAK…)
 *   {FINISH}    from the Finish axis (e.g. White, Oak, Grey)
 *   {FINISH_CODE} short code (WHI, OAK, GRY)
 */

interface AxisValue {
  value: string
  code: string
  active: boolean
}

type PricingMode = 'matrix' | 'per_sku'

interface PreviewRow {
  sku: string
  name: string
  description: string
  unit_price: number
  cost_price: number | null
  axisLabel: string
  /** True when this SKU already exists in the workbench draft. */
  exists: boolean
  /** Finish price matrix for matrix mode (one row, many colours). */
  finishMatrix?: Record<string, number>
}

const DEFAULT_FINISHES: AxisValue[] = [
  { value: 'White', code: 'WHI', active: true },
  { value: 'Oak', code: 'OAK', active: true },
  { value: 'Grey', code: 'GRY', active: true },
]

const DEFAULT_SIZES: AxisValue[] = [
  { value: '300', code: '300', active: false },
  { value: '400', code: '400', active: false },
  { value: '500', code: '500', active: false },
  { value: '600', code: '600', active: true },
  { value: '800', code: '800', active: true },
  { value: '1000', code: '1000', active: true },
]

function defaultCode(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  if (!clean) return ''
  // First three letters of cleaned string is a decent default code.
  return clean.slice(0, 3)
}

export default function AdminVariantBuilder() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const partTypesHook = useAssemblyPartTypes(true)

  const [draftRows, setDraftRows] = useState<PricelistWorkbenchRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const [source, setSource] = useState<PricelistSource>('lamtek')
  const [pricingMode, setPricingMode] = useState<PricingMode>('matrix')

  const [skuPattern, setSkuPattern] = useState('B{SIZE}')
  const [namePattern, setNamePattern] = useState('{SIZE} Base unit')
  const [descriptionPattern, setDescriptionPattern] = useState('')
  const [partType, setPartType] = useState('carcass')
  const [unitPrice, setUnitPrice] = useState('55')
  const [costPrice, setCostPrice] = useState('')
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('')

  const [useFinishAxis, setUseFinishAxis] = useState(true)
  const [useSizeAxis, setUseSizeAxis] = useState(false)
  const [useRangeAxis, setUseRangeAxis] = useState(false)

  const [finishes, setFinishes] = useState<AxisValue[]>(DEFAULT_FINISHES)
  const [sizes, setSizes] = useState<AxisValue[]>(DEFAULT_SIZES)
  const [rangeAxis, setRangeAxis] = useState<AxisValue[]>([])
  // Per-cell price overrides keyed by SKU. Empty string = use base price.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({})

  const [creating, setCreating] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setDataLoading(true)
    const [{ rows }, catRes] = await Promise.all([
      loadWorkbenchDraft(),
      supabase.from('categories').select('*').order('sort_order').order('name'),
    ])
    setDraftRows(rows)
    setCategories((catRes.data ?? []) as CategoryRow[])
    setDataLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Seed range axis from the door_range categories.
  useEffect(() => {
    if (categories.length === 0) return
    setRangeAxis((prev) => {
      if (prev.length > 0) return prev
      return categories
        .filter((c) => c.category_kind === 'door_range')
        .map((c) => ({
          value: c.name,
          code: defaultCode(c.name),
          active: false,
        }))
    })
  }, [categories])

  const productTypeCategories = useMemo(
    () => categories.filter((c) => c.category_kind === 'product_type' || c.category_kind === 'universal'),
    [categories]
  )
  const rangeCategoriesByName = useMemo(
    () => new Map(categories.filter((c) => c.category_kind === 'door_range').map((c) => [c.name.toLowerCase(), c])),
    [categories]
  )
  const existingSkus = useMemo(
    () => new Set(draftRows.map((r) => (r.sku ?? '').trim().toLowerCase())),
    [draftRows],
  )

  const previewRows: PreviewRow[] = useMemo(() => {
    const activeFinishes = useFinishAxis ? finishes.filter((f) => f.active) : []
    const sizeValues = useSizeAxis ? sizes.filter((s) => s.active) : [null]
    const rangeValues = useRangeAxis ? rangeAxis.filter((r) => r.active) : [null]
    const basePrice = Number(unitPrice) || 0
    const baseCost = costPrice === '' ? null : Number(costPrice)

    const rows: PreviewRow[] = []

    if (pricingMode === 'matrix') {
      // One draft row per size/range combo; all colours live in a finish price matrix.
      const sizeLoop = sizeValues.length > 0 ? sizeValues : [null]
      const rangeLoop = rangeValues.length > 0 ? rangeValues : [null]
      for (const size of sizeLoop) {
        for (const range of rangeLoop) {
          const ctx = {
            size: size?.value ?? null,
            sizeCode: size?.code ?? null,
            range: range?.value ?? null,
            rangeCode: range?.code ?? (range?.value ? rangeCode(range.value) : null),
          }
          const sku = applyVariantTemplate(skuPattern, ctx)
          const name = applyVariantTemplate(namePattern, ctx)
          const description = applyVariantTemplate(descriptionPattern, ctx)
          const finishOpts: FinishOption[] =
            activeFinishes.length > 0
              ? activeFinishes.map((f) => {
                  const raw = priceOverrides[`finish:${f.value}`]
                  const explicit =
                    raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined
                  return { label: f.value, price: explicit }
                })
              : [{ label: 'Default', price: basePrice }]
          const matrix = buildFinishPriceMatrix(finishOpts, basePrice)
          const parts = [size?.value && `${size.value}mm`, range?.value].filter(Boolean)
          rows.push({
            sku,
            name,
            description,
            unit_price: cheapestFinishPrice(matrix) ?? basePrice,
            cost_price: baseCost,
            axisLabel: parts.join(' / ') || '(base)',
            exists: !!sku && existingSkus.has(sku.toLowerCase()),
            finishMatrix: matrix,
          })
        }
      }
      return rows
    }

    // per_sku: one concrete SKU per combination (e.g. separate hinge brands).
    const finishLoop = useFinishAxis ? activeFinishes : [null]
    for (const finish of finishLoop) {
      for (const size of sizeValues) {
        for (const range of rangeValues) {
          const ctx = {
            finish: finish?.value ?? null,
            finishCode: finish?.code ?? (finish?.value ? finishCode(finish.value) : null),
            size: size?.value ?? null,
            sizeCode: size?.code ?? null,
            range: range?.value ?? null,
            rangeCode: range?.code ?? (range?.value ? rangeCode(range.value) : null),
          }
          const sku = applyVariantTemplate(skuPattern, ctx)
          const name = applyVariantTemplate(namePattern, ctx)
          const description = applyVariantTemplate(descriptionPattern, ctx)
          const parts = [finish?.value, size?.value && `${size.value}mm`, range?.value].filter(Boolean)
          const axisLabel = parts.join(' / ') || '(base)'
          const overrideRaw = priceOverrides[sku]
          const overridePrice =
            overrideRaw != null && overrideRaw !== '' && Number.isFinite(Number(overrideRaw))
              ? Number(overrideRaw)
              : null
          rows.push({
            sku,
            name,
            description,
            unit_price: overridePrice ?? basePrice,
            cost_price: baseCost,
            axisLabel,
            exists: !!sku && existingSkus.has(sku.toLowerCase()),
          })
        }
      }
    }
    return rows
  }, [
    pricingMode,
    useFinishAxis,
    useSizeAxis,
    useRangeAxis,
    finishes,
    sizes,
    rangeAxis,
    unitPrice,
    costPrice,
    skuPattern,
    namePattern,
    descriptionPattern,
    priceOverrides,
    existingSkus,
  ])

  const validRows = useMemo(() => previewRows.filter((r) => r.sku && r.name), [previewRows])
  const newRowCount = useMemo(() => validRows.filter((r) => !r.exists).length, [validRows])
  const skipCount = useMemo(() => validRows.filter((r) => r.exists).length, [validRows])
  const blankRows = previewRows.length - validRows.length

  function buildWorkbenchRowFromPreview(row: PreviewRow): PricelistWorkbenchRow {
    const finishKey =
      source === 'tealbury' ? 'tealbury_finish_prices_gbp' : 'lamtek_finish_prices_gbp'
    const primaryCat = categories.find((c) => c.id === primaryCategoryId)
    const rangePart = row.axisLabel.split(' / ').find((part) => rangeCategoriesByName.has(part.toLowerCase()))
    const doorRange = rangePart ?? ''
    const sizePart = row.axisLabel.match(/(\d+)mm/)?.[1]
    const widthMm = sizePart ? Number(sizePart) : null

    const options: Record<string, unknown> = {}
    if (row.finishMatrix) options[finishKey] = row.finishMatrix
    if (widthMm) options.lamtek_dims_mm = { w: widthMm, h: 720, d: 560 }

    const draft: PricelistWorkbenchRow = {
      id: crypto.randomUUID(),
      source,
      catalog_program: source === 'tealbury' ? 'tealbury' : 'lamtek',
      sku: row.sku,
      name: row.name,
      description: row.description,
      unit_price: row.unit_price,
      cost_price: row.cost_price,
      active: true,
      is_stock: source !== 'tealbury',
      image_url: '',
      image_alt: '',
      category_id: primaryCategoryId || null,
      category_slug: primaryCat?.slug ?? '',
      category_name: primaryCat?.name ?? '',
      section: '',
      door_range: doorRange,
      trade_code: row.sku.replace(/\s*·\s*.+$/, '').trim(),
      selected: false,
      options: options as PricelistWorkbenchRow['options'],
      item_kind: source === 'tealbury' ? 'complete' : 'component',
      part_type: partType || '',
    }
    return enrichWorkbenchRowMetadata(draft)
  }

  async function handleAddToDraft() {
    if (!canEdit) return
    setCreating(true)
    setResultMessage(null)
    setResultError(null)
    try {
      const toAdd = validRows.filter((r) => !r.exists)
      if (toAdd.length === 0) {
        setResultMessage('Nothing to add — every preview SKU is already in the workbench draft.')
        return
      }
      const updated = [...draftRows]
      let added = 0
      let replaced = 0
      for (const pr of toAdd) {
        const wb = buildWorkbenchRowFromPreview(pr)
        const idx = updated.findIndex((r) => (r.sku ?? '').trim().toLowerCase() === pr.sku.toLowerCase())
        if (idx >= 0) {
          updated[idx] = { ...wb, id: updated[idx].id }
          replaced++
        } else {
          updated.push(wb)
          added++
        }
      }
      await saveWorkbenchDraft(updated)
      setResultMessage(
        `Added ${added} row(s) to the workbench draft${replaced ? ` (${replaced} updated)` : ''}. ` +
          `Draft now has ${updated.length} rows — nothing is live in the catalogue until you publish.`,
      )
      await reload()
    } catch (e) {
      const msg = formatUnknownError(e, 'Could not add variants to the workbench draft.')
      console.error('[variant-builder] draft save failed:', msg)
      setResultError(msg)
    } finally {
      setCreating(false)
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
          <h1>Variant matrix builder</h1>
        </div>
        <p className="admin-error">You don&rsquo;t have permission to edit the catalogue.</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Variant matrix builder</h1>
        <p className="page-intro">
          Generate component or complete-unit rows into the <strong>pricelist workbench draft</strong>{' '}
          (not the live catalogue). Use <strong>Finish matrix</strong> mode so one SKU carries every
          colour price — the customer picks the finish at order time. Publish from the workbench when
          everything is ready.
        </p>
        <p className="admin-muted">
          Draft: {draftRows.length} row{draftRows.length === 1 ? '' : 's'} · Live catalogue: empty until
          you publish.{' '}
          <Link to="/admin/catalogue-tools/pricelist-workbench">Open workbench</Link>
        </p>
      </div>

      <section className="admin-modal-card admin-wipe-section">
        <h2>1. Base template</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Placeholders: <code>&#123;SIZE&#125;</code> <code>&#123;RANGE&#125;</code>{' '}
          <code>&#123;FINISH&#125;</code> (per-SKU mode only). In <strong>matrix</strong> mode, colours
          are not separate SKUs — they become entries in{' '}
          <code>lamtek_finish_prices_gbp</code> / <code>tealbury_finish_prices_gbp</code>.
        </p>
        <div className="admin-form-grid">
          <label>
            <span className="admin-muted">Draft source</span>
            <select
              className="admin-input"
              value={source}
              onChange={(e) => setSource(e.target.value as PricelistSource)}
            >
              <option value="lamtek">Lamtek components (carcass, hinges…)</option>
              <option value="uform">UFORM doors / drawer fronts</option>
              <option value="tealbury">Tealbury complete units</option>
            </select>
          </label>
          <label>
            <span className="admin-muted">Pricing mode</span>
            <select
              className="admin-input"
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as PricingMode)}
            >
              <option value="matrix">Finish matrix (one SKU, many colours)</option>
              <option value="per_sku">Separate SKU per combination</option>
            </select>
          </label>
          <label>
            <span className="admin-muted">SKU pattern</span>
            <input
              className="admin-input"
              value={skuPattern}
              onChange={(e) => setSkuPattern(e.target.value)}
            />
          </label>
          <label>
            <span className="admin-muted">Name pattern</span>
            <input
              className="admin-input"
              value={namePattern}
              onChange={(e) => setNamePattern(e.target.value)}
            />
          </label>
          <label className="admin-form-grid--span-full">
            <span className="admin-muted">Description pattern (optional)</span>
            <input
              className="admin-input"
              value={descriptionPattern}
              onChange={(e) => setDescriptionPattern(e.target.value)}
            />
          </label>
          <label>
            <span className="admin-muted">Base unit price (GBP)</span>
            <input
              className="admin-input"
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
          <label>
            <span className="admin-muted">Base cost price (optional)</span>
            <input
              className="admin-input"
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </label>
          <div>
            <span className="admin-muted">Part type</span>
            <PartTypeSelectWithAdd
              partTypes={partTypesHook.types}
              value={partType}
              onChange={setPartType}
              onPartTypesChange={() => void partTypesHook.reload()}
              selectLabel="Part type"
              allowCreate
            />
          </div>
          <label>
            <span className="admin-muted">Primary category</span>
            <select
              className="admin-input"
              value={primaryCategoryId}
              onChange={(e) => setPrimaryCategoryId(e.target.value)}
            >
              <option value="">(none)</option>
              {productTypeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.category_kind === 'universal' ? ' (universal)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-modal-card admin-wipe-section">
        <h2>2. Axes</h2>
        <AxisEditor
          label="Carcass / door finish"
          enabled={useFinishAxis}
          onToggle={setUseFinishAxis}
          values={finishes}
          setValues={setFinishes}
          placeholder="Add finish (e.g. Smoke)"
          codeHint="3-letter code, e.g. WHI"
        />
        {pricingMode === 'matrix' && useFinishAxis && (
          <div className="admin-finish-price-grid">
            <p className="admin-muted">Optional price per finish (GBP). Leave blank to use base price.</p>
            {finishes
              .filter((f) => f.active)
              .map((f) => (
                <label key={f.value} className="admin-finish-price-row">
                  <span>{f.value}</span>
                  <input
                    className="admin-input"
                    type="number"
                    step="0.01"
                    placeholder={unitPrice || '0'}
                    value={priceOverrides[`finish:${f.value}`] ?? ''}
                    onChange={(e) =>
                      setPriceOverrides((prev) => ({
                        ...prev,
                        [`finish:${f.value}`]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
          </div>
        )}
        <AxisEditor
          label="Size (mm)"
          enabled={useSizeAxis}
          onToggle={setUseSizeAxis}
          values={sizes}
          setValues={setSizes}
          placeholder="Add size (e.g. 1200)"
          codeHint="Same as value by default"
        />
        <AxisEditor
          label="Door range"
          enabled={useRangeAxis}
          onToggle={setUseRangeAxis}
          values={rangeAxis}
          setValues={setRangeAxis}
          placeholder="Add range (must exist as a door_range category)"
          codeHint="3-letter code, e.g. DAW"
        />
      </section>

      <section className="admin-modal-card admin-wipe-section">
        <h2>
          3. Preview ({validRows.length} SKU{validRows.length === 1 ? '' : 's'} — {newRowCount} to add,{' '}
          {skipCount} already in draft
          {blankRows > 0 ? `, ${blankRows} skipped (blank sku/name)` : ''})
        </h2>
        {previewRows.length === 0 && (
          <p className="admin-muted">Toggle at least one axis on, then tick some values.</p>
        )}
        {previewRows.length > 0 && (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Name</th>
                  {pricingMode === 'matrix' && <th>Finish prices</th>}
                  <th>Price override</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.sku || 'blank'}-${i}`}>
                    <td>{r.axisLabel}</td>
                    <td>
                      <code>{r.sku || '(blank)'}</code>
                    </td>
                    <td>{r.name || '(blank)'}</td>
                    {pricingMode === 'matrix' && (
                      <td className="admin-muted" style={{ fontSize: '0.85rem', maxWidth: '14rem' }}>
                        {r.finishMatrix
                          ? Object.entries(r.finishMatrix)
                              .map(([k, v]) => `${k}: £${v.toFixed(2)}`)
                              .join(' · ')
                          : '—'}
                      </td>
                    )}
                    <td>
                      {pricingMode === 'matrix' ? (
                        <span className="admin-muted">per finish below</span>
                      ) : (
                        <input
                          className="admin-input"
                          type="number"
                          step="0.01"
                          placeholder={String(unitPrice || 0)}
                          value={priceOverrides[r.sku] ?? ''}
                          onChange={(e) =>
                            setPriceOverrides((prev) => ({ ...prev, [r.sku]: e.target.value }))
                          }
                          style={{ width: '6rem' }}
                        />
                      )}
                    </td>
                    <td>
                      {!r.sku || !r.name
                        ? 'blank'
                        : r.exists
                          ? 'in draft (skip)'
                          : 'will add to draft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 200 && (
              <p className="admin-muted">Showing first 200 of {previewRows.length} rows.</p>
            )}
          </div>
        )}

        <div className="admin-page-actions-row" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void handleAddToDraft()}
            disabled={creating || newRowCount === 0 || dataLoading}
          >
            {creating ? 'Saving draft…' : `Add ${newRowCount} row(s) to workbench draft`}
          </button>
          <Link to="/admin/catalogue-tools" className="btn btn-ghost">
            Back to tools
          </Link>
        </div>
        {resultMessage && (
          <p className="admin-message-ok" style={{ marginTop: '0.75rem' }}>
            {resultMessage}
          </p>
        )}
        {resultError && (
          <p className="admin-error" style={{ marginTop: '0.75rem' }}>
            {resultError}
          </p>
        )}
      </section>
    </div>
  )
}

interface AxisEditorProps {
  label: string
  enabled: boolean
  onToggle: (next: boolean) => void
  values: AxisValue[]
  setValues: React.Dispatch<React.SetStateAction<AxisValue[]>>
  placeholder: string
  codeHint: string
}

function AxisEditor({ label, enabled, onToggle, values, setValues, placeholder, codeHint }: AxisEditorProps) {
  const [draftValue, setDraftValue] = useState('')

  function addValue() {
    const v = draftValue.trim()
    if (!v) return
    setValues((prev) => {
      if (prev.some((x) => x.value.toLowerCase() === v.toLowerCase())) return prev
      return [...prev, { value: v, code: defaultCode(v) || v, active: true }]
    })
    setDraftValue('')
  }

  return (
    <div className="admin-axis-row">
      <label className="admin-axis-row-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>{label}</span>
      </label>
      {enabled && (
        <>
          <div className="admin-axis-chips">
            {values.map((v, i) => (
              <div
                key={`${v.value}-${i}`}
                className={`admin-axis-chip${v.active ? ' admin-axis-chip--active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={v.active}
                  onChange={(e) =>
                    setValues((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, active: e.target.checked } : x))
                    )
                  }
                />
                <span>{v.value}</span>
                <input
                  type="text"
                  className="admin-input admin-axis-chip-code"
                  value={v.code}
                  onChange={(e) =>
                    setValues((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, code: e.target.value } : x))
                    )
                  }
                  title={codeHint}
                  aria-label={`Code for ${v.value}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setValues((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${v.value}`}
                  style={{ padding: '0 0.35rem' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="admin-axis-add-row">
            <input
              className="admin-input"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addValue()
                }
              }}
              placeholder={placeholder}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addValue}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}

