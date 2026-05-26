import { useEffect, useMemo, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStaff } from '@/hooks/useStaff'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { useAdminUi } from '@/contexts/AdminUiContext'
import { usePermission } from '@/hooks/usePermission'
import AdminMainBackdrop from '@/components/admin/AdminMainBackdrop'
import AdminQuickActionsFab from '@/components/admin/AdminQuickActionsFab'
import {
  Archive,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Package,
  PanelsTopLeft,
  Plus,
  PoundSterling,
  BookOpen,
  Settings,
  Shield,
  ShoppingCart,
  Ticket,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import { CATALOGUE_TOOLS } from '@/lib/catalogueToolsPaths'
import {
  AdminSidebarGroupRail,
  AdminSidebarNavItem,
  adminNavTip,
} from '@/components/admin/AdminSidebarNav'

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
    if (location.pathname === '/admin/orders') return { pageTitle: 'Orders & quotes', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Orders & quotes' }] }
    if (location.pathname === '/admin/pick-lists') {
      return {
        pageTitle: 'Pick lists',
        breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Pick lists' }],
      }
    }
    if (location.pathname.match(/^\/admin\/pick-lists\/[^/]+\/print$/)) {
      return {
        pageTitle: 'Print pick list',
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: '/admin/orders', label: 'Orders' },
          { to: '/admin/pick-lists', label: 'Pick lists' },
          { label: 'Print' },
        ],
      }
    }
    if (location.pathname.startsWith('/admin/pick-lists/')) {
      return {
        pageTitle: 'Pick list',
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: '/admin/orders', label: 'Orders' },
          { to: '/admin/pick-lists', label: 'Pick lists' },
          { label: 'Detail' },
        ],
      }
    }
    if (location.pathname.match(/^\/admin\/package-labels\/[^/]+\/print$/)) {
      return {
        pageTitle: 'Print package label',
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: '/admin/orders', label: 'Orders' },
          { to: '/admin/pick-lists', label: 'Pick lists' },
          { label: 'Package label' },
        ],
      }
    }
    if (location.pathname === '/admin/orders/processing') return { pageTitle: 'Order processing', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order processing' }] }
    if (location.pathname === '/admin/orders/reminders') return { pageTitle: 'Order reminders', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Order reminders' }] }
    if (location.pathname === '/admin/delivery-schedule') {
      return {
        pageTitle: 'Delivery schedule',
        breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Delivery schedule' }],
      }
    }
    if (location.pathname.match(/^\/admin\/pick-lists\/[^/]+\/scan$/)) {
      return {
        pageTitle: 'Warehouse scan',
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: '/admin/pick-lists', label: 'Pick lists' },
          { label: 'Warehouse scan' },
        ],
      }
    }
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
        activity: 'Activity list',
        'sales-board': 'Sales board',
        calendar: 'Activity calendar',
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
    if (location.pathname === '/admin/create-quote') return { pageTitle: 'Create quote', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/orders', label: 'Orders' }, { label: 'Create quote' }] }
    if (location.pathname === '/admin/catalogue') return { pageTitle: 'Catalogue', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Catalogue' }] }
    if (location.pathname === '/admin/catalogue/categories') {
      return {
        pageTitle: 'Categories',
        breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Categories' }],
      }
    }
    if (location.pathname === CATALOGUE_TOOLS.hub) {
      return {
        pageTitle: 'Product & category tools',
        breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Product & category tools' }],
      }
    }
    if (location.pathname.startsWith(CATALOGUE_TOOLS.hub + '/')) {
      const toolCrumb = (() => {
        if (location.pathname.includes('/pricelist-workbench')) return 'Pricelist workbench'
        if (location.pathname.includes('/catalogue-data')) return 'Import, audit & images'
        if (location.pathname.includes('/smart-categorise')) return 'Smart categorise'
        if (location.pathname.endsWith('/parts')) return 'Parts registry'
        if (location.pathname.includes('/components/import')) return 'Component import'
        if (location.pathname.includes('/variant-builder')) return 'Variant builder'
        if (location.pathname.includes('/wipe')) return 'Reset catalogue'
        return 'Tool'
      })()
      return {
        pageTitle: toolCrumb,
        breadcrumb: [
          { to: '/admin', label: 'Today' },
          { to: CATALOGUE_TOOLS.hub, label: 'Product & category tools' },
          { label: toolCrumb },
        ],
      }
    }
    if (location.pathname === '/admin/stock') return { pageTitle: 'Stock take', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/catalogue', label: 'Catalogue' }, { label: 'Stock take' }] }
    if (location.pathname === '/admin/locations') return { pageTitle: 'Locations', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/stock', label: 'Stock take' }, { label: 'Locations' }] }
    if (location.pathname === '/admin/delivery-windows') return { pageTitle: 'Delivery windows', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/stock', label: 'Stock take' }, { label: 'Delivery windows' }] }
    if (location.pathname === '/admin/uploads') return { pageTitle: 'Brochure & files', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Brochure & files' }] }
    if (location.pathname === '/admin/pricing') return { pageTitle: 'Pricing & margin', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Pricing & margin' }] }
    if (location.pathname === '/admin/users') return { pageTitle: 'Team users', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Team users' }] }
    if (location.pathname === '/admin/users/create') return { pageTitle: 'Create team user', breadcrumb: [{ to: '/admin', label: 'Today' }, { to: '/admin/users', label: 'Team users' }, { label: 'Create user' }] }
    if (location.pathname === '/admin/permissions') return { pageTitle: 'Permissions', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Permissions' }] }
    if (location.pathname === '/admin/settings') return { pageTitle: 'Settings', breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Settings' }] }
    if (location.pathname === '/admin/support-manual') {
      return {
        pageTitle: 'Support manual',
        breadcrumb: [{ to: '/admin', label: 'Today' }, { label: 'Support manual' }],
      }
    }
    return { pageTitle: 'Admin', breadcrumb: [] }
  })()

  const { allowed: canViewOrders } = usePermission('admin.orders', 'view')
  const { allowed: canViewCustomers } = usePermission('admin.customers', 'view')
  const { allowed: canViewCatalogue } = usePermission('admin.catalogue', 'view')
  const { allowed: canEditCatalogue } = usePermission('admin.catalogue', 'edit')
  const { allowed: canViewStock } = usePermission('admin.stock', 'view')
  const { allowed: canViewUploads } = usePermission('admin.uploads', 'view')
  const { allowed: canViewUsers } = usePermission('admin.users', 'view')
  const { allowed: canViewPermissions } = usePermission('admin.permissions', 'view')
  const { allowed: canViewPricing } = usePermission('admin.pricing', 'view')
  const { allowed: canViewReports } = usePermission('admin.reports', 'view')
  const { allowed: canViewAccounting } = usePermission('accounts.view', 'view')
  const { allowed: canViewTickets } = usePermission('tickets.view', 'view')

  function pathToScope(path: string): string | null {
    if (path === '/admin' || path === '/admin/settings' || path === '/admin/support-manual' || path === '/admin/notifications') return null
    if (
      path.startsWith('/admin/orders') ||
      path === '/admin/create-order' ||
      path === '/admin/create-quote' ||
      path.startsWith('/admin/pick-lists') ||
      path.startsWith('/admin/package-labels')
    )
      return 'admin.orders'
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/crm')) return 'admin.customers'
    if (path.startsWith('/admin/catalogue') || path.startsWith('/admin/catalogue-tools')) return 'admin.catalogue'
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
        finance: groupId === 'finance',
        users: groupId === 'users',
      },
    })
  }

  function groupIsOpen(groupId: string, forceOpen: boolean) {
    if (sidebarCollapsed) return forceOpen
    if (forceOpen) return true
    return sidebarGroups?.[groupId] ?? false
  }

  const activeGroup = useMemo(() => {
    const path = location.pathname
    if (
      path.startsWith('/admin/orders') ||
      path === '/admin/create-order' ||
      path === '/admin/create-quote' ||
      path === '/admin/delivery-schedule'
    ) {
      return 'orders'
    }
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/crm')) return 'customers'
    if (
      path.startsWith('/admin/catalogue') ||
      path.startsWith('/admin/catalogue-tools') ||
      path === '/admin/stock' ||
      path === '/admin/locations' ||
      path === '/admin/delivery-windows' ||
      path === '/admin/uploads'
    )
      return 'catalogue'
    if (path === '/admin/pricing' || path === '/admin/reports' || path === '/admin/accounting') return 'finance'
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
          <Link
            to="/admin"
            className="admin-sidebar-logo"
            data-tip="Lamtek"
            aria-label="Lamtek"
          >
            <span className="admin-sidebar-logo-text">{sidebarCollapsed ? 'L' : 'Lamtek'}</span>
            {!sidebarCollapsed && <span className="admin-sidebar-badge">Staff</span>}
          </Link>
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            data-tip={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} strokeWidth={2} aria-hidden /> : <ChevronLeft size={18} strokeWidth={2} aria-hidden />}
          </button>
        </div>
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-section">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Home</div>}
            <div className="admin-nav-group">
              <AdminSidebarNavItem
                to="/admin"
                end
                label="Today"
                section="Home"
                collapsed={sidebarCollapsed}
                icon={<LayoutDashboard size={18} strokeWidth={2} aria-hidden />}
              />
            </div>
          </div>

          <div className="admin-nav-section">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Sales</div>}

          {canViewOrders && (() => {
            const groupId = 'orders'
            const forceOpen =
              location.pathname.startsWith('/admin/orders') ||
              location.pathname === '/admin/create-order' ||
              location.pathname === '/admin/create-quote' ||
              location.pathname.startsWith('/admin/pick-lists') ||
              location.pathname.startsWith('/admin/package-labels') ||
              location.pathname === '/admin/delivery-schedule'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {sidebarCollapsed ? (
                  <AdminSidebarGroupRail
                    to="/admin/orders"
                    label="Orders & quotes"
                    section="Sales"
                    active={activeGroup === groupId}
                    icon={<ShoppingCart size={22} strokeWidth={2} aria-hidden />}
                  />
                ) : (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span className="admin-nav-group-toggle-icon" aria-hidden>
                      <ShoppingCart size={16} strokeWidth={2} />
                    </span>
                    <span>Orders &amp; quotes</span>
                    <span className="admin-nav-group-chevron" aria-hidden>
                      {open ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
                    </span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  <AdminSidebarNavItem
                    to="/admin/orders"
                    label="All orders & quotes"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<ClipboardList size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/orders?archive=archived"
                    label="Archived"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    isActive={({ isActive }) => isActive && location.search.includes('archive=archived')}
                    icon={<Archive size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/orders/reminders"
                    label="Reminders"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<Bell size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/orders/processing"
                    label="Processing"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<Zap size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/delivery-schedule"
                    label="Delivery schedule"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<CalendarClock size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/pick-lists"
                    label="Pick lists"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    isActive={({ isActive }) =>
                      isActive ||
                      location.pathname.startsWith('/admin/pick-lists') ||
                      location.pathname.startsWith('/admin/package-labels')
                    }
                    icon={<Package size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/create-order"
                    label="Create order"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<Plus size={18} strokeWidth={2.25} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/create-quote"
                    label="Create quote"
                    section="Orders"
                    collapsed={sidebarCollapsed}
                    icon={<Plus size={18} strokeWidth={2.25} aria-hidden />}
                  />
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
                {sidebarCollapsed ? (
                  <AdminSidebarGroupRail
                    to="/admin/customers"
                    label="Customers & CRM"
                    section="Sales"
                    active={activeGroup === groupId}
                    icon={<Users size={22} strokeWidth={2} aria-hidden />}
                  />
                ) : (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span className="admin-nav-group-toggle-icon" aria-hidden>
                      <Users size={16} strokeWidth={2} />
                    </span>
                    <span>Customers &amp; CRM</span>
                    <span className="admin-nav-group-chevron" aria-hidden>
                      {open ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
                    </span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  <AdminSidebarNavItem
                    to="/admin/customers"
                    label="Customers"
                    section="CRM"
                    collapsed={sidebarCollapsed}
                    icon={<Users size={18} strokeWidth={2} aria-hidden />}
                  />
                  <AdminSidebarNavItem
                    to="/admin/crm/open-orders"
                    label="CRM"
                    section="CRM"
                    collapsed={sidebarCollapsed}
                    isActive={({ isActive }) => isActive || location.pathname.startsWith('/admin/crm')}
                    icon={<PanelsTopLeft size={18} strokeWidth={2} aria-hidden />}
                  />
                  {!sidebarCollapsed && open && (
                    <div className="admin-nav-sub">
                      <span className="admin-nav-sub-heading">CRM views</span>
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
                        to="/admin/crm/sales-board"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Sales board
                      </NavLink>
                      <NavLink
                        to="/admin/crm/calendar"
                        className={({ isActive }) => `admin-nav-sub-link${isActive ? ' active' : ''}`}
                      >
                        Week calendar
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
          </div>

          <div className="admin-nav-section">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Catalogue &amp; stock</div>}

          {(canViewCatalogue || canViewStock || canViewUploads) && (() => {
            const groupId = 'catalogue'
            const forceOpen =
              location.pathname.startsWith('/admin/catalogue') ||
              location.pathname.startsWith('/admin/catalogue-tools') ||
              location.pathname === '/admin/stock' ||
              location.pathname === '/admin/locations' ||
              location.pathname === '/admin/delivery-windows' ||
              location.pathname === '/admin/uploads'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {sidebarCollapsed ? (
                  <AdminSidebarGroupRail
                    to={
                      canViewCatalogue
                        ? '/admin/catalogue'
                        : canViewStock
                          ? '/admin/stock'
                          : '/admin/uploads'
                    }
                    label="Catalogue"
                    section="Catalogue"
                    active={activeGroup === groupId}
                    icon={<Package size={22} strokeWidth={2} aria-hidden />}
                  />
                ) : (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span className="admin-nav-group-toggle-icon" aria-hidden>
                      <Package size={16} strokeWidth={2} />
                    </span>
                    <span>Catalogue</span>
                    <span className="admin-nav-group-chevron" aria-hidden>
                      {open ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
                    </span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  {canViewCatalogue && (
                    <AdminSidebarNavItem
                      to="/admin/catalogue"
                      end
                      label="Catalogue"
                      section="Catalogue"
                      collapsed={sidebarCollapsed}
                      icon={<ClipboardList size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewCatalogue && (
                    <AdminSidebarNavItem
                      to="/admin/catalogue/categories"
                      label="Manage categories"
                      section="Catalogue"
                      collapsed={sidebarCollapsed}
                      sub
                      icon={<FolderTree size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canEditCatalogue && (
                    <AdminSidebarNavItem
                      to={CATALOGUE_TOOLS.hub}
                      label="Product & category tools"
                      section="Catalogue"
                      collapsed={sidebarCollapsed}
                      sub
                      isActive={({ isActive }) =>
                        isActive || location.pathname.startsWith(`${CATALOGUE_TOOLS.hub}/`)
                      }
                      icon={<Wrench size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewStock && (
                    <AdminSidebarNavItem
                      to="/admin/stock"
                      label="Stock take"
                      section="Stock"
                      collapsed={sidebarCollapsed}
                      icon={<Package size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewStock && (
                    <AdminSidebarNavItem
                      to="/admin/locations"
                      label="Locations"
                      section="Stock"
                      collapsed={sidebarCollapsed}
                      icon={<MapPin size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewStock && (
                    <AdminSidebarNavItem
                      to="/admin/delivery-windows"
                      label="Delivery windows"
                      section="Stock"
                      collapsed={sidebarCollapsed}
                      icon={<CalendarClock size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewUploads && (
                    <AdminSidebarNavItem
                      to="/admin/uploads"
                      label="Brochure & files"
                      section="Catalogue"
                      collapsed={sidebarCollapsed}
                      icon={<FileText size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                </div>
              </div>
            )
          })()}
          </div>

          <div className="admin-nav-section">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Finance</div>}

          {(canViewPricing || canViewReports || canViewAccounting) && (() => {
            const groupId = 'finance'
            const forceOpen =
              location.pathname === '/admin/pricing' ||
              location.pathname === '/admin/reports' ||
              location.pathname === '/admin/accounting'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {sidebarCollapsed ? (
                  <AdminSidebarGroupRail
                    to={canViewAccounting ? '/admin/accounting' : canViewPricing ? '/admin/pricing' : '/admin/reports'}
                    label="Finance"
                    section="Finance"
                    active={activeGroup === groupId}
                    icon={<PoundSterling size={22} strokeWidth={2} aria-hidden />}
                  />
                ) : (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span className="admin-nav-group-toggle-icon" aria-hidden>
                      <PoundSterling size={16} strokeWidth={2} />
                    </span>
                    <span>Finance</span>
                    <span className="admin-nav-group-chevron" aria-hidden>
                      {open ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
                    </span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  {canViewAccounting && (
                    <AdminSidebarNavItem
                      to="/admin/accounting"
                      label="Accounting"
                      section="Finance"
                      collapsed={sidebarCollapsed}
                      icon={<Landmark size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewPricing && (
                    <AdminSidebarNavItem
                      to="/admin/pricing"
                      label="Pricing & margin"
                      section="Finance"
                      collapsed={sidebarCollapsed}
                      icon={<PoundSterling size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewReports && (
                    <AdminSidebarNavItem
                      to="/admin/reports"
                      label="Reports"
                      section="Finance"
                      collapsed={sidebarCollapsed}
                      icon={<BarChart3 size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                </div>
              </div>
            )
          })()}
          </div>

          <div className="admin-nav-section">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Team &amp; access</div>}

          {(canViewUsers || canViewTickets || canViewPermissions) && (() => {
            const groupId = 'users'
            const forceOpen =
              location.pathname.startsWith('/admin/users') ||
              location.pathname.startsWith('/admin/tickets') ||
              location.pathname === '/admin/permissions'
            const open = groupIsOpen(groupId, forceOpen)
            return (
              <div className={`admin-nav-group ${open ? 'admin-nav-group--open' : ''}`}>
                {sidebarCollapsed ? (
                  <AdminSidebarGroupRail
                    to={
                      canViewUsers
                        ? '/admin/users'
                        : canViewTickets
                          ? '/admin/tickets'
                          : '/admin/permissions'
                    }
                    label="Team & access"
                    section="Admin"
                    active={activeGroup === groupId}
                    icon={<Shield size={22} strokeWidth={2} aria-hidden />}
                  />
                ) : (
                  <button
                    type="button"
                    className="admin-nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => setGroupOpen(groupId, !open)}
                  >
                    <span className="admin-nav-group-toggle-icon" aria-hidden>
                      <Shield size={16} strokeWidth={2} />
                    </span>
                    <span>Team, Support &amp; Access</span>
                    <span className="admin-nav-group-chevron" aria-hidden>
                      {open ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
                    </span>
                  </button>
                )}
                <div className={`admin-nav-children ${open ? 'open' : ''}`}>
                  {canViewUsers && (
                    <AdminSidebarNavItem
                      to="/admin/users"
                      label="Team users"
                      section="Team"
                      collapsed={sidebarCollapsed}
                      icon={<Users size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewUsers && (
                    <AdminSidebarNavItem
                      to="/admin/users/create"
                      label="Create team user"
                      section="Team"
                      collapsed={sidebarCollapsed}
                      icon={<Plus size={18} strokeWidth={2.25} aria-hidden />}
                    />
                  )}
                  {canViewUsers && (
                    <AdminSidebarNavItem
                      to="/admin/applications"
                      label="Account applications"
                      section="Team"
                      collapsed={sidebarCollapsed}
                      icon={<ClipboardCheck size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewTickets && (
                    <AdminSidebarNavItem
                      to="/admin/tickets"
                      label="Tickets"
                      section="Support"
                      collapsed={sidebarCollapsed}
                      icon={<Ticket size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                  {canViewPermissions && (
                    <AdminSidebarNavItem
                      to="/admin/permissions"
                      label="Permissions"
                      section="Access"
                      collapsed={sidebarCollapsed}
                      icon={<Lock size={18} strokeWidth={2} aria-hidden />}
                    />
                  )}
                </div>
              </div>
            )
          })()}
          </div>

          <div className="admin-nav-section admin-nav-section--compact">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Links</div>}
            <div className="admin-nav-group">
              <Link to="/" className="admin-nav-item" {...adminNavTip('Customer portal', 'Links')}>
                <span className="admin-nav-icon">
                  <ArrowUpRight size={18} strokeWidth={2} aria-hidden />
                </span>
                {!sidebarCollapsed && <span>Customer portal</span>}
              </Link>
            </div>
          </div>

          <div className="admin-nav-section admin-nav-section--bottom">
            {!sidebarCollapsed && <div className="admin-nav-section-label">Account</div>}
          <div className="admin-nav-group admin-nav-group--bottom">
            <AdminSidebarNavItem
              to="/admin/notifications"
              label="Notifications"
              section="Account"
              collapsed={sidebarCollapsed}
              icon={<Mail size={18} strokeWidth={2} aria-hidden />}
            />
            <AdminSidebarNavItem
              to="/admin/settings"
              label="Settings"
              section="Account"
              collapsed={sidebarCollapsed}
              icon={<Settings size={18} strokeWidth={2} aria-hidden />}
            />
            <AdminSidebarNavItem
              to="/admin/support-manual"
              label="Support manual"
              section="Account"
              collapsed={sidebarCollapsed}
              icon={<BookOpen size={18} strokeWidth={2} aria-hidden />}
            />
          </div>
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
                {canViewOrders && <option value="/admin/pick-lists">Pick lists</option>}
                {canViewOrders && <option value="/admin/orders">Orders &amp; quotes</option>}
                {canViewOrders && <option value="/admin/create-order">Create order</option>}
                {canViewOrders && <option value="/admin/create-quote">Create quote</option>}
                {canViewCustomers && <option value="/admin/customers">Customers</option>}
                {canViewCustomers && <option value="/admin/crm/open-orders">CRM open orders</option>}
                {canViewCatalogue && <option value="/admin/catalogue">Catalogue</option>}
                {canViewCatalogue && <option value="/admin/catalogue/categories">Categories</option>}
                {canEditCatalogue && <option value={CATALOGUE_TOOLS.hub}>Product &amp; category tools</option>}
                {canViewStock && <option value="/admin/stock">Stock take</option>}
                {canViewAccounting && <option value="/admin/accounting">Accounting</option>}
                {canViewPricing && <option value="/admin/pricing">Pricing &amp; margin</option>}
                {canViewReports && <option value="/admin/reports">Reports</option>}
                {canViewTickets && <option value="/admin/tickets">Support tickets</option>}
                {canViewUsers && <option value="/admin/users">Team users</option>}
                <option value="/admin/settings">Settings</option>
                <option value="/admin/support-manual">Support manual</option>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  {staffProfile?.display_name || staffProfile?.role || 'Staff'}
                  <ChevronDown size={14} strokeWidth={2} aria-hidden />
                </span>
              </button>
              <div className="admin-dropdown-menu admin-dropdown-menu--right">
                <Link to="/admin/settings" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Settings
                </Link>
                <Link to="/admin/support-manual" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Support manual
                </Link>
                <Link to="/" className="admin-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                  Customer portal
                </Link>
                <button type="button" className="admin-dropdown-item" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <AdminMainBackdrop />
          <div className="admin-main-inner">
            {!canAccessPage ? (
              <div className="admin-page admin-no-access">
                <div className="card admin-card">
                  <h2>No access</h2>
                  <p>You don&apos;t have permission to view this section.</p>
                  <Link to="/admin" className="btn btn-outline">Back to dashboard</Link>
                </div>
              </div>
            ) : (
              <Outlet key={location.pathname + location.search} />
            )}
          </div>
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

      <AdminQuickActionsFab />

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


