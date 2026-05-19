/**
 * Inline categories editor shown on the Catalogue admin page. Wrapped in a <details> element so
 * it's collapsed by default and tucks away under the rest of the catalogue UI. Supports
 * create / rename / change parent / change kind / delete with inline validation.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createCategory,
  deleteCategory,
  slugifyCategoryName,
  updateCategory,
} from '@/lib/categoryAdmin'
import { categoryKindLabel, inferCategoryKindFromName } from '@/lib/categoryTaxonomy'
import { getProductCategoryIds, type ProductCategoryMap } from '@/lib/productCategories'
import type { CategoryKind, CategoryRow, ProductRow } from '@/types/database'

interface CatalogueCategoriesManagerProps {
  categories: CategoryRow[]
  products: ProductRow[]
  productCategoryMap: ProductCategoryMap
  onChanged: () => void | Promise<void>
}

interface Message {
  type: 'ok' | 'err'
  text: string
}

export default function CatalogueCategoriesManager({
  categories,
  products,
  productCategoryMap,
  onChanged,
}: CatalogueCategoriesManagerProps) {
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [newKind, setNewKind] = useState<CategoryKind>('product_type')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )

  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const catIds = getProductCategoryIds(p.id, p.category_id, productCategoryMap)
      for (const id of catIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [products, productCategoryMap])

  const childCountByParent = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of categories) {
      if (!c.parent_id) continue
      counts.set(c.parent_id, (counts.get(c.parent_id) ?? 0) + 1)
    }
    return counts
  }, [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [categories, search])

  const slugPreview = newSlug.trim() || (newName.trim() ? slugifyCategoryName(newName) : '')

  const totalProductsWithCategory = useMemo(
    () =>
      products.filter(
        (p) => getProductCategoryIds(p.id, p.category_id, productCategoryMap).length > 0,
      ).length,
    [products, productCategoryMap],
  )

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setMessage(null)
    const { category, error } = await createCategory({
      name: newName.trim(),
      slug: newSlug.trim() || undefined,
      parent_id: newParentId || null,
      category_kind: newKind,
    })
    setCreating(false)
    if (error || !category) {
      setMessage({ type: 'err', text: error ?? 'Could not create category.' })
      return
    }
    setMessage({ type: 'ok', text: `Created "${category.name}".` })
    setNewName('')
    setNewSlug('')
    setNewParentId('')
    setNewKind('product_type')
    await onChanged()
  }

  async function patch(id: string, body: Parameters<typeof updateCategory>[1]) {
    setBusyId(id)
    setMessage(null)
    const { error } = await updateCategory(id, body)
    setBusyId(null)
    if (error) {
      setMessage({ type: 'err', text: error })
      return
    }
    await onChanged()
  }

  async function remove(c: CategoryRow) {
    const productCount = productCountByCategory.get(c.id) ?? 0
    const childCount = childCountByParent.get(c.id) ?? 0
    if (productCount > 0 || childCount > 0) {
      setMessage({
        type: 'err',
        text: `Cannot delete "${c.name}" — ${productCount} product(s) and ${childCount} sub-categor(y/ies) still reference it. Re-categorise them first.`,
      })
      return
    }
    if (!window.confirm(`Delete category "${c.name}"? This cannot be undone.`)) return
    setBusyId(c.id)
    setMessage(null)
    const { error } = await deleteCategory(c.id)
    setBusyId(null)
    if (error) {
      setMessage({ type: 'err', text: error })
      return
    }
    setMessage({ type: 'ok', text: `Deleted "${c.name}".` })
    await onChanged()
  }

  return (
    <details className="card admin-card admin-catalogue-categories-manager">
      <summary className="admin-catalogue-categories-summary">
        <span className="admin-catalogue-categories-summary-title">
          Categories
          <span className="admin-muted"> · {categories.length} total</span>
        </span>
        <span className="admin-muted admin-catalogue-categories-summary-meta">
          {totalProductsWithCategory} of {products.length} products categorised · click to manage
        </span>
      </summary>

      <div className="admin-catalogue-categories-body">
        <p className="admin-callout admin-callout--info">
          Categories group products in the catalogue, ordering flow and the customer site. Use
          <strong> sub-categories</strong> under a parent (e.g. <em>Handles → Knobs</em>). Set
          <strong> Type</strong> so the catalogue toggle can switch between product categories,
          kitchen ranges, and cross-range items. Need bulk assignment? Use{' '}
          <Link to="/admin/catalogue/smart-categorise">Smart categorise</Link>.
        </p>

        {message && (
          <p
            className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'}
            role={message.type === 'err' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}

        <form className="admin-catalogue-categories-add-form" onSubmit={(e) => void handleCreate(e)}>
          <h3 className="admin-modal-form-section-title">Add category</h3>
          <div className="admin-catalogue-categories-add-grid">
            <label>
              Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Drawer boxes"
                required
                disabled={creating}
                title="Display name shown in the catalogue, ordering flow, and customer site"
              />
            </label>
            <label>
              Slug <span className="admin-muted">(optional)</span>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder={slugPreview || 'auto from name'}
                disabled={creating}
                title="URL slug. Auto-derived from the name if left blank."
              />
            </label>
            <label>
              Parent <span className="admin-muted">(sub-category)</span>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                disabled={creating}
                title="Choose a parent if this should be a sub-category"
              >
                <option value="">Top level</option>
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
                title="Product category = doors/handles/etc. Kitchen range = Oakham/Norwood/etc. Cross-range = wirework, accessories, drawer boxes etc. usable with any range."
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
          <button
            type="submit"
            className="btn btn-outline btn-small"
            disabled={creating || !newName.trim()}
          >
            {creating ? 'Creating…' : 'Add category'}
          </button>
        </form>

        <div className="admin-catalogue-categories-list-toolbar">
          <h3 className="admin-modal-form-section-title">
            All categories ({filtered.length}
            {filtered.length !== categories.length ? ` of ${categories.length}` : ''})
          </h3>
          <input
            type="search"
            className="admin-categories-search"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="admin-muted">No categories match your search.</p>
        ) : (
          <table className="admin-catalogue-categories-table">
            <thead>
              <tr>
                <th title="The category name shown to staff and customers">Name</th>
                <th title="URL-friendly identifier — used in links and saved filters">Slug</th>
                <th title="Empty if this is a top-level category">Parent</th>
                <th title="Product category / Kitchen range / Cross-range">Type</th>
                <th title="How many products currently sit in this category (across primary and multi-category assignments)">
                  Products
                </th>
                <th title="How many sub-categories live under this category">Subs</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
                const kind = c.category_kind ?? inferCategoryKindFromName(c.name)
                const productCount = productCountByCategory.get(c.id) ?? 0
                const childCount = childCountByParent.get(c.id) ?? 0
                const deletable = productCount === 0 && childCount === 0
                const isBusy = busyId === c.id
                return (
                  <tr
                    key={c.id}
                    className={isBusy ? 'admin-catalogue-categories-row--busy' : undefined}
                    title={`${categoryKindLabel(kind)} · ${productCount} product${productCount === 1 ? '' : 's'}${
                      parent ? ` · sub-category of ${parent.name}` : ' · top level'
                    }`}
                  >
                    <td>
                      <input
                        type="text"
                        defaultValue={c.name}
                        disabled={isBusy}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== c.name) void patch(c.id, { name: v })
                        }}
                        title="Rename this category. Saved when you click away."
                        aria-label={`Rename ${c.name}`}
                      />
                    </td>
                    <td>
                      <code className="admin-catalogue-categories-slug">{c.slug}</code>
                    </td>
                    <td>
                      <select
                        defaultValue={c.parent_id ?? ''}
                        disabled={isBusy}
                        onChange={(e) =>
                          void patch(c.id, { parent_id: e.target.value || null })
                        }
                        title="Move under a parent category, or set to Top level"
                      >
                        <option value="">Top level</option>
                        {parents
                          .filter((p) => p.id !== c.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <select
                        defaultValue={kind}
                        disabled={isBusy}
                        onChange={(e) =>
                          void patch(c.id, { category_kind: e.target.value as CategoryKind })
                        }
                        title={`Currently: ${categoryKindLabel(kind)}`}
                      >
                        <option value="product_type">Product category</option>
                        <option value="door_range">Kitchen range</option>
                        <option value="universal">Cross-range</option>
                      </select>
                    </td>
                    <td className="admin-catalogue-categories-count" title={`${productCount} product(s) in this category`}>
                      {productCount}
                    </td>
                    <td className="admin-catalogue-categories-count" title={`${childCount} sub-categor(y/ies)`}>
                      {childCount}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-link-button admin-danger"
                        disabled={isBusy || !deletable}
                        onClick={() => void remove(c)}
                        title={
                          deletable
                            ? 'Delete this category — only available when it has no products and no sub-categories'
                            : 'Move products & sub-categories out before deleting'
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </details>
  )
}
