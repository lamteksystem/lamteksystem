import fs from 'fs'
import path from 'path'

const out = path.join(import.meta.dirname, '..', 'src/pages/Dashboard.tsx')
const content = `import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow } from '@/types/database'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'
import { BarTrendChart } from '@/components/charts/BarTrendChart'
import { DonutChart } from '@/components/charts/DonutChart'
import {
  AnimatedChartIllustration,
  DashboardHeroRibbon,
  StatDownloadsGlyph,
  StatOrdersGlyph,
  StatProductsGlyph,
} from '@/components/dashboard/DashboardDecorSvgs'
import { VisualStatCard } from '@/components/dashboard/VisualStatCard'
import {
  buildDailyCounts,
  formatDashboardCurrency,
  sparklineFromPoints,
  statusBreakdown,
} from '@/lib/dashboardAnalytics'

type UserOrderTrend = { created_at: string; status: string; total_inc_vat: number }

export default function Dashboard() {
  const effectiveUserId = useEffectiveUserId()
  const { draftOrder } = useDraftOrder()
  const [stats, setStats] = useState<{ products: number; categories: number; documents: number } | null>(null)
  const [draftLineCount, setDraftLineCount] = useState(0)
  const [recentOrders, setRecentOrders] = useState<(Pick<OrderRow, 'id' | 'reference' | 'created_at' | 'status' | 'total_inc_vat'>)[]>([])
  const [userOrders, setUserOrders] = useState<UserOrderTrend[]>([])
  const [orderTotals, setOrderTotals] = useState({ count: 0, spend: 0, open: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true).eq('catalog_program', CATALOG_PROGRAM.LAMTEK),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
    ]).then(([p, c, d]) => {
      setStats({ products: p.count ?? 0, categories: c.count ?? 0, documents: d.count ?? 0 })
    })
  }, [])

  useEffect(() => {
    if (!draftOrder?.id) {
      setDraftLineCount(0)
      return
    }
    supabase.from('order_lines').select('id', { count: 'exact', head: true }).eq('order_id', draftOrder.id).then(({ count }) => {
      setDraftLineCount(count ?? 0)
    })
  }, [draftOrder?.id])

  useEffect(() => {
    if (!effectiveUserId) return
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    Promise.all([
      supabase.from('orders').select('id, reference, created_at, status, total_inc_vat').eq('user_id', effectiveUserId).neq('status', 'draft').order('created_at', { ascending: false }).limit(5),
      supabase.from('orders').select('created_at, status, total_inc_vat').eq('user_id', effectiveUserId).neq('status', 'cancelled').gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('orders').select('status, total_inc_vat').eq('user_id', effectiveUserId).neq('status', 'cancelled'),
    ]).then(([recentRes, trendRes, allRes]) => {
      setRecentOrders((recentRes.data ?? []) as typeof recentOrders)
      const trend = (trendRes.data ?? []) as UserOrderTrend[]
      setUserOrders(trend)
      const all = (allRes.data ?? []) as { status: string; total_inc_vat: number }[]
      const spend = all.filter((o) => ['placed', 'invoiced', 'paid'].includes(o.status)).reduce((s, o) => s + Number(o.total_inc_vat || 0), 0)
      const open = all.filter((o) => ['placed', 'quotation'].includes(o.status)).length
      setOrderTotals({ count: all.length, spend, open })
    })
  }, [effectiveUserId])

  const orderVolumeTrend = useMemo(() => buildDailyCounts(userOrders, 30), [userOrders])
  const statusChart = useMemo(() => statusBreakdown(userOrders), [userOrders])
  const orderSpark = useMemo(() => sparklineFromPoints(orderVolumeTrend), [orderVolumeTrend])

  return (
    <TAGV className="dashboard">
      <section className="dashboard-hero dashboard-hero-visual">
        <h1 className="dashboard-hero-title">Carcasses, components &amp; complete solutions</h1>
        <p className="dashboard-hero-tagline">Lamtek — component and complete-unit ordering, brochures, and pricelists in one place.</p>
        <AnimatedChartIllustration className="dashboard-hero-illustration" />
        <DashboardHeroRibbon className="admin-dashboard-hero-ribbon" />
      </section>

      {effectiveUserId && (
        <section className="dashboard-visual-metrics" aria-label="Your account overview">
          <VisualStatCard value={orderTotals.count} label="Your orders" icon={<StatOrdersGlyph />} sparkline={orderSpark} to="/account" />
          <VisualStatCard value={formatDashboardCurrency(orderTotals.spend)} label="Lifetime spend (placed+)" icon={<StatOrdersGlyph />} accent="success" to="/account" />
          <VisualStatCard value={orderTotals.open} label="Open / in progress" icon={<StatOrdersGlyph />} accent="gold" to="/account" />
        </section>
      )}

      {effectiveUserId && userOrders.length > 0 && (
        <section className="admin-dashboard-charts-section" aria-label="Your order activity">
          <h2>Your last 30 days</h2>
          <TAGV className="dashboard-charts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <article className="chart-card">
              <TAGV className="chart-card-head"><TAGV><h3>Order activity</h3><p>Orders per day</p></TAGV></TAGV>
              <BarTrendChart data={orderVolumeTrend} ariaLabel="Your order activity" />
            </article>
            <article className="chart-card">
              <TAGV className="chart-card-head"><TAGV><h3>Status breakdown</h3></TAGV></TAGV>
              <DonutChart data={statusChart} ariaLabel="Your order status mix" />
            </article>
          </TAGV>
        </section>
      )}

      <section className="dashboard-value-strip">
        <Link to="/ordering/start" className="dashboard-value-item dashboard-value-item--link">
          <StatProductsGlyph className="dashboard-value-icon-svg" />
          <span>Component &amp; complete ordering</span>
        </Link>
        <Link to="/downloads" className="dashboard-value-item dashboard-value-item--link">
          <StatDownloadsGlyph className="dashboard-value-icon-svg" />
          <span>Brochures &amp; pricelists</span>
        </Link>
        <Link to="/account" className="dashboard-value-item dashboard-value-item--link">
          <StatOrdersGlyph className="dashboard-value-icon-svg" />
          <span>Account &amp; order history</span>
        </Link>
      </section>

      <section className="dashboard-demo-journey card">
        <h2>Quick start</h2>
        <ol className="dashboard-demo-journey-list">
          <li><Link to="/products">Browse products</Link> and open product details.</li>
          <li><Link to="/ordering/start">Create an order</Link> (manual or guided), add lines, then review the <Link to="/ordering/cart">cart</Link>.</li>
          <li>Save as quotation or place the order; track progress under <Link to="/account">My account</Link>.</li>
        </ol>
      </section>

      {stats != null && (
        <section className="dashboard-visual-metrics">
          <VisualStatCard value={stats.products} label="Products" icon={<StatProductsGlyph />} to="/products" hint="Browse →" />
          <VisualStatCard value={stats.categories} label="Ranges / categories" icon={<StatProductsGlyph />} />
          <VisualStatCard value={stats.documents} label="Downloads" icon={<StatDownloadsGlyph />} to="/downloads" hint="View →" />
        </section>
      )}

      {draftLineCount > 0 && (
        <section className="dashboard-draft card">
          <h2 className="dashboard-draft-title">Your draft order</h2>
          <p className="dashboard-draft-text">You have <strong>{draftLineCount}</strong> item{draftLineCount !== 1 ? 's' : ''} in your cart.</p>
          <TAGV className="dashboard-draft-actions">
            <Link to="/ordering/cart" className="btn">Continue to cart →</Link>
            <Link to="/ordering" className="btn btn-outline">Add more items</Link>
          </TAGV>
        </section>
      )}

      {recentOrders.length > 0 && (
        <section className="dashboard-recent card">
          <h2 className="dashboard-recent-title">Recent orders</h2>
          <ul className="dashboard-recent-list">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link to={\`/account/orders/\${o.id}\`}>{formatOrderReferenceOrFallback(o)}</Link>
                <span className="dashboard-recent-meta">
                  {new Date(o.created_at).toLocaleDateString()} · {o.status}
                  {o.total_inc_vat != null ? \` · \${formatDashboardCurrency(Number(o.total_inc_vat))}\` : ''}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/account" className="dashboard-recent-link">View all in My account →</Link>
        </section>
      )}

      <section className="dashboard-ctas">
        <h2 className="dashboard-ctas-title">Quick actions</h2>
        <TAGV className="dashboard-grid">
          <Link to="/products" className="dashboard-card card"><h2>Browse products</h2><p>Door ranges, cabinets, handles, lighting, and accessories.</p><span className="dashboard-cta">View ranges →</span></Link>
          <Link to="/ordering/start" className="dashboard-card card"><h2>Create order</h2><p>Build a complete kitchen or bedroom estimate.</p><span className="dashboard-cta">Start order →</span></Link>
          <Link to="/downloads" className="dashboard-card card"><h2>Downloads</h2><p>Price lists, brochures, and order forms.</p><span className="dashboard-cta">View downloads →</span></Link>
          <Link to="/depots" className="dashboard-card card"><h2>Depots &amp; locations</h2><p>Lamtek depots and contact details.</p><span className="dashboard-cta">View depots →</span></Link>
          <Link to="/account" className="dashboard-card card"><h2>My account</h2><p>Outstanding orders and order history.</p><span className="dashboard-cta">Account →</span></Link>
        </TAGV>
      </section>
    </TAGV>
  )
}
`.replace(/TAGV/g, 'div')

fs.writeFileSync(out, content)
console.log('customer dashboard written')
