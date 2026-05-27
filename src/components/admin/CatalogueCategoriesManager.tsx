/**
 * Inline categories editor shown on the Catalogue admin page. Wrapped in a <details> element so
 * it's collapsed by default and tucks away under the rest of the catalogue UI. Supports
 * create / rename / change parent / change kind / delete with inline validation.
 */
import { useMemo, useState, type FormEvent } from 'react'
import CategoriesWorkbenchTable from '@/components/admin/CategoriesWorkbenchTable'
import PricelistWorkbenchSection from '@/components/admin/PricelistWorkbenchSection'
import { DEFAULT_CATEGORIES_FILTERS, type CategoriesTableFilters } from '@/lib/categoriesWorkbenchFilters'
import { Link } from 'react-router-dom'
import {
  createCategory,
  deleteCategory,
  slugifyCategoryName,
  updateCategory,
} from '@/lib/categoryAdmin'
import { getProductCategoryIds, type ProductCategoryMap } from '@/lib/productCategories'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import type { CategoryKind, CategoryRow, CategoryTypeRow, ProductRow } from '@/types/database'

interface CatalogueCategoriesManagerProps {
  categories: CategoryRow[]
  products: ProductRow[]
  productCategoryMap: ProductCategoryMap
  onChanged: () => void | Promise<void>
  /** When provided (e.g. from parent page), Type dropdowns use this list and stay in sync after new types are added. */
  categoryTypes?: CategoryTypeRow[]
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
  categoryTypes: categoryTypesProp,
  variant = 'inline',
  canEdit = true,
}: CatalogueCategoriesManagerProps) {
  const [tableFilters, setTableFilters] = useState<CategoriesTableFilters>(DEFAULT_CATEGORIES_FILTERS)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [newKind, setNewKind] = useState<CategoryKind>('product_type')
  const { types: categoryTypesFromHook } = useCategoryTypes(false)
  const categoryTypes = categoryTypesProp ?? categoryTypesFromHook
  const activeTypes = categoryTypes.filter((t) => t.active)
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

  const slugPreview = newSlug.trim() || (newName.trim() ? slugifyCategoryName(newName) : '')

  function patchTableFilters(patch: Partial<CategoriesTableFilters>) {
    setTableFilters((prev) => ({ ...prev, ...patch }))
  }

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
                onChange={(e) => setNewKind(e.target.value)}
                disabled={creating}
                title="Category type — add custom options in the Category types section above"
              >
                {(activeTypes.length ? activeTypes : categoryTypes).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
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

        <CategoriesWorkbenchTable
          categories={categories}
          categoryTypes={categoryTypes}
          productCountByCategory={productCountByCategory}
          childCountByParent={childCountByParent}
          canEdit={canEdit}
          busyId={busyId}
          onPatch={(id, body) => void patch(id, body)}
          onRemove={(c) => void remove(c)}
          filters={tableFilters}
          onFiltersChange={patchTableFilters}
        />
      </div>
  )

  const workbenchList = (
    <PricelistWorkbenchSection
      id="categories-workbench"
      title="Edit categories"
      summary={`${categories.length} categories · search, filter, and sort like the pricelist workbench`}
      tip="Resize columns via the header edges. Hover the side arrows to auto-scroll horizontally."
      defaultOpen
      badge={categories.length}
    >
      {body}
    </PricelistWorkbenchSection>
  )

  if (variant === 'embedded') {
    return (
      <div className="admin-catalogue-categories-manager admin-catalogue-categories-manager--embedded admin-categories-workbench">
        {workbenchList}
      </div>
    )
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
