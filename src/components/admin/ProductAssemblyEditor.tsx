import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [componentPicker, setComponentPicker] = useState('')

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const pickerProducts = useMemo(
    () =>
      allProducts
        .filter((p) => p.id !== product.id && p.active)
        .sort((a, b) => (a.sku ?? a.name).localeCompare(b.sku ?? b.name)),
    [allProducts, product.id]
  )

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
    if (!bom || !addProductId) return
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
    setComponentPicker('')
    setMessage({ type: 'ok', text: 'Component added.' })
    await refresh()
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
          <ProductAssemblyBreakdown productId={product.id} roleLabels={labels} />
          {canEdit && (
            <div className="product-assembly-editor-add card admin-card">
              <h4 className="product-assembly-editor-add-title">Add component line</h4>
              <div className="product-assembly-editor-add-form">
                <label className="product-assembly-editor-field product-assembly-editor-field--full">
                  <span className="product-assembly-editor-field-label">Component product (SKU)</span>
                  <input
                    type="search"
                    list="assembly-component-products"
                    className="admin-input"
                    value={componentPicker}
                    onChange={(e) => {
                      const v = e.target.value
                      setComponentPicker(v)
                      const match = pickerProducts.find(
                        (p) => p.sku === v || `${p.sku} — ${p.name}` === v || p.id === v
                      )
                      if (match) {
                        setAddProductId(match.id)
                        const cat = categoryMap.get(match.category_id)
                        setAddRole(inferComponentRoleFromProduct(match, cat?.slug))
                      } else if (!v.trim()) {
                        setAddProductId('')
                      }
                    }}
                    placeholder="Search SKU or name…"
                  />
                </label>
                <datalist id="assembly-component-products">
                  {pickerProducts.slice(0, 500).map((p) => (
                    <option key={p.id} value={`${p.sku ?? p.id} — ${p.name}`} />
                  ))}
                </datalist>
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
                  >
                    Add to breakdown
                  </button>
                </div>
              </div>
              {bom.assembly_lines.length > 0 && (
                <div className="product-assembly-editor-lines-wrap">
                  <p className="product-assembly-editor-lines-heading">Lines in this breakdown</p>
                  <ul className="product-assembly-editor-lines">
                    {bom.assembly_lines.map((line) => (
                      <li key={line.id}>
                        <span className="product-assembly-editor-line-text">
                          {roleLabel(line.component_role)} ×{line.quantity} —{' '}
                          <code>{line.product?.sku}</code>
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
                </div>
              )}
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
