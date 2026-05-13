import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import ProductDetailModal from '@/components/ProductDetailModal'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'
import type { CategoryRow, ProductRow } from '@/types/database'

export default function TealburyOrdering() {
  const { draftOrder, ensureDraftOrder, refresh } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [addQuantity, setAddQuantity] = useState(1)
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null)
  const [lineCount, setLineCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: prodData, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('catalog_program', CATALOG_PROGRAM.TEALBURY)
        .order('sort_order')
        .order('name')
      if (pErr) {
        console.error(pErr)
        if (!cancelled) setLoading(false)
        return
      }
      const plist = (prodData ?? []) as ProductRow[]
      const catIds = [...new Set(plist.map((p) => p.category_id).filter(Boolean))]
      const { data: catData } =
        catIds.length === 0
          ? { data: [] as CategoryRow[] }
          : await supabase.from('categories').select('*').in('id', catIds).order('sort_order').order('name')
      if (!cancelled) {
        setProducts(plist)
        setCategories((catData ?? []) as CategoryRow[])
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const productsInCategory = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory && p.category_id !== selectedCategory) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.trim().toLowerCase()
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, selectedCategory, searchQuery])

  useEffect(() => {
    let cancelled = false
    async function countLines() {
      if (!draftOrder?.id) {
        if (!cancelled) setLineCount(0)
        return
      }
      const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', draftOrder.id)
      if (!cancelled) setLineCount(count ?? 0)
    }
    void countLines()
    return () => {
      cancelled = true
    }
  }, [draftOrder?.id])

  const addToCart = useCallback(
    async (product: ProductRow, quantity?: number) => {
      const qty = quantity ?? addQuantity
      setAdding(product.id)
      try {
        const orderId = await ensureDraftOrder()
        const productSnapshot = {
          name: product.name,
          description: product.description,
          sku: product.sku,
          image_url: product.image_url,
        }
        const { error } = await supabase.from('order_lines').insert({
          order_id: orderId,
          product_id: product.id,
          product_snapshot: productSnapshot,
          quantity: qty,
          unit_price: product.unit_price,
          options: product.options ?? {},
        })
        if (error) throw error
        if (effectiveUserId) await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: effectiveUserId })
        await refresh()
        const { count } = await supabase.from('order_lines').select('*', { count: 'exact', head: true }).eq('order_id', orderId)
        setLineCount(count ?? 0)
        setLastAddedMessage(`Added ${qty} × ${product.name}`)
      } catch (e) {
        console.error(e)
      } finally {
        setAdding(null)
      }
    },
    [addQuantity, effectiveUserId, ensureDraftOrder, refresh]
  )

  if (loading) return <div className="app-loading">Loading Tealbury catalogue…</div>

  return (
    <div className="page ordering-page">
      <PageNav backTo="/ordering/start" backLabel="Ordering" />
      <header className="page-header">
        <h1>Tealbury kitchens</h1>
        <p className="page-lead">
          Curated packaged lines from the Tealbury programme — order complete kitchen packages here. Component-level Lamtek ordering
          stays under <Link to="/ordering">Create order</Link>.
        </p>
        <div className="ordering-toolbar" style={{ marginTop: '0.75rem' }}>
          <Link to="/ordering/cart" className="btn btn-outline">
            Cart{lineCount > 0 ? ` (${lineCount})` : ''}
          </Link>
        </div>
      </header>

      <div className="ordering-filters" style={{ marginBottom: '1rem' }}>
        <label className="filter-field">
          <span>Search</span>
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="SKU, name…" />
        </label>
        <label className="filter-field">
          <span>Range</span>
          <select value={selectedCategory ?? ''} onChange={(e) => setSelectedCategory(e.target.value || null)}>
            <option value="">All ranges</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Qty</span>
          <input
            type="number"
            min={1}
            value={addQuantity}
            onChange={(e) => setAddQuantity(Math.max(1, Number(e.target.value) || 1))}
            style={{ maxWidth: '5rem' }}
          />
        </label>
      </div>

      {lastAddedMessage && <p className="ordering-toast">{lastAddedMessage}</p>}

      {products.length === 0 ? (
        <p className="muted">
          No Tealbury products are loaded yet. Ask staff to import the Tealbury pricelist under Admin → Tealbury pricelist.
        </p>
      ) : (
        <ul className="product-grid">
          {productsInCategory.map((product) => {
            const av = getProductAvailabilityMeta(product)
            return (
              <li key={product.id} className="product-card">
                <button type="button" className="product-card-main" onClick={() => setSelectedProduct(product)}>
                  <div className="product-card-body">
                    <h3 className="product-card-title">{product.name}</h3>
                    {product.sku && <p className="product-card-sku">{product.sku}</p>}
                    <p className="product-card-price">£{Number(product.unit_price).toFixed(2)} ex VAT</p>
                    {av.label ? <p className="product-card-meta">{av.label}</p> : null}
                  </div>
                </button>
                <div className="product-card-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={adding === product.id}
                    onClick={() => void addToCart(product)}
                  >
                    {adding === product.id ? 'Adding…' : 'Add to cart'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(p, qty) => void addToCart(p, qty)}
        />
      )}
    </div>
  )
}
