import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CatalogProductWorkbench from '@/components/catalog/CatalogProductWorkbench'
import TealburyOrderSetupWizard from '@/components/catalog/TealburyOrderSetupWizard'
import type { CatalogPickerCommitPayload } from '@/components/catalog/CatalogProductPickerModal'
import { useCatalogWorkbenchData } from '@/hooks/useCatalogWorkbenchData'
import { insertStaffOrder } from '@/lib/adminStaffOrderCreate'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { insertAssemblyOrderLines, insertProductOrderLines } from '@/lib/orderLineInsert'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import type { CustomerProfileRow, OrderLinkReason, OrderRow } from '@/types/database'
import { ORDER_LINK_REASONS } from '@/types/database'
import {
  loadTealburyOrderSetup,
  orderNeedsGuidedSetup,
  orderNeedsTealburyKitchenSetup,
  hingeBrandLabel,
  isTealburyCatalogueChoice,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import { carcassFinishLabel } from '@/lib/orderRangeFinish'
import { resolveAssemblyForHingeBrand } from '@/lib/tealburyBomResolve'
import type { AssemblyWithLines } from '@/types/database'

const PARENT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLinkReason(raw: string | null): OrderLinkReason | null {
  if (!raw) return null
  return ORDER_LINK_REASONS.includes(raw as OrderLinkReason) ? (raw as OrderLinkReason) : null
}

export type AdminOrderBuildMode = 'order' | 'quote'

interface AdminOrderBuildPageProps {
  mode: AdminOrderBuildMode
}

export default function AdminOrderBuildPage({ mode }: AdminOrderBuildPageProps) {
  const isQuote = mode === 'quote'
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { staffProfile } = useStaff()

  const preselectedCustomer = searchParams.get('customer') ?? ''
  const parentOrderParam = searchParams.get('parentOrder') ?? ''
  const linkReasonParam = parseLinkReason(searchParams.get('linkReason'))
  const orderIdParam = searchParams.get('orderId') ?? ''

  const [customers, setCustomers] = useState<(CustomerProfileRow & { email?: string })[]>([])
  const [selectedUserId, setSelectedUserId] = useState(preselectedCustomer)
  const [quoteReference, setQuoteReference] = useState('')
  const [parentOrder, setParentOrder] = useState<OrderRow | null>(null)
  const [parentLoadError, setParentLoadError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState('')
  const [lineCount, setLineCount] = useState(0)
  const [orderLinesRefreshToken, setOrderLinesRefreshToken] = useState(0)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null)
  const [tealburySetup, setTealburySetup] = useState<TealburyOrderSetup | null>(null)
  const [tealburySetupOpen, setTealburySetupOpen] = useState(false)

  const parentOrderId = useMemo(() => {
    const t = parentOrderParam.trim()
    return PARENT_UUID.test(t) ? t : ''
  }, [parentOrderParam])

  const buildActive = Boolean(orderId)

  const catalogPrograms = useMemo(() => {
    if (tealburySetup?.catalogue_choice === 'lamtek') return [CATALOG_PROGRAM.LAMTEK]
    if (tealburySetup?.catalogue_choice === 'tealbury') return [CATALOG_PROGRAM.TEALBURY]
    return [CATALOG_PROGRAM.LAMTEK, CATALOG_PROGRAM.TEALBURY]
  }, [tealburySetup?.catalogue_choice])

  const { products, categories, assemblies, loading: catalogLoading } = useCatalogWorkbenchData(
    buildActive ? catalogPrograms : [],
  )

  const orderHref = orderId ? `/admin/orders/${orderId}` : ''
  const preferencesScope = orderId ? `admin_build_${orderId}` : `admin_build_${mode}_new`

  const refreshLineCount = useCallback(async () => {
    if (!orderId) {
      setLineCount(0)
      return
    }
    const { count } = await supabase
      .from('order_lines')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId)
    setLineCount(count ?? 0)
  }, [orderId])

  useEffect(() => {
    async function loadCustomers() {
      const { data: profiles } = await supabase.from('customer_profiles').select('*').order('company_name')
      setCustomers(profiles ?? [])
      if (preselectedCustomer) setSelectedUserId(preselectedCustomer)
    }
    void loadCustomers()
  }, [preselectedCustomer])

  useEffect(() => {
    if (!parentOrderId) {
      setParentOrder(null)
      setParentLoadError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error: qErr } = await supabase.from('orders').select('*').eq('id', parentOrderId).maybeSingle()
      if (cancelled) return
      if (qErr || !data) {
        setParentOrder(null)
        setParentLoadError(qErr?.message ?? 'Parent order not found.')
        return
      }
      setParentLoadError(null)
      setParentOrder(data as OrderRow)
      if (preselectedCustomer && (data as OrderRow).user_id !== preselectedCustomer) {
        setParentLoadError('Parent order belongs to a different customer than the selected account.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [parentOrderId, preselectedCustomer])

  useEffect(() => {
    if (!PARENT_UUID.test(orderIdParam.trim())) return
    let cancelled = false
    ;(async () => {
      const id = orderIdParam.trim()
      const { data, error: qErr } = await supabase
        .from('orders')
        .select('id, user_id, status, reference')
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      if (qErr || !data) return
      const row = data as OrderRow
      const expectedStatus = isQuote ? 'quotation' : 'draft'
      if (row.status !== expectedStatus) return
      setOrderId(row.id)
      setSelectedUserId(row.user_id ?? '')
      if (row.reference) setQuoteReference(row.reference)
    })()
    return () => {
      cancelled = true
    }
  }, [orderIdParam, isQuote])

  useEffect(() => {
    void refreshLineCount()
  }, [refreshLineCount])

  useEffect(() => {
    if (!orderId) {
      setTealburySetup(null)
      return
    }
    let cancelled = false
    void loadTealburyOrderSetup(orderId).then((setup) => {
      if (!cancelled) setTealburySetup(setup)
    })
    return () => {
      cancelled = true
    }
  }, [orderId, orderLinesRefreshToken])

  useEffect(() => {
    if (!lastAddedMessage) return
    const t = window.setTimeout(() => setLastAddedMessage(null), 2800)
    return () => window.clearTimeout(t)
  }, [lastAddedMessage])

  async function startBuild() {
    if (!selectedUserId || !staffProfile) {
      setError('Select a customer and ensure you are logged in as staff.')
      return
    }
    if (parentOrderId && parentLoadError) {
      setError(parentLoadError)
      return
    }
    if (parentOrderId && parentOrder && parentOrder.user_id !== selectedUserId) {
      setError('Selected customer must match the parent order account.')
      return
    }
    setError('')
    setCreating(true)

    const { data: order, error: err } = await insertStaffOrder({
      userId: selectedUserId,
      staffProfileId: staffProfile.id,
      status: isQuote ? 'quotation' : 'draft',
      reference: isQuote ? quoteReference.trim() || null : null,
      parentOrderId: parentOrderId || undefined,
      parentOrder: parentOrderId && parentOrder ? parentOrder : null,
      linkReason: linkReasonParam,
    })

    setCreating(false)
    if (err || !order) {
      setError(err?.message ?? 'Could not create record.')
      return
    }

    const next = new URLSearchParams(searchParams)
    next.set('orderId', order.id)
    setSearchParams(next, { replace: true })
    setOrderId(order.id)
  }

  const commitLines = useCallback(
    async (payload: CatalogPickerCommitPayload) => {
      if (!orderId) return
      const useCustomerPricing = Boolean(selectedUserId)
      if (payload.products.length > 0) {
        await insertProductOrderLines({
          orderId,
          lines: payload.products,
          customerUserId: selectedUserId,
          repriceCustomer: useCustomerPricing,
        })
      }
      for (const line of payload.assemblies) {
        let assembly: AssemblyWithLines = line.assembly
        if (tealburySetup?.hinge_brand) {
          assembly = resolveAssemblyForHingeBrand(assembly, tealburySetup.hinge_brand, products)
        }
        await insertAssemblyOrderLines({
          orderId,
          assembly,
          quantity: line.quantity,
          customerUserId: selectedUserId,
          repriceCustomer: useCustomerPricing,
        })
      }
      await refreshLineCount()
      setOrderLinesRefreshToken((t) => t + 1)
      const added = payload.products.length + payload.assemblies.length
      const label = isQuote ? 'quote' : 'order'
      setLastAddedMessage(
        added === 1 ? `Line saved to ${label}` : `${added} lines saved to ${label}`,
      )
    },
    [isQuote, orderId, refreshLineCount, selectedUserId, tealburySetup?.hinge_brand, products],
  )

  const showGuidedWizard =
    buildActive && (tealburySetupOpen || orderNeedsGuidedSetup(tealburySetup)) && !catalogLoading

  const rangeName = useMemo(() => {
    if (!tealburySetup?.kitchen_range_id) return null
    return categories.find((c) => c.id === tealburySetup.kitchen_range_id)?.name ?? null
  }, [categories, tealburySetup?.kitchen_range_id])

  const customerLabel = useMemo(() => {
    const c = customers.find((x) => x.user_id === selectedUserId)
    if (!c) return 'Customer'
    return [c.company_name, c.contact_name].filter(Boolean).join(' · ')
  }, [customers, selectedUserId])

  const buildBar = (
    <header className="kq-build-bar">
      <div className="kq-build-bar-main">
        <span className="admin-breadcrumb">{isQuote ? 'Create quote' : 'Create order'}</span>
        <h1 className="kq-build-bar-title">
          {buildActive ? (isQuote ? 'Build quote' : 'Build order') : isQuote ? 'New quote' : 'New order'}
        </h1>
        {!buildActive ? (
          <div className="kq-build-bar-form">
            <label className="kq-build-bar-field">
              <span>Customer account</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="admin-select-customer"
              >
                <option value="">— Select customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.user_id}>
                    {c.company_name} {c.contact_name ? `(${c.contact_name})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {isQuote && (
              <label className="kq-build-bar-field">
                <span>Quote reference (optional)</span>
                <input
                  type="text"
                  className="admin-filter-input"
                  value={quoteReference}
                  onChange={(e) => setQuoteReference(e.target.value)}
                  placeholder="e.g. Kitchen ref ABC-12"
                  maxLength={120}
                />
              </label>
            )}
            {error && <p className="admin-error">{error}</p>}
            {parentOrderId && parentOrder && !parentLoadError && (
              <p className="admin-muted kq-build-bar-note">
                Linked to{' '}
                <Link to={`/admin/orders/${parentOrderId}`}>
                  {parentOrder.reference?.trim() || parentOrderId.slice(0, 8)}
                </Link>
                {linkReasonParam ? ` · ${linkReasonParam}` : ''}.
              </p>
            )}
            {parentOrderId && parentLoadError && (
              <p className="admin-error">{parentLoadError}</p>
            )}
          </div>
        ) : (
          <p className="kq-build-bar-lead">
            <strong>{customerLabel}</strong>
            {isQuote && quoteReference.trim() && (
              <span className="admin-muted"> · Ref: {quoteReference.trim()}</span>
            )}
          </p>
        )}
      </div>
      <div className="kq-build-bar-actions">
        {!buildActive ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => void startBuild()}
              disabled={!selectedUserId || creating || (!!parentOrderId && !!parentLoadError)}
            >
              {creating ? 'Starting…' : 'Open product search'}
            </button>
            <Link to={isQuote ? '/admin/create-order' : '/admin/create-quote'} className="btn btn-outline">
              {isQuote ? 'Create order instead' : 'Create quote instead'}
            </Link>
          </>
        ) : (
          <>
            {lastAddedMessage && (
              <p className="ordering-toast admin-order-build-toast" role="status">
                {lastAddedMessage}
              </p>
            )}
            {orderHref && (
              <>
                <Link to={orderHref} className="btn btn-outline btn-small">
                  {isQuote ? 'Quote detail' : 'Order detail'}
                  {lineCount > 0 ? ` (${lineCount})` : ''} →
                </Link>
                <button type="button" className="btn btn-small" onClick={() => navigate(orderHref)}>
                  Finish &amp; review
                </button>
              </>
            )}
          </>
        )}
      </div>
    </header>
  )

  return (
    <div className={`admin-page admin-order-build-page admin-order-build-page--${mode} kq-build-shell kq-build-shell--full`}>
      {buildActive && (
        <>
          {tealburySetup &&
            isTealburyCatalogueChoice(tealburySetup.catalogue_choice) &&
            !orderNeedsTealburyKitchenSetup(tealburySetup) &&
            !showGuidedWizard && (
              <div className="kq-build-context kq-build-context--inline">
                <div className="kq-build-context-chips">
                  <span className="kq-build-chip">Tealbury Complete</span>
                  <span className="kq-build-chip">
                    {tealburySetup.build_style === 'flat_pack' ? 'Flat pack' : 'Rigid'}
                  </span>
                  <span className="kq-build-chip">{rangeName ?? 'Range'}</span>
                  <span className="kq-build-chip">{tealburySetup.door_finish}</span>
                  <span className="kq-build-chip">{carcassFinishLabel(tealburySetup.carcass_finish)}</span>
                  <span className="kq-build-chip">
                    {tealburySetup.line_style_preference?.replace('_', ' ') ?? '—'}
                  </span>
                  <span className="kq-build-chip">{hingeBrandLabel(tealburySetup.hinge_brand) ?? '—'}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => setTealburySetupOpen(true)}
                >
                  Change setup
                </button>
              </div>
            )}
          {tealburySetup?.catalogue_choice === 'lamtek' && !showGuidedWizard && (
            <div className="kq-build-context kq-build-context--inline">
              <span className="kq-build-chip">Lamtek components</span>
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => setTealburySetupOpen(true)}
              >
                Change catalogue
              </button>
            </div>
          )}
        </>
      )}

      {!buildActive && buildBar}

      {buildActive && catalogLoading && products.length === 0 ? (
        <div className="kq-build-workspace">
          {buildBar}
          <div className="admin-loading-state" style={{ minHeight: '14rem' }}>
            <div className="admin-loading-spinner" aria-hidden />
            <p>Loading catalogues…</p>
          </div>
        </div>
      ) : buildActive && showGuidedWizard ? (
        <div className="kq-build-workspace">
          {buildBar}
          <TealburyOrderSetupWizard
            orderId={orderId}
            isQuote={isQuote}
            categories={categories}
            products={products}
            initial={tealburySetup}
            onComplete={(setup) => {
              setTealburySetup(setup)
              setTealburySetupOpen(false)
            }}
          />
        </div>
      ) : buildActive ? (
        <CatalogProductWorkbench
          embedded
          products={products}
          categories={categories}
          assemblies={assemblies}
          allowedCatalogPrograms={catalogPrograms}
          showCatalogueSwitcher={catalogPrograms.length > 1}
          customerUserId={selectedUserId}
          preferencesScope={preferencesScope}
          orderId={orderId}
          orderLinesRefreshToken={orderLinesRefreshToken}
          cartLineCount={lineCount}
          cartHref={orderHref}
          commitLabel={isQuote ? 'Add to quote' : 'Add to order'}
          linePersistence="immediate"
          addButtonLabel={isQuote ? 'Add to quote' : 'Add to order'}
          tealburySetup={
            tealburySetup && !orderNeedsGuidedSetup(tealburySetup) ? tealburySetup : null
          }
          buildBar={buildBar}
          onCommit={commitLines}
        />
      ) : null}
    </div>
  )
}
