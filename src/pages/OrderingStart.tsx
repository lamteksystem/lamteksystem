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
          <h2 className="ordering-wizard-card-title">Tealbury kitchens</h2>
          <p className="ordering-wizard-card-desc">
            Curated Tealbury packaged kitchen lines (separate pricelist). Use this when ordering complete configured kitchens rather
            than individual Lamtek components.
          </p>
        </Link>
        <Link to="/ordering" className="ordering-wizard-card ordering-wizard-card--link">
          <span className="ordering-wizard-card-icon ordering-wizard-card-icon--lucide" aria-hidden>
            <Compass size={30} strokeWidth={1.85} />
          </span>
          <h2 className="ordering-wizard-card-title">Manual order</h2>
          <p className="ordering-wizard-card-desc">
            Browse the full catalogue: pick component or complete units, filters, and search — no step-by-step questionnaire first.
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
