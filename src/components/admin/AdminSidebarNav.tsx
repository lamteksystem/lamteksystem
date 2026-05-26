import type { ReactNode } from 'react'
import { NavLink, type NavLinkProps } from 'react-router-dom'

/** Instant tooltip + a11y label for collapsed sidebar rail items. */
export function adminNavTip(label: string, section?: string) {
  const tip = section ? `${label} · ${section}` : label
  return { 'data-tip': tip, 'aria-label': label } as const
}

export function AdminNavIcon({ children }: { children: ReactNode }) {
  return <span className="admin-nav-icon">{children}</span>
}

type AdminSidebarNavItemProps = {
  to: NavLinkProps['to']
  end?: boolean
  label: string
  section?: string
  collapsed: boolean
  icon: ReactNode
  sub?: boolean
  /** When set, overrides NavLink default active detection (e.g. query-string routes). */
  isActive?: (args: { isActive: boolean }) => boolean
}

export function AdminSidebarNavItem({
  to,
  end,
  label,
  section,
  collapsed,
  icon,
  sub,
  isActive: isActiveOverride,
}: AdminSidebarNavItemProps) {
  const base = sub ? 'admin-nav-item admin-nav-item--sub' : 'admin-nav-item'
  return (
    <NavLink
      to={to}
      end={end}
      className={(args) => {
        const active = (isActiveOverride ? isActiveOverride(args) : args.isActive) ? 'active' : ''
        return [base, active].filter(Boolean).join(' ')
      }}
      {...adminNavTip(label, section)}
    >
      <AdminNavIcon>{icon}</AdminNavIcon>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

type AdminSidebarGroupRailProps = {
  to: string
  label: string
  section: string
  active: boolean
  icon: ReactNode
}

/** Collapsed sidebar: one icon per section that links to the section home. */
export function AdminSidebarGroupRail({ to, label, section, active, icon }: AdminSidebarGroupRailProps) {
  return (
    <NavLink
      to={to}
      className={`admin-nav-item admin-nav-group-rail${active ? ' active' : ''}`}
      {...adminNavTip(label, section)}
    >
      <AdminNavIcon>{icon}</AdminNavIcon>
    </NavLink>
  )
}
