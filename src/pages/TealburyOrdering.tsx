import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import TealburyProductWorkbench from '@/components/tealbury/TealburyProductWorkbench'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { repriceDraftOrderLinesForCustomer } from '@/lib/orderPricing'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import type { CategoryRow, ProductRow } from '@/types/database'

export default function TealburyOrdering() {
  const { draftOrder, ensureDraftOrder, refresh } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
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

  const commitLines = useCallback(
    async (lines: { product: ProductRow; quantity: number }[]) => {
      if (lines.length === 0) return
      const orderId = await ensureDraftOrder()
      for (const { product, quantity } of lines) {
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
          quantity,
          unit_price: product.unit_price,
          options: product.options ?? {},
        })
        if (error) throw error
      }
      if (effectiveUserId) {
        await repriceDraftOrderLinesForCustomer({ orderId, customerUserId: effectiveUserId })
      }
      await refresh()
      const { count } = await supabase
        .from('order_lines')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId)
      setLineCount(count ?? 0)
    },
    [effectiveUserId, ensureDraftOrder, refresh],
  )

  if (loading) return <div className="app-loading">Loading Tealbury catalogue…</div>

  if (products.length === 0) {
    return (
      <div className="page ordering-page tealbury-ordering-page">
        <PageNav backTo="/ordering/start" backLabel="Ordering" />
        <header className="page-header">
          <h1>Tealbury kitchens</h1>
          <p className="muted">
            No Tealbury products are loaded yet. Ask staff to import the Tealbury pricelist under Admin → Tealbury
            pricelist.
          </p>
        </header>
      </div>
    )
  }

  return (
    <div className="page ordering-page tealbury-ordering-page tealbury-ordering-page--workbench">
      <PageNav backTo="/ordering/start" backLabel="Ordering" />

      <header className="page-header ordering-page-header tb-page-header">
        <div>
          <h1>Tealbury product search</h1>
          <p className="page-lead">
            Search the Tealbury catalogue, review specifications and build your order in a staging basket — similar to
            industry quoting tools. Component ordering remains under <Link to="/ordering">Create order</Link>.
          </p>
        </div>
        <div className="ordering-header-actions">
          <Link to="/ordering/cart" className="btn btn-outline">
            View order{lineCount > 0 ? ` (${lineCount})` : ''} →
          </Link>
        </div>
      </header>

      {lineCount > 0 && (
        <Link to="/ordering/cart" className="cart-fab" aria-label={`Open order (${lineCount} lines)`}>
          Order <span className="cart-fab-badge" aria-hidden>{lineCount}</span>
        </Link>
      )}

      <TealburyProductWorkbench
        products={products}
        categories={categories}
        cartLineCount={lineCount}
        onCommitLines={commitLines}
      />
    </div>
  )
}

