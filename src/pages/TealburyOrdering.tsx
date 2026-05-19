import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import CatalogProductWorkbench from '@/components/catalog/CatalogProductWorkbench'
import { useCatalogWorkbenchData } from '@/hooks/useCatalogWorkbenchData'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { insertAssemblyOrderLines, insertProductOrderLines } from '@/lib/orderLineInsert'
import { supabase } from '@/lib/supabase'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'

export default function TealburyOrdering() {
  const { draftOrder, ensureDraftOrder, refresh } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const { products, categories, loading } = useCatalogWorkbenchData([CATALOG_PROGRAM.TEALBURY])
  const [lineCount, setLineCount] = useState(0)
  const [orderLinesRefreshToken, setOrderLinesRefreshToken] = useState(0)

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

  const commitPicker = useCallback(
    async (payload: CatalogPickerCommitPayload) => {
      const orderId = await ensureDraftOrder()
      await insertProductOrderLines({
        orderId,
        lines: payload.products,
        customerUserId: effectiveUserId,
      })
      for (const line of payload.assemblies) {
        await insertAssemblyOrderLines({
          orderId,
          assembly: line.assembly,
          quantity: line.quantity,
          customerUserId: effectiveUserId,
        })
      }
      await refresh()
      const { count } = await supabase
        .from('order_lines')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId)
      setLineCount(count ?? 0)
      setOrderLinesRefreshToken((t) => t + 1)
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
            Industry-style catalogue search for Tealbury packaged kitchens. Component ordering is under{' '}
            <Link to="/ordering">Lamtek create order</Link>.
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

      <CatalogProductWorkbench
        products={products}
        categories={categories}
        allowedCatalogPrograms={[CATALOG_PROGRAM.TEALBURY]}
        customerUserId={effectiveUserId}
        preferencesScope="ordering_tealbury"
        orderId={draftOrder?.id ?? null}
        orderLinesRefreshToken={orderLinesRefreshToken}
        cartLineCount={lineCount}
        cartHref="/ordering/cart"
        commitLabel="Add to order"
        linePersistence="immediate"
        addButtonLabel="Add to order"
        onCommit={commitPicker}
      />
    </div>
  )
}
