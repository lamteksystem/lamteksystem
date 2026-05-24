import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCategory,
  fetchAllCategories,
  normalizeCategorySlug,
  slugifyCategoryName,
  updateCategory,
} from '@/lib/categoryAdmin'
import { categoryKindLabel, inferCategoryKindFromName } from '@/lib/categoryTaxonomy'
import type { CategoryKind, CategoryRow } from '@/types/database'

export default function SettingsCategoriesPanel() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [newKind, setNewKind] = useState<CategoryKind>('product_type')
  const [creating, setCreating] = useState(false)
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const cats = await fetchAllCategories()
      setCategories(cats)
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Could not load categories.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
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
      parent_id: newParentId || null,
      category_kind: newKind,
    })
    if (error || !category) {
      setCreating(false)
      setMessage({ type: 'err', text: error ?? 'Could not create category.' })
      return
    }
    setCreating(false)
    setNewName('')
    setNewSlug('')
    setNewParentId('')
    setNewKind('product_type')
    setMessage({ type: 'ok', text: `Created “${category.name}”.` })
    await refresh()
  }

  async function patchCategory(id: string, patch: Parameters<typeof updateCategory>[1]) {
    const { error } = await updateCategory(id, patch)
    if (error) {
      setMessage({ type: 'err', text: error })
      return
    }
    await refresh()
  }

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Categories group products in the catalogue and ordering flows. Use <strong>sub-categories</strong>{' '}
        under a parent (e.g. Handles → Knobs). Set <strong>type</strong> so Create order can switch between
        product categories and kitchen ranges. Assign products in{' '}
        <Link to="/admin/catalogue">Catalogue</Link> or use Smart categorise there.
      </p>
      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}

      <form className="admin-part-types-add-form" onSubmit={(e) => void handleCreate(e)}>
        <h3 className="admin-modal-form-section-title">Add category</h3>
        <div className="admin-part-types-add-fields admin-category-add-grid">
          <label>
            Name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required disabled={creating} />
          </label>
          <label>
            Slug <span className="admin-muted">(optional)</span>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder={slugPreview || 'auto from name'}
              disabled={creating}
            />
          </label>
          <label>
            Parent <span className="admin-muted">(sub-category)</span>
            <select value={newParentId} onChange={(e) => setNewParentId(e.target.value)} disabled={creating}>
              <option value="">Top level (parent category)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as CategoryKind)}
              disabled={creating}
            >
              <option value="product_type">Product category</option>
              <option value="door_range">Kitchen range</option>
              <option value="universal">Cross-range (wirework, accessories…)</option>
            </select>
          </label>
        </div>
        {slugPreview && (
          <p className="admin-muted admin-settings-hint">
            Will save as <code>{slugPreview}</code>
          </p>
        )}
        <button type="submit" className="btn btn-outline" disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : 'Add category'}
        </button>
      </form>

      <div className="admin-categories-list-toolbar" style={{ marginTop: '1.25rem' }}>
        <h3 className="admin-modal-form-section-title">All categories ({categories.length})</h3>
        <input
          type="search"
          className="admin-categories-search"
          placeholder="Search name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="admin-muted">Loading categories…</p>
      ) : filtered.length === 0 ? (
        <p className="admin-muted">No categories match your search.</p>
      ) : (
        <ul className="admin-categories-list admin-categories-list--settings admin-categories-list--editable">
          {filtered.map((c) => {
            const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
            const kind = c.category_kind ?? inferCategoryKindFromName(c.name)
            return (
              <li key={c.id} className="admin-categories-list-item admin-categories-list-item--edit">
                <label className="admin-category-edit-name">
                  <span className="visually-hidden">Name</span>
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== c.name) void patchCategory(c.id, { name: v })
                    }}
                  />
                </label>
                {editingSlugId === c.id ? (
                  <input
                    type="text"
                    className="admin-catalogue-categories-slug-input"
                    defaultValue={c.slug}
                    autoFocus
                    onBlur={(e) => {
                      setEditingSlugId(null)
                      const next = normalizeCategorySlug(e.target.value)
                      if (next && next !== c.slug) void patchCategory(c.id, { slug: next })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditingSlugId(null)
                    }}
                  />
                ) : (
                  <code
                    className="admin-categories-list-slug admin-catalogue-categories-slug--editable"
                    onDoubleClick={() => setEditingSlugId(c.id)}
                    title="Double-click to edit slug"
                  >
                    {c.slug}
                  </code>
                )}
                <label>
                  Parent
                  <select
                    defaultValue={c.parent_id ?? ''}
                    onChange={(e) =>
                      void patchCategory(c.id, { parent_id: e.target.value || null })
                    }
                  >
                    <option value="">Top level (parent category)</option>
                    {parents
                      .filter((p) => p.id !== c.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Type
                  <select
                    defaultValue={kind}
                    onChange={(e) =>
                      void patchCategory(c.id, { category_kind: e.target.value as CategoryKind })
                    }
                  >
                    <option value="product_type">Product category</option>
                    <option value="door_range">Kitchen range</option>
                    <option value="universal">Cross-range</option>
                  </select>
                </label>
                <span className="admin-muted admin-category-edit-meta">
                  {parent ? `Sub of ${parent.name}` : 'Top level'} · {categoryKindLabel(kind)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

