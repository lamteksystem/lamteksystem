import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_ASSEMBLY_PART_TYPES } from '@/lib/assemblyPartTypes'
import {
  addAssemblyLine,
  ASSEMBLY_COMPONENT_ROLE_LABELS,
  ensureAssemblyForProduct,
  fetchProductAssemblyBom,
  inferComponentRoleFromProduct,
  removeAssemblyLine,
  type ProductAssemblyBom,
} from '@/lib/productAssembly'
import PartTypeSelectWithAdd from '@/components/admin/PartTypeSelectWithAdd'
import ProductAssemblyBreakdown from '@/components/ProductAssemblyBreakdown'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import type { AssemblyPartTypeRow, CategoryRow, ProductRow } from '@/types/database'

interface ProductAssemblyEditorProps {
  product: ProductRow
  categories: CategoryRow[]
  allProducts: ProductRow[]
  canEdit: boolean
  partTypes?: AssemblyPartTypeRow[]
  partTypeLabels?: Map<string, string>
  onPartTypesChange?: () => void
}

function toFallbackTypes(): AssemblyPartTypeRow[] {
  return DEFAULT_ASSEMBLY_PART_TYPES.map((row) => ({
    ...row,
    active: true,
    created_at: '',
    updated_at: '',
  }))
}

export default function ProductAssemblyEditor({
  product,
  categories,
  allProducts,
  canEdit,
  partTypes: partTypesProp,
  partTypeLabels: partTypeLabelsProp,
  onPartTypesChange,
}: ProductAssemblyEditorProps) {
  const hookPartTypes = useAssemblyPartTypes(true)
  const [localPartTypes, setLocalPartTypes] = useState<AssemblyPartTypeRow[] | null>(null)

  const partTypes = useMemo(() => {
    if (localPartTypes && localPartTypes.length > 0) return localPartTypes
    if (partTypesProp && partTypesProp.length > 0) return partTypesProp
    if (hookPartTypes.types.length > 0) return hookPartTypes.types
    return toFallbackTypes()
  }, [localPartTypes, partTypesProp, hookPartTypes.types])

  const labels = useMemo(() => {
    if (partTypeLabelsProp && partTypeLabelsProp.size > 0) return partTypeLabelsProp
    if (hookPartTypes.labels.size > 0) return hookPartTypes.labels
    return new Map(Object.entries(ASSEMBLY_COMPONENT_ROLE_LABELS))
  }, [partTypeLabelsProp, hookPartTypes.labels])

  const [bom, setBom] = useState<ProductAssemblyBom | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addRole, setAddRole] = useState('other')
  const [componentSearch, setComponentSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilterByRole, setPickerFilterByRole] = useState(true)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const productMap = useMemo(() => new Map(allProducts.map((p) => [p.id, p])), [allProducts])

  const pickerProducts = useMemo(
    () =>
      allProducts
        .filter((p) => p.id !== product.id && p.active)
        .sort((a, b) => (a.sku ?? a.name).localeCompare(b.sku ?? b.name)),
    [allProducts, product.id]
  )

  const filteredPickerProducts = useMemo(() => {
    const q = componentSearch.trim().toLowerCase()
    let base = pickerProducts
    if (pickerFilterByRole && addRole && addRole !== 'other') {
      const matchByPartType = base.filter((p) => p.part_type === addRole)
      // Only narrow if filtering actually has matches; otherwise show everything so
      // the user isn't stuck with an empty list because nothing is tagged yet.
      if (matchByPartType.length > 0) base = matchByPartType
    }
    if (!q) return base.slice(0, 100)
    return base
      .filter((p) => {
        const sku = (p.sku ?? '').toLowerCase()
        const name = p.name.toLowerCase()
        return sku.includes(q) || name.includes(q)
      })
      .slice(0, 100)
  }, [pickerProducts, componentSearch, pickerFilterByRole, addRole])

  const selectedProduct = addProductId ? productMap.get(addProductId) ?? null : null

  useEffect(() => {
    if (!pickerOpen) return
    function onDocClick(e: MouseEvent) {
      if (!pickerRef.current) return
      if (e.target instanceof Node && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [pickerOpen])

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await fetchProductAssemblyBom(product.id)
    setBom(data)
    setLoading(false)
  }, [product.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (partTypes.length > 0 && !partTypes.some((t) => t.code === addRole)) {
      setAddRole(partTypes[0]?.code ?? 'other')
    }
  }, [partTypes, addRole])

  function handlePartTypesUpdated(next: AssemblyPartTypeRow[]) {
    setLocalPartTypes(next)
    void hookPartTypes.reload()
    onPartTypesChange?.()
  }

  async function handleAddLine() {
    if (!addProductId) {
      setMessage({ type: 'err', text: 'Pick a component product (SKU) from the search list first.' })
      return
    }
    const qty = parseInt(addQty, 10)
    if (!Number.isFinite(qty) || qty < 1) {
      setMessage({ type: 'err', text: 'Quantity must be at least 1.' })
      return
    }
    setBusy(true)
    setMessage(null)

    // Auto-create the assembly if it doesn't exist yet so users don't have a
    // 2-step gotcha (Define breakdown → Add line). One click = it just works.
    let assemblyId = bom?.id ?? null
    let currentLineCount = bom?.assembly_lines.length ?? 0
    if (!assemblyId) {
      const created = await ensureAssemblyForProduct(product)
      if (created.error || !created.assemblyId) {
        setBusy(false)
        console.error('[assembly] auto-create on add failed:', created.error)
        setMessage({
          type: 'err',
          text: created.error ?? 'Could not create the component breakdown.',
        })
        return
      }
      assemblyId = created.assemblyId
      currentLineCount = 0
    }

    const { error } = await addAssemblyLine({
      assemblyId,
      productId: addProductId,
      quantity: qty,
      componentRole: addRole,
      sortOrder: currentLineCount + 1,
    })
    setBusy(false)
    if (error) {
      console.error('[assembly] addAssemblyLine failed:', error, {
        assemblyId,
        productId: addProductId,
        componentRole: addRole,
        quantity: qty,
      })
      setMessage({
        type: 'err',
        text: error.includes('duplicate key')
          ? 'That component is already on this breakdown — increase its quantity or remove it first.'
          : `Could not add component: ${error}`,
      })
      return
    }
    setAddProductId('')
    setAddQty('1')
    setComponentSearch('')
    setPickerOpen(false)
    setMessage({ type: 'ok', text: 'Component added to breakdown.' })
    await refresh()
  }

  function handleSelectComponent(p: ProductRow) {
    setAddProductId(p.id)
    setComponentSearch(`${p.sku ?? p.id} — ${p.name}`)
    const cat = categoryMap.get(p.category_id)
    setAddRole(inferComponentRoleFromProduct(p, cat?.slug))
    setPickerOpen(false)
  }

  function handleClearComponent() {
    setAddProductId('')
    setComponentSearch('')
    setPickerOpen(true)
  }

  async function handleAutoSuggest() {
    if (!canEdit) return
    setBusy(true)
    setMessage(null)
    try {
      // Make sure we have an assembly to attach to.
      let assemblyId = bom?.id ?? null
      let nextSort = bom?.assembly_lines.length ?? 0
      if (!assemblyId) {
        const created = await ensureAssemblyForProduct(product)
        if (created.error || !created.assemblyId) {
          setMessage({ type: 'err', text: created.error ?? 'Could not create breakdown.' })
          return
        }
        assemblyId = created.assemblyId
        nextSort = 0
      }

      // Pick one product per part_type that this complete unit doesn't already have a
      // line for. We bias to the product whose category set overlaps with the host's,
      // falling back to the cheapest active match. This is a heuristic shortcut, not a
      // committed default — the user can immediately remove / change anything.
      const existingProductIds = new Set((bom?.assembly_lines ?? []).map((l) => l.product_id))
      const hostCategoryId = product.category_id
      const suggestionsByRole = new Map<string, ProductRow>()
      for (const role of partTypes) {
        if (suggestionsByRole.has(role.code)) continue
        const candidates = allProducts.filter(
          (p) =>
            p.id !== product.id &&
            p.active &&
            p.part_type === role.code &&
            !existingProductIds.has(p.id)
        )
        if (candidates.length === 0) continue
        const scored = candidates
          .map((p) => ({
            p,
            score: p.category_id && p.category_id === hostCategoryId ? 1 : 0,
            price: Number(p.unit_price ?? Infinity),
          }))
          .sort((a, b) => b.score - a.score || a.price - b.price)
        suggestionsByRole.set(role.code, scored[0].p)
      }

      if (suggestionsByRole.size === 0) {
        setMessage({
          type: 'err',
          text:
            'No components have a part_type set yet. Tag components in the Variant Builder or via CSV import, then try again.',
        })
        return
      }

      const lines = Array.from(suggestionsByRole.entries()).map(([role, candidate], i) => ({
        role,
        productId: candidate.id,
        sortOrder: nextSort + i + 1,
      }))

      let failed = 0
      for (const line of lines) {
        const { error } = await addAssemblyLine({
          assemblyId,
          productId: line.productId,
          quantity: 1,
          componentRole: line.role,
          sortOrder: line.sortOrder,
        })
        if (error) {
          failed += 1
          console.error('[assembly] auto-suggest add failed:', error)
        }
      }
      setMessage({
        type: failed > 0 ? 'err' : 'ok',
        text:
          failed > 0
            ? `Added ${lines.length - failed} of ${lines.length} suggested components (${failed} failed — check console).`
            : `Added ${lines.length} suggested component${lines.length === 1 ? '' : 's'}. Adjust quantities and swaps as needed.`,
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveLine(lineId: string) {
    setBusy(true)
    const { error } = await removeAssemblyLine(lineId)
    setBusy(false)
    if (error) {
      setMessage({ type: 'err', text: error })
      return
    }
    await refresh()
  }

  function roleLabel(code: string): string {
    return labels.get(code) ?? code
  }

  if (loading) {
    return <p className="admin-muted">Loading complete-unit breakdown…</p>
  }

  return (
    <div className="product-assembly-editor">
      <p className="admin-muted product-assembly-editor-hint">
        A Tealbury <strong>complete</strong> unit typically includes: carcass/cabinet, door or drawer front, hinges,
        plates, leg kit, and fittings. Link each stocked SKU here — stock take counts these parts, not the package alone.{' '}
        <Link to="/admin/settings?tab=products">Manage part types in Settings</Link>.
      </p>

      {canEdit && (
        <div className="product-assembly-editor-part-types card admin-card">
          <h4 className="product-assembly-editor-add-title">Default part type</h4>
          <p className="admin-muted product-assembly-editor-part-types-hint">
            Pre-selects the part type when you add a component below. Changes apply immediately — no separate save.
          </p>
          <PartTypeSelectWithAdd
            partTypes={partTypes}
            value={addRole}
            onChange={setAddRole}
            onPartTypesChange={handlePartTypesUpdated}
            selectLabel="Default part type for new component lines"
          />
        </div>
      )}

      {!canEdit ? (
        <ProductAssemblyBreakdown productId={product.id} roleLabels={labels} />
      ) : (
        <>
          {!bom && (
            <p className="admin-muted product-assembly-editor-hint">
              No breakdown for this product yet. Pick a component SKU and quantity below — we will
              create the breakdown automatically on your first add.
            </p>
          )}
          <div className="product-assembly-editor-add card admin-card">
              <div className="product-assembly-editor-add-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4 className="product-assembly-editor-add-title" style={{ margin: 0 }}>Add component line</h4>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => void handleAutoSuggest()}
                  disabled={busy}
                  title="Add one component per part type, picked from products tagged with that part_type."
                >
                  {busy ? 'Working…' : 'Auto-suggest standard components'}
                </button>
              </div>
              <div className="product-assembly-editor-add-form">
                <div className="product-assembly-editor-field product-assembly-editor-field--full">
                  <span className="product-assembly-editor-field-label">Component product (SKU)</span>
                  {selectedProduct ? (
                    <div className="product-assembly-picker-selected" role="status">
                      <div className="product-assembly-picker-selected-text">
                        <strong>{selectedProduct.sku ?? '(no SKU)'}</strong>
                        <span> — {selectedProduct.name}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleClearComponent}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="product-assembly-picker" ref={pickerRef}>
                      <input
                        type="search"
                        className="admin-input"
                        value={componentSearch}
                        onChange={(e) => {
                          setComponentSearch(e.target.value)
                          setPickerOpen(true)
                        }}
                        onFocus={() => setPickerOpen(true)}
                        placeholder="Search SKU or name…"
                        aria-label="Search component product"
                        autoComplete="off"
                      />
                      <label
                        className="admin-muted product-assembly-picker-filter"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.85rem' }}
                      >
                        <input
                          type="checkbox"
                          checked={pickerFilterByRole}
                          onChange={(e) => setPickerFilterByRole(e.target.checked)}
                        />
                        <span>
                          Only show components tagged as <code>{roleLabel(addRole)}</code>
                        </span>
                      </label>
                      {pickerOpen && (
                        <ul className="product-assembly-picker-list" role="listbox">
                          {filteredPickerProducts.length === 0 ? (
                            <li className="product-assembly-picker-empty">No matching products.</li>
                          ) : (
                            filteredPickerProducts.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="product-assembly-picker-option"
                                  onClick={() => handleSelectComponent(p)}
                                >
                                  <span className="product-assembly-picker-option-sku">
                                    {p.sku ?? '(no SKU)'}
                                  </span>
                                  <span className="product-assembly-picker-option-name">{p.name}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="product-assembly-editor-add-row">
                  <div className="product-assembly-editor-field product-assembly-editor-field--part-type">
                    <PartTypeSelectWithAdd
                      partTypes={partTypes}
                      value={addRole}
                      onChange={setAddRole}
                      onPartTypesChange={handlePartTypesUpdated}
                      selectLabel="Part type for this line"
                      allowCreate={false}
                    />
                  </div>
                  <label className="product-assembly-editor-field">
                    <span className="product-assembly-editor-field-label">Qty per complete unit</span>
                    <input
                      type="number"
                      min={1}
                      className="admin-input"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                    />
                  </label>
                </div>
                {message && (
                  <p
                    className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'}
                    role="status"
                    style={{ marginTop: 0 }}
                  >
                    {message.text}
                  </p>
                )}
                <div className="product-assembly-editor-add-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void handleAddLine()}
                  >
                    {busy ? 'Adding…' : 'Add to breakdown'}
                  </button>
                  {!addProductId && (
                    <span className="admin-muted product-assembly-editor-add-hint">
                      Pick a component above first.
                    </span>
                  )}
                </div>
              </div>
              <div className="product-assembly-editor-lines-wrap">
                <p className="product-assembly-editor-lines-heading">
                  Lines in this breakdown ({bom?.assembly_lines.length ?? 0})
                </p>
                {!bom || bom.assembly_lines.length === 0 ? (
                  <p className="admin-muted">
                    No components yet. Pick a SKU above, set the quantity and part type, then click
                    <em> Add to breakdown</em>.
                  </p>
                ) : (
                  <ul className="product-assembly-editor-lines">
                    {bom.assembly_lines.map((line) => (
                      <li key={line.id}>
                        <span className="product-assembly-editor-line-text">
                          <strong>×{line.quantity}</strong>{' '}
                          <code>{line.product?.sku ?? '—'}</code>{' '}
                          {line.product?.name ?? ''}{' '}
                          <span className="admin-muted">({roleLabel(line.component_role)})</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={busy}
                          onClick={() => void handleRemoveLine(line.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
        </>
      )}
    </div>
  )
}
