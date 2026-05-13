import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { getDocumentUrls } from '@/lib/documents'
import ProductDetailModal from '@/components/ProductDetailModal'
import type { CategoryRow, DocumentRow, OrderRow, ProductRow, TicketRow } from '@/types/database'
import { PageNav } from '@/components/PageNav'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'
import { getProductAvailabilityMeta } from '@/lib/productAvailability'

type Scope = 'all' | 'products' | 'orders' | 'downloads' | 'support'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeLikeInput(s: string): string {
  // `ilike` patterns treat `%` and `_` as wildcards. For user input we strip them.
  return s.replace(/[%_]/g, '').trim()
}

function getOptionsSearchString(options: Record<string, unknown> | null): string {
  if (!options || typeof options !== 'object') return ''
  return Object.values(options)
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).toLowerCase())
    .join(' ')
}

function formatMoney(v: number): string {
  if (Number.isNaN(v)) return '£0.00'
  return `£${Number(v).toFixed(2)}`
}

function highlightText(text: string, term: string) {
  const t = term.trim()
  if (!t) return text
  const safe = escapeRegex(t)
  const re = new RegExp(`(${safe})`, 'ig')
  const parts = text.split(re)
  return parts.map((p, idx) => {
    if (idx % 2 === 1) return <mark key={idx} className="global-search-mark">{p}</mark>
    return <span key={idx}>{p}</span>
  })
}

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const effectiveUserId = useEffectiveUserId()

  const qRaw = searchParams.get('q') ?? ''
  const q = qRaw.trim()
  const scopeParam = searchParams.get('scope') ?? 'all'
  const scope = scopeParam as Scope

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [downloads, setDownloads] = useState<DocumentRow[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})

  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)

  const tokens = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q])
  const serverToken = tokens[0] ?? ''
  const highlightTerm = tokens[0] ?? ''

  const tabs: { value: Scope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'products', label: 'Products' },
    { value: 'orders', label: 'Orders' },
    { value: 'downloads', label: 'Downloads' },
    { value: 'support', label: 'Support' },
  ]

  const productsScored = useMemo(() => {
    const qLower = q.toLowerCase()
    return [...products]
      .map((p) => {
        const name = (p.name ?? '').toLowerCase()
        const sku = (p.sku ?? '').toLowerCase()
        const desc = (p.description ?? '').toLowerCase()
        const opts = getOptionsSearchString(p.options as Record<string, unknown> | null)
        const haystack = [name, sku, desc, opts].join(' ')

        let score = 0
        if (tokens.length > 0) {
          const tokenHits = tokens.filter((t) => haystack.includes(t)).length
          score += (tokenHits / tokens.length) * 70
        }
        if (qLower && name === qLower) score += 20
        if (qLower && sku === qLower) score += 30
        if (name.startsWith(tokens[0] ?? '')) score += 10
        if (sku && sku.includes(tokens[0] ?? '')) score += 8
        return { p, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
  }, [products, q, tokens])

  const ordersScored = useMemo(() => {
    const qLower = q.toLowerCase()
    return [...orders]
      .map((o) => {
        const ref = (o.reference ?? '').toLowerCase()
        const haystack = `${ref} ${o.status}`.toLowerCase()
        let score = 0
        if (tokens.length > 0) {
          const tokenHits = tokens.filter((t) => haystack.includes(t)).length
          score += (tokenHits / tokens.length) * 70
        }
        if (qLower && ref === qLower) score += 30
        if (qLower && ref.startsWith(qLower)) score += 15
        return { o, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o)
  }, [orders, q, tokens])

  const downloadsScored = useMemo(() => {
    return [...downloads]
      .map((d) => {
        const title = (d.title ?? '').toLowerCase()
        const desc = (d.description ?? '').toLowerCase()
        const haystack = `${title} ${desc}`.toLowerCase()
        let score = 0
        if (tokens.length > 0) {
          const tokenHits = tokens.filter((t) => haystack.includes(t)).length
          score += (tokenHits / tokens.length) * 70
        }
        if (title.startsWith(serverToken)) score += 15
        if (title === q.toLowerCase() && q) score += 25
        return { d, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.d)
  }, [downloads, serverToken, tokens, q])

  const ticketsScored = useMemo(() => {
    return [...tickets]
      .map((t) => {
        const subject = (t.subject ?? '').toLowerCase()
        const body = (t.body ?? '').toLowerCase()
        const haystack = `${subject} ${body} ${t.type} ${t.status}`.toLowerCase()
        let score = 0
        if (tokens.length > 0) {
          const tokenHits = tokens.filter((tok) => haystack.includes(tok)).length
          score += (tokenHits / tokens.length) * 70
        }
        if (subject === q.toLowerCase() && q) score += 25
        if (subject.startsWith(serverToken)) score += 15
        return { t, score }
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.t)
  }, [tickets, q, serverToken, tokens])

  useEffect(() => {
    if (!q) {
      setProducts([])
      setOrders([])
      setDownloads([])
      setTickets([])
      setDocumentUrls({})
      setCategories([])
      setError(null)
      return
    }

    if (!effectiveUserId) {
      setError('Unable to determine your customer profile for search.')
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const likeToken = sanitizeLikeInput(serverToken)
        const pattern = `${likeToken}`
        const like = likeToken ? `%${pattern}%` : `%${q}%`
        const prodsPromise = supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .eq('catalog_program', CATALOG_PROGRAM.LAMTEK)
          .or(`name.ilike.${like},sku.ilike.${like},description.ilike.${like}`)
          .limit(25)

        const ordersPromise = supabase
          .from('orders')
          .select('*')
          .eq('user_id', effectiveUserId)
          .or(
            `reference.ilike.${like},status.ilike.${like},invoice_number.ilike.${like},courier.ilike.${like},delivery_postcode.ilike.${like}`
          )
          .order('created_at', { ascending: false })
          .limit(15)

        const downloadsPromise = supabase
          .from('documents')
          .select('*')
          .or(`title.ilike.${like},description.ilike.${like},file_path.ilike.${like}`)
          .order('category')
          .order('title')
          .limit(15)

        const ticketsPromise = supabase
          .from('tickets')
          .select('*')
          .eq('customer_user_id', effectiveUserId)
          .or(`subject.ilike.${like},body.ilike.${like},type.ilike.${like}`)
          .order('updated_at', { ascending: false })
          .limit(15)

        const catsPromise = supabase
          .from('categories')
          .select('*')
          .order('sort_order')

        const [
          { data: prodData, error: prodErr },
          { data: orderData, error: orderErr },
          { data: docData, error: docErr },
          { data: ticketData, error: ticketErr },
          { data: catData, error: catErr },
        ] = await Promise.all([
          prodsPromise,
          ordersPromise,
          downloadsPromise,
          ticketsPromise,
          catsPromise,
        ])

        if (cancelled) return
        if (prodErr) throw prodErr
        if (orderErr) throw orderErr
        if (docErr) throw docErr
        if (ticketErr) throw ticketErr
        if (catErr) throw catErr

        const prodList = (prodData ?? []) as ProductRow[]
        const orderList = (orderData ?? []) as OrderRow[]
        const docList = (docData ?? []) as DocumentRow[]
        const ticketList = (ticketData ?? []) as TicketRow[]
        const catList = (catData ?? []) as CategoryRow[]

        setProducts(prodList)
        setOrders(orderList)
        setDownloads(docList)
        setTickets(ticketList)
        setCategories(catList)

        const urlMap = await getDocumentUrls(docList)
        if (!cancelled) setDocumentUrls(urlMap)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Search failed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [q, effectiveUserId, serverToken])

  function setScopeAndNavigate(nextScope: Scope) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextScope === 'all') next.delete('scope')
      else next.set('scope', nextScope)
      return next
    })
  }

  const emptyState = (
    <div className="card global-search-empty">
      <h2>Search</h2>
      <p className="page-intro">
        Search across <strong>products</strong>, <strong>orders</strong>, <strong>downloads</strong>, and <strong>support tickets</strong>.
      </p>
      <div className="global-search-tips">
        <div className="global-search-tip">Try: <code>ABC123</code> or an invoice/order reference.</div>
        <div className="global-search-tip">Use the tabs to narrow results.</div>
      </div>
    </div>
  )

  function statusLabel(status: OrderRow['status']): string {
    switch (status) {
      case 'draft': return 'Draft'
      case 'quotation': return 'Quotation'
      case 'placed': return 'Placed'
      case 'invoiced': return 'Invoiced'
      case 'paid': return 'Paid'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  function ticketTypeLabel(type: TicketRow['type']): string {
    switch (type) {
      case 'returns': return 'Returns'
      case 'issue': return 'Issue'
      case 'question': return 'Question'
      default: return type
    }
  }

  const showProducts = scope === 'all' || scope === 'products'
  const showOrders = scope === 'all' || scope === 'orders'
  const showDownloads = scope === 'all' || scope === 'downloads'
  const showSupport = scope === 'all' || scope === 'support'

  return (
    <div className="global-search-page">
      <PageNav backTo="/" backLabel="Dashboard" />
      <h1>Global search</h1>
      <p className="page-intro">
        {q ? (
          <>
            Results for <strong>{q}</strong>
          </>
        ) : (
          'Use the header search to look up products, orders, downloads, and tickets.'
        )}
      </p>

      <div className="global-search-tabs" role="tablist" aria-label="Search scope">
        {tabs.map((t) => {
          const active = (scope === t.value) || (t.value === 'all' && !searchParams.get('scope'))
          return (
            <button
              key={t.value}
              type="button"
              className={active ? 'btn btn-small active' : 'btn btn-small btn-outline'}
              role="tab"
              aria-selected={active}
              onClick={() => setScopeAndNavigate(t.value)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="card global-search-error">
          <h2>Search error</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Back</button>
        </div>
      )}

      {!q && emptyState}

      {q && loading && (
        <div className="card">
          <p>Searching…</p>
        </div>
      )}

      {q && !loading && (
        <>
          {showProducts && (
            <section className="global-search-section">
              <h2>Products</h2>
              {productsScored.length === 0 ? (
                <p className="global-search-muted">No product matches.</p>
              ) : (
                <div className="global-search-items">
                  {productsScored.slice(0, scope === 'all' ? 6 : 20).map((p) => {
                    const availability = getProductAvailabilityMeta(p)
                    return (
                    <div key={p.id} className="card global-search-item">
                      <div className="global-search-item-main">
                        {p.image_url ? (
                          <img className="global-search-item-image" src={p.image_url} alt={p.image_alt ?? p.name ?? ''} />
                        ) : (
                          <div className="global-search-item-image global-search-item-image--placeholder">No image</div>
                        )}
                        <div className="global-search-item-body">
                          <div className="global-search-item-title">
                            <button type="button" className="link-btn" onClick={() => setSelectedProduct(p)}>
                              {highlightText(p.name ?? '—', highlightTerm)}
                            </button>
                          </div>
                          {p.sku && <div className="global-search-item-sub">SKU: {highlightText(p.sku, highlightTerm)}</div>}
                          <div className="global-search-item-sub">
                            <span className="product-badge" title={availability.detail ?? availability.label}>
                              {availability.label}
                            </span>
                          </div>
                          {p.description && <div className="global-search-item-desc">{p.description.slice(0, 90)}{p.description.length > 90 ? '…' : ''}</div>}
                        </div>
                      </div>
                      <div className="global-search-item-actions">
                        <Link to="/ordering" className="btn btn-small">Add to order</Link>
                        <button type="button" className="btn btn-small btn-outline" onClick={() => setSelectedProduct(p)}>
                          Details
                        </button>
                      </div>
                      <div className="global-search-item-price">Price: {formatMoney(p.unit_price)}</div>
                    </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {showOrders && (
            <section className="global-search-section">
              <h2>Orders</h2>
              {ordersScored.length === 0 ? (
                <p className="global-search-muted">No order matches.</p>
              ) : (
                <div className="global-search-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Placed</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersScored.slice(0, scope === 'all' ? 6 : 20).map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link to={`/account/orders/${o.id}`} className="link-inline">
                              {highlightText(formatOrderReferenceOrFallback(o), highlightTerm)}
                            </Link>
                          </td>
                          <td>{statusLabel(o.status)}</td>
                          <td>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td>{formatMoney(o.total_inc_vat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {showDownloads && (
            <section className="global-search-section">
              <h2>Downloads</h2>
              {downloadsScored.length === 0 ? (
                <p className="global-search-muted">No download matches.</p>
              ) : (
                <div className="global-search-items">
                  {downloadsScored.slice(0, scope === 'all' ? 6 : 20).map((d) => {
                    const url = documentUrls[d.id]
                    return (
                      <div key={d.id} className="card global-search-item global-search-item--doc">
                        <div className="global-search-item-main">
                          <div className="global-search-item-body">
                            <div className="global-search-item-title">
                              <span className="global-search-doc-cat">{d.category}</span>
                              <div>
                                {highlightText(d.title ?? 'Untitled', highlightTerm)}
                              </div>
                            </div>
                            {d.description && <div className="global-search-item-desc">{d.description.slice(0, 90)}{d.description.length > 90 ? '…' : ''}</div>}
                          </div>
                        </div>
                        <div className="global-search-item-actions">
                          {url ? (
                            <>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-small btn-outline">View</a>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-small" download>Download</a>
                            </>
                          ) : (
                            <span className="global-search-muted">Loading file link…</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {showSupport && (
            <section className="global-search-section">
              <h2>Support tickets</h2>
              {ticketsScored.length === 0 ? (
                <p className="global-search-muted">No ticket matches.</p>
              ) : (
                <div className="global-search-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsScored.slice(0, scope === 'all' ? 6 : 20).map((t) => (
                        <tr key={t.id}>
                          <td>
                            <Link to={`/account/support/${t.id}`} className="link-inline">
                              {highlightText(t.subject ?? '—', highlightTerm)}
                            </Link>
                          </td>
                          <td>{ticketTypeLabel(t.type)}</td>
                          <td>{t.status.replace(/_/g, ' ')}</td>
                          <td>{new Date(t.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          allProducts={productsScored}
          onClose={() => setSelectedProduct(null)}
          onSelectProduct={(p) => setSelectedProduct(p)}
        />
      )}
    </div>
  )
}

