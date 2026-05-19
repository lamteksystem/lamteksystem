import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePermission } from '@/hooks/usePermission'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import PartTypeSelectWithAdd from '@/components/admin/PartTypeSelectWithAdd'
import type { CategoryRow, ProductRow } from '@/types/database'

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

interface PreviewRow {
  sku: string
  name: string
  description: string
  unit_price: number
  cost_price: number | null
  axisLabel: string
  exists: boolean
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

function applyTemplate(
  template: string,
  ctx: {
    size?: AxisValue | null
    range?: AxisValue | null
    finish?: AxisValue | null
  }
): string {
  return template
    .replace(/\{SIZE\}/g, ctx.size?.value ?? '')
    .replace(/\{SIZE_CODE\}/g, ctx.size?.code ?? '')
    .replace(/\{RANGE\}/g, ctx.range?.value ?? '')
    .replace(/\{RANGE_CODE\}/g, ctx.range?.code ?? '')
    .replace(/\{FINISH\}/g, ctx.finish?.value ?? '')
    .replace(/\{FINISH_CODE\}/g, ctx.finish?.code ?? '')
}

export default function AdminVariantBuilder() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.catalogue', 'edit')
  const partTypesHook = useAssemblyPartTypes(true)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const [skuPattern, setSkuPattern] = useState('1000-HL-B-{FINISH_CODE}')
  const [namePattern, setNamePattern] = useState('1000 HL Base Carcass ({FINISH})')
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
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('id, sku, category_id').order('sku'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
    ])
    setProducts((prodRes.data ?? []) as ProductRow[])
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
    () => new Set(products.map((p) => (p.sku ?? '').trim().toLowerCase())),
    [products]
  )

  const previewRows: PreviewRow[] = useMemo(() => {
    const finishValues = useFinishAxis ? finishes.filter((f) => f.active) : [null]
    const sizeValues = useSizeAxis ? sizes.filter((s) => s.active) : [null]
    const rangeValues = useRangeAxis ? rangeAxis.filter((r) => r.active) : [null]
    const basePrice = Number(unitPrice) || 0
    const baseCost = costPrice === '' ? null : Number(costPrice)

    const rows: PreviewRow[] = []
    for (const finish of finishValues) {
      for (const size of sizeValues) {
        for (const range of rangeValues) {
          const ctx = {
            finish: finish ?? undefined,
            size: size ?? undefined,
            range: range ?? undefined,
          }
          const sku = applyTemplate(skuPattern, ctx).trim()
          const name = applyTemplate(namePattern, ctx).trim()
          const description = applyTemplate(descriptionPattern, ctx).trim()
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

  async function handleCreate() {
    if (!canEdit) return
    setCreating(true)
    setResultMessage(null)
    setResultError(null)
    try {
      const toCreate = validRows.filter((r) => !r.exists)
      if (toCreate.length === 0) {
        setResultMessage('Nothing to create — all rows already exist.')
        return
      }
      const payload = toCreate.map((r) => ({
        sku: r.sku,
        name: r.name,
        description: r.description || null,
        part_type: partType || null,
        category_id: primaryCategoryId || null,
        unit_price: r.unit_price,
        cost_price: r.cost_price,
        stock_quantity: 0,
        is_stock: true,
        active: true,
      }))
      const { data, error } = await supabase
        .from('products')
        .upsert(payload, { onConflict: 'sku' })
        .select('id, sku, name')
      if (error) throw error

      // For each created row, attach range category if axis is active.
      const rangeAxisActive = useRangeAxis ? rangeAxis.filter((r) => r.active) : []
      const skuToRow = new Map<string, PreviewRow>()
      for (const r of toCreate) skuToRow.set(r.sku, r)

      if (rangeAxisActive.length > 0 && primaryCategoryId) {
        for (const created of data ?? []) {
          const row = skuToRow.get(created.sku ?? '')
          if (!row) continue
          const rangeName = row.axisLabel.split(' / ').find((part) => {
            const lower = part.toLowerCase()
            return [...rangeCategoriesByName.keys()].some((rn) => rn === lower)
          })
          if (!rangeName) continue
          const rangeCat = rangeCategoriesByName.get(rangeName.toLowerCase())
          if (!rangeCat) continue
          const categoryIds = [primaryCategoryId, rangeCat.id]
          await supabase.rpc('save_product_categories', {
            p_product_id: created.id,
            p_category_ids: categoryIds,
            p_primary_category_id: primaryCategoryId,
          })
        }
      } else if (primaryCategoryId) {
        for (const created of data ?? []) {
          await supabase.rpc('save_product_categories', {
            p_product_id: created.id,
            p_category_ids: [primaryCategoryId],
            p_primary_category_id: primaryCategoryId,
          })
        }
      }

      setResultMessage(`Created ${data?.length ?? 0} component(s).`)
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[variant-builder] create failed:', msg)
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
          Type each base SKU once, tick the colours / ranges / sizes you want, and we&rsquo;ll
          create one concrete component for every combination.
        </p>
      </div>

      <div className="admin-modal-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>1. Base template</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>
          Use <code>&#123;FINISH&#125;</code>, <code>&#123;FINISH_CODE&#125;</code>,{' '}
          <code>&#123;SIZE&#125;</code>, <code>&#123;RANGE&#125;</code>, or{' '}
          <code>&#123;RANGE_CODE&#125;</code> as placeholders.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          <label>
            <span className="admin-muted">SKU pattern</span>
            <input
              className="admin-input"
              value={skuPattern}
              onChange={(e) => setSkuPattern(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            <span className="admin-muted">Name pattern</span>
            <input
              className="admin-input"
              value={namePattern}
              onChange={(e) => setNamePattern(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span className="admin-muted">Description pattern (optional)</span>
            <input
              className="admin-input"
              value={descriptionPattern}
              onChange={(e) => setDescriptionPattern(e.target.value)}
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
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
              style={{ width: '100%' }}
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
      </div>

      <div className="admin-modal-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>2. Axes</h2>
        <AxisEditor
          label="Carcass / door finish"
          enabled={useFinishAxis}
          onToggle={setUseFinishAxis}
          values={finishes}
          setValues={setFinishes}
          placeholder="Add finish (e.g. Smoke)"
          codeHint="3-letter code, e.g. WHI"
        />
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
      </div>

      <div className="admin-modal-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>
          3. Preview ({validRows.length} SKU{validRows.length === 1 ? '' : 's'} — {newRowCount} new,{' '}
          {skipCount} already exist
          {blankRows > 0 ? `, ${blankRows} skipped (blank sku/name)` : ''})
        </h2>
        {previewRows.length === 0 && (
          <p className="admin-muted">Toggle at least one axis on, then tick some values.</p>
        )}
        {previewRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Name</th>
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
                    <td>
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
                    </td>
                    <td>
                      {!r.sku || !r.name
                        ? 'blank'
                        : r.exists
                        ? 'exists (skip)'
                        : 'will create'}
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

        <div className="admin-modal-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void handleCreate()}
            disabled={creating || newRowCount === 0 || dataLoading}
          >
            {creating ? 'Creating…' : `Create ${newRowCount} component(s)`}
          </button>
          <Link to="/admin/catalogue" className="btn btn-ghost">
            Back to catalogue
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
      </div>
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
    <div style={{ marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--lamtek-border, #eee)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>{label}</span>
      </label>
      {enabled && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.5rem 0' }}>
            {values.map((v, i) => (
              <div
                key={`${v.value}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.5rem',
                  border: '1px solid var(--lamtek-border, #ddd)',
                  borderRadius: '6px',
                  background: v.active ? 'rgba(201, 169, 81, 0.08)' : 'transparent',
                }}
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
                  value={v.code}
                  onChange={(e) =>
                    setValues((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, code: e.target.value } : x))
                    )
                  }
                  title={codeHint}
                  style={{ width: '4rem', fontSize: '0.85rem', padding: '0.15rem 0.35rem' }}
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              style={{ flex: 1, maxWidth: '20rem' }}
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

