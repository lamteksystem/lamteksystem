import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import CatalogueCategoriesManager from '@/components/admin/CatalogueCategoriesManager'
import { fetchProductCategoryMap, type ProductCategoryMap } from '@/lib/productCategories'
import { CATALOGUE_TOOLS } from '@/lib/catalogueToolsPaths'
import type { CategoryRow, ProductRow } from '@/types/database'

/** Live category tree — browse and edit active categories (tooling lives under Product & category tools). */
export default function AdminLiveCategories() {
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

  return (
    <section className="admin-page admin-live-categories-page">
      <header className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p className="admin-muted">
            Active category tree used by the live catalogue. For smart categorisation, imports, and parsers, use{' '}
            <Link to={CATALOGUE_TOOLS.hub}>Product &amp; category tools</Link>.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="admin-muted">Loading categories…</p>
      ) : (
        <CatalogueCategoriesManager
          categories={categories}
          products={products}
          productCategoryMap={productCategoryMap}
          onChanged={loadAll}
          variant="embedded"
        />
      )}
    </section>
  )
}
