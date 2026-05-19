import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import {
  fetchProductCategoriesForProduct,
  formatCategoryNames,
  getProductCategoriesFromMap,
  normalizeCategorySelection,
  saveProductCategories,
  type ProductCategoryMap,
} from '@/lib/productCategories'
import ProductCategoriesAssignModal from '@/components/admin/ProductCategoriesAssignModal'
import { ProductCategoryMultiSelect } from '@/components/admin/ProductCategoryMultiSelect'
import ProductCompositionPanel from '@/components/admin/ProductCompositionPanel'
import { usePermission } from '@/hooks/usePermission'
import type { AssemblyPartTypeRow, CategoryRow, ProductRow } from '@/types/database'

function catalogProgramLabel(program: string | undefined): string {
  if (program === 'tealbury') return 'Tealbury (curated kitchens)'
  return 'Lamtek (component catalogue)'
}

type ProductModalInlineField =
  | 'name'
  | 'sku'
  | 'description'
  | 'unit_price'
  | 'cost_price'
  | 'stock_quantity'
  | 'sort_order'
  | 'active'
  | 'is_stock'
  | 'image_url'
  | 'image_alt'
  | 'category_id'

const INLINE_EDIT_HINT = 'Double-click to edit'

interface AdminProductModalProps {
  product: ProductRow
  categories: CategoryRow[]
  /** When provided (e.g. from Catalogue), avoids loading all product↔category links. */
  productCategoryMap?: ProductCategoryMap
  partTypes?: AssemblyPartTypeRow[]
  partTypeLabels?: Map<string, string>
  allProducts: ProductRow[]
  onClose: () => void
  onSaved: () => void
  onCategoriesChange?: (categories: CategoryRow[]) => void
  onPartTypesChange?: () => void
  /** Called after a successful save with updated category assignment. */
  onProductSaved?: (productId: string, categoryIds: string[], primaryCategoryId: string) => void
  /** When set (e.g. from Catalogue), avoids a second permission round-trip in the modal. */
  canEditCatalogue?: boolean
}

