import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'
import { publicAsset } from '@/lib/basePath'

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={18} height={18} aria-hidden focusable="false">
      <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  )
}

const NAV_LINKS: Array<{ to: string; label: string; end?: boolean; home?: boolean }> = [
  { to: '/', label: 'Home', end: true, home: true },
  { to: '/site/products', label: 'Products' },
  { to: '/site/ordering', label: 'Online ordering' },
  { to: '/site/downloads', label: 'Downloads' },
  { to: '/site/gallery', label: 'Gallery' },
  { to: '/site/depots', label: 'Contact' },
]

/**
 * Cycles auto → light → dark → auto. Icon shown reflects the action available:
 * - light explicit → moon  (next visible state would be dark)
 * - dark explicit  → sun   (next visible state would be light)
 * - auto           → moon or sun depending on the OS-resolved theme
 */
function themeMeta(theme: ThemeId, resolved: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      Icon: Moon,
      tooltip: 'Switch to dark theme',
      next: 'dark' as ThemeId,
    }
  }
  if (theme === 'dark') {
    return {
      Icon: Sun,
      tooltip: 'Switch to light theme',
      next: 'auto' as ThemeId,
    }
  }
  return {
    Icon: resolved === 'dark' ? Sun : Moon,
    tooltip: `Theme: Auto (currently ${resolved}). Click to set an explicit theme.`,
    next: 'light' as ThemeId,
  }
}

export default function MarketingHeader() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const logoSrc =
    resolvedTheme === 'dark' ? publicAsset('marketing/logo-on-dark.png') : publicAsset('marketing/logo-on-light.png')

  const { Icon: ThemeIcon, tooltip: themeTooltip, next: nextTheme } = themeMeta(theme, resolvedTheme)

  return (
    <header className="marketing-header">
      <div className="marketing-header-brand">
        <Link to="/" className="marketing-logo-link" aria-label="Lamtek — Home">
          <img src={logoSrc} alt="" className="marketing-logo-img" />
        </Link>
      </div>

      <nav
        className={`marketing-nav ${menuOpen ? 'marketing-nav--open' : ''}`}
        aria-label="Primary"
      >
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              link.home
                ? (isActive ? 'active marketing-nav-home' : 'marketing-nav-home')
                : (isActive ? 'active' : '')
            }
          >
            {link.home && <HomeIcon className="marketing-nav-home-icon" />}
            <span>{link.label}</span>
          </NavLink>
        ))}
        <Link
          to="/create-account"
          className="marketing-nav-cta"
          onClick={() => setMenuOpen(false)}
        >
          Open an account
        </Link>
      </nav>

      <div className="marketing-header-end">
        <button
          type="button"
          className="marketing-theme-toggle"
          onClick={() => setTheme(nextTheme)}
          title={themeTooltip}
          aria-label={themeTooltip}
        >
          <ThemeIcon size={18} strokeWidth={2} aria-hidden />
        </button>

        <Link to="/create-account" className="btn btn-outline btn-small marketing-cta-desktop">
          Open an account
        </Link>
        <Link to="/login" className="btn btn-small">
          Login
        </Link>

        <button
          type="button"
          className="marketing-mobile-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
        </button>
      </div>
    </header>
  )
}
