import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createCategory,
  fetchAllCategories,
  fetchCategoryProductCounts,
  slugifyCategoryName,
} from '@/lib/categoryAdmin'
import type { CategoryRow } from '@/types/database'

interface AdminCategoriesModalProps {
  categories: CategoryRow[]
  productName?: string
  onClose: () => void
  onCategoriesUpdated: (categories: CategoryRow[]) => void
  /** Fired after a category is created; assignToProduct reflects the checkbox. */
  onCategoryCreated?: (category: CategoryRow, assignToProduct: boolean) => void
}

export default function AdminCategoriesModal({
  categories: initialCategories,
  productName,
  onClose,
  onCategoriesUpdated,
  onCategoryCreated,
}: AdminCategoriesModalProps) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories)
  const [productCounts, setProductCounts] = useState<Map<string, number>>(new Map())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [assignToProduct, setAssignToProduct] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [cats, counts] = await Promise.all([fetchAllCategories(), fetchCategoryProductCounts()])
      setCategories(cats)
      setProductCounts(counts)
      onCategoriesUpdated(cats)
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Could not load categories.' })
    } finally {
      setLoading(false)
    }
  }, [onCategoriesUpdated])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    )
  }, [categories, search])

  const slugPreview = newSlug.trim() || (newName.trim() ? slugifyCategoryName(newName) : '')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMessage(null)
    const { category, error } = await createCategory({
      name: newName,
      slug: newSlug.trim() || undefined,
    })
    setCreating(false)
    if (error || !category) {
      setMessage({ type: 'err', text: error ?? 'Could not create category.' })
      return
    }
    const next = [...categories, category].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    )
    setCategories(next)
    setProductCounts((prev) => new Map(prev).set(category.id, 0))
    onCategoriesUpdated(next)
    onCategoryCreated?.(category, assignToProduct)
    setMessage({ type: 'ok', text: `Created “${category.name}”.` })
    setNewName('')
    setNewSlug('')
  }

  const modalTree = (
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal admin-modal-backdrop--stacked"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-categories-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="admin-modal admin-modal--categories"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-categories-modal-inner">
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <h2 id="admin-categories-modal-title" className="admin-modal-title">
            Manage categories
          </h2>
          {productName && (
            <p className="admin-categories-modal-context">
              For product: <strong>{productName}</strong>
            </p>
          )}

          <div className="admin-categories-modal-body">
            <form className="admin-modal-form admin-categories-add-form" onSubmit={handleCreate}>
              <h3 className="admin-modal-form-section-title">Add category</h3>
              <label>
                Name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Lamtek — Wall units"
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                Slug <span className="admin-muted">(optional)</span>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder={slugPreview || 'auto from name'}
                  autoComplete="off"
                />
              </label>
              {slugPreview && (
                <p className="admin-muted admin-categories-slug-preview">
                  Will save as: <code>{slugPreview}</code>
                  {categories.some((c) => c.slug === slugPreview) && (
                    <span> — a number suffix may be added if this slug already exists.</span>
                  )}
                </p>
              )}
              {onCategoryCreated && (
                <label className="admin-product-modal-check admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={assignToProduct}
                    onChange={(e) => setAssignToProduct(e.target.checked)}
                  />
                  Assign to this product after creating
                </label>
              )}
              <button type="submit" className="btn" disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Add category'}
              </button>
            </form>

            {message && (
              <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
                {message.text}
              </p>
            )}

            <section className="admin-modal-form-section admin-categories-list-section" aria-label="Existing categories">
              <div className="admin-categories-list-toolbar">
                <h3 className="admin-modal-form-section-title">All categories ({categories.length})</h3>
                <input
                  type="search"
                  className="admin-categories-search"
                  placeholder="Search name or slug…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search categories"
                />
              </div>
              {loading ? (
                <p className="admin-muted">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="admin-muted">No categories match your search.</p>
              ) : (
                <ul className="admin-categories-list">
                  {filtered.map((c) => (
                    <li key={c.id} className="admin-categories-list-item">
                      <span className="admin-categories-list-name">{c.name}</span>
                      <code className="admin-categories-list-slug">{c.slug}</code>
                      <span className="admin-categories-list-count">
                        {productCounts.get(c.id) ?? 0} product{(productCounts.get(c.id) ?? 0) === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
