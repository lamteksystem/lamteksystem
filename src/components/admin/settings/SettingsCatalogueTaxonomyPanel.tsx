import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'
import CategoryTypesManager from '@/components/admin/CategoryTypesManager'
import OrderingBehavioursManager from '@/components/admin/OrderingBehavioursManager'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import { LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import { usePermission } from '@/hooks/usePermission'
import type { CategoryRow, ProductRow } from '@/types/database'

/** Settings → Catalogue taxonomy: types + categories in one tidy layout. */
export default function SettingsCatalogueTaxonomyPanel() {
  const { allowed: canEdit } = usePermission('admin.settings', 'edit')
  const { types: categoryTypes, reload: reloadCategoryTypes } = useCategoryTypes(false)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [productCategoryMap, setProductCategoryMap] = useState<ProductCategoryMap>(new Map())
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prodData }, { data: catData }, pcMap] = await Promise.all([
      supabase.from('products').select('id, name, category_id').order('name'),
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

  return (
    <div className="admin-settings-panel admin-settings-taxonomy">
      <p className="admin-settings-panel-intro">
        Manage <strong>types</strong> (how categories behave) and <strong>categories</strong> (the live
        product tree). For bulk assignment use{' '}
        <Link to="/admin/catalogue-tools/smart-categorise">Smart categorise</Link> or the full editor on{' '}
        <Link to={LIVE_CATALOGUE.categories}>Manage categories</Link>.
      </p>

      <OrderingBehavioursManager
        embedded
        editScope="any"
        onChanged={() => reloadCategoryTypes()}
      />

      <CategoryTypesManager
        embedded
        editScope="any"
        onTypesChanged={() => reloadCategoryTypes()}
      />

      <section className="admin-taxonomy-section admin-taxonomy-section--categories card admin-card">
        <h2 className="admin-modal-form-section-title">Categories</h2>
        <p className="admin-muted admin-taxonomy-section-intro">
          Add parent categories (leave Parent empty) or sub-categories under a parent. Double-click a
          slug to edit.
        </p>
        {loading ? (
          <p className="admin-muted">Loading categories…</p>
        ) : (
          <CatalogueCategoriesManager
            categories={categories}
            products={products}
            productCategoryMap={productCategoryMap}
            categoryTypes={categoryTypes}
            onChanged={loadAll}
            variant="embedded"
            canEdit={canEdit}
          />
        )}
      </section>
    </div>
  )
}
