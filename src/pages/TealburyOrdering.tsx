import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import CatalogProductWorkbench from '@/components/catalog/CatalogProductWorkbench'
import TealburyOrderSetupWizard from '@/components/catalog/TealburyOrderSetupWizard'
import { useCatalogWorkbenchData } from '@/hooks/useCatalogWorkbenchData'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { insertAssemblyOrderLines, insertProductOrderLines } from '@/lib/orderLineInsert'
import { resolveAssemblyForHingeBrand } from '@/lib/tealburyBomResolve'
import {
  loadTealburyOrderSetup,
  orderNeedsGuidedSetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import { supabase } from '@/lib/supabase'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import type { AssemblyWithLines } from '@/types/database'

export default function TealburyOrdering() {
  const { draftOrder, ensureDraftOrder, refresh } = useDraftOrder()
  const effectiveUserId = useEffectiveUserId()
  const { products, categories, assemblies, loading } = useCatalogWorkbenchData([CATALOG_PROGRAM.TEALBURY])
  const [lineCount, setLineCount] = useState(0)
  const [orderLinesRefreshToken, setOrderLinesRefreshToken] = useState(0)
  const [tealburySetup, setTealburySetup] = useState<TealburyOrderSetup | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  useEffect(() => {
    if (!draftOrder?.id) return
    let cancelled = false
    void loadTealburyOrderSetup(draftOrder.id).then((s) => {
      if (!cancelled) {
        setTealburySetup(s)
        setSetupOpen(orderNeedsGuidedSetup(s))
      }
    })
    return () => {
      cancelled = true
    }
  }, [draftOrder?.id])

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
  }, [draftOrder?.id, orderLinesRefreshToken])

  const commitPicker = useCallback(
    async (payload: CatalogPickerCommitPayload) => {
      const orderId = await ensureDraftOrder()
      const setup = await loadTealburyOrderSetup(orderId)
      await insertProductOrderLines({
        orderId,
        lines: payload.products,
        customerUserId: effectiveUserId,
      })
      for (const line of payload.assemblies) {
        let assembly: AssemblyWithLines = line.assembly
        if (setup?.hinge_brand) {
          assembly = resolveAssemblyForHingeBrand(assembly, setup.hinge_brand, products)
        }
        await insertAssemblyOrderLines({
          orderId,
          assembly,
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
    [effectiveUserId, ensureDraftOrder, products, refresh],
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

  const orderId = draftOrder?.id

  if (orderId && setupOpen) {
    return (
      <div className="page ordering-page tealbury-ordering-page kq-wizard-page">
        <PageNav backTo="/ordering/start" backLabel="Ordering" />
        <TealburyOrderSetupWizard
          orderId={orderId}
          isQuote={false}
          categories={categories}
          products={products}
          initial={tealburySetup}
          variant="customer"
          onComplete={(complete) => {
            setTealburySetup(complete)
            setSetupOpen(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="page ordering-page tealbury-ordering-page tealbury-ordering-page--workbench">
      <PageNav backTo="/ordering/start" backLabel="Ordering" />
      <header className="kq-build-hero ordering-page-header">
        <div>
          <h1>Tealbury product search</h1>
          <p>
            Browse complete units and accessories for your configured kitchen. Component-only ordering is on{' '}
            <Link to="/ordering">Lamtek create order</Link>.
          </p>
        </div>
        <div className="ordering-header-actions">
          {orderId && (
            <button type="button" className="btn btn-outline btn-small" onClick={() => setSetupOpen(true)}>
              Change kitchen setup
            </button>
          )}
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
        assemblies={assemblies}
        allowedCatalogPrograms={[CATALOG_PROGRAM.TEALBURY]}
        customerUserId={effectiveUserId}
        preferencesScope="ordering_tealbury"
        orderId={orderId ?? null}
        orderLinesRefreshToken={orderLinesRefreshToken}
        cartLineCount={lineCount}
        cartHref="/ordering/cart"
        commitLabel="Add to order"
        linePersistence="immediate"
        addButtonLabel="Add to order"
        tealburySetup={tealburySetup}
        onCommit={commitPicker}
      />
    </div>
  )
}
