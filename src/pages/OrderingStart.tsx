import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  LayoutGrid,
  ListChecks,
  PaintBucket,
  Palette,
} from 'lucide-react'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import {
  buildCategoryTreeOptions,
  productMatchesBrowseFilter,
} from '@/lib/categoryTaxonomy'
import { getProductFinishLabels } from '@/lib/catalogProductDisplay'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import {
  CARCASS_FINISH_OPTIONS,
  saveOrderRangeFinish,
} from '@/lib/orderRangeFinish'
import type { CategoryRow, ProductRow } from '@/types/database'

type WizardStep = 'range' | 'door-finish' | 'carcass-finish'

/**
 * Order-start wizard.
 *
 * Walks the user through three forced choices before they ever see the
 * workbench:
 *
 *   1. Range (a `categories` row with category_kind='door_range')
 *   2. Door / range finish (a key extracted from products' finish-price maps)
 *   3. Carcass / cabinet finish (small enum, free-text in DB for flexibility)
 *
 * Each choice is saved onto the draft order's new columns (kitchen_range_id,
 * door_finish, carcass_finish) and persists across sessions. After step 3 the
 * user lands on the Lamtek workbench (`/ordering?range=<id>`) which already
 * accepts a starting range via the URL.
 *
 * A "Skip wizard" shortcut at the bottom routes to the legacy direct-search
 * flow (Lamtek search, Tealbury search, or the older free-form guided flow)
 * for power users who already know what they want.
 */
