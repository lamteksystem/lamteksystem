import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `btn btn-small ${isActive ? '' : 'btn-outline'}`

export default function AdminCrmLayout() {
  const location = useLocation()
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">CRM</span>
      </div>
      <nav className="admin-crm-subnav" aria-label="CRM sections" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <NavLink to="/admin/crm/open-orders" className={tabClass} end>
          Open orders
        </NavLink>
        <NavLink to="/admin/crm/sales-board" className={tabClass}>
          Sales board
        </NavLink>
        <NavLink to="/admin/crm/activity" className={tabClass}>
          Activity list
        </NavLink>
        <NavLink to="/admin/crm/calendar" className={tabClass}>
          Week calendar
        </NavLink>
        <NavLink to="/admin/crm/pipeline" className={tabClass}>
          Sales pipeline
        </NavLink>
        <NavLink to="/admin/crm/directory" className={tabClass}>
          Directory
        </NavLink>
      </nav>
      <Outlet key={location.pathname + location.search} />
    </div>
  )
}
