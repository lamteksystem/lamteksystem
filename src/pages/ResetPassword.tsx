import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import BrandLogo from '@/components/BrandLogo'

/**
 * Landing page for the password-reset email link.
 *
 * Supabase appends recovery tokens to the URL hash (e.g. `#access_token=…&type=recovery`).
 * The supabase-js client picks them up automatically and fires `onAuthStateChange`
 * with event `PASSWORD_RECOVERY`. Once that happens we let the user set a new password.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    const hash = window.location.hash || ''
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const desc = params.get('error_description') || params.get('error') || 'Reset link is invalid or expired.'
      setLinkError(desc.replace(/\+/g, ' '))
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Could not update password.')
      return
    }
    setDone(true)
    await supabase.auth.signOut()
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-brand">
          <BrandLogo className="app-logo-image app-logo-image--login" />
          <p className="login-tagline">Online Ordering System</p>
        </div>
        <h1 className="login-title">Set a new password</h1>

        {linkError && (
          <>
            <div className="login-error">{linkError}</div>
            <p className="login-subtitle">The reset link may have expired or already been used.</p>
            <div className="marketing-hero-actions" style={{ marginTop: '1rem' }}>
              <Link to="/forgot-password" className="btn">Request a new reset link</Link>
              <Link to="/login" className="btn btn-outline">Back to sign in</Link>
            </div>
          </>
        )}

        {!linkError && done && (
          <>
            <p className="login-subtitle">
              Password updated. Redirecting you to sign in&hellip;
            </p>
            <div className="marketing-hero-actions" style={{ marginTop: '1rem' }}>
              <Link to="/login" className="btn">Sign in now</Link>
            </div>
          </>
        )}

        {!linkError && !done && !ready && (
          <p className="login-subtitle">
            Verifying your reset link&hellip; If this page does not change within a few seconds,
            <Link to="/forgot-password"> request a new link</Link>.
          </p>
        )}

        {!linkError && !done && ready && (
          <>
            <p className="login-subtitle">Choose a strong password you have not used elsewhere.</p>
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="login-error">{error}</div>}
              <label>
                New password <span className="required">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <label>
                Confirm new password <span className="required">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <button type="submit" className="btn btn-block" disabled={submitting}>
                {submitting ? 'Saving…' : 'Update password'}
              </button>
            </form>
            <p className="login-footer">
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
