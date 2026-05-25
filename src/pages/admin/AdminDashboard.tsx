import { useEffect, useMemo, useState } from 'react'
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
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { withBasePath } from '@/lib/basePath'
import { useStaff } from '@/hooks/useStaff'
import { AreaTrendChart } from '@/components/charts/AreaTrendChart'
import { BarTrendChart } from '@/components/charts/BarTrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { DashboardHeroRibbon, StatOrdersGlyph, StatRevenueGlyph } from '@/components/dashboard/DashboardDecorSvgs'
import { VisualStatCard } from '@/components/dashboard/VisualStatCard'
import { buildDailyCounts, buildDailyRevenue, formatDashboardCurrency, sparklineFromPoints, statusBreakdown } from '@/lib/dashboardAnalytics'

type RecentOrder = {
  id: string
  reference: string | null
  created_at: string
  status: string
  total_inc_vat: number
}

type TrendOrder = { created_at: string; status: string; total_inc_vat: number }

const WORKFLOW_ACTIONS: { heading: string; items: { to: string; label: string; Icon: LucideIcon }[] }[] = [
  {
    heading: 'Orders & quotes',
    items: [
      { to: '/admin/orders/processing', label: 'Process orders', Icon: Zap },
      { to: '/admin/orders', label: 'All orders & quotes', Icon: ClipboardList },
      { to: '/admin/create-quote', label: 'Create quote', Icon: PlusCircle },
      { to: '/admin/create-order', label: 'Create order', Icon: PlusCircle },
      { to: '/admin/pick-lists', label: 'Pick lists', Icon: ScanBarcode },
      { to: '/admin/delivery-schedule', label: 'Delivery schedule', Icon: Calendar },
      { to: '/admin/orders/reminders', label: 'Reminders', Icon: Bell },
    ],
  },
  {
    heading: 'Customers & CRM',
    items: [
      { to: '/admin/customers', label: 'Customers', Icon: Users },
      { to: '/admin/crm/open-orders', label: 'Open orders', Icon: ShoppingCart },
      { to: '/admin/crm/sales-board', label: 'Sales board', Icon: Kanban },
      { to: '/admin/crm/calendar', label: 'Activity calendar', Icon: Calendar },
      { to: '/admin/crm/activity', label: 'Activity list', Icon: Activity },
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
    quotationsCount: 0,
    ticketsOpenCount: 0,
    pickListsOpenCount: 0,
    overdueActivitiesCount: 0,
    locationsCount: 0,
    customersCount: 0,
    productsCount: 0,
    assembliesCount: 0,
    revenuePaid: 0,
    recentOrders: [] as RecentOrder[],
  })
  const [trendOrders, setTrendOrders] = useState<TrendOrder[]>([])

  useEffect(() => {
    async function load() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayIso = todayStart.toISOString()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const thirtyIso = thirtyDaysAgo.toISOString()
      const [
        ordersRes,
        placedRes,
        todayRes,
        quotationsRes,
        ticketsRes,
        pickListsRes,
        overdueActivitiesRes,
        locationsRes,
        customersRes,
        productsRes,
        assembliesRes,
        revenueRes,
        recentRes,
        trendRes,
      ] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', thirtyIso).neq('status', 'cancelled').eq('is_archived', false),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'placed').eq('is_archived', false),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayIso).neq('status', 'cancelled').eq('is_archived', false),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'quotation').eq('is_archived', false),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('pick_lists').select('id', { count: 'exact', head: true }).in('status', ['generated', 'picking']),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .is('completed_at', null)
          .not('due_at', 'is', null)
          .lt('due_at', new Date().toISOString()),
        supabase.from('locations').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('assemblies').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('orders').select('total_inc_vat').in('status', ['paid', 'invoiced']).eq('is_archived', false),
        supabase.from('orders').select('id, reference, created_at, status, total_inc_vat').eq('is_archived', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('orders').select('created_at, status, total_inc_vat').gte('created_at', thirtyIso).eq('is_archived', false).neq('status', 'cancelled'),
      ])

      const revenuePaid = (revenueRes.data ?? []).reduce((sum, r) => sum + Number(r.total_inc_vat || 0), 0)

      setStats({
        ordersCount: ordersRes.count ?? 0,
        ordersPlaced: placedRes.count ?? 0,
        ordersToday: todayRes.count ?? 0,
        quotationsCount: quotationsRes.count ?? 0,
        ticketsOpenCount: ticketsRes.count ?? 0,
        pickListsOpenCount: pickListsRes.count ?? 0,
        overdueActivitiesCount: overdueActivitiesRes.count ?? 0,
        locationsCount: locationsRes.count ?? 0,
        customersCount: customersRes.count ?? 0,
        productsCount: productsRes.count ?? 0,
        assembliesCount: assembliesRes.count ?? 0,
        revenuePaid,
        recentOrders: (recentRes.data ?? []) as RecentOrder[],
      })
      setTrendOrders((trendRes.data ?? []) as TrendOrder[])
      setLoading(false)
    }
    load()
  }, [])

  const orderVolumeTrend = useMemo(() => buildDailyCounts(trendOrders, 30), [trendOrders])
  const revenueTrend = useMemo(
    () => buildDailyRevenue(trendOrders.filter((o) => ['paid', 'invoiced', 'placed'].includes(o.status)), 30),
    [trendOrders],
  )
  const statusChart = useMemo(() => statusBreakdown(trendOrders), [trendOrders])
  const orderSpark = useMemo(() => sparklineFromPoints(orderVolumeTrend), [orderVolumeTrend])
  const revenueSpark = useMemo(() => sparklineFromPoints(revenueTrend), [revenueTrend])

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
        <div className="dashboard-visual-metrics dashboard-visual-metrics--staff dashboard-visual-metrics--skeleton">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <div key={i} className="visual-stat-card visual-stat-card--skeleton" aria-hidden />
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
      <header className="admin-dashboard-hero admin-dashboard-hero-visual">
        <div className="admin-dashboard-hero-text">
          <h1 className="admin-dashboard-hero-title">{greeting}, {displayName}</h1>
          <p className="admin-dashboard-hero-meta">{dateStr}</p>
          <p className="admin-dashboard-hero-lead">
            Use this as your daily workspace: process orders first, then follow up customers, then maintain stock and catalogue.
          </p>
          <div className="admin-dashboard-hero-quick">
            <Link to="/admin/create-quote" className="btn btn-small">
              Quick quote
            </Link>
            <Link to="/admin/create-order" className="btn btn-outline btn-small">
              Quick order
            </Link>
          </div>
        </div>
        <DashboardHeroRibbon className="admin-dashboard-hero-ribbon" />
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

      <section className="dashboard-visual-metrics dashboard-visual-metrics--staff" aria-label="Key metrics">
        <VisualStatCard value={stats.ordersCount} label="Orders (30 days)" icon={<StatOrdersGlyph />} sparkline={orderSpark} to="/admin/orders" hint="View all →" />
        <VisualStatCard value={stats.ordersPlaced} label="Awaiting process" icon={<Zap size={22} strokeWidth={2} />} to="/admin/orders/processing" hint="Process →" />
        <VisualStatCard value={stats.ordersToday} label="Orders today" icon={<Calendar size={22} strokeWidth={2} />} />
        <VisualStatCard value={stats.quotationsCount} label="Quotations open" icon={<FileText size={22} strokeWidth={2} />} to="/admin/orders" hint="Quotes →" />
        <VisualStatCard value={formatDashboardCurrency(stats.revenuePaid)} label="Paid / invoiced" icon={<StatRevenueGlyph />} sparkline={revenueSpark} accent="success" />
        <VisualStatCard value={stats.ticketsOpenCount} label="Open tickets" icon={<Bell size={22} strokeWidth={2} />} to="/admin/tickets" hint="Support →" />
        <VisualStatCard value={stats.pickListsOpenCount} label="Pick lists active" icon={<ScanBarcode size={22} strokeWidth={2} />} to="/admin/pick-lists" hint="Warehouse →" />
        <VisualStatCard
          value={stats.overdueActivitiesCount}
          label="Overdue CRM tasks"
          icon={<Activity size={22} strokeWidth={2} />}
          to="/admin/crm/calendar"
          hint="Calendar →"
          accent={stats.overdueActivitiesCount > 0 ? 'gold' : undefined}
        />
        <VisualStatCard value={stats.customersCount} label="Customers" icon={<Users size={22} strokeWidth={2} />} to="/admin/customers" />
        <VisualStatCard value={stats.productsCount} label="Products" icon={<Package size={22} strokeWidth={2} />} to="/admin/catalogue" />
        <VisualStatCard value={stats.assembliesCount} label="Assemblies" icon={<BookOpen size={22} strokeWidth={2} />} to="/admin/catalogue" />
        <VisualStatCard value={stats.locationsCount} label="Depot locations" icon={<MapPin size={22} strokeWidth={2} />} to="/admin/locations" />
      </section>
      <section className="admin-dashboard-charts-section" aria-label="Analytics">
        <h2><BarChart3 size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden /> Last 30 days</h2>
        <div className="dashboard-charts-grid">
          <article className="chart-card">
            <div className="chart-card-head"><div><h3>Order volume</h3><p>Daily orders</p></div></div>
            <BarTrendChart data={orderVolumeTrend} ariaLabel="Order volume" />
          </article>
          <article className="chart-card">
            <div className="chart-card-head"><div><h3>Status mix</h3></div></div>
            <DonutChart data={statusChart} ariaLabel="Status mix" />
          </article>
          <article className="chart-card">
            <div className="chart-card-head"><div><h3>Revenue trend</h3><p>Placed, invoiced &amp; paid</p></div></div>
            <AreaTrendChart data={revenueTrend} valueFormatter={formatDashboardCurrency} ariaLabel="Revenue" />
          </article>
        </div>
      </section>
      <section className="dashboard-reports-preview" aria-label="Reports">
        <Link to="/admin/reports" className="report-preview-card"><strong>{trendOrders.length}</strong><span>Orders (30d) — full reports</span></Link>
        <Link to="/admin/reports" className="report-preview-card"><strong>{formatDashboardCurrency(revenueTrend.reduce((s, p) => s + p.value, 0))}</strong><span>30-day revenue</span></Link>
        <Link to="/admin/crm/sales-board" className="report-preview-card"><strong>{stats.quotationsCount}</strong><span>Open quotations — sales board</span></Link>
        <Link to="/admin/delivery-schedule" className="report-preview-card"><strong>{stats.ordersPlaced}</strong><span>Placed orders — delivery week</span></Link>
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
              <Link to="/admin/create-quote" className="btn">Create quote</Link>
              <Link to="/admin/create-order" className="btn btn-outline">Create order</Link>
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
