import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Kanban,
  MapPin,
  Package,
  ScanBarcode,
  PlusCircle,
  PoundSterling,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { withBasePath } from '@/lib/basePath'
import { useStaff } from '@/hooks/useStaff'

type RecentOrder = {
  id: string
  reference: string | null
  created_at: string
  status: string
  total_inc_vat: number
}

const WORKFLOW_ACTIONS: { heading: string; items: { to: string; label: string; Icon: LucideIcon }[] }[] = [
  {
    heading: 'Orders',
    items: [
      { to: '/admin/orders/processing', label: 'Process orders', Icon: Zap },
      { to: '/admin/orders', label: 'All orders', Icon: ClipboardList },
      { to: '/admin/create-order', label: 'Create order', Icon: PlusCircle },
      { to: '/admin/pick-lists', label: 'Pick lists', Icon: ScanBarcode },
      { to: '/admin/orders/reminders', label: 'Reminders', Icon: Bell },
    ],
  },
  {
    heading: 'Customers & CRM',
    items: [
      { to: '/admin/customers', label: 'Customers', Icon: Users },
      { to: '/admin/crm/open-orders', label: 'Open orders', Icon: ShoppingCart },
      { to: '/admin/crm/activity', label: 'Activity', Icon: Activity },
      { to: '/admin/crm/pipeline', label: 'Pipeline', Icon: Kanban },
    ],
  },
  {
    heading: 'Catalogue & operations',
    items: [
      { to: '/admin/catalogue', label: 'Catalogue', Icon: BookOpen },
      { to: '/admin/stock', label: 'Stock take', Icon: ClipboardCheck },
      { to: '/admin/locations', label: 'Locations', Icon: MapPin },
      { to: '/admin/uploads', label: 'Brochure & files', Icon: FileText },
      { to: '/admin/reports', label: 'Reports', Icon: BarChart3 },
    ],
  },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    draft: 'admin-status-draft',
    quotation: 'admin-status-quotation',
    placed: 'admin-status-placed',
    invoiced: 'admin-status-invoiced',
    paid: 'admin-status-paid',
    cancelled: 'admin-status-cancelled',
  }
  return m[s] ?? ''
}

