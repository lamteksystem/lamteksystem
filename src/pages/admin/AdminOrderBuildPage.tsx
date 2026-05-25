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
  orderNeedsTealburySetup,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import { carcassFinishLabel } from '@/lib/orderRangeFinish'

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

  const catalogPrograms = useMemo(
    () => [CATALOG_PROGRAM.LAMTEK, CATALOG_PROGRAM.TEALBURY],
    [],
  )
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
        await insertAssemblyOrderLines({
          orderId,
          assembly: line.assembly,
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
    [isQuote, orderId, refreshLineCount, selectedUserId],
  )

  const showTealburyWizard =
    buildActive &&
    (tealburySetupOpen || orderNeedsTealburySetup(tealburySetup)) &&
    !catalogLoading

  const rangeName = useMemo(() => {
    if (!tealburySetup?.kitchen_range_id) return null
    return categories.find((c) => c.id === tealburySetup.kitchen_range_id)?.name ?? null
  }, [categories, tealburySetup?.kitchen_range_id])

  const customerLabel = useMemo(() => {
    const c = customers.find((x) => x.user_id === selectedUserId)
    if (!c) return 'Customer'
    return [c.company_name, c.contact_name].filter(Boolean).join(' · ')
  }, [customers, selectedUserId])

  return (
    <div className={`admin-page admin-order-build-page admin-order-build-page--${mode}`}>
      <div className="admin-page-header admin-order-build-header">
        <span className="admin-breadcrumb">{isQuote ? 'Create quote' : 'Create order'}</span>
        {buildActive && orderHref && (
          <div className="admin-order-build-header-actions">
            <Link to={orderHref} className="btn btn-outline btn-small">
              {isQuote ? 'Quote detail' : 'Order detail'}
              {lineCount > 0 ? ` (${lineCount})` : ''} →
            </Link>
            <button type="button" className="btn btn-small" onClick={() => navigate(orderHref)}>
              Finish &amp; review
            </button>
          </div>
        )}
      </div>

      {!buildActive && (
        <>
          <p className="page-intro">
            {isQuote
              ? 'Choose the customer, then add products with the standard catalogue workbench — same flow as customer ordering and TruBlue-style quoting.'
              : 'Choose the customer, then search Lamtek and Tealbury catalogues and add lines straight onto the draft order.'}
          </p>

          {parentOrderId && parentOrder && !parentLoadError && (
            <div className="card admin-card admin-create-quote-linked" style={{ marginBottom: '1rem' }}>
              <p style={{ margin: 0 }}>
                <strong>{isQuote ? 'Linked quote' : 'Follow-up order'}</strong> — related to{' '}
                <Link to={`/admin/orders/${parentOrderId}`}>
                  {parentOrder.reference?.trim() || parentOrderId.slice(0, 8)}
                </Link>
                {linkReasonParam ? ` · ${linkReasonParam}` : ''}.
              </p>
            </div>
          )}
          {parentOrderId && parentLoadError && (
            <div className="card admin-card" style={{ marginBottom: '1rem' }}>
              <p className="admin-error" style={{ margin: 0 }}>{parentLoadError}</p>
            </div>
          )}

          <div className="card admin-card admin-create-order-card">
            <h2 style={{ marginTop: 0 }}>{isQuote ? 'Quote for which customer?' : 'Who is this order for?'}</h2>
            <label className="admin-create-order-label">
              <span className="admin-settings-label">Customer account</span>
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
              <label className="admin-create-order-label" style={{ marginTop: '1rem' }}>
                <span className="admin-settings-label">Quote reference (optional)</span>
                <input
                  type="text"
                  className="admin-filter-input"
                  value={quoteReference}
                  onChange={(e) => setQuoteReference(e.target.value)}
                  placeholder="e.g. Kitchen ref ABC-12, March 2026"
                  maxLength={120}
                />
              </label>
            )}
            {customers.length === 0 && (
              <p className="admin-muted">No customer profiles found. Add customers before continuing.</p>
            )}
            {error && <p className="admin-error">{error}</p>}
            <div className="admin-order-build-start-actions" style={{ marginTop: '1.25rem' }}>
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
            </div>
          </div>
        </>
      )}

      {buildActive && (
        <>
          <div className="admin-order-build-context card admin-card">
            <div className="admin-order-build-context-main">
              <strong>{customerLabel}</strong>
              {isQuote && quoteReference.trim() && (
                <span className="admin-muted"> · Ref: {quoteReference.trim()}</span>
              )}
              <p className="admin-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                Lines save to this {isQuote ? 'quote' : 'draft order'} as you add them. Use the pane controls to
                collapse filters or hide product details.
              </p>
            </div>
            {lastAddedMessage && (
              <p className="ordering-toast admin-order-build-toast" role="status">
                {lastAddedMessage}
              </p>
            )}
          </div>

          {catalogLoading && products.length === 0 ? (
            <div className="admin-loading-state" style={{ minHeight: '14rem' }}>
              <div className="admin-loading-spinner" aria-hidden />
              <p>Loading catalogues…</p>
            </div>
          ) : showTealburyWizard ? (
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
          ) : (
            <>
              {tealburySetup && !orderNeedsTealburySetup(tealburySetup) && (
                <div className="card admin-card admin-order-build-tealbury-summary" style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: 0 }}>
                    <strong>Tealbury setup:</strong>{' '}
                    {tealburySetup.build_style === 'flat_pack' ? 'Flat pack' : 'Rigid'} ·{' '}
                    {rangeName ?? 'Range'} · {tealburySetup.door_finish} ·{' '}
                    {carcassFinishLabel(tealburySetup.carcass_finish)} carcass ·{' '}
                    {tealburySetup.line_style_preference?.replace('_', ' ')}
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      style={{ marginLeft: '0.75rem' }}
                      onClick={() => setTealburySetupOpen(true)}
                    >
                      Change setup
                    </button>
                  </p>
                </div>
              )}
              <CatalogProductWorkbench
                embedded
                products={products}
                categories={categories}
                assemblies={assemblies}
                allowedCatalogPrograms={catalogPrograms}
                showCatalogueSwitcher
                customerUserId={selectedUserId}
                preferencesScope={preferencesScope}
                orderId={orderId}
                orderLinesRefreshToken={orderLinesRefreshToken}
                cartLineCount={lineCount}
                cartHref={orderHref}
                commitLabel={isQuote ? 'Add to quote' : 'Add to order'}
                linePersistence="immediate"
                addButtonLabel={isQuote ? 'Add to quote' : 'Add to order'}
                tealburySetup={orderNeedsTealburySetup(tealburySetup) ? null : tealburySetup}
                onCommit={commitLines}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
