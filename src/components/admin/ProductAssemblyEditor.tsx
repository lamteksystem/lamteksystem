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
    if (!q) return pickerProducts.slice(0, 100)
    return pickerProducts
      .filter((p) => {
        const sku = (p.sku ?? '').toLowerCase()
        const name = p.name.toLowerCase()
        return sku.includes(q) || name.includes(q)
      })
      .slice(0, 100)
  }, [pickerProducts, componentSearch])

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

  async function handleCreateBom() {
    setBusy(true)
    setMessage(null)
    const { assemblyId, error } = await ensureAssemblyForProduct(product)
    setBusy(false)
    if (error || !assemblyId) {
      setMessage({ type: 'err', text: error ?? 'Could not create breakdown.' })
      return
    }
    setMessage({ type: 'ok', text: 'Breakdown created — add component lines below.' })
    await refresh()
  }

  async function handleAddLine() {
    if (!bom) {
      setMessage({ type: 'err', text: 'Create the breakdown first.' })
      return
    }
    if (!addProductId) {
      setMessage({ type: 'err', text: 'Pick a component SKU from the search list first.' })
      return
    }
    const qty = parseInt(addQty, 10)
    if (!Number.isFinite(qty) || qty < 1) {
      setMessage({ type: 'err', text: 'Quantity must be at least 1.' })
      return
    }
    setBusy(true)
    const { error } = await addAssemblyLine({
      assemblyId: bom.id,
      productId: addProductId,
      quantity: qty,
      componentRole: addRole,
      sortOrder: bom.assembly_lines.length + 1,
    })
    setBusy(false)
    if (error) {
      setMessage({ type: 'err', text: error })
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

      {!bom ? (
        canEdit ? (
          <div className="product-assembly-editor-create">
            <p className="admin-muted">
              When you are ready, create the breakdown, then pick a component SKU and quantity below.
            </p>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void handleCreateBom()}>
              {busy ? 'Creating…' : 'Define component breakdown'}
            </button>
          </div>
        ) : (
          <ProductAssemblyBreakdown productId={product.id} roleLabels={labels} />
        )
      ) : (
        <>
          {!canEdit && <ProductAssemblyBreakdown productId={product.id} roleLabels={labels} />}
          {canEdit && (
            <div className="product-assembly-editor-add card admin-card">
              <h4 className="product-assembly-editor-add-title">Add component line</h4>
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
                <div className="product-assembly-editor-add-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !addProductId}
                    onClick={() => void handleAddLine()}
                    title={!addProductId ? 'Pick a component from the search list first' : undefined}
                  >
                    {busy ? 'Adding…' : 'Add to breakdown'}
                  </button>
                </div>
              </div>
              <div className="product-assembly-editor-lines-wrap">
                <p className="product-assembly-editor-lines-heading">
                  Lines in this breakdown ({bom.assembly_lines.length})
                </p>
                {bom.assembly_lines.length === 0 ? (
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
          )}
        </>
      )}

      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
