import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCategory, slugifyCategoryName } from '@/lib/categoryAdmin'
import {
  normalizeCategorySelection,
  saveProductCategories,
} from '@/lib/productCategories'
import { ProductCategoryMultiSelect } from '@/components/admin/ProductCategoryMultiSelect'
import type { CategoryRow } from '@/types/database'

interface ProductCategoriesAssignModalProps {
  open: boolean
  productId: string
  productName: string
  categories: CategoryRow[]
  selectedIds: string[]
  primaryCategoryId: string
  onClose: () => void
  onCategoriesUpdated: (categories: CategoryRow[]) => void
  onSaved: (categoryIds: string[], primaryCategoryId: string) => void
}

export default function ProductCategoriesAssignModal({
  open,
  productId,
  productName,
  categories: initialCategories,
  selectedIds: initialSelectedIds,
  primaryCategoryId: initialPrimaryId,
  onClose,
  onCategoriesUpdated,
  onSaved,
}: ProductCategoriesAssignModalProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [draftIds, setDraftIds] = useState(initialSelectedIds)
  const [draftPrimary, setDraftPrimary] = useState(initialPrimaryId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  useEffect(() => {
    if (!open) return
    setDraftIds(initialSelectedIds)
    setDraftPrimary(initialPrimaryId)
    setError(null)
    setCreateMessage(null)
    setShowCreateForm(false)
    setNewName('')
    setNewSlug('')
  }, [open, initialSelectedIds, initialPrimaryId])

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

  const slugPreview = newSlug.trim() || (newName.trim() ? slugifyCategoryName(newName) : '')

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateMessage(null)
    const { category, error: createErr } = await createCategory({
      name: newName,
      slug: newSlug.trim() || undefined,
    })
    setCreating(false)
    if (createErr || !category) {
      setCreateMessage({ type: 'err', text: createErr ?? 'Could not create category.' })
      return
    }
    const next = [...categories, category].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    )
    setCategories(next)
    onCategoriesUpdated(next)
    const normalized = normalizeCategorySelection(
      draftIds.includes(category.id) ? draftIds : [...draftIds, category.id],
      draftPrimary || category.id
    )
    setDraftIds(normalized.ids)
    setDraftPrimary(normalized.primary)
    setCreateMessage({ type: 'ok', text: `Created “${category.name}” and added to this product.` })
    setNewName('')
    setNewSlug('')
    setShowCreateForm(false)
  }

  async function handleSave() {
    const normalized = normalizeCategorySelection(draftIds, draftPrimary)
    if (normalized.ids.length === 0 || !normalized.primary) {
      setError('Select at least one category and choose a primary.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await saveProductCategories(productId, normalized.ids, normalized.primary)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSaved(result.categoryIds, result.primaryCategoryId)
    onClose()
  }

  const modalTree = (
    <div
      className={`admin-modal-backdrop admin-modal-backdrop--portal admin-modal-backdrop--stacked${open ? '' : ' admin-modal-backdrop--preloaded'}`}
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-labelledby="product-categories-assign-title"
      {...(!open ? { inert: '' as const } : {})}
      onClick={(e) => open && e.target === e.currentTarget && onClose()}
    >
      <div
        className="admin-modal admin-modal--categories admin-modal--product-categories-assign"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-categories-modal-inner">
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <h2 id="product-categories-assign-title" className="admin-modal-title">
            Assign categories
          </h2>
          <p className="admin-categories-modal-context">
            Product: <strong>{productName}</strong>
          </p>
          <p className="admin-muted product-categories-assign-intro">
            Tick categories for this product. The primary category drives pricing rules and spreadsheet export.
          </p>

          <div className="admin-categories-modal-body product-categories-assign-body">
            <ProductCategoryMultiSelect
              layout="panel"
              categories={categories}
              selectedIds={draftIds}
              primaryId={draftPrimary}
              onChange={(ids, primary) => {
                const normalized = normalizeCategorySelection(ids, primary)
                setDraftIds(normalized.ids)
                setDraftPrimary(normalized.primary)
              }}
            />

            <section className="product-categories-assign-create" aria-label="Create new category">
              <button
                type="button"
                className="product-categories-assign-create-toggle"
                onClick={() => setShowCreateForm((v) => !v)}
                aria-expanded={showCreateForm}
              >
                {showCreateForm ? 'Hide new category form' : 'Category not listed? Create one…'}
              </button>
              {showCreateForm && (
                <form
                  className="admin-modal-form admin-categories-add-form product-categories-assign-create-form"
                  onSubmit={(e) => void handleCreateCategory(e)}
                >
                  <label>
                    Name
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Lamtek — Wall units"
                      required
                      autoComplete="off"
                      autoFocus
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
                    </p>
                  )}
                  <button type="submit" className="btn btn-sm" disabled={creating || !newName.trim()}>
                    {creating ? 'Creating…' : 'Create & assign to product'}
                  </button>
                </form>
              )}
              {createMessage && (
                <p
                  className={createMessage.type === 'ok' ? 'admin-message-ok' : 'admin-error'}
                  role="status"
                >
                  {createMessage.text}
                </p>
              )}
            </section>
          </div>

          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-modal-actions product-categories-assign-actions">
            <button
              type="button"
              className="btn"
              disabled={saving || draftIds.length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save categories'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
