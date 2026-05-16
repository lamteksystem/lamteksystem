import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import { fetchProductCategoryMap, formatCategoryNames, getProductCategoryIds, saveProductCategories } from '@/lib/productCategories'
import AdminCategoriesModal from '@/components/admin/AdminCategoriesModal'
import { ProductCategoryMultiSelect } from '@/components/admin/ProductCategoryMultiSelect'
import ProductAssemblyEditor from '@/components/admin/ProductAssemblyEditor'
import { usePermission } from '@/hooks/usePermission'
import type { CategoryRow, ProductRow } from '@/types/database'

function catalogProgramLabel(program: string | undefined): string {
  if (program === 'tealbury') return 'Tealbury (curated kitchens)'
  return 'Lamtek (component catalogue)'
}

interface AdminProductModalProps {
  product: ProductRow
  categories: CategoryRow[]
  allProducts: ProductRow[]
  onClose: () => void
  onSaved: () => void
  onCategoriesChange?: (categories: CategoryRow[]) => void
}

export default function AdminProductModal({
  product,
  categories,
  allProducts,
  onClose,
  onSaved,
  onCategoriesChange,
}: AdminProductModalProps) {
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoriesList, setCategoriesList] = useState(categories)
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false)
  const [categoryIds, setCategoryIds] = useState<string[]>([product.category_id])
  const [primaryCategoryId, setPrimaryCategoryId] = useState(product.category_id)
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map = await fetchProductCategoryMap()
      if (cancelled) return
      const ids = getProductCategoryIds(product.id, product.category_id, map)
      setCategoryIds(ids.length > 0 ? ids : [product.category_id])
      setPrimaryCategoryId(ids[0] ?? product.category_id)
    })()
    return () => {
      cancelled = true
    }
  }, [product.id, product.category_id])

  useEffect(() => {
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

  function handleCategoriesUpdated(next: CategoryRow[]) {
    setCategoriesList(next)
    onCategoriesChange?.(next)
  }

  function handleCategoryCreated(cat: CategoryRow, assignToProduct: boolean) {
    if (!assignToProduct) return
    setCategoryIds((prev) => (prev.includes(cat.id) ? prev : [...prev, cat.id]))
    setPrimaryCategoryId((prev) => prev || cat.id)
  }

  async function handleSave() {
    setSaving(true)
    const price = parseFloat(form.unit_price)
    const costPrice = form.cost_price === '' ? null : parseFloat(form.cost_price)
    const stockQty = parseInt(form.stock_quantity, 10)
    const sortOrder = parseInt(form.sort_order, 10)

    const { error: catErr } = await saveProductCategories(product.id, categoryIds, primaryCategoryId)
    if (catErr) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        category_id: primaryCategoryId,
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
    if (!error) {
      setEditing(false)
      onSaved()
      onClose()
    }
  }

  const categoryMap = new Map(categoriesList.map((c) => [c.id, c]))
  const displayCategoryNames = formatCategoryNames(categoryIds, categoryMap)
  const availability = getProductAvailabilityMeta(product)

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
        <h2 id="admin-product-modal-title" className="admin-modal-title">
          {product.name}
        </h2>
        {product.image_url && (
          <div className="admin-product-modal-image">
            <img src={product.image_url} alt={product.image_alt ?? product.name} />
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
              <div className="admin-category-section-header">
                <button
                  type="button"
                  className="admin-category-section-title-btn"
                  onClick={() => setCategoriesModalOpen(true)}
                  title="View all categories and add new ones"
                >
                  <span className="admin-modal-form-section-title admin-category-section-title">Categories</span>
                  <span className="admin-category-section-manage">Manage…</span>
                </button>
              </div>
              <p className="admin-muted admin-category-section-hint">
                Assign one or more categories. Primary is used for pricing rules scoped to category and spreadsheet export.
                Click <strong>Categories</strong> to add a new category on the fly.
              </p>
              <ProductCategoryMultiSelect
                categories={categoriesList}
                selectedIds={categoryIds}
                primaryId={primaryCategoryId}
                onChange={(ids, primary) => {
                  setCategoryIds(ids)
                  setPrimaryCategoryId(primary)
                }}
              />
            </div>
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Complete unit make-up</h3>
              <ProductAssemblyEditor
                product={product}
                categories={categoriesList}
                allProducts={allProducts}
                canEdit={canEditCatalogue}
              />
            </div>
            <div className="admin-modal-form-section">
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
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Product record</h3>
              <dl className="admin-product-modal-meta">
                <dt>Database ID</dt>
                <dd><code>{product.id}</code></dd>
                <dt>Catalogue programme</dt>
                <dd>{catalogProgramLabel(product.catalog_program)}</dd>
                <dt>Sort order</dt>
                <dd>{product.sort_order ?? 0}</dd>
                <dt>Created</dt>
                <dd>{new Date(product.created_at).toLocaleString()}</dd>
              </dl>
            </div>
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Commercial</h3>
              <dl className="admin-product-modal-meta">
                <dt>SKU</dt>
                <dd>{product.sku ?? '—'}</dd>
                <dt className="admin-product-meta-categories-dt">Categories</dt>
                <dd className="admin-product-meta-categories">
                  <p className="admin-product-meta-categories-value">{displayCategoryNames}</p>
                  <div className="admin-product-meta-categories-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setEditing(true)
                        setCategoriesModalOpen(true)
                      }}
                    >
                      Manage categories
                    </button>
                  </div>
                </dd>
                <dt>Unit price</dt>
                <dd>£{Number(product.unit_price).toFixed(2)}</dd>
                {product.cost_price != null && (
                  <>
                    <dt>Cost price</dt>
                    <dd>£{Number(product.cost_price).toFixed(2)}</dd>
                  </>
                )}
                <dt>Stock quantity</dt>
                <dd>{product.stock_quantity ?? 0}</dd>
                <dt>Availability</dt>
                <dd>
                  <span title={availability.detail ?? availability.label}>{availability.label}</span>
                </dd>
                <dt>Active</dt>
                <dd>{product.active ? 'Yes' : 'No'}</dd>
                <dt>Stocked item</dt>
                <dd>{product.is_stock !== false ? 'Yes' : 'No (made to measure only)'}</dd>
              </dl>
            </div>
            <div className="admin-modal-form-section">
              <h3 className="admin-modal-form-section-title">Complete unit make-up</h3>
              <ProductAssemblyEditor
                product={product}
                categories={categoriesList}
                allProducts={allProducts}
                canEdit={canEditCatalogue}
              />
            </div>
            {product.description && (
              <div className="admin-modal-form-section">
                <h3 className="admin-modal-form-section-title">Description</h3>
                <p className="admin-product-modal-description">{product.description}</p>
              </div>
            )}
            <div className="admin-modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                Edit
              </button>
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
      {categoriesModalOpen &&
        createPortal(
          <AdminCategoriesModal
            categories={categoriesList}
            productName={product.name}
            onClose={() => setCategoriesModalOpen(false)}
            onCategoriesUpdated={handleCategoriesUpdated}
            onCategoryCreated={handleCategoryCreated}
          />,
          document.body
        )}
    </>
  )
}