export default function AdminDashboard() {
  const { staffProfile } = useStaff()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    ordersCount: 0,
    ordersPlaced: 0,
    ordersToday: 0,
    customersCount: 0,
    productsCount: 0,
    assembliesCount: 0,
    revenuePaid: 0,
    recentOrders: [] as RecentOrder[],
  })

  useEffect(() => {
    async function load() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayIso = todayStart.toISOString()

      const [
        ordersRes,
        placedRes,
        todayRes,
        customersRes,
        productsRes,
        assembliesRes,
        revenueRes,
        recentRes,
      ] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).neq('status', 'cancelled').eq('is_archived', false),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'placed').eq('is_archived', false),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayIso).neq('status', 'cancelled').eq('is_archived', false),
        supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('assemblies').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('orders').select('total_inc_vat').in('status', ['paid', 'invoiced']).eq('is_archived', false),
        supabase.from('orders').select('id, reference, created_at, status, total_inc_vat').eq('is_archived', false).order('created_at', { ascending: false }).limit(10),
      ])

      const revenuePaid = (revenueRes.data ?? []).reduce((sum, r) => sum + Number(r.total_inc_vat || 0), 0)

      setStats({
        ordersCount: ordersRes.count ?? 0,
        ordersPlaced: placedRes.count ?? 0,
        ordersToday: todayRes.count ?? 0,
        customersCount: customersRes.count ?? 0,
        productsCount: productsRes.count ?? 0,
        assembliesCount: assembliesRes.count ?? 0,
        revenuePaid,
        recentOrders: (recentRes.data ?? []) as RecentOrder[],
      })
      setLoading(false)
    }
    load()
  }, [])

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()
  const displayName = staffProfile?.display_name?.trim() || 'Staff'
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="admin-dashboard admin-dashboard--loading">
        <div className="admin-dashboard-hero admin-dashboard-hero--skeleton">
          <div className="admin-dashboard-hero-title-skeleton" />
          <div className="admin-dashboard-hero-meta-skeleton" />
        </div>
        <div className="admin-dashboard-metrics admin-dashboard-metrics--skeleton">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="admin-stat-card admin-stat-card--skeleton" />
          ))}
        </div>
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-hero">
        <div className="admin-dashboard-hero-text">
          <h1 className="admin-dashboard-hero-title">{greeting}, {displayName}</h1>
          <p className="admin-dashboard-hero-meta">{dateStr}</p>
          <p className="admin-dashboard-hero-lead">
            Use this as your daily workspace: process orders first, then follow up customers, then maintain stock and catalogue.
          </p>
        </div>
      </header>

      {stats.ordersPlaced > 0 && (
        <div className="admin-dashboard-attention">
          <span className="admin-dashboard-attention-icon" aria-hidden>
            <AlertTriangle size={22} strokeWidth={2} />
          </span>
          <span className="admin-dashboard-attention-text">
            <strong>{stats.ordersPlaced}</strong> order{stats.ordersPlaced !== 1 ? 's' : ''} placed and awaiting processing
          </span>
          <Link to="/admin/orders/processing" className="admin-dashboard-attention-btn">
            Process orders →
          </Link>
        </div>
      )}

      <section className="admin-dashboard-metrics" aria-label="Key metrics">
        <Link to="/admin/orders" className="admin-stat-card admin-stat-card--link admin-stat-card--orders">
          <span className="admin-stat-card-icon" aria-hidden>
            <ClipboardList size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{stats.ordersCount}</span>
          <span className="admin-stat-label">Total orders</span>
          <span className="admin-stat-card-hint">View all →</span>
        </Link>
        <Link to="/admin/orders/processing" className="admin-stat-card admin-stat-card--link admin-stat-card--placed">
          <span className="admin-stat-card-icon" aria-hidden>
            <Zap size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{stats.ordersPlaced}</span>
          <span className="admin-stat-label">Awaiting process</span>
          <span className="admin-stat-card-hint">Process →</span>
        </Link>
        <div className="admin-stat-card admin-stat-card--today">
          <span className="admin-stat-card-icon" aria-hidden>
            <Calendar size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{stats.ordersToday}</span>
          <span className="admin-stat-label">Orders today</span>
        </div>
        <Link to="/admin/customers" className="admin-stat-card admin-stat-card--link admin-stat-card--customers">
          <span className="admin-stat-card-icon" aria-hidden>
            <Users size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{stats.customersCount}</span>
          <span className="admin-stat-label">Customers</span>
          <span className="admin-stat-card-hint">View →</span>
        </Link>
        <Link to="/admin/catalogue" className="admin-stat-card admin-stat-card--link admin-stat-card--products">
          <span className="admin-stat-card-icon" aria-hidden>
            <Package size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{stats.productsCount}</span>
          <span className="admin-stat-label">Products</span>
          <span className="admin-stat-card-hint">Catalogue →</span>
        </Link>
        <div className="admin-stat-card admin-stat-card--revenue">
          <span className="admin-stat-card-icon" aria-hidden>
            <PoundSterling size={24} strokeWidth={2} />
          </span>
          <span className="admin-stat-value">{formatCurrency(stats.revenuePaid)}</span>
          <span className="admin-stat-label">Paid / invoiced value</span>
        </div>
      </section>

      <div className="admin-dashboard-main">
        <section className="admin-dashboard-section admin-dashboard-recent">
          <div className="admin-dashboard-section-head">
            <h2>Recent orders</h2>
            <Link to="/admin/orders" className="admin-dashboard-section-link">View all orders →</Link>
          </div>
          {stats.recentOrders.length > 0 ? (
            <div className="admin-dashboard-table-wrap">
              <table className="admin-dashboard-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="admin-dashboard-table-num">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="admin-dashboard-table-ref">
                          {o.reference || `#${o.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td>{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        <span className={`admin-dashboard-status ${statusClass(o.status)}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="admin-dashboard-table-num">{formatCurrency(Number(o.total_inc_vat || 0))}</td>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="admin-dashboard-table-action">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-dashboard-empty">
              <p>No orders yet.</p>
              <Link to="/admin/create-order" className="btn">Create order for customer</Link>
            </div>
          )}
        </section>

        <section className="admin-dashboard-section admin-dashboard-actions">
          <h2>Workflow shortcuts</h2>
          <div className="admin-dashboard-demo-sequence">
            <p className="admin-dashboard-demo-sequence-intro">
              <strong>Sales-ready walk-through:</strong> open the{' '}
              <a href={withBasePath('/site/products')} target="_blank" rel="noopener noreferrer">
                public trade site (new tab)
              </a>
              , then sign in via <Link to="/login">customer login</Link> to show ordering and account. Back in admin:{' '}
              <Link to="/admin/orders/processing">process orders</Link>,{' '}
              <Link to="/admin/pick-lists">warehouse pick lists</Link>,{' '}
              <Link to="/admin/crm/open-orders">CRM open orders</Link>,{' '}
              <Link to="/admin/reports">reports</Link>.
            </p>
          </div>
          {WORKFLOW_ACTIONS.map((group) => (
            <div key={group.heading} className="admin-dashboard-actions-group">
              <p className="admin-dashboard-actions-group-title">{group.heading}</p>
              <div className="admin-dashboard-actions-grid">
                {group.items.map(({ to, label, Icon }) => (
                  <Link key={to} to={to} className="admin-quick-action-card">
                    <span className="admin-quick-action-icon" aria-hidden>
                      <Icon size={22} strokeWidth={2} />
                    </span>
                    <span className="admin-quick-action-label">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
