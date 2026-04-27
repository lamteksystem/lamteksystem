import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useMtoCartRefresh } from '@/components/MtoLayout'
import { recalcOrderTotals } from '@/lib/orders'
import type { ProductRow } from '@/types/database'

/** Static list when no Mouldings category exists in DB (from reference: Arched Pelmet, Bullnose, Canopy, Cornice, etc.) */
const FALLBACK_MOULDINGS = [
  { description: 'Arched Pelmet', details: 'Up to 2500 x 200 x 18 (300mm ends)', price: 51.73, sku: 'MOLD-ARCH-PELMET' },
  { description: 'Bullnose Square Modern 50 x 30 x 3050', details: '50 x 30', price: 21.62, sku: 'MOLD-BULL-50' },
  { description: 'Canopy Modern', details: 'As per spec', price: 275.77, sku: 'MOLD-CAN-MOD' },
  { description: 'Canopy Shaker Fronted', details: 'As per spec', price: 275.77, sku: 'MOLD-CAN-SHAKER' },
  { description: 'Canopy Square Fronted Plain', details: 'As per spec', price: 275.77, sku: 'MOLD-CAN-SQ' },
  { description: 'Canopy Traditional T&G', details: 'As per spec', price: 275.77, sku: 'MOLD-CAN-TG' },
  { description: 'Classic Radius Cap', details: '63mm fitted height', price: 34.41, sku: 'MOLD-RADIUS-CAP' },
  { description: 'Cornice Classic', details: '62mm fitted height', price: 22.87, sku: 'MOLD-CORNICE' },
  { description: 'Over Mantle Arch Fascia', details: 'As per spec', price: 89.0, sku: 'MOLD-OM-ARCH' },
  { description: 'Over Mantle Shelf', details: 'As per spec', price: 45.0, sku: 'MOLD-OM-SHELF' },
  { description: 'Over Mantle Shelf Support (Each)', details: 'Each', price: 8.5, sku: 'MOLD-OM-SUPP' },
  { description: 'Over Mantle Side', details: 'As per spec', price: 32.0, sku: 'MOLD-OM-SIDE' },
  { description: 'Pilaster Barrel', details: 'As per spec', price: 28.5, sku: 'MOLD-PIL-BARREL' },
]

export default function MtoMouldingsAccessories() {
  const refreshCart = useMtoCartRefresh()
  const { ensureDraftOrder } = useDraftOrder()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [useFallback, setUseFallback] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [rangeName] = useState('Salisbury')
  const [colour] = useState('Porcelain')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('categories')
      .select('id')
      .or('slug.eq.mouldings-accessories,slug.eq.mouldings')
      .maybeSingle()
      .then(({ data: cat }) => {
        if (!cat || cancelled) return supabase.from('products').select('id').limit(0)
        return supabase
          .from('products')
          .select('*')
          .eq('category_id', cat.id)
          .eq('active', true)
          .order('sort_order')
          .order('name')
      })
      .then((result) => {
        if (cancelled || !result) return
        const data = result.data as ProductRow[] | undefined
        if (data && data.length > 0) {
          setProducts(data)
          setUseFallback(false)
        } else {
          setUseFallback(true)
        }
      })
    return () => { cancelled = true }
  }, [])

  async function addProduct(product: ProductRow) {
    setAdding(product.id)
    try {
      const orderId = await ensureDraftOrder()
      const snapshot = { name: product.name, description: product.description, sku: product.sku, image_url: product.image_url }
      await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: product.id,
        product_snapshot: snapshot,
        quantity: 1,
        unit_price: product.unit_price,
        options: {},
      })
      await recalcOrderTotals(orderId)
      refreshCart()
    } finally {
      setAdding(null)
    }
  }

  async function addFallbackItem(item: (typeof FALLBACK_MOULDINGS)[0]) {
    setAdding(item.sku)
    try {
      const orderId = await ensureDraftOrder()
      await supabase.from('order_lines').insert({
        order_id: orderId,
        product_id: null,
        product_snapshot: { name: item.description, description: item.details, sku: item.sku },
        quantity: 1,
        unit_price: item.price,
        options: { mtoType: 'mouldings-accessories', rangeName, colour },
      })
      await recalcOrderTotals(orderId)
      refreshCart()
    } finally {
      setAdding(null)
    }
  }

  if (useFallback) {
    return (
      <div className="mto-config card">
        <h1 className="mto-config-title">Mouldings & Accessories</h1>
        <p className="mto-config-meta">
          Range: {rangeName} · Colour: {colour}
        </p>
        <div className="mto-table-wrap">
          <table className="mto-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
                <th>Price £</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {FALLBACK_MOULDINGS.map((item) => (
                <tr key={item.sku}>
                  <td>{item.description}</td>
                  <td>{item.details}</td>
                  <td>£{item.price.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-success btn-small mto-add-icon"
                      onClick={() => addFallbackItem(item)}
                      disabled={adding === item.sku}
                      title="Add to cart"
                    >
                      {adding === item.sku ? '…' : '+'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (products.length === 0 && !useFallback) {
    return (
      <div className="mto-config card">
        <h1 className="mto-config-title">Mouldings & Accessories</h1>
        <p className="mto-config-meta">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mto-config card">
      <h1 className="mto-config-title">Mouldings & Accessories</h1>
      <p className="mto-config-meta">
        Range: {rangeName} · Colour: {colour}
      </p>
      <div className="mto-table-wrap">
        <table className="mto-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Details</th>
              <th>Price £</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.description ?? '—'}</td>
                <td>£{Number(p.unit_price).toFixed(2)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-success btn-small mto-add-icon"
                    onClick={() => addProduct(p)}
                    disabled={adding === p.id}
                    title="Add to cart"
                  >
                    {adding === p.id ? '…' : '+'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
