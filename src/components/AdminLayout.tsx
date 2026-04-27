import { useEffect, useMemo, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { useAdminUi } from '@/contexts/AdminUiContext'
import { usePermission } from '@/hooks/usePermission'

interface CustomerOption {
  user_id: string
  label: string
  staff_portal_access_consent_at: string | null
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { staffProfile } = useStaff()
  const { setImpersonating } = useImpersonation()
  const { sidebarCollapsed, setSidebarCollapsed, sidebarGroups, sidebarAccordion, updatePrefs } = useAdminUi()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [viewAsOpen, setViewAsOpen] = useState(false)
  const [viewAsConsentBlock, setViewAsConsentBlock] = useState<null | { label: string; userId: string }>(null)
  const [quickJumpValue, setQuickJumpValue] = useState('')

  useEffect(() => {
    supabase
      .from('customer_profiles')
      .select('user_id, company_name, contact_name, staff_portal_access_consent_at')
      .order('company_name')
      .then(({ data }) => {
        setCustomers((data ?? []).map((c) => ({
          user_id: c.user_id,
          label: [c.contact_name, c.company_name].filter(Boolean).join(' · ') || c.user_id.slice(0, 8),
          staff_portal_access_consent_at: (c as { staff_portal_access_consent_at?: string | null }).staff_portal_access_consent_at ?? null,
        })))
      })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setImpersonating(null)
    navigate('/admin/login')
  }

  function handleViewAsCustomer(userId: string) {
    if (!userId) return
    setImpersonating(userId)
    setViewAsOpen(false)
    navigate('/')
  }

  function tryViewAsCustomer(c: CustomerOption) {
    if (!c.staff_portal_access_consent_at) {
      setViewAsOpen(false)
      setViewAsConsentBlock({ label: c.label, userId: c.user_id })
      return
    }
    handleViewAsCustomer(c.user_id)
  }

  const { pageTitle, breadcrumb } = (() => {
    if (location.pathname === '/admin') return { pageTitle: 'Today', breadcrumb: [] }
    if (location.pathname === '/admin/orders' && location.search.includes('archive=archived')) return { pageTitle: 'Archived orders', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Archived orders' }] }
    if (location.pathname === '/admin/orders') return { pageTitle: 'Orders', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Orders' }] }
    if (location.pathname === '/admin/orders/processing') return { pageTitle: 'Order processing', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order processing' }] }
    if (location.pathname === '/admin/orders/reminders') return { pageTitle: 'Order reminders', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order reminders' }] }
    if (location.pathname.match(/^\/admin\/orders\/[^/]+\/invoice$/)) return { pageTitle: 'Print invoice', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Invoice' }] }
    if (location.pathname.match(/^\/admin\/orders\/[^/]+\/packing-slip$/)) return { pageTitle: 'Packing slip', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Packing slip' }] }
    if (location.pathname.match(/^\/admin\/orders\/[^/]+\/quote/)) return { pageTitle: 'Print quote', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Quote' }] }
    if (location.pathname.startsWith('/admin/orders/')) return { pageTitle: 'Order detail', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order' }] }
    if (location.pathname === '/admin/customers') return { pageTitle: 'Customers', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Customers' }] }
    if (location.pathname.startsWith('/admin/customers/')) return { pageTitle: 'Customer detail', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/customers', label: 'Customers' }, { label: 'Customer' }] }
    if (location.pathname.startsWith('/admin/crm')) {
      const tail = (location.pathname.replace(/^\/admin\/crm\/?/, '') || 'open-orders').split('/')[0]
      const labels: Record<string, string> = {
        'open-orders': 'Open orders',
        activity: 'Activity',
        pipeline: 'Sales pipeline',
        directory: 'Directory',
      }
      const crumb = labels[tail] ?? 'CRM'
      return {
        pageTitle: crumb,
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: '/admin/crm/open-orders', label: 'CRM' },
          { label: crumb },
        ],
      }
    }
    if (location.pathname === '/admin/notifications') {
      return { pageTitle: 'Notifications', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Notifications' }] }
    }
    if (location.pathname === '/admin/create-order') return { pageTitle: 'Create order', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Create order' }] }
    if (location.pathname === '/admin/catalogue') return { pageTitle: 'Catalogue', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Catalogue' }] }
    if (location.pathname === '/admin/catalogue/import') return { pageTitle: 'Import Napwood pricelist', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/catalogue', label: 'Catalogue' }, { label: 'Import' }] }
    if (location.pathname === '/admin/stock') return { pageTitle: 'Stock take', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/catalogue', label: 'Catalogue' }, { label: 'Stock take' }] }
    if (location.pathname === '/admin/locations') return { pageTitle: 'Locations', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/stock', label: 'Stock take' }, { label: 'Locations' }] }
    if (location.pathname === '/admin/delivery-windows') return { pageTitle: 'Delivery windows', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/stock', label: 'Stock take' }, { label: 'Delivery windows' }] }
    if (location.pathname === '/admin/uploads') return { pageTitle: 'Brochure & files', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Brochure & files' }] }
    if (location.pathname === '/admin/pricing') return { pageTitle: 'Pricing & margin', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Pricing & margin' }] }
    if (location.pathname === '/admin/users') return { pageTitle: 'Team users', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Team users' }] }
    if (location.pathname === '/admin/users/create') return { pageTitle: 'Create team user', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/users', label: 'Team users' }, { label: 'Create user' }] }
    if (location.pathname === '/admin/permissions') return { pageTitle: 'Permissions', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Permissions' }] }
    if (location.pathname === '/admin/settings') return { pageTitle: 'Settings', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Settings' }] }
    return { pageTitle: 'Admin', breadcrumb: [] }
  })()

  const { allowed: canViewOrders } = usePermission('admin.orders', 'view')
  const { allowed: canViewCustomers } = usePermission('admin.customers', 'view')
  const { allowed: canViewCatalogue } = usePermission('admin.catalogue', 'view')
  const { allowed: canViewStock } = usePermission('admin.stock', 'view')
  const { allowed: canViewUploads } = usePermission('admin.uploads', 'view')
  const { allowed: canViewUsers } = usePermission('admin.users', 'view')
  const { allowed: canViewPermissions } = usePermission('admin.permissions', 'view')
  const { allowed: canViewPricing } = usePermission('admin.pricing', 'view')
  const { allowed: canViewReports } = usePermission('admin.reports', 'view')
  const { allowed: canViewAccounting } = usePermission('accounts.view', 'view')
  const { allowed: canViewTickets } = usePermission('tickets.view', 'view')

  function pathToScope(path: string): string | null {
    if (path === '/admin' || path === '/admin/settings' || path === '/admin/notifications') return null
    if (path.startsWith('/admin/orders') || path === '/admin/create-order') return 'admin.orders'
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/crm')) return 'admin.customers'
    if (path.startsWith('/admin/catalogue')) return 'admin.catalogue'
    if (path === '/admin/stock' || path === '/admin/locations' || path === '/admin/delivery-windows') return 'admin.stock'
    if (path === '/admin/uploads') return 'admin.uploads'
    if (path === '/admin/pricing') return 'admin.pricing'
    if (path === '/admin/reports') return 'admin.reports'
    if (path === '/admin/accounting') return 'accounts.view'
    if (path.startsWith('/admin/tickets')) return 'tickets.view'
    if (path.startsWith('/admin/users')) return 'admin.users'
    if (path === '/admin/permissions') return 'admin.permissions'
    return null
  }

  const scopeAllowed: Record<string, boolean> = {
    'admin.orders': canViewOrders,
    'admin.customers': canViewCustomers,
    'admin.catalogue': canViewCatalogue,
    'admin.stock': canViewStock,
    'admin.uploads': canViewUploads,
    'admin.pricing': canViewPricing,
    'admin.reports': canViewReports,
    'accounts.view': canViewAccounting,
    'tickets.view': canViewTickets,
    'admin.users': canViewUsers,
    'admin.permissions': canViewPermissions,
  }
  const pathScope = pathToScope(location.pathname)
  const canAccessPage = pathScope === null || scopeAllowed[pathScope] === true

  function setGroupOpen(groupId: string, open: boolean) {
    const prev = sidebarGroups ?? {}
    if (!open) {
      updatePrefs({ sidebarGroups: { ...prev, [groupId]: false } })
      return
    }
    if (!sidebarAccordion) {
      updatePrefs({ sidebarGroups: { ...prev, [groupId]: true } })
      return
    }
    updatePrefs({
      sidebarGroups: {
        orders: groupId === 'orders',
        customers: groupId === 'customers',
        catalogue: groupId === 'catalogue',
        users: groupId === 'users',
      },
    })
  }

  function groupIsOpen(groupId: string, forceOpen: boolean) {
    if (sidebarCollapsed) return false
    if (forceOpen) return true
    return sidebarGroups?.[groupId] ?? false
  }

  const activeGroup = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/admin/orders') || path === '/admin/create-order') return 'orders'
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/crm')) return 'customers'
    if (
      path.startsWith('/admin/catalogue') ||
      path === '/admin/stock' ||
      path === '/admin/locations' ||
      path === '/admin/delivery-windows' ||
      path === '/admin/uploads' ||
      path === '/admin/pricing' ||
      path === '/admin/reports' ||
      path === '/admin/accounting'
    ) return 'catalogue'
    if (path.startsWith('/admin/users') || path.startsWith('/admin/tickets') || path === '/admin/permissions') return 'users'
    return null
  }, [location.pathname])

  useEffect(() => {
    if (!sidebarAccordion) return
    if (!activeGroup) return
    setGroupOpen(activeGroup, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, sidebarAccordion])

  return (
    <div className={`admin-app ${sidebarCollapsed ? 'admin-app--sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link to="/admin" className="admin-sidebar-logo">
            <span className="admin-sidebar-logo-text">TM</span>
            {!sidebarCollapsed && <span className="admin-sidebar-badge">Staff</span>}
          </Link>
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Workspace</span>}
            <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">◇</span>
              {!sidebarCollapsed && <span>Today</span>}
            </NavLink>
          </div>

          {canViewOrders && (() => {
            const groupId = 'orders'
            const forceOpen = location.pathname.startsWith('/admin/orders') || location.pathname === '/admin/create-order'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span>Orders</span>
                    <span className="admin-nav-group-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="admin-nav-icon">☰</span>
                    {!sidebarCollapsed && <span>Orders</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/orders?archive=archived"
                    className={({ isActive }) =>
                      `admin-nav-item ${isActive && location.search.includes('archive=archived') ? 'active' : ''}`
                    }
                  >
                    <span className="admin-nav-icon">🗂</span>
                    {!sidebarCollapsed && <span>Archived</span>}
                  </NavLink>
                  <NavLink to="/admin/orders/reminders" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="admin-nav-icon">🔔</span>
                    {!sidebarCollapsed && <span>Reminders</span>}
                  </NavLink>
                  <NavLink to="/admin/orders/processing" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="admin-nav-icon">⚡</span>
                    {!sidebarCollapsed && <span>Processing</span>}
                  </NavLink>
                  <NavLink to="/admin/create-order" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="admin-nav-icon">+</span>
                    {!sidebarCollapsed && <span>Create order</span>}
                  </NavLink>
                </div>
              </div>
            )
          })()}

          {canViewCustomers && (() => {
            const groupId = 'customers'
            const forceOpen = location.pathname.startsWith('/admin/customers') || location.pathname.startsWith('/admin/crm')
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span>Customers & CRM</span>
                    <span className="admin-nav-group-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  <NavLink to="/admin/customers" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="admin-nav-icon">◉</span>
                      {!sidebarCollapsed && <span>Customers</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/crm/open-orders"
                    className={({ isActive }) =>
                      `admin-nav-item ${isActive || location.pathname.startsWith('/admin/crm') ? 'active' : ''}`
                    }
                  >
                    <span className="admin-nav-icon">📝</span>
                    {!sidebarCollapsed && <span>CRM</span>}
                  </NavLink>
                  {!sidebarCollapsed && (
                    <div className="admin-nav-sub">
                      <NavLink
                        to="/admin/crm/open-orders"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Open orders
                      </NavLink>
                      <NavLink
                        to="/admin/crm/activity"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Activity
                      </NavLink>
                      <NavLink
                        to="/admin/crm/pipeline"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Pipeline
                      </NavLink>
                      <NavLink
                        to="/admin/crm/directory"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Directory
                      </NavLink>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {(canViewCatalogue || canViewStock || canViewUploads || canViewPricing || canViewReports || canViewAccounting) && (() => {
            const groupId = 'catalogue'
            const forceOpen =
              location.pathname.startsWith('/admin/catalogue') ||
              location.pathname === '/admin/stock' ||
              location.pathname === '/admin/locations' ||
              location.pathname === '/admin/delivery-windows' ||
              location.pathname === '/admin/uploads' ||
              location.pathname === '/admin/pricing' ||
              location.pathname === '/admin/reports' ||
              location.pathname === '/admin/accounting'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span>Catalogue, Stock & Finance</span>
                    <span className="admin-nav-group-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  {canViewCatalogue && (
                    <NavLink to="/admin/catalogue" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">📋</span>
                      {!sidebarCollapsed && <span>Catalogue</span>}
                    </NavLink>
                  )}
                  {canViewStock && (
                    <NavLink to="/admin/stock" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">📦</span>
                      {!sidebarCollapsed && <span>Stock take</span>}
                    </NavLink>
                  )}
                  {canViewStock && (
                    <NavLink to="/admin/locations" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">📍</span>
                      {!sidebarCollapsed && <span>Locations</span>}
                    </NavLink>
                  )}
                  {canViewStock && (
                    <NavLink to="/admin/delivery-windows" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">🕐</span>
                      {!sidebarCollapsed && <span>Delivery windows</span>}
                    </NavLink>
                  )}
                  {canViewUploads && (
                    <NavLink to="/admin/uploads" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">📄</span>
                      {!sidebarCollapsed && <span>Brochure & files</span>}
                    </NavLink>
                  )}
                  {canViewPricing && (
                    <NavLink to="/admin/pricing" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">£</span>
                      {!sidebarCollapsed && <span>Pricing & margin</span>}
                    </NavLink>
                  )}
                  {canViewReports && (
                    <NavLink to="/admin/reports" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">📈</span>
                      {!sidebarCollapsed && <span>Reports</span>}
                    </NavLink>
                  )}
                  {canViewAccounting && (
                    <NavLink to="/admin/accounting" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">🧾</span>
                      {!sidebarCollapsed && <span>Accounting</span>}
                    </NavLink>
                  )}
                </div>
              </div>
            )
          })()}

          {(canViewUsers || canViewTickets || canViewPermissions) && (() => {
            const groupId = 'users'
            const forceOpen =
              location.pathname.startsWith('/admin/users') ||
              location.pathname.startsWith('/admin/tickets') ||
              location.pathname === '/admin/permissions'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span>Team, Support & Access</span>
                    <span className="admin-nav-group-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  {canViewUsers && (
                    <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">👥</span>
                      {!sidebarCollapsed && <span>Team users</span>}
                    </NavLink>
                  )}
                  {canViewUsers && (
                    <NavLink to="/admin/users/create" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">+</span>
                      {!sidebarCollapsed && <span>Create team user</span>}
                    </NavLink>
                  )}
                  {canViewTickets && (
                    <NavLink to="/admin/tickets" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">🎫</span>
                      {!sidebarCollapsed && <span>Tickets</span>}
                    </NavLink>
                  )}
                  {canViewPermissions && (
                    <NavLink to="/admin/permissions" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                      <span className="admin-nav-icon">🔐</span>
                      {!sidebarCollapsed && <span>Permissions</span>}
                    </NavLink>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="admin-nav-group">
            {!sidebarCollapsed && <span className="admin-nav-group-title">Tools</span>}
            <a href="/" className="admin-nav-item" target="_blank" rel="noopener noreferrer">
              <span className="admin-nav-icon">↗</span>
              {!sidebarCollapsed && <span>Customer portal</span>}
            </a>
          </div>

          <div className="admin-nav-group admin-nav-group--bottom">
            <NavLink to="/admin/notifications" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">📬</span>
              {!sidebarCollapsed && <span>Notifications</span>}
            </NavLink>
            <NavLink to="/admin/settings" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">⚙</span>
              {!sidebarCollapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </nav>
      </aside>

      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <span className="admin-topbar-badge" aria-label="Admin area">Admin</span>
          <div className="admin-topbar-heading">
            {breadcrumb.length > 0 && (
              <nav className="admin-breadcrumb" aria-label="Breadcrumb">
                <ol className="admin-breadcrumb-list">
                  {breadcrumb.map((item, i) => (
                    <li key={i} className="admin-breadcrumb-item">
                      {i > 0 && <span className="admin-breadcrumb-sep">/</span>}
                      {item.to ? (
                        <Link to={item.to} className="admin-breadcrumb-link">{item.label}</Link>
                      ) : (
                        <span className="admin-breadcrumb-current">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <h1 className="admin-topbar-title">{pageTitle}</h1>
          </div>
          <div className="admin-topbar-actions">
            <label className="admin-topbar-jump">
              <span className="admin-topbar-jump-label">Quick jump</span>
              <select
                value={quickJumpValue}
                onChange={(e) => {
                  const value = e.target.value
                  setQuickJumpValue(value)
                  if (!value) return
                  navigate(value)
                  setQuickJumpValue('')
                  setUserMenuOpen(false)
                  setViewAsOpen(false)
                }}
                className="admin-topbar-jump-select"
                aria-label="Quick jump to admin page"
              >
                <option value="">Go to…</option>
                <option value="/admin">Today</option>
                {canViewOrders && <option value="/admin/orders/processing">Process orders</option>}
                {canViewOrders && <option value="/admin/orders">All orders</option>}
                {canViewOrders && <option value="/admin/create-order">Create order</option>}
                {canViewCustomers && <option value="/admin/customers">Customers</option>}
                {canViewCustomers && <option value="/admin/crm/open-orders">CRM open orders</option>}
                {canViewCatalogue && <option value="/admin/catalogue">Catalogue</option>}
                {canViewStock && <option value="/admin/stock">Stock take</option>}
                {canViewReports && <option value="/admin/reports">Reports</option>}
                {canViewTickets && <option value="/admin/tickets">Support tickets</option>}
                {canViewUsers && <option value="/admin/users">Team users</option>}
                <option value="/admin/settings">Settings</option>
              </select>
            </label>
            <div className={`admin-dropdown ${viewAsOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="admin-topbar-btn"
                onClick={() => { setViewAsOpen(!viewAsOpen); setUserMenuOpen(false); }}
              >
                View as customer
              </button>
              <div className="admin-dropdown-menu">
                {customers.length === 0 ? (
                  <div className="admin-dropdown-item admin-dropdown-item--muted">No customers</div>
                ) : (
                  customers.slice(0, 15).map((c) => (
                    <button
                      key={c.user_id}
                      type="button"
                      className="admin-dropdown-item"
                      onClick={() => tryViewAsCustomer(c)}
                    >
                      {c.label}
                      {!c.staff_portal_access_consent_at ? (
                        <span className="admin-muted" style={{ display: 'block', fontSize: '0.8rem' }}>Consent not recorded</span>
                      ) : null}
                    </button>
                  ))
                )}
                {customers.length > 15 && (
                  <div className="admin-dropdown-item admin-dropdown-item--muted">+ {customers.length - 15} more</div>
                )}
              </div>
            </div>
            <div className={`admin-dropdown ${userMenuOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="admin-topbar-btn admin-topbar-user"
                onClick={() => { setUserMenuOpen(!userMenuOpen); setViewAsOpen(false); }}
              >
                {staffProfile?.display_name || staffProfile?.role || 'Staff'} ▾
              </button>
              <div className="admin-dropdown-menu admin-dropdown-menu--right">
                <Link to="/admin/settings" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Settings
                </Link>
                <a href="/" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Customer portal
                </a>
                <button type="button" className="admin-dropdown-item" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-main">
          {!canAccessPage ? (
            <div className="admin-page admin-no-access">
              <div className="card admin-card">
                <h2>No access</h2>
                <p>You don&apos;t have permission to view this section.</p>
                <Link to="/admin" className="btn btn-outline">Back to dashboard</Link>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Click outside to close dropdowns */}
      {(userMenuOpen || viewAsOpen) && (
        <div
          className="admin-dropdown-backdrop"
          aria-hidden
          onClick={() => { setUserMenuOpen(false); setViewAsOpen(false); }}
        />
      )}

      {viewAsConsentBlock && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="view-as-consent-title"
          onClick={() => setViewAsConsentBlock(null)}
        >
          <div className="admin-modal card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="view-as-consent-title" style={{ marginTop: 0 }}>Customer consent required</h3>
            <p className="admin-muted">
              <strong>{viewAsConsentBlock.label}</strong> has not accepted the staff portal access authorisation in{' '}
              <strong>My account</strong>. They must tick the consent box before you can view the site as them.
            </p>
            <p style={{ marginBottom: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                to={`/admin/customers/${viewAsConsentBlock.userId}`}
                className="btn btn-small"
                onClick={() => setViewAsConsentBlock(null)}
              >
                Open customer
              </Link>
              <button type="button" className="btn btn-outline btn-small" onClick={() => setViewAsConsentBlock(null)}>
                Close
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
