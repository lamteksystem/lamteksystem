import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { withBasePath } from '@/lib/basePath'
import BrandLogo from '@/components/BrandLogo'

/**
 * Request a password reset email. Supabase sends a link to the user; clicking it
 * lands them on /reset-password where a recovery session is created in-browser.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter your account email first.')
      return
    }
    setSubmitting(true)
    const redirectTo = `${window.location.origin}${withBasePath('/reset-password')}`
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Could not send reset email.')
      return
    }
    setSent(true)
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <BrandLogo className="app-logo-image app-logo-image--login" />
          <p className="login-tagline">Online Ordering System</p>
        </div>
        <h1 className="login-title">Forgot password</h1>
        {sent ? (
          <>
            <p className="login-subtitle">
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
              Open the email on this device and click the link to set a new password.
            </p>
            <p className="admin-muted">
              Don&rsquo;t see it within a few minutes? Check spam, then{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                try a different email
              </button>
              .
            </p>
            <div className="marketing-hero-actions" style={{ marginTop: '1rem' }}>
              <Link to="/login" className="btn btn-outline">Back to sign in</Link>
            </div>
          </>
        ) : (
          <>
            <p className="login-subtitle">
              Enter the email on your trade account and we&rsquo;ll send a reset link.
            </p>
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
              <button type="submit" className="btn btn-block" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="login-footer">
              Remembered it? <Link to="/login">Back to sign in</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
