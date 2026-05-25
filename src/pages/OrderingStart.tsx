import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, LayoutGrid, ListChecks } from 'lucide-react'
import { PageNav } from '@/components/PageNav'
import TealburyOrderSetupWizard from '@/components/catalog/TealburyOrderSetupWizard'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { productMatchesBrowseFilter } from '@/lib/categoryTaxonomy'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import {
  loadTealburyOrderSetup,
  orderNeedsTealburySetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import type { CategoryRow, ProductRow } from '@/types/database'

/**
 * Customer order-start: full Tealbury kitchen setup (flat/rigid, range, finishes, hinge brand, carcass)
 * then routes to the Tealbury or Lamtek workbench.
 */
export default function OrderingStart() {
  const navigate = useNavigate()
  const { draftOrder, ensureDraftOrder } = useDraftOrder()

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [setup, setSetup] = useState<TealburyOrderSetup | null>(null)
  const [showWizard, setShowWizard] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order').order('name'),
        supabase.from('products').select('*').eq('active', true),
      ])
      if (cancelled) return
      setCategories((catRes.data ?? []) as CategoryRow[])
      setProducts((prodRes.data ?? []) as ProductRow[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = await ensureDraftOrder()
      if (cancelled) return
      setOrderId(id)
      const saved = await loadTealburyOrderSetup(id)
      if (cancelled) return
      setSetup(saved)
      setShowWizard(orderNeedsTealburySetup(saved))
    })()
    return () => {
      cancelled = true
    }
  }, [ensureDraftOrder, draftOrder?.id])

  function navigateAfterSetup(complete: TealburyOrderSetup) {
    const params = new URLSearchParams()
    if (complete.kitchen_range_id) params.set('range', complete.kitchen_range_id)
    const inRange = complete.kitchen_range_id
      ? products.filter((p) =>
          productMatchesBrowseFilter(p, categories, 'range', complete.kitchen_range_id!),
        )
      : []
    const isTealbury =
      inRange.length > 0 && inRange.every((p) => p.catalog_program === CATALOG_PROGRAM.TEALBURY)
    navigate(`${isTealbury ? '/ordering/tealbury' : '/ordering'}?${params.toString()}`)
  }

  if (loading || !orderId) {
    return (
      <div className="ordering-wizard">
        <PageNav backTo="/" backLabel="Dashboard" />
        <p className="ordering-wizard-loading">Loading…</p>
      </div>
    )
  }

  return (
    <div className="ordering-wizard">
      <PageNav backTo="/" backLabel="Dashboard" />

      {showWizard ? (
        <div className="kq-wizard-page">
          <TealburyOrderSetupWizard
            orderId={orderId}
            isQuote={false}
            categories={categories}
            products={products}
            initial={setup}
            variant="customer"
            onComplete={(complete) => {
              setSetup(complete)
              setShowWizard(false)
              navigateAfterSetup(complete)
            }}
          />
        </div>
      ) : (
        <>
          <p className="ordering-wizard-intro">
            Kitchen setup is saved. Continue to the catalogue or change your choices.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-small"
            style={{ marginBottom: '1rem' }}
            onClick={() => setShowWizard(true)}
          >
            Change kitchen setup
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setup && navigateAfterSetup(setup)}
          >
            Continue to product search
          </button>
        </>
      )}

      <section className="ordering-wizard-alt" style={{ marginTop: '2rem' }}>
        <h2 className="ordering-wizard-alt-title">Other ways to order</h2>
        <div className="ordering-wizard-cards">
          <Link to="/ordering" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <ListChecks size={26} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Lamtek component search</span>
            <span className="ordering-wizard-card-desc">Individual parts without the kitchen wizard.</span>
          </Link>
          <Link to="/ordering/tealbury" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <LayoutGrid size={26} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Tealbury product search</span>
            <span className="ordering-wizard-card-desc">Skip setup if already configured on this order.</span>
          </Link>
          <Link to="/ordering?flow=guided" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <Compass size={26} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Guided checklist</span>
            <span className="ordering-wizard-card-desc">Step-by-step checklist for mixed orders.</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
