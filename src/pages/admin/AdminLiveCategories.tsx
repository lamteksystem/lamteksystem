import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'
import CategoryTypesManager from '@/components/admin/CategoryTypesManager'
import { ORDERING_BEHAVIOUR_SETTINGS_HREF } from '@/lib/catalogueSettingsPaths'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import { CATALOGUE_TOOLS } from '@/lib/catalogueToolsPaths'
import { CORE_CATALOGUE_CATEGORY_NAMES, pruneImportedCategories } from '@/lib/categoryPrune'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import { usePermission } from '@/hooks/usePermission'
import type { CategoryRow, ProductRow } from '@/types/database'

/** Live category tree — types registry + browse and edit active categories. */
export default function AdminLiveCategories() {
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const { types: categoryTypes, reload: reloadCategoryTypes } = useCategoryTypes(false)
  const [pruning, setPruning] = useState(false)
  const [pruneMessage, setPruneMessage] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prodData }, { data: catData }, pcMap] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      fetchProductCategoryMap(),
    ])
    setProducts((prodData ?? []) as ProductRow[])
    setCategories((catData ?? []) as CategoryRow[])
    setProductCategoryMap(pcMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function runPruneImportedCategories() {
    if (
      !window.confirm(
        `Delete every category except the ${CORE_CATALOGUE_CATEGORY_NAMES.length} core types (${CORE_CATALOGUE_CATEGORY_NAMES.join(', ')})? Products in removed categories become uncategorised — nothing is deleted.`,
      )
    ) {
      return
    }
    setPruning(true)
    setPruneMessage(null)
    try {
      const r = await pruneImportedCategories()
      if (r.error) {
        setPruneMessage(`Error: ${r.error}`)
      } else {
        setPruneMessage(
          `Removed ${r.removedCategories} imported categor${r.removedCategories === 1 ? 'y' : 'ies'}; ${r.productsUncategorised} product(s) are now uncategorised.`,
        )
        await loadAll()
      }
    } finally {
      setPruning(false)
    }
  }

  return (
    <section className="admin-page admin-live-categories-page">
      <header className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p className="admin-muted">
            First add or edit <strong>category types</strong> (the Type dropdown options), then add
            categories below. Configure quote/order behaviours in{' '}
            <Link to={ORDERING_BEHAVIOUR_SETTINGS_HREF}>Settings → Catalogue taxonomy</Link>.
            Smart categorisation and imports live under{' '}
            <Link to={CATALOGUE_TOOLS.hub}>Product &amp; category tools</Link>.
          </p>
          {canEditCatalogue && (
            <div className="admin-live-categories-actions" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-small btn-danger-outline"
                disabled={pruning}
                onClick={() => void runPruneImportedCategories()}
              >
                {pruning ? 'Removing…' : 'Remove imported categories'}
              </button>
              {pruneMessage ? <span className="admin-muted"> {pruneMessage}</span> : null}
            </div>
          )}
        </div>
      </header>

      <CategoryTypesManager
        embedded
        editScope="catalogue"
        onTypesChanged={() => reloadCategoryTypes()}
      />

      {loading ? (
        <p className="admin-muted" style={{ marginTop: '1.25rem' }}>
          Loading categories…
        </p>
      ) : (
        <section className="card admin-card admin-taxonomy-section--categories" style={{ marginTop: '1.25rem' }}>
          <h2 className="admin-modal-form-section-title">Categories</h2>
          <p className="admin-muted admin-taxonomy-section-intro">
            Add parent categories (leave Parent empty) or sub-categories. Edit type and parent in the
            table; double-click a slug to change it.
          </p>
          <CatalogueCategoriesManager
            categories={categories}
            products={products}
            productCategoryMap={productCategoryMap}
            categoryTypes={categoryTypes}
            onChanged={loadAll}
            variant="embedded"
            canEdit={canEditCatalogue}
          />
        </section>
      )}
    </section>
  )
}
