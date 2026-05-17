import { Link } from 'react-router-dom'
import { Compass, LayoutGrid, ListChecks } from 'lucide-react'
import { PageNav } from '@/components/PageNav'

export default function OrderingStart() {
  return (
    <div className="ordering-wizard">
      <PageNav backTo="/" backLabel="Dashboard" />
      <div className="ordering-wizard-header">
        <h1>Create order</h1>
        <p className="ordering-wizard-intro">
          Choose how you want to begin. You can still switch filters, range, and cart from the next screens.
        </p>
      </div>
      <div className="ordering-wizard-cards">
        <Link to="/ordering/tealbury" className="ordering-wizard-card ordering-wizard-card--link">
          <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
            <LayoutGrid size={30} strokeWidth={1.85} />
          </span>
          <h2 className="ordering-wizard-card-title">Tealbury product search</h2>
          <p className="ordering-wizard-card-desc">
            Same industry-style search for Tealbury packaged kitchen lines (separate pricelist). Filter by door range, stage lines, then add to your order.
          </p>
        </Link>
        <Link to="/ordering" className="ordering-wizard-card ordering-wizard-card--link">
          <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
            <Compass size={30} strokeWidth={1.85} />
          </span>
          <h2 className="ordering-wizard-card-title">Lamtek product search</h2>
          <p className="ordering-wizard-card-desc">
            Professional catalogue search with filters, product details, customer pricing and a staging basket — the standard way to build Lamtek orders.
          </p>
        </Link>
        <Link to="/ordering?flow=guided" className="ordering-wizard-card ordering-wizard-card--link">
          <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
            <ListChecks size={30} strokeWidth={1.85} />
          </span>
          <h2 className="ordering-wizard-card-title">Guided order</h2>
          <p className="ordering-wizard-card-desc">
            Step through order type, range, component or complete mode, then optional project details — ideal if you want a clear path.
          </p>
        </Link>
      </div>
    </div>
  )
}
