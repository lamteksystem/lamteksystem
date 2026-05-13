import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type DocSlot = 'proof_trade' | 'photo_id' | 'proof_address' | 'references'

const DOC_LABELS: Record<DocSlot, string> = {
  proof_trade: 'Proof of trade',
  photo_id: 'Photo ID',
  proof_address: 'Proof of address',
  references: 'References (optional)',
}

type AccountApplication = {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  company_number: string | null
  vat_number: string | null
  trade_type: string | null
  address1: string | null
  city: string | null
  postcode: string | null
  delivery_regions: string[]
  document_paths: Partial<Record<DocSlot, string>> | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string
}

type TabId = 'pending' | 'approved' | 'rejected' | 'all'

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

function StatusBadge({ status }: { status: AccountApplication['status'] }) {
  const tone =
    status === 'pending' ? 'admin-badge--warn' :
    status === 'approved' ? 'admin-badge--ok' :
    'admin-badge--danger'
  return <span className={`admin-badge ${tone}`} style={{ textTransform: 'capitalize' }}>{status}</span>
}

export default function AdminAccountApplications() {
  const [tab, setTab] = useState<TabId>('pending')
  const [applications, setApplications] = useState<AccountApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('account_applications')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) {
      setActionError(error.message)
      setApplications([])
    } else {
      setApplications((data ?? []) as AccountApplication[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (tab === 'all') return applications
    return applications.filter((a) => a.status === tab)
  }, [applications, tab])

  const selected = useMemo(
    () => applications.find((a) => a.id === selectedId) ?? null,
    [applications, selectedId],
  )

  useEffect(() => {
    setReviewNotes(selected?.review_notes ?? '')
    setDocUrls({})
    if (!selected?.document_paths) return
    const paths = selected.document_paths as Record<string, string>
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        Object.entries(paths).map(async ([slot, path]) => {
          const { data } = await supabase.storage
            .from('account-applications')
            .createSignedUrl(path, 60 * 60)
          return [slot, data?.signedUrl ?? ''] as const
        }),
      )
      if (!cancelled) {
        const next: Record<string, string> = {}
        for (const [slot, url] of entries) if (url) next[slot] = url
        setDocUrls(next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  async function setStatus(status: 'approved' | 'rejected') {
    if (!selected) return
    setActionError('')
    setActionBusy(true)
    const { data: userResp } = await supabase.auth.getUser()
    const reviewerId = userResp.user?.id ?? null
    const { error } = await supabase
      .from('account_applications')
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes.trim() || null,
      })
      .eq('id', selected.id)
    setActionBusy(false)
    if (error) {
      setActionError(error.message)
      return
    }
    await load()
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    for (const a of applications) c[a.status] += 1
    return c
  }, [applications])

  return (
    <div className="admin-page">
      <p className="page-intro">
        Customer-submitted trade account applications. Review supporting documents, then approve or reject.
        Approving here marks the application; create the actual login from{' '}
        <Link to="/admin/users/create" className="admin-link">Create user</Link> using the email and company details below.
      </p>

      <div className="admin-pricing-tabs" style={{ marginBottom: '1rem' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-pricing-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'pending' && `Pending (${counts.pending})`}
            {t === 'approved' && `Approved (${counts.approved})`}
            {t === 'rejected' && `Rejected (${counts.rejected})`}
            {t === 'all' && `All (${applications.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading applications…</p>
        </div>
      ) : (
        <div className="card admin-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '1.5rem' }}>
          <div>
            {filtered.length === 0 ? (
              <p className="admin-muted">No applications in this view.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
                {filtered.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className="card"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '0.6rem 0.8rem',
                        background: selectedId === a.id ? 'var(--lamtek-bg-alt, #f5f5f0)' : undefined,
                        borderColor: selectedId === a.id ? 'var(--lamtek-accent)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{a.company_name}</strong>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="admin-muted" style={{ fontSize: '0.85rem' }}>
                        {a.contact_name} · {a.email}
                      </div>
                      <div className="admin-muted" style={{ fontSize: '0.8rem' }}>
                        Submitted {formatDate(a.submitted_at)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            {selected ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>{selected.company_name}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <p className="admin-muted" style={{ marginTop: '0.25rem' }}>
                    Submitted {formatDate(selected.submitted_at)}
                    {selected.reviewed_at && ` · Reviewed ${formatDate(selected.reviewed_at)}`}
                  </p>
                </div>

                <div className="admin-detail-grid">
                  <div>
                    <strong>Contact</strong>
                    <div>{selected.contact_name}</div>
                    <div><a href={`mailto:${selected.email}`}>{selected.email}</a></div>
                    <div><a href={`tel:${selected.phone}`}>{selected.phone}</a></div>
                  </div>
                  <div>
                    <strong>Business</strong>
                    <div>Company #: {selected.company_number ?? '—'}</div>
                    <div>VAT #: {selected.vat_number ?? '—'}</div>
                    <div>Trade: {selected.trade_type ?? '—'}</div>
                  </div>
                  <div>
                    <strong>Address</strong>
                    <div>{selected.address1 ?? '—'}</div>
                    <div>{[selected.city, selected.postcode].filter(Boolean).join(' ') || '—'}</div>
                  </div>
                  <div>
                    <strong>Preferred regions</strong>
                    <div>
                      {selected.delivery_regions?.length
                        ? selected.delivery_regions.join(', ')
                        : '—'}
                    </div>
                  </div>
                </div>

                <div>
                  <strong>Supporting documents</strong>
                  <ul style={{ marginTop: '0.4rem' }}>
                    {(Object.keys(DOC_LABELS) as DocSlot[]).map((slot) => {
                      const path = selected.document_paths?.[slot]
                      if (!path) return (
                        <li key={slot} className="admin-muted">{DOC_LABELS[slot]}: not provided</li>
                      )
                      const url = docUrls[slot]
                      return (
                        <li key={slot}>
                          {DOC_LABELS[slot]}:{' '}
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer">View / download</a>
                          ) : (
                            <span className="admin-muted">Generating link…</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <label>
                  <strong>Review notes</strong>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Optional notes for internal records (visible only to staff)."
                  />
                </label>

                {actionError && <div className="login-error" role="alert">{actionError}</div>}

                <div className="admin-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={actionBusy || selected.status === 'approved'}
                    onClick={() => setStatus('approved')}
                  >
                    {selected.status === 'approved' ? 'Approved' : actionBusy ? 'Saving…' : 'Mark approved'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={actionBusy || selected.status === 'rejected'}
                    onClick={() => setStatus('rejected')}
                  >
                    {selected.status === 'rejected' ? 'Rejected' : 'Reject'}
                  </button>
                  <Link
                    to="/admin/users/create"
                    state={{
                      prefill: {
                        email: selected.email,
                        companyName: selected.company_name,
                        contactName: selected.contact_name,
                        phone: selected.phone,
                      },
                    }}
                    className="btn btn-outline"
                  >
                    Create login for this customer →
                  </Link>
                </div>

                <p className="admin-muted" style={{ fontSize: '0.85rem' }}>
                  Tip: copy the email and contact name above, then click <em>Create login</em> to set up the customer
                  account. Send the customer a password reset link (or use the invite flow) so they can log in.
                </p>
              </div>
            ) : (
              <p className="admin-muted">Select an application on the left to review documents and update status.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
