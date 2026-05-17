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

type ViewType = 'grid' | 'compact' | 'list'

function isInternalOptionKey(key: string): boolean {
  return key.startsWith('lamtek_') || key.startsWith('tealbury_') || key === 'components'
}

function tealburyHighlightBadges(product: ProductRow): string[] {
  const opts = (product.options as Record<string, unknown>) ?? {}
  const badges: string[] = []
  const door = opts.tealbury_door_range
  if (typeof door === 'string' && door.trim()) badges.push(door.trim())
  const dims = opts.tealbury_dims_mm
  if (dims && typeof dims === 'object' && !Array.isArray(dims)) {
    const d = dims as { h?: number; w?: number; d?: number }
    const parts = [d.w, d.h, d.d].filter((n) => typeof n === 'number' && n > 0)
    if (parts.length > 0) badges.push(`${parts.join(' × ')} mm`)
  }
  return badges
}

function customerFacingBadges(product: ProductRow): string[] {
  const opts = (product.options as Record<string, unknown>) ?? {}
  const highlights = tealburyHighlightBadges(product)
  const general = Object.entries(opts)
    .filter(([k, v]) => !isInternalOptionKey(k) && v != null && String(v).trim() !== '')
    .map(([, v]) => String(v).trim())
  return [...highlights, ...general.filter((v) => !highlights.includes(v))].slice(0, 4)
}

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
  const [productQtyById, setProductQtyById] = useState<Record<string, number>>({})
  const [viewType, setViewType] = useState<ViewType>('grid')
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
      const catIds = [...new Set(plist.map((p) => p.category_id).filter(Boolean))] as string[]
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

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      if (!p.category_id) continue
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
    }
    return counts
  }, [products])

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
      const { count } = await supabase
        .from('order_lines')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', draftOrder.id)
      if (!cancelled) setLineCount(count ?? 0)
    }
    void countLines()
    return () => {
      cancelled = true
    }
  }, [draftOrder?.id])

  useEffect(() => {
    if (!lastAddedMessage) return
    const t = window.setTimeout(() => setLastAddedMessage(null), 3500)
    return () => window.clearTimeout(t)
  }, [lastAddedMessage])

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
        const { count } = await supabase
          .from('order_lines')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', orderId)
        setLineCount(count ?? 0)
        setLastAddedMessage(`Added ${qty} × ${product.name}`)
      } catch (e) {
        console.error(e)
      } finally {
        setAdding(null)
      }
    },
    [addQuantity, effectiveUserId, ensureDraftOrder, refresh],
  )

  if (loading) return <div className="app-loading">Loading Tealbury catalogue…</div>

  return (
    <div className="page ordering-page tealbury-ordering-page">
      <PageNav backTo="/ordering/start" backLabel="Ordering" />

      <header className="page-header ordering-page-header">
        <div>
          <h1>Tealbury kitchens</h1>
          <p className="page-lead">
            Browse packaged kitchen lines and add them to your cart. For component-level Lamtek ordering, use{' '}
            <Link to="/ordering">Create order</Link>.
          </p>
        </div>
        <div className="ordering-header-actions">
          <Link to="/ordering/cart" className="btn btn-outline">
            Cart{lineCount > 0 ? ` (${lineCount})` : ''} →
          </Link>
        </div>
      </header>

      {lineCount > 0 && (
        <Link to="/ordering/cart" className="cart-fab" aria-label={`Open cart (${lineCount} items)`}>
          Cart <span className="cart-fab-badge" aria-hidden>{lineCount}</span>
        </Link>
      )}

      {lastAddedMessage && <p className="ordering-toast" role="status">{lastAddedMessage}</p>}

      <div className="ordering-toolbar">
        <label className="ordering-qty-label">
          Default add qty
          <select
            value={addQuantity}
            onChange={(e) => setAddQuantity(Number(e.target.value))}
            className="ordering-qty-select"
            title="Quantity applied when you first use the stepper on a product"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="ordering-result-count admin-muted">
          {productsInCategory.length} product{productsInCategory.length === 1 ? '' : 's'}
        </span>
      </div>

      {categories.length > 0 && (
        <div className="ordering-tabs" role="tablist" aria-label="Kitchen ranges">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === null}
            className={selectedCategory === null ? 'active' : ''}
            onClick={() => setSelectedCategory(null)}
          >
            All ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === c.id}
              className={selectedCategory === c.id ? 'active' : ''}
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.name}
              {categoryCounts.has(c.id) ? ` (${categoryCounts.get(c.id)})` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="ordering-view-toolbar">
        <span className="admin-muted" style={{ fontSize: '0.9rem' }}>View</span>
        <div className="products-view-toggle" role="group" aria-label="Catalogue view">
          <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} aria-pressed={viewType === 'grid'}>
            Grid
          </button>
          <button type="button" className={viewType === 'list' ? 'active' : ''} onClick={() => setViewType('list')} aria-pressed={viewType === 'list'}>
            List
          </button>
          <button type="button" className={viewType === 'compact' ? 'active' : ''} onClick={() => setViewType('compact')} aria-pressed={viewType === 'compact'}>
            Compact
          </button>
        </div>
      </div>

      <div className="ordering-search-wrap">
        <div className="ordering-search-row">
          <input
            type="search"
            placeholder="Search by name or SKU…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ordering-search-input"
          />
          {searchQuery.trim() && (
            <button
              type="button"
              className="ordering-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <p className="muted">
            No Tealbury products are loaded yet. Ask staff to import the Tealbury pricelist under Admin → Tealbury pricelist.
          </p>
        </div>
      ) : (
        <div className={`ordering-grid products-view--${viewType}`}>
          {productsInCategory.length === 0 ? (
            <div className="card">
              <p>No products match your filters. Try another range or clear the search.</p>
            </div>
          ) : (
            productsInCategory.map((product) => {
              const availability = getProductAvailabilityMeta(product)
              const badges = customerFacingBadges(product)
              const openDetail = () => setSelectedProduct(product)
              const qty = productQtyById[product.id] ?? addQuantity

              return (
                <div key={product.id} className="card product-card product-card--clickable">
                  <button
                    type="button"
                    className="product-card-click-layer"
                    onClick={openDetail}
                    aria-label={`View details for ${product.name}`}
                  />
                  <div
                    className="product-card-image product-card-trigger"
                    onClick={openDetail}
                    onKeyDown={(e) => e.key === 'Enter' && openDetail()}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${product.name}`}
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.image_alt ?? product.name ?? ''} />
                    ) : (
                      <div className="product-card-placeholder">No image</div>
                    )}
                  </div>
                  <div className="product-card-body">
                    <h3 className="product-card-name product-card-trigger">
                      <button type="button" onClick={openDetail} className="product-card-name-btn">
                        {product.name}
                      </button>
                    </h3>
                    {product.description && <p className="product-card-desc">{product.description}</p>}
                    {badges.length > 0 && (
                      <div className="product-badges">
                        {badges.map((label) => (
                          <span key={label} className="product-badge">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {product.sku && <span className="product-card-sku">SKU: {product.sku}</span>}
                    <div className="product-badges">
                      <span className="product-badge" title={availability.detail ?? availability.label}>
                        {availability.label}
                      </span>
                    </div>
                    <div className="product-card-footer">
                      <button
                        type="button"
                        onClick={openDetail}
                        className="product-card-price product-card-trigger"
                        aria-label={`View details – £${Number(product.unit_price).toFixed(2)}`}
                      >
                        £{Number(product.unit_price).toFixed(2)}
                      </button>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          aria-label={`Decrease quantity for ${product.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setProductQtyById((prev) => ({
                              ...prev,
                              [product.id]: Math.max(1, (prev[product.id] ?? addQuantity) - 1),
                            }))
                          }}
                          disabled={adding === product.id}
                        >
                          −
                        </button>
                        <input
                          className="qty-stepper-input"
                          inputMode="numeric"
                          aria-label={`Quantity for ${product.name}`}
                          value={qty}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            setProductQtyById((prev) => ({
                              ...prev,
                              [product.id]: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
                            }))
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={adding === product.id}
                        />
                        <button
                          type="button"
                          className="qty-stepper-btn"
                          aria-label={`Increase quantity for ${product.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setProductQtyById((prev) => ({
                              ...prev,
                              [product.id]: Math.min(99, (prev[product.id] ?? addQuantity) + 1),
                            }))
                          }}
                          disabled={adding === product.id}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={(e) => {
                          e.stopPropagation()
                          void addToCart(product, qty)
                        }}
                        disabled={adding === product.id}
                      >
                        {adding === product.id ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={setSelectedProduct}
          onAddToCart={(p, qty) => void addToCart(p, qty)}
        />
      )}
    </div>
  )
}
