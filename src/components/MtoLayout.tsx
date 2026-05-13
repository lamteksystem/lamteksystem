import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { useDraftOrder } from '@/hooks/useDraftOrder'
import { supabase } from '@/lib/supabase'
import { VAT_RATE } from '@/lib/tax'

export const MtoCartRefreshContext = createContext<() => void>(() => {})

export function useMtoCartRefresh() {
  return useContext(MtoCartRefreshContext)
}

export default function MtoLayout() {
  const { draftOrder, refresh } = useDraftOrder()
  const [lineCount, setLineCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)
  const [cartVersion, setCartVersion] = useState(0)

  const refreshCart = () => {
    setCartVersion((v) => v + 1)
    refresh()
  }

  useEffect(() => {
    if (!draftOrder?.id) {
      setLineCount(0)
      setCartTotal(0)
      return
    }
    supabase
      .from('order_lines')
      .select('quantity, unit_price')
      .eq('order_id', draftOrder.id)
      .then(({ data }) => {
        const lines = data ?? []
        setLineCount(lines.reduce((s, l) => s + l.quantity, 0))
        setCartTotal(lines.reduce((s, l) => s + l.quantity * Number(l.unit_price), 0))
      })
  }, [draftOrder?.id, cartVersion])

  const mtoTabs = [
    { to: '/ordering', label: 'Standard sizes' },
    { to: '/ordering/mto', label: 'Choose type', end: true },
    { to: '/ordering/mto/non-standard', label: 'Non standard' },
    { to: '/ordering/mto/angled', label: 'MTM Angled' },
    { to: '/ordering/mto/framed', label: 'MTM Framed' },
    { to: '/ordering/mto/worktops-panels', label: 'MTM Worktops & Panels' },
  ]
  const otherTabs = [
    { to: '/ordering', label: 'Handles', hash: 'handles' },
    { to: '/ordering', label: 'Lighting', hash: 'lighting' },
    { to: '/ordering', label: 'Wirework', hash: 'wirework' },
    { to: '/ordering', label: 'Fittings', hash: 'fittings' },
    { to: '/ordering/mto/mouldings-accessories', label: 'Trims & pelmets (MTO)' },
  ]

  return (
    <MtoCartRefreshContext.Provider value={refreshCart}>
    <div className="mto-page">
      <PageNav backTo="/ordering" backLabel="Create order" />
      <div className="mto-tabs-row">
        <div className="mto-tabs mto-tabs--primary">
          {mtoTabs.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end ?? to === '/ordering'}
              className={({ isActive }) => `mto-tab ${isActive ? 'mto-tab--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className="mto-tabs mto-tabs--secondary">
          {otherTabs.map(({ to, label, hash }) => (
            <NavLink
              key={to + (hash || '')}
              to={hash ? `${to}#${hash}` : to}
              end={!hash}
              className={({ isActive }) => `mto-tab mto-tab--small ${isActive ? 'mto-tab--active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mto-body">
        <main className="mto-main">
          <Outlet />
        </main>
        <aside className="mto-cart">
          <div className="mto-cart-box card">
            <h2 className="mto-cart-title">Order cart</h2>
            {lineCount === 0 ? (
              <p className="mto-cart-empty">You have no items in your cart.</p>
            ) : (
              <>
                <p className="mto-cart-count">{lineCount} item{lineCount !== 1 ? 's' : ''} in cart</p>
                <p className="mto-cart-total">Total ex VAT £{cartTotal.toFixed(2)}</p>
                <p className="mto-cart-total">Total inc VAT £{(cartTotal * VAT_RATE).toFixed(2)}</p>
              </>
            )}
            <Link to="/ordering/cart" className="btn btn-block mto-cart-btn">
              View cart →
            </Link>
          </div>
        </aside>
      </div>
    </div>
    </MtoCartRefreshContext.Provider>
  )
}
