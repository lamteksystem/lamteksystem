import { Link, NavLink } from 'react-router-dom'
import { useTheme, type ThemeId } from '@/contexts/ThemeContext'
import { publicAsset } from '@/lib/basePath'
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={18} height={18} aria-hidden focusable="false">
      <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  )
}

export default function MarketingHeader() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const themeOptions: Array<{ id: ThemeId; label: string }> = [
    { id: 'auto', label: 'Auto' },
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
  ]

  const logoSrc =
    resolvedTheme === 'dark' ? publicAsset('marketing/logo-on-dark.png') : publicAsset('marketing/logo-on-light.png')

  return (
    <header className="marketing-header">
      <div className="marketing-header-brand">
        <Link to="/" className="marketing-logo-link" aria-label="Lamtek — Home">
          <img src={logoSrc} alt="" className="marketing-logo-img" />
        </Link>
      </div>
      <nav className="marketing-nav" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active marketing-nav-home' : 'marketing-nav-home')}>
          <HomeIcon className="marketing-nav-home-icon" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/site/products" className={({ isActive }) => (isActive ? 'active' : '')}>
          Products
        </NavLink>
        <NavLink to="/site/ordering" className={({ isActive }) => (isActive ? 'active' : '')}>
          Online ordering
        </NavLink>
        <NavLink to="/site/downloads" className={({ isActive }) => (isActive ? 'active' : '')}>
          Downloads
        </NavLink>
        <NavLink to="/site/gallery" className={({ isActive }) => (isActive ? 'active' : '')}>
          Gallery
        </NavLink>
        <NavLink to="/site/depots" className={({ isActive }) => (isActive ? 'active' : '')}>
          Contact
        </NavLink>
      </nav>
      <div className="marketing-header-end">
        <div className="marketing-theme-switch" role="group" aria-label="Theme switcher">
          {themeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn-small ${theme === opt.id ? 'active' : 'btn-ghost'}`}
              onClick={() => setTheme(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <nav className="marketing-actions" aria-label="Marketing site actions">
          <Link to="/create-account" className="btn btn-outline">
            Open an account
          </Link>
          <Link to="/login" className="btn">
            Login
          </Link>
        </nav>
      </div>
    </header>
  )
}