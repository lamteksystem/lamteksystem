/**
 * Inline categories editor shown on the Catalogue admin page. Wrapped in a <details> element so
 * it's collapsed by default and tucks away under the rest of the catalogue UI. Supports
 * create / rename / change parent / change kind / delete with inline validation.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ListPager from '@/components/admin/ListPager'
import { useListPagination } from '@/lib/listPagination'
import {
  createCategory,
  deleteCategory,
  normalizeCategorySlug,
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
  /**
   * `inline` (default) renders the manager as a collapsible `<details>` card — used
   * when embedded under the catalogue browse table as a quick-edit panel.
   * `embedded` renders the full editor open by default with no card chrome — used
   * on the dedicated Categories hub page's General tab.
   */
  variant?: 'inline' | 'embedded'
  /** When false, list is read-only (view permission without edit). */
  canEdit?: boolean
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
  variant = 'inline',
  canEdit = true,
}: CatalogueCategoriesManagerProps) {
  const [search, setSearch] = useState('')
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null)
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

  const {
    pageItems: pagedCategories,
    totalItems: filteredTotal,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useListPagination(filtered, { resetDeps: [search] })

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
    const impact =
      productCount > 0 || childCount > 0
        ? `\n\n• ${productCount} product(s) will lose this category (uncategorised unless they have another).\n• ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'} will move to top level.`
        : ''
    if (!window.confirm(`Delete category "${c.name}"? This cannot be undone.${impact}`)) return
    setBusyId(c.id)
    setMessage(null)
    const result = await deleteCategory(c.id)
    setBusyId(null)
    if (result.error) {
      setMessage({ type: 'err', text: result.error })
      return
    }
    const parts = [`Deleted "${c.name}".`]
    if ((result.productsUncategorised ?? 0) > 0) {
      parts.push(`${result.productsUncategorised} product(s) uncategorised.`)
    }
    if ((result.productsRepointed ?? 0) > 0) {
      parts.push(`${result.productsRepointed} product(s) kept another category as primary.`)
    }
    if ((result.subcategoriesPromoted ?? 0) > 0) {
      parts.push(`${result.subcategoriesPromoted} sub-categor${result.subcategoriesPromoted === 1 ? 'y' : 'ies'} moved to top level.`)
    }
    setMessage({ type: 'ok', text: parts.join(' ') })
    await onChanged()
  }

  const body = (
      <div className="admin-catalogue-categories-body">
        <p className="admin-callout admin-callout--info">
          Categories group products in the catalogue, ordering flow and the customer site.{' '}
          <strong>Add category</strong> below to create a top-level parent (leave Parent empty) or a
          sub-category under an existing parent. Edit <strong>Parent</strong> and{' '}
          <strong>Type</strong> in the table; double-click a <strong>slug</strong> to change it.{' '}
          {canEdit ? (
            <>
              Names save when you click away; parent and type save when you change the dropdown.
            </>
          ) : (
            <>You have view-only access — ask an admin with catalogue edit permission to make changes.</>
          )}{' '}
          {variant === 'inline' ? (
            <>
              Need bulk assignment?{' '}
              <Link to="/admin/catalogue-tools/smart-categorise">Smart categorise</Link>.
            </>
          ) : (
            <>
              {totalProductsWithCategory} of {products.length} products are currently
              categorised.
            </>
          )}
        </p>

        {message && (
          <p
            className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'}
            role={message.type === 'err' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}

        {canEdit && (
        <form className="admin-catalogue-categories-add-form" onSubmit={(e) => void handleCreate(e)}>
          <h3 className="admin-modal-form-section-title">Add category</h3>
          <div className="admin-catalogue-categories-add-grid">
            <label>
              Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Complete, Drawer boxes"
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
              Parent category
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                disabled={creating}
                title="Leave as Top level to create a parent category; pick a parent for a sub-category"
              >
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
        )}

        <div className="admin-catalogue-categories-list-toolbar">
          <h3 className="admin-modal-form-section-title">
            All categories ({filteredTotal}
            {filteredTotal !== categories.length ? ` of ${categories.length}` : ''})
          </h3>
          <input
            type="search"
            className="admin-categories-search"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredTotal === 0 ? (
          <p className="admin-muted">No categories match your search.</p>
        ) : (
          <>
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
              {pagedCategories.map((c) => {
                const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
                const kind = c.category_kind ?? inferCategoryKindFromName(c.name)
                const productCount = productCountByCategory.get(c.id) ?? 0
                const childCount = childCountByParent.get(c.id) ?? 0
                const isBusy = busyId === c.id
                const hasReferences = productCount > 0 || childCount > 0
                return (
                  <tr
                    key={c.id}
                    className={isBusy ? 'admin-catalogue-categories-row--busy' : undefined}
                    title={`${categoryKindLabel(kind)} · ${productCount} product${productCount === 1 ? '' : 's'}${
                      parent ? ` · sub-category of ${parent.name}` : ' · top level'
                    }`}
                  >
                    <td>
                      {canEdit ? (
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
                      ) : (
                        c.name
                      )}
                    </td>
                    <td>
                      {canEdit && editingSlugId === c.id ? (
                        <input
                          type="text"
                          className="admin-catalogue-categories-slug-input"
                          defaultValue={c.slug}
                          autoFocus
                          disabled={isBusy}
                          onBlur={(e) => {
                            setEditingSlugId(null)
                            const next = normalizeCategorySlug(e.target.value)
                            if (next && next !== c.slug) void patch(c.id, { slug: next })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setEditingSlugId(null)
                          }}
                          aria-label={`Edit slug for ${c.name}`}
                        />
                      ) : (
                        <code
                          className={`admin-catalogue-categories-slug${canEdit ? ' admin-catalogue-categories-slug--editable' : ''}`}
                          onDoubleClick={
                            canEdit && !isBusy
                              ? () => setEditingSlugId(c.id)
                              : undefined
                          }
                          title={
                            canEdit
                              ? 'Double-click to edit slug'
                              : c.slug
                          }
                        >
                          {c.slug}
                        </code>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          defaultValue={c.parent_id ?? ''}
                          disabled={isBusy}
                          onChange={(e) =>
                            void patch(c.id, { parent_id: e.target.value || null })
                          }
                          title="Move under a parent category, or set to Top level (parent category)"
                        >
                          <option value="">Top level (parent)</option>
                          {parents
                            .filter((p) => p.id !== c.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      ) : parent ? (
                        parent.name
                      ) : (
                        <span className="admin-muted">Top level</span>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
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
                      ) : (
                        categoryKindLabel(kind)
                      )}
                    </td>
                    <td className="admin-catalogue-categories-count" title={`${productCount} product(s) in this category`}>
                      {productCount}
                    </td>
                    <td className="admin-catalogue-categories-count" title={`${childCount} sub-categor(y/ies)`}>
                      {childCount}
                    </td>
                    <td>
                      {canEdit ? (
                        <button
                          type="button"
                          className="admin-link-button admin-danger"
                          disabled={isBusy}
                          onClick={() => void remove(c)}
                          title={
                            hasReferences
                              ? `Delete "${c.name}" — ${productCount} product(s) and ${childCount} sub-categor(y/ies) will be updated`
                              : `Delete "${c.name}"`
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ListPager
            totalItems={filteredTotal}
            totalPages={totalPages}
            currentPage={currentPage}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            itemLabel={filteredTotal === 1 ? 'category' : 'categories'}
            ariaLabel="Category list"
          />
          </>
        )}
      </div>
  )

  if (variant === 'embedded') {
    return <div className="admin-catalogue-categories-manager admin-catalogue-categories-manager--embedded">{body}</div>
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
      {body}
    </details>
  )
}
