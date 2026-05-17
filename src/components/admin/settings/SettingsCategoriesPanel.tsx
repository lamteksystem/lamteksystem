import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createCategory, fetchAllCategories, slugifyCategoryName } from '@/lib/categoryAdmin'
import type { CategoryRow } from '@/types/database'

export default function SettingsCategoriesPanel() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
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
    setNewName('')
    setNewSlug('')
    setMessage({ type: 'ok', text: `Created “${category.name}”.` })
    await refresh()
  }

  return (
    <div className="admin-settings-panel">
      <p className="admin-settings-panel-intro">
        Categories group products in the catalogue and ordering flows. Assign them on each product in{' '}
        <Link to="/admin/catalogue">Catalogue</Link> or when editing a product.
      </p>
      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}

      <form className="admin-part-types-add-form" onSubmit={(e) => void handleCreate(e)}>
        <h3 className="admin-modal-form-section-title">Add category</h3>
        <div className="admin-part-types-add-fields">
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
        <ul className="admin-categories-list admin-categories-list--settings">
          {filtered.map((c) => (
            <li key={c.id} className="admin-categories-list-item">
              <span className="admin-categories-list-name">{c.name}</span>
              <code className="admin-categories-list-slug">{c.slug}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
