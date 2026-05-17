import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCategory, fetchCategoryProductCounts, slugifyCategoryName } from '@/lib/categoryAdmin'
import type { CategoryRow } from '@/types/database'

interface AdminCategoriesModalProps {
  open: boolean
  categories: CategoryRow[]
  productName?: string
  /** Skip slow per-category product counts (use when opened from product modal). */
  skipProductCounts?: boolean
  onClose: () => void
  onCategoriesUpdated: (categories: CategoryRow[]) => void
  /** Fired after a category is created; assignToProduct reflects the checkbox. */
  onCategoryCreated?: (category: CategoryRow, assignToProduct: boolean) => void
}

export default function AdminCategoriesModal({
  open,
  categories: initialCategories,
  productName,
  skipProductCounts = false,
  onClose,
  onCategoriesUpdated,
  onCategoryCreated,
}: AdminCategoriesModalProps) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories)
  const [productCounts, setProductCounts] = useState<Map<string, number>>(new Map())
  const [search, setSearch] = useState('')
  const [countsLoading, setCountsLoading] = useState(false)
  const onCategoriesUpdatedRef = useRef(onCategoriesUpdated)
  onCategoriesUpdatedRef.current = onCategoriesUpdated
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [assignToProduct, setAssignToProduct] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    if (!open || skipProductCounts) return
    let cancelled = false
    setCountsLoading(true)
    const timer = window.setTimeout(() => {
      fetchCategoryProductCounts()
        .then((counts) => {
          if (!cancelled) setProductCounts(counts)
        })
        .catch(() => {
          /* product counts are optional in this modal */
        })
        .finally(() => {
          if (!cancelled) setCountsLoading(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, skipProductCounts])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [onClose, open])

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
    onCategoriesUpdatedRef.current(next)
    onCategoryCreated?.(category, assignToProduct)
    setMessage({ type: 'ok', text: `Created “${category.name}”.` })
    setNewName('')
    setNewSlug('')
  }

  const modalTree = (
    <div
      className={`admin-modal-backdrop admin-modal-backdrop--portal admin-modal-backdrop--stacked${open ? '' : ' admin-modal-backdrop--preloaded'}`}
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-labelledby="admin-categories-modal-title"
      {...(!open ? { inert: '' as const } : {})}
      onClick={(e) => open && e.target === e.currentTarget && onClose()}
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
              {filtered.length === 0 ? (
                <p className="admin-muted">No categories match your search.</p>
              ) : (
                <ul className="admin-categories-list">
                  {filtered.map((c) => (
                    <li key={c.id} className="admin-categories-list-item">
                      <span className="admin-categories-list-name">{c.name}</span>
                      <code className="admin-categories-list-slug">{c.slug}</code>
                      <span className="admin-categories-list-count">
                        {countsLoading ? (
                          <span className="admin-muted">…</span>
                        ) : (
                          <>
                            {productCounts.get(c.id) ?? 0} product{(productCounts.get(c.id) ?? 0) === 1 ? '' : 's'}
                          </>
                        )}
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
