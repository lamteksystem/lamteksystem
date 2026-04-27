import { useMemo, useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import BrandLogo from '@/components/BrandLogo'

const DEMO_CUSTOMER_EMAIL = 'demo@lamtek.co.uk'
const DEMO_CUSTOMER_PASSWORD = 'Demo123!'
const DEMO_ADMIN_EMAIL = 'owners-demo@lamtek.co.uk'
const DEMO_ADMIN_PASSWORD = 'Lamtek-26'

export default function AdminLogin() {
  const { user, loading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaff()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const showDemoCredentials = useMemo(() => {
    const host = window.location.hostname.toLowerCase()
    return (
      host.includes('demo.lamtek.co.uk') ||
      host.includes('lamtek-demo') ||
      host.includes('vercel.app')
    )
  }, [])

  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (user && isStaff) return <Navigate to="/admin" replace />
  if (user && !isStaff) {
    return (
      <div className="login-page admin-login-page">
        <div className="login-card card admin-login-card">
          <p className="login-error">This account is not a staff account. Use the <Link to="/">customer portal</Link> or sign in with a staff email.</p>
          <button type="button" className="btn btn-block" onClick={() => supabase.auth.signOut().then(() => navigate(0))}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (err) {
      setError(err.message ?? 'Login failed')
      return
    }
    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (profile) {
      navigate('/admin', { replace: true })
    } else {
      setError('This account is not a staff account. Use the customer portal or sign in with a staff email.')
    }
  }

  return (
    <div className="login-page admin-login-page">
      <div className="login-card card admin-login-card">
        <div className="login-brand">
          <BrandLogo className="app-logo-image app-logo-image--login" />
          <span className="admin-login-badge">Staff</span>
          <p className="login-tagline">Staff &amp; admin only</p>
        </div>
        <h1 className="login-title">Staff sign in</h1>
        <p className="login-subtitle">Sign in with your Lamtek staff email to access the admin dashboard, orders, and customers.</p>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <label>
            Staff email <span className="required">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="staff@lamtek.co.uk"
          />
          <label>
            Password <span className="required">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in to admin'}
          </button>
        </form>
        <p className="login-footer">
          <Link to="/login">Customer login</Link>
          {' · '}
          <a href="mailto:info@lamtek.co.uk">Need access?</a>
        </p>
        {showDemoCredentials && (
          <div className="card" style={{ marginTop: '0.9rem', background: 'var(--tm-bg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Demo access</h3>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <div>
                <strong>Demo admin</strong>
                <div className="admin-muted">{DEMO_ADMIN_EMAIL}</div>
                <div className="admin-muted">{DEMO_ADMIN_PASSWORD}</div>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  style={{ marginTop: '0.35rem' }}
                  onClick={() => {
                    setEmail(DEMO_ADMIN_EMAIL)
                    setPassword(DEMO_ADMIN_PASSWORD)
                  }}
                >
                  Use admin credentials
                </button>
              </div>
              <div>
                <strong>Demo customer</strong>
                <div className="admin-muted">{DEMO_CUSTOMER_EMAIL}</div>
                <div className="admin-muted">{DEMO_CUSTOMER_PASSWORD}</div>
                <Link to="/login" className="btn btn-outline btn-small" style={{ marginTop: '0.35rem' }}>
                  Go to customer sign-in
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