export default function OrderingStart() {
  const navigate = useNavigate()
  const { draftOrder, ensureDraftOrder } = useDraftOrder()

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<WizardStep>('range')
  const [rangeId, setRangeId] = useState<string | null>(null)
  const [doorFinish, setDoorFinish] = useState<string | null>(null)
  const [carcassFinish, setCarcassFinish] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate from the current draft so the wizard reflects what was previously chosen.
  useEffect(() => {
    if (!draftOrder) return
    if (draftOrder.kitchen_range_id) setRangeId(draftOrder.kitchen_range_id)
    if (draftOrder.door_finish) setDoorFinish(draftOrder.door_finish)
    if (draftOrder.carcass_finish) setCarcassFinish(draftOrder.carcass_finish)
  }, [draftOrder])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order').order('name'),
        // Pull a wide product set: both programmes, only active items. We need this for finish
        // extraction at step 2 and for the per-range product counts shown on step 1.
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

  const rangeOptions = useMemo(
    () =>
      buildCategoryTreeOptions(categories, 'range').filter((o) => o.kind === 'door_range'),
    [categories],
  )

  const rangeProductCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const opt of rangeOptions) {
      const n = products.filter((p) =>
        productMatchesBrowseFilter(p, categories, 'range', opt.id),
      ).length
      map.set(opt.id, n)
    }
    return map
  }, [rangeOptions, products, categories])

  const selectedRange = useMemo(
    () => categories.find((c) => c.id === rangeId) ?? null,
    [categories, rangeId],
  )

  /**
   * Products inside the chosen range — used to discover which door finishes
   * actually exist for it (we don't want to offer "Soft Matte" if no Dawson
   * product is priced for Soft Matte).
   */
  const productsInRange = useMemo(() => {
    if (!rangeId) return []
    return products.filter((p) =>
      productMatchesBrowseFilter(p, categories, 'range', rangeId),
    )
  }, [products, categories, rangeId])

  const doorFinishOptions = useMemo(() => {
    if (!rangeId) return [] as string[]
    return getProductFinishLabels(productsInRange)
  }, [rangeId, productsInRange])

  function goToStep(next: WizardStep) {
    setStep(next)
    setError(null)
  }

  function handlePickRange(id: string) {
    setRangeId(id)
    // If the previously-chosen door finish is no longer offered by the new range, clear it.
    if (doorFinish) {
      const list = getProductFinishLabels(
        products.filter((p) => productMatchesBrowseFilter(p, categories, 'range', id)),
      )
      if (!list.includes(doorFinish)) setDoorFinish(null)
    }
    goToStep('door-finish')
  }

  function handlePickDoorFinish(finish: string) {
    setDoorFinish(finish)
    goToStep('carcass-finish')
  }

  async function handleFinishWizard(finalCarcass: string) {
    if (!rangeId) {
      setError('Pick a kitchen range first.')
      goToStep('range')
      return
    }
    if (!doorFinish) {
      setError('Pick a door/range finish first.')
      goToStep('door-finish')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const orderId = await ensureDraftOrder()
      const { error: saveErr } = await saveOrderRangeFinish(orderId, {
        kitchen_range_id: rangeId,
        door_finish: doorFinish,
        carcass_finish: finalCarcass,
      })
      if (saveErr) {
        setError(`Could not save your selection: ${saveErr}`)
        setSubmitting(false)
        return
      }
      // Tealbury-tagged ranges (no `category_kind` because Tealbury imports go via JSON)
      // route to the Tealbury workbench so the user lands on a programme-appropriate view.
      // Everything else lands on the standard Lamtek workbench with `range` URL param so
      // CatalogProductWorkbench preselects the right filter.
      const params = new URLSearchParams({ range: rangeId })
      const isTealbury =
        productsInRange.length > 0 &&
        productsInRange.every((p) => p.catalog_program === CATALOG_PROGRAM.TEALBURY)
      navigate(`${isTealbury ? '/ordering/tealbury' : '/ordering'}?${params.toString()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your order.')
      setSubmitting(false)
    }
  }

  return (
    <div className="ordering-wizard">
      <PageNav backTo="/" backLabel="Dashboard" />
      <div className="ordering-wizard-header">
        <h1>New order — choose your kitchen</h1>
        <p className="ordering-wizard-intro">
          Tell us the door range, range finish and carcass finish first — the product workbench
          will then only show items that match. You can change any of these later from the cart.
        </p>
      </div>

      <div className="ordering-wizard-steps">
        <div
          className={`ordering-wizard-step-indicator ${step === 'range' ? 'active' : ''} ${
            rangeId ? 'done' : ''
          }`}
        >
          <span className="ordering-wizard-step-num">1</span>
          <span className="ordering-wizard-step-label">Door range</span>
        </div>
        <div
          className={`ordering-wizard-step-indicator ${step === 'door-finish' ? 'active' : ''} ${
            doorFinish ? 'done' : ''
          }`}
        >
          <span className="ordering-wizard-step-num">2</span>
          <span className="ordering-wizard-step-label">Door finish</span>
        </div>
        <div
          className={`ordering-wizard-step-indicator ${step === 'carcass-finish' ? 'active' : ''} ${
            carcassFinish ? 'done' : ''
          }`}
        >
          <span className="ordering-wizard-step-num">3</span>
          <span className="ordering-wizard-step-label">Carcass finish</span>
        </div>
      </div>

      {/* Breadcrumb of choices so the user can see what they've picked so far. */}
      <p className="ordering-wizard-context">
        {selectedRange ? <strong>Range:</strong> : null} {selectedRange?.name ?? '—'}
        {' · '}
        <strong>Door finish:</strong> {doorFinish ?? '—'}
        {' · '}
        <strong>Carcass:</strong>{' '}
        {carcassFinish
          ? CARCASS_FINISH_OPTIONS.find((o) => o.value === carcassFinish)?.label ?? carcassFinish
          : '—'}
      </p>

      {loading ? (
        <p className="ordering-wizard-loading">Loading kitchen ranges…</p>
      ) : step === 'range' ? (
        <>
          {rangeOptions.length === 0 ? (
            <p className="admin-muted">
              No door ranges configured yet. An admin needs to mark categories as kitchen ranges in{' '}
              <Link to="/admin/catalogue">Admin → Catalogue</Link>.
            </p>
          ) : (
            <div className="ordering-wizard-cards ordering-wizard-cards--range">
              {rangeOptions.map((opt) => {
                const count = rangeProductCounts.get(opt.id) ?? 0
                const selected = rangeId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ordering-wizard-card${selected ? ' ordering-wizard-card--selected' : ''}`}
                    onClick={() => handlePickRange(opt.id)}
                  >
                    <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
                      <LayoutGrid size={26} strokeWidth={1.85} />
                    </span>
                    <span className="ordering-wizard-card-title">{opt.label}</span>
                    <span className="ordering-wizard-card-desc">
                      {count} {count === 1 ? 'product' : 'products'} in this range
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : step === 'door-finish' ? (
        <>
          <button
            type="button"
            className="ordering-wizard-back"
            onClick={() => goToStep('range')}
          >
            <ArrowLeft size={14} /> Change range
          </button>
          {doorFinishOptions.length === 0 ? (
            <p className="admin-muted">
              No finishes are recorded for products in <strong>{selectedRange?.name}</strong>. You
              can still continue — pick a carcass finish next and we'll save the range without a
              specific door finish.
              <br />
              <button
                type="button"
                className="btn btn-outline ordering-wizard-skip"
                onClick={() => {
                  setDoorFinish('— none recorded —')
                  goToStep('carcass-finish')
                }}
              >
                Continue without door finish
              </button>
            </p>
          ) : (
            <div className="ordering-wizard-cards ordering-wizard-cards--range">
              {doorFinishOptions.map((finish) => {
                const selected = doorFinish === finish
                return (
                  <button
                    key={finish}
                    type="button"
                    className={`ordering-wizard-card${selected ? ' ordering-wizard-card--selected' : ''}`}
                    onClick={() => handlePickDoorFinish(finish)}
                  >
                    <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
                      <Palette size={26} strokeWidth={1.85} />
                    </span>
                    <span className="ordering-wizard-card-title">{finish}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="ordering-wizard-back"
            onClick={() => goToStep('door-finish')}
          >
            <ArrowLeft size={14} /> Change door finish
          </button>
          <div className="ordering-wizard-cards ordering-wizard-cards--range">
            {CARCASS_FINISH_OPTIONS.map((opt) => {
              const selected = carcassFinish === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`ordering-wizard-card${selected ? ' ordering-wizard-card--selected' : ''}`}
                  disabled={submitting}
                  onClick={() => {
                    setCarcassFinish(opt.value)
                    void handleFinishWizard(opt.value)
                  }}
                >
                  <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
                    <PaintBucket size={26} strokeWidth={1.85} />
                  </span>
                  <span className="ordering-wizard-card-title">{opt.label}</span>
                </button>
              )
            })}
          </div>
          {submitting && (
            <p className="ordering-wizard-loading">Saving your selection and opening the workbench…</p>
          )}
        </>
      )}

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <div className="ordering-wizard-footer">
        <p className="admin-muted">
          Already know exactly which SKUs you need? Skip the wizard and go straight to one of the
          search-based flows:
        </p>
        <div className="ordering-wizard-cards ordering-wizard-cards--range">
          <Link to="/ordering" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <Compass size={22} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Lamtek product search</span>
            <span className="ordering-wizard-card-desc">
              Full catalogue search with the classic filters.
            </span>
          </Link>
          <Link to="/ordering/tealbury" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <LayoutGrid size={22} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Tealbury product search</span>
            <span className="ordering-wizard-card-desc">
              Packaged Tealbury kitchen lines, separate pricelist.
            </span>
          </Link>
          <Link to="/ordering?flow=guided" className="ordering-wizard-card ordering-wizard-card--link">
            <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
              <ListChecks size={22} strokeWidth={1.85} />
            </span>
            <span className="ordering-wizard-card-title">Old guided flow</span>
            <span className="ordering-wizard-card-desc">
              The previous order-type / range / mode / project wizard. Kept temporarily.
            </span>
          </Link>
        </div>
        <ChevronRight size={0} aria-hidden style={{ display: 'none' }} />
      </div>
    </div>
  )
}
