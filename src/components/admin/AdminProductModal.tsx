import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import type { ProductRow } from '@/types/database'
import type { CategoryRow } from '@/types/database'

interface AdminProductModalProps {
  product: ProductRow
  categories: CategoryRow[]
  onClose: () => void
  onSaved: () => void
}

export default function AdminProductModal({ product, categories, onClose, onSaved }: AdminProductModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    sku: product.sku ?? '',
    category_id: product.category_id,
    unit_price: String(product.unit_price),
    cost_price: product.cost_price != null ? String(product.cost_price) : '',
    stock_quantity: String(product.stock_quantity ?? 0),
    active: product.active,
    image_url: product.image_url ?? '',
    image_alt: product.image_alt ?? '',
    is_stock: product.is_stock !== false,
  })

  useEffect(() => {
    setForm({
      name: product.name,
      description: product.description ?? '',
      sku: product.sku ?? '',
      category_id: product.category_id,
      unit_price: String(product.unit_price),
      cost_price: product.cost_price != null ? String(product.cost_price) : '',
      stock_quantity: String(product.stock_quantity ?? 0),
      active: product.active,
      image_url: product.image_url ?? '',
      image_alt: product.image_alt ?? '',
      is_stock: product.is_stock !== false,
    })
  }, [product])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    const price = parseFloat(form.unit_price)
    const costPrice = form.cost_price === '' ? null : parseFloat(form.cost_price)
    const stockQty = parseInt(form.stock_quantity, 10)
    const { error } = await supabase
      .from('products')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        category_id: form.category_id,
        unit_price: Number.isFinite(price) ? price : product.unit_price,
        cost_price: Number.isFinite(costPrice) ? costPrice : null,
        stock_quantity: Number.isFinite(stockQty) && stockQty >= 0 ? stockQty : product.stock_quantity ?? 0,
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

  const category = categories.find((c) => c.id === product.category_id)
  const availability = getProductAvailabilityMeta(product)

  return (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-product-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="admin-modal card">
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
              <div className="admin-modal-form-row admin-modal-form-row--equal">
                <label>
                  SKU
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="SKU"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
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
                    placeholder="Optional"
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
              <button type="button" className="btn" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="admin-product-modal-detail">
            <p><strong>SKU</strong> {product.sku ?? '—'}</p>
            <p><strong>Category</strong> {category?.name ?? '—'}</p>
            <p><strong>Unit price</strong> £{Number(product.unit_price).toFixed(2)}</p>
            {product.cost_price != null && <p><strong>Cost price</strong> £{Number(product.cost_price).toFixed(2)}</p>}
            <p><strong>Stock</strong> {product.stock_quantity ?? 0}</p>
            <p><strong>Availability</strong> <span title={availability.detail ?? availability.label}>{availability.label}</span></p>
            <p><strong>Active</strong> {product.active ? 'Yes' : 'No'}</p>
            <p><strong>Stocked item</strong> {product.is_stock !== false ? 'Yes' : 'No (MTO only)'}</p>
            {product.description && <p><strong>Description</strong> {product.description}</p>}
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
}
