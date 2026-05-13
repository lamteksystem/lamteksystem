import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import { getSafeNextPath } from '@/lib/customerRoutes'
import BrandLogo from '@/components/BrandLogo'

const DEMO_CUSTOMER_EMAIL = 'demo@lamtek.co.uk'
const DEMO_CUSTOMER_PASSWORD = 'Demo123!'
const DEMO_ADMIN_EMAIL = 'lamteksystem@gmail.com'
const DEMO_ADMIN_PASSWORD = 'LamtekSystem26'

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!hash || hash.charAt(0) !== '#') return params
  hash
    .slice(1)
    .split('&')
    .forEach((part) => {
      const [key, value] = part.split('=')
      if (key && value) params[key] = decodeURIComponent(value.replace(/\+/g, ' '))
    })
  return params
}

export default function Login() {
  const { user, loading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaff()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = useMemo(() => getSafeNextPath(searchParams), [searchParams])
  const showDemoCredentials = useMemo(() => {
    const host = window.location.hostname.toLowerCase()
    return (
      host.includes('demo.lamtek.co.uk') ||
      host.includes('lamtek-demo') ||
      host.includes('vercel.app') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    )
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = parseHashParams(window.location.hash)
    if (params.error === 'access_denied' && params.error_code === 'otp_expired') {
      setError('That sign-in link has expired. Please sign in with your email and password below, or request a new link.')
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    } else if (params.error && params.error_description) {
      setError(params.error_description)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  // Redirect logged-in users imperatively so we never render Navigate (avoids white screen when staff hit /login)
  useEffect(() => {
    if (loading || staffLoading || !user) return
    if (isStaff) {
      navigate('/admin', { replace: true })
      return
    }
    navigate(nextPath ?? '/', { replace: true })
  }, [user, loading, staffLoading, isStaff, navigate, nextPath])

  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (user) return <div className="app-loading">Redirecting…</div>

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
    // Ensure session is applied before RLS sees auth.uid()
    await supabase.auth.getSession()
    await new Promise((r) => setTimeout(r, 150))
    // Redirect staff to admin, customers to dashboard
    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (profile) {
      navigate('/admin', { replace: true })
      return
    }
    navigate(nextPath ?? '/', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <BrandLogo className="app-logo-image app-logo-image--login" />
          <p className="login-tagline">Online Ordering System</p>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to create estimates, view brochures, and place orders.</p>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <label>
            Email address <span className="required">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-footer">
          Need access? <a href="mailto:info@lamtek.co.uk">Contact Lamtek</a>.
        </p>
        <div className="login-staff-section">
          <p className="login-staff-title">Staff or admin?</p>
          <p className="login-staff-text">
            <Link to="/admin/login">Sign in to the staff area</Link> for the admin dashboard, orders, and customers.
          </p>
        </div>
        {showDemoCredentials && (
          <div className="card" style={{ marginTop: '0.9rem', background: 'var(--lamtek-bg)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Demo access</h3>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              Use these demo credentials to explore both customer and admin flows.
            </p>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <div>
                <strong>Demo customer</strong>
                <div className="admin-muted">{DEMO_CUSTOMER_EMAIL}</div>
                <div className="admin-muted">{DEMO_CUSTOMER_PASSWORD}</div>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  style={{ marginTop: '0.35rem' }}
                  onClick={() => {
                    setEmail(DEMO_CUSTOMER_EMAIL)
                    setPassword(DEMO_CUSTOMER_PASSWORD)
                  }}
                >
                  Use customer credentials
                </button>
              </div>
              <div>
                <strong>Demo admin</strong>
                <div className="admin-muted">{DEMO_ADMIN_EMAIL}</div>
                <div className="admin-muted">{DEMO_ADMIN_PASSWORD}</div>
                <Link to="/admin/login" className="btn btn-outline btn-small" style={{ marginTop: '0.35rem' }}>
                  Go to admin sign-in
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

