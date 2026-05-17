import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, Link, useNavigate, NavLink, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { useCustomerUi } from '@/contexts/CustomerUiContext'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import BrandLogo from '@/components/BrandLogo'
import type { DocumentRow, OrderRow, ProductRow, TicketRow } from '@/types/database'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'

function headerNavLinkClass(isActive: boolean, extra = ''): string {
  return ['header-nav-link', extra, isActive ? 'active' : ''].filter(Boolean).join(' ')
}

function isCreateOrderPath(pathname: string): boolean {
  return pathname === '/ordering/start' || pathname === '/ordering' || pathname.startsWith('/ordering/mto')
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isStaff } = useStaff()
  const { useSidebarMenu, sidebarGroups, setSidebarGroupOpen, sidebarAccordion } = useCustomerUi()
  const { impersonatingUserId, setImpersonating } = useImpersonation()
  const [impersonationName, setImpersonationName] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''
  const [headerQuery, setHeaderQuery] = useState(qParam)

  const effectiveUserId = useEffectiveUserId()

  type SuggestionKind = 'product' | 'order' | 'download' | 'ticket' | 'search'
  type Suggestion = {
    kind: SuggestionKind
    id?: string
    title: string
    subtitle?: string
    onSelect: () => void
  }
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)
  const debounceRef = useRef<number | null>(null)
  const lastFetchTokenRef = useRef(0)

  function sanitizeLikeInput(s: string): string {
    // `ilike` patterns treat `%` and `_` as wildcards. For user input we strip them.
    return s.replace(/[%_]/g, '').trim()
  }

  const headerQueryTrimmed = useMemo(() => headerQuery.trim(), [headerQuery])

  useEffect(() => {
    if (!impersonatingUserId) {
      setImpersonationName(null)
      return
    }
    supabase
      .from('customer_profiles')
      .select('company_name, contact_name')
      .eq('user_id', impersonatingUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setImpersonationName(data.contact_name || data.company_name || 'Customer')
        else setImpersonationName('Customer')
      })
  }, [impersonatingUserId])

  useEffect(() => {
    if (!user?.id) {
      setProfileName(null)
      return
    }
    supabase
      .from('customer_profiles')
      .select('contact_name, company_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileName(data.contact_name || data.company_name || null)
        else setProfileName(null)
      })
  }, [user?.id])

  useEffect(() => {
    setHeaderQuery(qParam)
  }, [qParam])

  useEffect(() => {
    // Close dropdown when query is cleared.
    if (!headerQueryTrimmed || headerQueryTrimmed.length < 2) {
      setSuggestionsOpen(false)
      setSuggestions([])
      return
    }
    // If we can't scope orders/tickets to a customer yet, don't query.
    if (!effectiveUserId) return

    const fetchToken = lastFetchTokenRef.current + 1
    lastFetchTokenRef.current = fetchToken

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        setSuggestionsLoading(true)
        const likeToken = sanitizeLikeInput(headerQueryTrimmed).toLowerCase()
        const like = likeToken ? `%${likeToken}%` : `%${headerQueryTrimmed}%`

        const prodsPromise = supabase
          .from('products')
          .select('id, name, sku, unit_price, image_url, image_alt')
          .eq('active', true)
          .or(`name.ilike.${like},sku.ilike.${like}`)
          .limit(5)

        const ordersPromise = supabase
          .from('orders')
          .select('id, reference, status, created_at, total_inc_vat')
          .eq('user_id', effectiveUserId)
          .or(
            `reference.ilike.${like},status.ilike.${like},invoice_number.ilike.${like},courier.ilike.${like},delivery_postcode.ilike.${like}`
          )
          .limit(5)

        const docsPromise = supabase
          .from('documents')
          .select('id, title, category, description, file_path')
          .or(`title.ilike.${like},description.ilike.${like},file_path.ilike.${like}`)
          .limit(5)

        const ticketsPromise = supabase
          .from('tickets')
          .select('id, subject, type, status, updated_at, priority')
          .eq('customer_user_id', effectiveUserId)
          .or(`subject.ilike.${like},body.ilike.${like},type.ilike.${like},status.ilike.${like}`)
          .limit(5)

        const [{ data: prodData }, { data: orderData }, { data: docData }, { data: ticketData }] = await Promise.all([
          prodsPromise,
          ordersPromise,
          docsPromise,
          ticketsPromise,
        ])

        if (lastFetchTokenRef.current !== fetchToken) return

        const prodList = (prodData ?? []) as ProductRow[]
        const orderList = (orderData ?? []) as OrderRow[]
        const docList = (docData ?? []) as DocumentRow[]
        const ticketList = (ticketData ?? []) as TicketRow[]

        const qForNav = headerQueryTrimmed

        const searchSuggestion: Suggestion = {
          kind: 'search',
          title: `Search “${qForNav}”`,
          subtitle: 'All results',
          onSelect: () => navigate(`/search?q=${encodeURIComponent(qForNav)}`),
        }

        const productSuggestions = prodList.slice(0, 3).map((p) => ({
          kind: 'product' as const,
          id: p.id,
          title: p.name ?? 'Product',
          subtitle: p.sku ? `SKU: ${p.sku}` : undefined,
          onSelect: () => navigate(`/search?q=${encodeURIComponent(qForNav)}&scope=products`),
        }))
        const orderSuggestions = orderList.slice(0, 3).map((o) => ({
          kind: 'order' as const,
          id: o.id,
          title: formatOrderReferenceOrFallback(o),
          subtitle: `${o.status} · ${new Date(o.created_at).toLocaleDateString()}`,
          onSelect: () => navigate(`/account/orders/${o.id}`),
        }))
        const downloadSuggestions = docList.slice(0, 2).map((d) => ({
          kind: 'download' as const,
          id: d.id,
          title: d.title ?? 'Download',
          subtitle: d.category ? `${d.category}` : undefined,
          onSelect: () => navigate(`/search?q=${encodeURIComponent(qForNav)}&scope=downloads`),
        }))
        const ticketSuggestions = ticketList.slice(0, 2).map((t) => ({
          kind: 'ticket' as const,
          id: t.id,
          title: t.subject ?? 'Ticket',
          subtitle: `${t.type} · ${t.status}`,
          onSelect: () => navigate(`/account/support/${t.id}`),
        }))

        setSuggestions([
          searchSuggestion,
          ...productSuggestions,
          ...orderSuggestions,
          ...downloadSuggestions,
          ...ticketSuggestions,
        ])
        setActiveSuggestionIdx(0)
        setSuggestionsOpen(true)
      } finally {
        if (lastFetchTokenRef.current === fetchToken) setSuggestionsLoading(false)
      }
    }, 180)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [headerQueryTrimmed, effectiveUserId, navigate])

  useEffect(() => {
    if (!suggestionsOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      // Allow clicks inside the search form/suggestion container.
      if (target.closest('.header-search')) return
      setSuggestionsOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [suggestionsOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    setImpersonating(null)
    navigate('/login')
  }

  const sharedBanner = impersonatingUserId && (
    <div className="impersonation-banner">
      <span>Viewing as {impersonationName ?? '…'}</span>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => { setImpersonating(null); navigate('/admin'); }}
      >
        Exit view
      </button>
    </div>
  )

  const staffPortalPreviewBanner = isStaff && !impersonatingUserId ? (
    <div className="staff-portal-preview-banner" role="note">
      <p className="staff-portal-preview-text">
        <strong>Staff preview.</strong> You&apos;re on the Lamtek trade portal while signed in with your staff login. For a specific
        customer account (orders, CRM context), open <Link to="/admin">Admin</Link> and use <strong>View as customer</strong>, then come
        back here.
      </p>
      <Link to="/admin" className="staff-portal-preview-link">
        Back to admin
      </Link>
    </div>
  ) : null

  const customerPath = location.pathname
  const sidebarGroupForceOpen = {
    shop: customerPath === '/' || customerPath.startsWith('/products') || customerPath.startsWith('/ordering'),
    ordering: customerPath.startsWith('/ordering'),
    resources: customerPath.startsWith('/downloads') || customerPath.startsWith('/depots'),
    account: customerPath.startsWith('/account') || customerPath.startsWith('/search') || customerPath.startsWith('/help'),
  } as const

  const sidebarActiveGroup =
    (Object.keys(sidebarGroupForceOpen) as Array<keyof typeof sidebarGroupForceOpen>).find(
      (k) => sidebarGroupForceOpen[k]
    ) ?? null

  useEffect(() => {
    if (!useSidebarMenu || !sidebarAccordion || !sidebarActiveGroup) return
    setSidebarGroupOpen(sidebarActiveGroup, true)
  }, [useSidebarMenu, sidebarAccordion, sidebarActiveGroup, setSidebarGroupOpen])

  if (useSidebarMenu) {
    const createOrderNavActive =
      customerPath === '/ordering/start' || customerPath === '/ordering' || customerPath.startsWith('/ordering/mto')

    function groupOpen(groupId: keyof typeof sidebarGroupForceOpen) {
      if (sidebarGroupForceOpen[groupId]) return true
      return sidebarGroups?.[groupId] ?? false
    }

    return (
      <div className="layout customer-layout customer-layout--sidebar">
        {sharedBanner}
        {staffPortalPreviewBanner}
        <aside className="customer-sidebar">
          <Link to="/" className="customer-sidebar-logo">
            <BrandLogo className="app-logo-image app-logo-image--sidebar" />
          </Link>
          <nav className="customer-sidebar-nav">
            <div className={`customer-sidebar-group ${groupOpen('shop') ? 'open' : ''}`}>
              <button
                type="button"
                className="customer-sidebar-group-toggle"
                aria-expanded={groupOpen('shop')}
                onClick={() => setSidebarGroupOpen('shop', !groupOpen('shop'))}
              >
                Shop
                <span className="customer-sidebar-group-chevron" aria-hidden>
                  {groupOpen('shop') ? '▾' : '▸'}
                </span>
              </button>
              {groupOpen('shop') && (
                <div className="customer-sidebar-children">
                  <NavLink to="/" end className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/products" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Products
                  </NavLink>
                </div>
              )}
            </div>

            <div className={`customer-sidebar-group ${groupOpen('ordering') ? 'open' : ''}`}>
              <button
                type="button"
                className="customer-sidebar-group-toggle"
                aria-expanded={groupOpen('ordering')}
                onClick={() => setSidebarGroupOpen('ordering', !groupOpen('ordering'))}
              >
                Ordering
                <span className="customer-sidebar-group-chevron" aria-hidden>
                  {groupOpen('ordering') ? '▾' : '▸'}
                </span>
              </button>
              {groupOpen('ordering') && (
                <div className="customer-sidebar-children">
                  <NavLink
                    to="/ordering/start"
                    className={() => `customer-sidebar-item ${createOrderNavActive ? 'active' : ''}`}
                  >
                    Create order
                  </NavLink>
                  <NavLink to="/ordering/tealbury" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Tealbury kitchens
                  </NavLink>
                  <NavLink to="/ordering/baskets" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Order baskets
                  </NavLink>
                  <NavLink to="/ordering/cart" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Cart
                  </NavLink>
                </div>
              )}
            </div>

            <div className={`customer-sidebar-group ${groupOpen('resources') ? 'open' : ''}`}>
              <button
                type="button"
                className="customer-sidebar-group-toggle"
                aria-expanded={groupOpen('resources')}
                onClick={() => setSidebarGroupOpen('resources', !groupOpen('resources'))}
              >
                Resources
                <span className="customer-sidebar-group-chevron" aria-hidden>
                  {groupOpen('resources') ? '▾' : '▸'}
                </span>
              </button>
              {groupOpen('resources') && (
                <div className="customer-sidebar-children">
                  <NavLink to="/downloads" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Downloads
                  </NavLink>
                  <NavLink to="/depots" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Depots
                  </NavLink>
                </div>
              )}
            </div>

            <div className={`customer-sidebar-group ${groupOpen('account') ? 'open' : ''}`}>
              <button
                type="button"
                className="customer-sidebar-group-toggle"
                aria-expanded={groupOpen('account')}
                onClick={() => setSidebarGroupOpen('account', !groupOpen('account'))}
              >
                Account
                <span className="customer-sidebar-group-chevron" aria-hidden>
                  {groupOpen('account') ? '▾' : '▸'}
                </span>
              </button>
              {groupOpen('account') && (
                <div className="customer-sidebar-children">
                  <NavLink to="/account" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    My account
                  </NavLink>
                  <NavLink to="/account/support" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Support
                  </NavLink>
                  <NavLink to="/account/help" className={({ isActive }) => `customer-sidebar-item ${isActive ? 'active' : ''}`}>
                    Help
                  </NavLink>
                </div>
              )}
            </div>

            {isStaff && (
              <Link to="/admin" className="customer-sidebar-item customer-sidebar-item--staff">
                Staff backend
              </Link>
            )}
          </nav>
          <div className="customer-sidebar-footer">
            <div className="customer-sidebar-user">
              <span className="customer-sidebar-user-name" title={user?.email ?? ''}>
                {profileName || user?.email || 'Account'}
              </span>
              <Link to="/account" className="customer-sidebar-user-profile">My profile</Link>
            </div>
            <button type="button" className="btn btn-outline btn-small btn-block" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>
        <div className="customer-main-wrap">
          <main className="main customer-main">
            <div className="customer-sidebar-topbar">
              <form
                className="header-search"
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = headerQuery.trim()
                  if (!q) return
                  setSuggestionsOpen(false)
                  navigate(`/search?q=${encodeURIComponent(q)}`)
                }}
                role="search"
              >
                <input
                  className="header-search-input"
                  type="search"
                  aria-label="Global search"
                  placeholder="Search products, orders, downloads…"
                  value={headerQuery}
                  onChange={(e) => setHeaderQuery(e.target.value)}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls="lamtek-global-search-suggestions"
                  onKeyDown={(e) => {
                    if (!suggestionsOpen) return
                    if (e.key === 'Escape') {
                      setSuggestionsOpen(false)
                      return
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setActiveSuggestionIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setActiveSuggestionIdx((i) => Math.max(0, i - 1))
                    } else if (e.key === 'Enter') {
                      if (suggestions.length > 0) {
                        e.preventDefault()
                        const s = suggestions[activeSuggestionIdx]
                        if (s) {
                          setSuggestionsOpen(false)
                          s.onSelect()
                        }
                      }
                    }
                  }}
                />
                <button type="submit" className="header-search-btn">
                  Search
                </button>

                {suggestionsOpen && (
                  <div
                    className="header-search-suggestions"
                    id="lamtek-global-search-suggestions"
                    role="listbox"
                    aria-label="Search suggestions"
                  >
                    {suggestionsLoading ? (
                      <div className="header-search-suggestion header-search-suggestion--muted">Searching…</div>
                    ) : suggestions.length === 0 ? (
                      <div className="header-search-suggestion header-search-suggestion--muted">No suggestions</div>
                    ) : (
                      suggestions.map((s, idx) => (
                        <button
                          key={`${s.kind}-${s.id ?? 'search'}-${idx}`}
                          type="button"
                          className={`header-search-suggestion ${idx === activeSuggestionIdx ? 'active' : ''}`}
                          role="option"
                          aria-selected={idx === activeSuggestionIdx}
                          onMouseEnter={() => setActiveSuggestionIdx(idx)}
                          onClick={() => {
                            setSuggestionsOpen(false)
                            s.onSelect()
                          }}
                        >
                          <div className="header-search-suggestion-title">{s.title}</div>
                          {s.subtitle && <div className="header-search-suggestion-subtitle">{s.subtitle}</div>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </form>
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  const userDisplayName = profileName || user?.email || 'Account'

  const pathname = location.pathname

  const navLinks = (
    <>
      <NavLink to="/" end className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        Dashboard
      </NavLink>
      <NavLink to="/products" className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        Products
      </NavLink>
      <NavLink
        to="/ordering/start"
        className={() => headerNavLinkClass(isCreateOrderPath(pathname))}
        onClick={() => setMobileMenuOpen(false)}
      >
        Create Order
      </NavLink>
      <NavLink to="/ordering/tealbury" className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        Tealbury kitchens
      </NavLink>
      <NavLink to="/downloads" className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        Downloads
      </NavLink>
      <NavLink to="/depots" className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        Depots
      </NavLink>
      <NavLink to="/account" className={({ isActive }) => headerNavLinkClass(isActive)} onClick={() => setMobileMenuOpen(false)}>
        My Account
      </NavLink>
      {isStaff && (
        <NavLink
          to="/admin"
          className={({ isActive }) => headerNavLinkClass(isActive, 'nav-staff-link')}
          onClick={() => setMobileMenuOpen(false)}
        >
          Staff backend
        </NavLink>
      )}
      <div className={`header-user-dropdown ${userMenuOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="header-user-btn"
          onClick={() => { setUserMenuOpen((o) => !o); setMobileMenuOpen(false); }}
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          {userDisplayName} ▾
        </button>
        <div className="header-user-menu" role="menu">
          <Link to="/account" className="header-user-menu-item" role="menuitem" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); }}>
            My profile
          </Link>
          <button type="button" className="header-user-menu-item" role="menuitem" onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false); handleLogout(); }}>
            Logout
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="layout">
      {sharedBanner}
      {staffPortalPreviewBanner}
      <header className="header">
        <Link to="/" className="header-logo" onClick={() => setMobileMenuOpen(false)}>
          <BrandLogo className="app-logo-image app-logo-image--header" />
        </Link>
        <form
          className="header-search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = headerQuery.trim()
            if (!q) return
            setUserMenuOpen(false)
            setMobileMenuOpen(false)
            navigate(`/search?q=${encodeURIComponent(q)}`)
          }}
          role="search"
        >
          <input
            className="header-search-input"
            type="search"
            aria-label="Global search"
            placeholder="Search products, orders, downloads…"
            value={headerQuery}
            onChange={(e) => setHeaderQuery(e.target.value)}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="lamtek-global-search-suggestions"
            onKeyDown={(e) => {
              if (!suggestionsOpen) return
              if (e.key === 'Escape') {
                setSuggestionsOpen(false)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveSuggestionIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveSuggestionIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                if (suggestions.length > 0) {
                  e.preventDefault()
                  const s = suggestions[activeSuggestionIdx]
                  if (s) {
                    setSuggestionsOpen(false)
                    s.onSelect()
                  }
                }
              }
            }}
          />
          <button type="submit" className="header-search-btn">
            Search
          </button>

          {suggestionsOpen && (
            <div
              className="header-search-suggestions"
              id="lamtek-global-search-suggestions"
              role="listbox"
              aria-label="Search suggestions"
            >
              {suggestionsLoading ? (
                <div className="header-search-suggestion header-search-suggestion--muted">Searching…</div>
              ) : suggestions.length === 0 ? (
                <div className="header-search-suggestion header-search-suggestion--muted">No suggestions</div>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={`${s.kind}-${s.id ?? 'search'}-${idx}`}
                    type="button"
                    className={`header-search-suggestion ${idx === activeSuggestionIdx ? 'active' : ''}`}
                    role="option"
                    aria-selected={idx === activeSuggestionIdx}
                    onMouseEnter={() => setActiveSuggestionIdx(idx)}
                    onClick={() => {
                      setSuggestionsOpen(false)
                      s.onSelect()
                    }}
                  >
                    <div className="header-search-suggestion-title">{s.title}</div>
                    {s.subtitle && <div className="header-search-suggestion-subtitle">{s.subtitle}</div>}
                  </button>
                ))
              )}
            </div>
          )}
        </form>
        <button
          type="button"
          className="header-mobile-toggle"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        <nav className={`header-nav ${mobileMenuOpen ? 'header-nav--open' : ''}`}>
          {navLinks}
        </nav>
      </header>
      {mobileMenuOpen && (
        <div className="header-mobile-backdrop" aria-hidden onClick={() => setMobileMenuOpen(false)} />
      )}
      {userMenuOpen && (
        <div className="header-user-backdrop" aria-hidden onClick={() => setUserMenuOpen(false)} />
      )}
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
