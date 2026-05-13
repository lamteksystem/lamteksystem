import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATALOG_PROGRAM } from '@/lib/catalogProgram'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { OrderRow } from '@/types/database'
import { formatOrderReferenceOrFallback } from '@/lib/orderDisplayName'

export default function Dashboard() {
  const effectiveUserId = useEffectiveUserId()
  const { draftOrder } = useDraftOrder()
  const [stats, setStats] = useState<{ products: number; categories: number; documents: number } | null>(null)
  const [draftLineCount, setDraftLineCount] = useState(0)
  const [recentOrders, setRecentOrders] = useState<(Pick<OrderRow, 'id' | 'reference' | 'created_at' | 'status'>)[]>([])

  useEffect(() => {
    Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .eq('catalog_program', CATALOG_PROGRAM.LAMTEK),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
    ]).then(([p, c, d]) => {
      setStats({
        products: p.count ?? 0,
        categories: c.count ?? 0,
        documents: d.count ?? 0,
      })
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
    supabase
      .from('orders')
      .select('id, reference, created_at, status')
      .eq('user_id', effectiveUserId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentOrders((data ?? []) as typeof recentOrders))
  }, [effectiveUserId])

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <h1 className="dashboard-hero-title">Carcasses, components &amp; complete solutions</h1>
        <p className="dashboard-hero-tagline">
          Lamtek — component and complete-unit ordering, brochures, and pricelists in one place.
        </p>
      </section>

      <section className="dashboard-value-strip">
        <Link to="/ordering/start" className="dashboard-value-item dashboard-value-item--link">
          <span className="dashboard-value-icon">◇</span>
          <span>Component &amp; complete ordering</span>
        </Link>
        <Link to="/downloads" className="dashboard-value-item dashboard-value-item--link">
          <span className="dashboard-value-icon">▤</span>
          <span>Brochures &amp; pricelists</span>
        </Link>
        <Link to="/account" className="dashboard-value-item dashboard-value-item--link">
          <span className="dashboard-value-icon">◉</span>
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
        <section className="dashboard-stats">
          <Link to="/products" className="dashboard-stat dashboard-stat-link">
            <span className="dashboard-stat-value">{stats.products}</span>
            <span className="dashboard-stat-label">Products</span>
          </Link>
          <div className="dashboard-stat" title="Ranges / categories">
            <span className="dashboard-stat-value">{stats.categories}</span>
            <span className="dashboard-stat-label">Ranges / categories</span>
          </div>
          <Link to="/downloads" className="dashboard-stat dashboard-stat-link">
            <span className="dashboard-stat-value">{stats.documents}</span>
            <span className="dashboard-stat-label">Downloads</span>
          </Link>
        </section>
      )}

      {draftLineCount > 0 && (
        <section className="dashboard-draft card">
          <h2 className="dashboard-draft-title">Your draft order</h2>
          <p className="dashboard-draft-text">
            You have <strong>{draftLineCount}</strong> item{draftLineCount !== 1 ? 's' : ''} in your cart. Review or add more, then save as quotation or place order.
          </p>
          <div className="dashboard-draft-actions">
            <Link to="/ordering/cart" className="btn">Continue to cart →</Link>
            <Link to="/ordering" className="btn btn-outline">Add more items</Link>
          </div>
        </section>
      )}

      {recentOrders.length > 0 && (
        <section className="dashboard-recent card">
          <h2 className="dashboard-recent-title">Recent orders</h2>
          <ul className="dashboard-recent-list">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link to={`/account/orders/${o.id}`}>
                  {formatOrderReferenceOrFallback(o)}
                </Link>
                <span className="dashboard-recent-meta">
                  {new Date(o.created_at).toLocaleDateString()} · {o.status}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/account" className="dashboard-recent-link">View all in My account →</Link>
        </section>
      )}

      <section className="dashboard-ctas">
        <h2 className="dashboard-ctas-title">Quick actions</h2>
        <div className="dashboard-grid">
          <Link to="/products" className="dashboard-card card">
            <h2>Browse products</h2>
            <p>Door ranges, cabinets, handles, lighting, and accessories. Filter by category and search.</p>
            <span className="dashboard-cta">View ranges →</span>
          </Link>
          <Link to="/ordering/start" className="dashboard-card card">
            <h2>Create order</h2>
            <p>Build a complete kitchen or bedroom estimate — add components or complete units and review in the cart.</p>
            <span className="dashboard-cta">Start order →</span>
          </Link>
          <Link to="/downloads" className="dashboard-card card">
            <h2>Downloads</h2>
            <p>Price lists, technical information, brochures, and order forms.</p>
            <span className="dashboard-cta">View downloads →</span>
          </Link>
          <Link to="/depots" className="dashboard-card card">
            <h2>Depots &amp; locations</h2>
            <p>Lamtek depots and contact details (where configured for your account).</p>
            <span className="dashboard-cta">View depots →</span>
          </Link>
          <Link to="/account" className="dashboard-card card">
            <h2>My account</h2>
            <p>Outstanding orders, balance owed, and order history.</p>
            <span className="dashboard-cta">Account →</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