export default function AdminProductModal({
  product,
  categories,
  productCategoryMap,
  partTypes,
  partTypeLabels,
  allProducts,
  onClose,
  onSaved,
  onCategoriesChange,
  onPartTypesChange,
  onProductSaved,
  canEditCatalogue: canEditCatalogueProp,
}: AdminProductModalProps) {
  const { allowed: canEditFromPermission } = usePermission('admin.catalogue', 'edit')
  const canEditCatalogue = canEditCatalogueProp ?? canEditFromPermission
  const [liveProduct, setLiveProduct] = useState(product)
  const [editing, setEditing] = useState(false)
  const [editingField, setEditingField] = useState<ProductModalInlineField | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [categoriesList, setCategoriesList] = useState(categories)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)
  const [preloadCategoriesModal, setPreloadCategoriesModal] = useState(false)
  const [showAssemblyEditor, setShowAssemblyEditor] = useState(false)
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    const fromMap = getProductCategoriesFromMap(product.id, product.category_id, productCategoryMap)
    return fromMap?.categoryIds ?? (product.category_id ? [product.category_id] : [])
  })
  const [primaryCategoryId, setPrimaryCategoryId] = useState(() => {
    const fromMap = getProductCategoriesFromMap(product.id, product.category_id, productCategoryMap)
    return fromMap?.primaryCategoryId ?? product.category_id ?? ''
  })
  const [inlineCategoryDraft, setInlineCategoryDraft] = useState<{ ids: string[]; primary: string } | null>(null)
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    sku: product.sku ?? '',
    unit_price: String(product.unit_price),
    cost_price: product.cost_price != null ? String(product.cost_price) : '',
    stock_quantity: String(product.stock_quantity ?? 0),
    sort_order: String(product.sort_order ?? 0),
    active: product.active,
    image_url: product.image_url ?? '',
    image_alt: product.image_alt ?? '',
    is_stock: product.is_stock !== false,
  })

  useEffect(() => {
    setCategoriesList(categories)
  }, [categories])

  // Sync when switching products or when parent updates primary category_id after save.
  // Do not depend on productCategoryMap — stale map was overwriting multi-category saves.
  useEffect(() => {
    setInlineCategoryDraft(null)
    const fromMap = getProductCategoriesFromMap(product.id, product.category_id, productCategoryMap)
    if (fromMap) {
      setCategoryIds(fromMap.categoryIds)
      setPrimaryCategoryId(fromMap.primaryCategoryId)
      return
    }
    let cancelled = false
    void fetchProductCategoriesForProduct(product.id, product.category_id).then(
      ({ categoryIds: ids, primaryCategoryId: primary }) => {
        if (cancelled) return
        setCategoryIds(ids.length > 0 ? ids : product.category_id ? [product.category_id] : [])
        setPrimaryCategoryId(primary || ids[0] || product.category_id || '')
      }
    )
    return () => {
      cancelled = true
    }
  }, [product.id, product.category_id])

  useEffect(() => {
    setPreloadCategoriesModal(false)
    setShowAssemblyEditor(false)
    const frame = requestAnimationFrame(() => {
      setPreloadCategoriesModal(true)
      setShowAssemblyEditor(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [product.id])

  useEffect(() => {
    setLiveProduct(product)
    setEditingField(null)
    setForm({
      name: product.name,
      description: product.description ?? '',
      sku: product.sku ?? '',
      unit_price: String(product.unit_price),
      cost_price: product.cost_price != null ? String(product.cost_price) : '',
      stock_quantity: String(product.stock_quantity ?? 0),
      sort_order: String(product.sort_order ?? 0),
      active: product.active,
      image_url: product.image_url ?? '',
      image_alt: product.image_alt ?? '',
      is_stock: product.is_stock !== false,
    })
  }, [product])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (categoriesModalOpen) return
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, categoriesModalOpen])

  const handleCategoriesUpdated = useCallback((next: CategoryRow[]) => {
    setCategoriesList(next)
    onCategoriesChange?.(next)
  }, [onCategoriesChange])

  const openCategoriesModal = useCallback(() => {
    setPreloadCategoriesModal(true)
    setCategoriesModalOpen(true)
  }, [])

  function handleCategoriesAssignSaved(ids: string[], primary: string) {
    setCategoryIds(ids)
    setPrimaryCategoryId(primary)
    setLiveProduct((prev) => ({ ...prev, category_id: primary }))
    onProductSaved?.(liveProduct.id, ids, primary)
    if (inlineCategoryDraft) {
      setInlineCategoryDraft({ ids, primary })
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const price = parseFloat(form.unit_price)
    const costPrice = form.cost_price === '' ? null : parseFloat(form.cost_price)
    const stockQty = parseInt(form.stock_quantity, 10)
    const sortOrder = parseInt(form.sort_order, 10)

    const normalized = normalizeCategorySelection(categoryIds, primaryCategoryId)
    if (normalized.ids.length === 0 || !normalized.primary) {
      setSaveError('Select at least one category.')
      setSaving(false)
      return
    }

    const catResult = await saveProductCategories(product.id, normalized.ids, normalized.primary)
    if (catResult.error) {
      setSaveError(`Categories: ${catResult.error}`)
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        category_id: catResult.primaryCategoryId,
        unit_price: Number.isFinite(price) ? price : product.unit_price,
        cost_price: Number.isFinite(costPrice) ? costPrice : null,
        stock_quantity: Number.isFinite(stockQty) && stockQty >= 0 ? stockQty : product.stock_quantity ?? 0,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : product.sort_order ?? 0,
        active: form.active,
        image_url: form.image_url.trim() || null,
        image_alt: form.image_alt.trim() || null,
        is_stock: form.is_stock,
      })
      .eq('id', product.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setCategoryIds(catResult.categoryIds)
    setPrimaryCategoryId(catResult.primaryCategoryId)
    setLiveProduct((prev) => ({ ...prev, category_id: catResult.primaryCategoryId }))
    onProductSaved?.(product.id, catResult.categoryIds, catResult.primaryCategoryId)
    setEditing(false)
    onSaved()
    onClose()
  }

  const categoryMap = new Map(categoriesList.map((c) => [c.id, c]))
  const displayCategoryNames = formatCategoryNames(categoryIds, categoryMap)
  const availability = getProductAvailabilityMeta(liveProduct)

  function startInlineEdit(field: ProductModalInlineField) {
    if (!canEditCatalogue || editing || inlineSaving) return
    if (field === 'category_id') {
      const ids = categoryIds.length > 0 ? categoryIds : [liveProduct.category_id]
      setInlineCategoryDraft({ ids, primary: primaryCategoryId || ids[0] || liveProduct.category_id })
    }
    setEditingField(field)
  }

  function cancelInlineEdit() {
    setEditingField(null)
    setInlineCategoryDraft(null)
  }

  async function saveInlineField(field: ProductModalInlineField, value: string | number | boolean | null) {
    if (!canEditCatalogue) {
      cancelInlineEdit()
      return
    }
    setInlineSaving(true)
    setEditingField(null)

    let payload: Record<string, unknown>
    switch (field) {
      case 'name':
        payload = { name: String(value).trim() || liveProduct.name }
        break
      case 'sku':
        payload = { sku: value === '' || value == null ? null : String(value).trim() }
        break
      case 'description':
        payload = { description: value === '' || value == null ? null : String(value).trim() }
        break
      case 'unit_price': {
        const n = typeof value === 'number' ? value : parseFloat(String(value))
        payload = { unit_price: Number.isFinite(n) && n >= 0 ? n : liveProduct.unit_price }
        break
      }
      case 'cost_price': {
        if (value === '' || value == null) payload = { cost_price: null }
        else {
          const n = typeof value === 'number' ? value : parseFloat(String(value))
          payload = { cost_price: Number.isFinite(n) && n >= 0 ? n : liveProduct.cost_price }
        }
        break
      }
      case 'stock_quantity': {
        const n = typeof value === 'number' ? value : parseInt(String(value), 10)
        payload = { stock_quantity: Number.isFinite(n) && n >= 0 ? Math.floor(n) : liveProduct.stock_quantity ?? 0 }
        break
      }
      case 'sort_order': {
        const n = typeof value === 'number' ? value : parseInt(String(value), 10)
        payload = { sort_order: Number.isFinite(n) ? n : liveProduct.sort_order ?? 0 }
        break
      }
      case 'active':
        payload = { active: Boolean(value) }
        break
      case 'is_stock':
        payload = { is_stock: Boolean(value) }
        break
      case 'image_url':
        payload = { image_url: value === '' || value == null ? null : String(value).trim() }
        break
      case 'image_alt':
        payload = { image_alt: value === '' || value == null ? null : String(value).trim() }
        break
      default:
        setInlineSaving(false)
        return
    }

    const { error } = await supabase.from('products').update(payload).eq('id', liveProduct.id)
    if (!error) {
      setLiveProduct((prev) => ({ ...prev, ...payload }) as ProductRow)
      setForm((f) => ({
        ...f,
        ...(payload.name != null ? { name: String(payload.name) } : {}),
        ...(payload.sku !== undefined ? { sku: (payload.sku as string | null) ?? '' } : {}),
        ...(payload.description !== undefined ? { description: (payload.description as string | null) ?? '' } : {}),
        ...(payload.unit_price != null ? { unit_price: String(payload.unit_price) } : {}),
        ...(payload.cost_price !== undefined ? { cost_price: payload.cost_price == null ? '' : String(payload.cost_price) } : {}),
        ...(payload.stock_quantity != null ? { stock_quantity: String(payload.stock_quantity) } : {}),
        ...(payload.sort_order != null ? { sort_order: String(payload.sort_order) } : {}),
        ...(payload.active != null ? { active: Boolean(payload.active) } : {}),
        ...(payload.is_stock != null ? { is_stock: Boolean(payload.is_stock) } : {}),
        ...(payload.image_url !== undefined ? { image_url: (payload.image_url as string | null) ?? '' } : {}),
        ...(payload.image_alt !== undefined ? { image_alt: (payload.image_alt as string | null) ?? '' } : {}),
      }))
      onSaved()
    }
    setInlineSaving(false)
  }

  async function saveInlineCategories(ids: string[], primary: string) {
    if (!canEditCatalogue) {
      cancelInlineEdit()
      return
    }
    const normalized = normalizeCategorySelection(ids, primary)
    if (normalized.ids.length === 0 || !normalized.primary) {
      setSaveError('Select at least one category.')
      return
    }
    setInlineSaving(true)
    setSaveError(null)
    const result = await saveProductCategories(liveProduct.id, normalized.ids, normalized.primary)
    if (result.error) {
      setSaveError(`Categories: ${result.error}`)
      setInlineSaving(false)
      return
    }
    setCategoryIds(result.categoryIds)
    setPrimaryCategoryId(result.primaryCategoryId)
    setLiveProduct((prev) => ({ ...prev, category_id: result.primaryCategoryId }))
    setInlineCategoryDraft(null)
    onProductSaved?.(liveProduct.id, result.categoryIds, result.primaryCategoryId)
    setEditingField(null)
    setInlineSaving(false)
  }

  function editableMetaProps(field: ProductModalInlineField) {
    return {
      className: canEditCatalogue ? 'admin-product-modal-meta-editable' : undefined,
      title: canEditCatalogue ? INLINE_EDIT_HINT : undefined,
      onDoubleClick: canEditCatalogue
        ? (e: MouseEvent) => {
            e.stopPropagation()
            startInlineEdit(field)
          }
        : undefined,
    }
  }

  const modalTree = (
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-product-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="admin-modal card admin-modal--product">
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2
          id="admin-product-modal-title"
          className={`admin-modal-title${canEditCatalogue && !editing ? ' admin-product-modal-title-editable' : ''}`}
          title={canEditCatalogue && !editing ? INLINE_EDIT_HINT : undefined}
          onDoubleClick={canEditCatalogue && !editing ? () => startInlineEdit('name') : undefined}
        >
          {editingField === 'name' ? (
            <input
              className="admin-inline-edit-input admin-product-modal-title-input"
              autoFocus
              defaultValue={liveProduct.name}
              onBlur={(e) => void saveInlineField('name', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveInlineField('name', (e.target as HTMLInputElement).value)
                if (e.key === 'Escape') cancelInlineEdit()
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            liveProduct.name
          )}
        </h2>
        {(liveProduct.image_url || canEditCatalogue) && (
          <div className="admin-product-modal-image">
            {liveProduct.image_url ? (
              <img src={liveProduct.image_url} alt={liveProduct.image_alt ?? liveProduct.name} />
            ) : (
              <p className="admin-muted admin-product-modal-no-image">No image — double-click Image URL below to add.</p>
            )}
          </div>
        )}
        {editing ? (
          <div className="admin-modal-form admin-product-modal-form">
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Details</h3>
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Product name"
              />
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                rows={3}
              />
              <label>SKU</label>
              <input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="SKU"
              />
              <h3 className="admin-modal-form-section-title">Categories</h3>
              <p className="admin-muted admin-category-section-hint">
                {displayCategoryNames || 'No categories assigned yet.'}
              </p>
              <button type="button" className="btn btn-sm btn-outline" onClick={openCategoriesModal}>
                Assign categories…
              </button>
            </div>
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Composition</h3>
              {showAssemblyEditor ? (
                <ProductCompositionPanel
                  product={liveProduct}
                  categories={categoriesList}
                  allProducts={allProducts}
                  canEdit={canEditCatalogue}
                  partTypes={partTypes}
                  partTypeLabels={partTypeLabels}
                  onPartTypesChange={onPartTypesChange}
                  onProductUpdated={(patch) => {
                    setLiveProduct((prev) => ({ ...prev, ...patch }))
                    onSaved()
                  }}
                />
              ) : (
                <p className="admin-muted admin-product-modal-section-loading">Loading composition…</p>
              )}
            </div>
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Pricing & stock</h3>
              <div className="admin-modal-form-row admin-modal-form-row--equal">
                <label>
                  Unit price (£)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                  />
                </label>
                <label>
                  Cost price (£)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  />
                </label>
              </div>
              <label>Stock quantity</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              />
              <label>Sort order</label>
              <input
                type="number"
                step="1"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
              <p className="admin-muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                Lower numbers appear earlier in catalogue lists. Import tools may set this automatically.
              </p>
            </div>
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Image</h3>
              <label>
                Image URL
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://… or path in product-images bucket"
                />
              </label>
              <label>
                Image alt text
                <input
                  type="text"
                  value={form.image_alt}
                  onChange={(e) => setForm((f) => ({ ...f, image_alt: e.target.value }))}
                  placeholder="Optional description for accessibility"
                />
              </label>
            </div>
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Status</h3>
              <label className="admin-product-modal-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active (visible in catalogue and ordering)
              </label>
              <label className="admin-product-modal-check">
                <input
                  type="checkbox"
                  checked={form.is_stock}
                  onChange={(e) => setForm((f) => ({ ...f, is_stock: e.target.checked }))}
                />
                Stocked item (shown in Stock guided flow; uncheck for Made to measure only)
              </label>
            </div>
            {saveError && (
              <p className="admin-error admin-product-modal-save-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="admin-modal-actions">
              <button type="button" className="btn" onClick={handleSave} disabled={saving || !form.name.trim() || categoryIds.length === 0}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="admin-product-modal-detail">
            {canEditCatalogue && (
              <p className="admin-product-modal-inline-hint admin-muted">
                Double-click any value to edit inline, or use <strong>Edit</strong> for all fields at once.
              </p>
            )}
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Product record</h3>
              <dl className="admin-product-modal-meta">
                <dt>Catalogue programme</dt>
                <dd>{catalogProgramLabel(liveProduct.catalog_program)}</dd>
                <dt>Sort order</dt>
                <dd {...editableMetaProps('sort_order')}>
                  {editingField === 'sort_order' ? (
                    <input
                      type="number"
                      step="1"
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.sort_order ?? 0}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10)
                        if (Number.isFinite(n)) void saveInlineField('sort_order', n)
                        else cancelInlineEdit()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const n = parseInt((e.target as HTMLInputElement).value, 10)
                          if (Number.isFinite(n)) void saveInlineField('sort_order', n)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.sort_order ?? 0
                  )}
                </dd>
                <dt>Created</dt>
                <dd>{new Date(liveProduct.created_at).toLocaleString()}</dd>
              </dl>
            </div>
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Commercial</h3>
              <dl className="admin-product-modal-meta">
                <dt>SKU</dt>
                <dd {...editableMetaProps('sku')}>
                  {editingField === 'sku' ? (
                    <input
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.sku ?? ''}
                      onBlur={(e) => void saveInlineField('sku', e.target.value.trim() || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void saveInlineField('sku', (e.target as HTMLInputElement).value.trim() || null)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.sku ?? '—'
                  )}
                </dd>
                <dt className="admin-product-meta-categories-dt">Categories</dt>
                <dd
                  className={`admin-product-meta-categories${editingField === 'category_id' ? ' admin-product-meta-categories--editing' : ''}${canEditCatalogue ? ' admin-product-modal-meta-editable' : ''}`}
                  title={canEditCatalogue ? INLINE_EDIT_HINT : undefined}
                  onDoubleClick={canEditCatalogue ? (e) => { e.stopPropagation(); startInlineEdit('category_id') } : undefined}
                >
                  {editingField === 'category_id' && inlineCategoryDraft ? (
                    <div className="admin-product-modal-inline-categories">
                      <ProductCategoryMultiSelect
                        layout="panel"
                        categories={categoriesList}
                        selectedIds={inlineCategoryDraft.ids}
                        primaryId={inlineCategoryDraft.primary}
                        onChange={(ids, primary) => setInlineCategoryDraft({ ids, primary })}
                      />
                      <div className="product-category-inline-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={inlineCategoryDraft.ids.length === 0 || inlineSaving}
                          onClick={() =>
                            void saveInlineCategories(inlineCategoryDraft.ids, inlineCategoryDraft.primary)
                          }
                        >
                          {inlineSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={cancelInlineEdit}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={openCategoriesModal}
                        >
                          Assign categories…
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="admin-product-meta-categories-value">{displayCategoryNames}</p>
                      {canEditCatalogue && (
                        <div className="admin-product-meta-categories-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={openCategoriesModal}
                          >
                            Assign categories…
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </dd>
                <dt>Unit price</dt>
                <dd {...editableMetaProps('unit_price')}>
                  {editingField === 'unit_price' ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.unit_price}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isNaN(v) && v >= 0) void saveInlineField('unit_price', v)
                        else cancelInlineEdit()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseFloat((e.target as HTMLInputElement).value)
                          if (!Number.isNaN(v) && v >= 0) void saveInlineField('unit_price', v)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    `£${Number(liveProduct.unit_price).toFixed(2)}`
                  )}
                </dd>
                <dt>Cost price</dt>
                <dd {...editableMetaProps('cost_price')}>
                  {editingField === 'cost_price' ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.cost_price ?? ''}
                      onBlur={(e) => {
                        const raw = e.target.value.trim()
                        if (raw === '') void saveInlineField('cost_price', null)
                        else {
                          const v = parseFloat(raw)
                          if (!Number.isNaN(v) && v >= 0) void saveInlineField('cost_price', v)
                          else cancelInlineEdit()
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const raw = (e.target as HTMLInputElement).value.trim()
                          if (raw === '') void saveInlineField('cost_price', null)
                          else {
                            const v = parseFloat(raw)
                            if (!Number.isNaN(v) && v >= 0) void saveInlineField('cost_price', v)
                          }
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.cost_price != null ? `£${Number(liveProduct.cost_price).toFixed(2)}` : '—'
                  )}
                </dd>
                <dt>Stock quantity</dt>
                <dd {...editableMetaProps('stock_quantity')}>
                  {editingField === 'stock_quantity' ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.stock_quantity ?? 0}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10)
                        void saveInlineField('stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseInt((e.target as HTMLInputElement).value, 10)
                          void saveInlineField('stock_quantity', Number.isFinite(v) && v >= 0 ? v : 0)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.stock_quantity ?? 0
                  )}
                </dd>
                <dt>Availability</dt>
                <dd>
                  <span title={availability.detail ?? availability.label}>{availability.label}</span>
                </dd>
                <dt>Active</dt>
                <dd {...editableMetaProps('active')}>
                  {editingField === 'active' ? (
                    <select
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.active ? '1' : '0'}
                      onBlur={(e) => void saveInlineField('active', e.target.value === '1')}
                      onChange={(e) => void saveInlineField('active', e.target.value === '1')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  ) : (
                    liveProduct.active ? 'Yes' : 'No'
                  )}
                </dd>
                <dt>Stocked item</dt>
                <dd {...editableMetaProps('is_stock')}>
                  {editingField === 'is_stock' ? (
                    <select
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.is_stock !== false ? '1' : '0'}
                      onBlur={(e) => void saveInlineField('is_stock', e.target.value === '1')}
                      onChange={(e) => void saveInlineField('is_stock', e.target.value === '1')}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="1">Yes</option>
                      <option value="0">No (made to measure only)</option>
                    </select>
                  ) : (
                    liveProduct.is_stock !== false ? 'Yes' : 'No (made to measure only)'
                  )}
                </dd>
              </dl>
            </div>
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Image</h3>
              <dl className="admin-product-modal-meta">
                <dt>Image URL</dt>
                <dd {...editableMetaProps('image_url')}>
                  {editingField === 'image_url' ? (
                    <input
                      type="url"
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.image_url ?? ''}
                      onBlur={(e) => void saveInlineField('image_url', e.target.value.trim() || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void saveInlineField('image_url', (e.target as HTMLInputElement).value.trim() || null)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.image_url ?? '—'
                  )}
                </dd>
                <dt>Image alt</dt>
                <dd {...editableMetaProps('image_alt')}>
                  {editingField === 'image_alt' ? (
                    <input
                      className="admin-inline-edit-input"
                      autoFocus
                      defaultValue={liveProduct.image_alt ?? ''}
                      onBlur={(e) => void saveInlineField('image_alt', e.target.value.trim() || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void saveInlineField('image_alt', (e.target as HTMLInputElement).value.trim() || null)
                        }
                        if (e.key === 'Escape') cancelInlineEdit()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    liveProduct.image_alt ?? '—'
                  )}
                </dd>
              </dl>
            </div>
            <div className="admin-modal-form-section admin-modal-card">
              <h3 className="admin-modal-form-section-title">Composition</h3>
              {showAssemblyEditor ? (
                <ProductCompositionPanel
                  product={liveProduct}
                  categories={categoriesList}
                  allProducts={allProducts}
                  canEdit={canEditCatalogue}
                  partTypes={partTypes}
                  partTypeLabels={partTypeLabels}
                  onPartTypesChange={onPartTypesChange}
                  onProductUpdated={(patch) => {
                    setLiveProduct((prev) => ({ ...prev, ...patch }))
                    onSaved()
                  }}
                />
              ) : (
                <p className="admin-muted admin-product-modal-section-loading">Loading composition…</p>
              )}
            </div>
            {(liveProduct.description || canEditCatalogue) && (
              <div className="admin-modal-form-section admin-modal-card">
                <h3 className="admin-modal-form-section-title">Description</h3>
                {editingField === 'description' ? (
                  <textarea
                    className="admin-inline-edit-input admin-product-modal-description-input"
                    autoFocus
                    rows={4}
                    defaultValue={liveProduct.description ?? ''}
                    onBlur={(e) => void saveInlineField('description', e.target.value.trim() || null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancelInlineEdit()
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={`admin-product-modal-description${canEditCatalogue ? ' admin-product-modal-meta-editable' : ''}`}
                    title={canEditCatalogue ? INLINE_EDIT_HINT : undefined}
                    onDoubleClick={canEditCatalogue ? () => startInlineEdit('description') : undefined}
                  >
                    {liveProduct.description?.trim() ? liveProduct.description : '—'}
                  </p>
                )}
              </div>
            )}
            {saveError && (
              <p className="admin-error admin-product-modal-save-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="admin-modal-actions">
              {canEditCatalogue && (
                <button type="button" className="btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return (
    <>
      {createPortal(modalTree, document.body)}
      {preloadCategoriesModal &&
        createPortal(
          <ProductCategoriesAssignModal
            open={categoriesModalOpen}
            productId={liveProduct.id}
            productName={liveProduct.name}
            categories={categoriesList}
            selectedIds={categoryIds}
            primaryCategoryId={primaryCategoryId}
            onClose={() => setCategoriesModalOpen(false)}
            onCategoriesUpdated={handleCategoriesUpdated}
            onSaved={handleCategoriesAssignSaved}
          />,
          document.body
        )}
    </>
  )
}
