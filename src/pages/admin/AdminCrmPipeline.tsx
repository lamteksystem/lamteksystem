import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { CustomerProfileRow, OpportunityRow, ActivityRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

type CustomerLookup = { user_id: string; company_name: string; contact_name: string | null }

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const

export default function AdminCrmPipeline() {
  const { allowed: canView } = usePermission('admin.customers', 'view')
  const [customerLookup, setCustomerLookup] = useState<Map<string, CustomerLookup>>(new Map())
  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [updatingOppId, setUpdatingOppId] = useState<string | null>(null)
  const [updatingActId, setUpdatingActId] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    async function load() {
      const [profilesRes, oppsRes, actsRes] = await Promise.all([
        supabase.from('customer_profiles').select('*').order('company_name'),
        supabase.from('opportunities').select('*').order('updated_at', { ascending: false }).limit(2000),
        supabase.from('activities').select('*').is('completed_at', null).order('due_at', { ascending: true, nullsFirst: false }).limit(2000),
      ])
      const list = (profilesRes.data ?? []) as CustomerProfileRow[]
      const lookup = new Map<string, CustomerLookup>()
      list.forEach((c) => lookup.set(c.user_id, { user_id: c.user_id, company_name: c.company_name, contact_name: c.contact_name }))
      setCustomerLookup(lookup)
      setOpportunities((oppsRes.data ?? []) as OpportunityRow[])
      setActivities((actsRes.data ?? []) as ActivityRow[])
      setLoading(false)
    }
    load()
  }, [canView])

  async function updateOpportunityStage(opportunityId: string, stage: string) {
    if (updatingOppId) return
    setUpdatingOppId(opportunityId)
    const { error } = await supabase
      .from('opportunities')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', opportunityId)
    if (!error) setOpportunities((prev) => prev.map((o) => (o.id === opportunityId ? { ...o, stage } : o)))
    setUpdatingOppId(null)
  }

  async function markActivityDone(activityId: string) {
    if (updatingActId) return
    setUpdatingActId(activityId)
    const completed_at = new Date().toISOString()
    const { error } = await supabase
      .from('activities')
      .update({ completed_at, updated_at: completed_at })
      .eq('id', activityId)
    if (!error) setActivities((prev) => prev.filter((a) => a.id !== activityId))
    setUpdatingActId(null)
  }

  const now = Date.now()
  const visibleActivities = activities.filter((a) => {
    if (!showOverdueOnly) return true
    if (!a.due_at) return false
    return new Date(a.due_at).getTime() < now
  })
  const overdueCount = activities.filter((a) => a.due_at && new Date(a.due_at).getTime() < now).length

  if (!canView) {
    return (
      <div className="card admin-card">
        <p>You don&apos;t have permission to view the pipeline.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-loading-state">
        <div className="admin-loading-spinner" aria-hidden />
        <p>Loading pipeline…</p>
      </div>
    )
  }

  return (
    <>
      <p className="page-intro" style={{ marginTop: 0 }}>
        Optional deal stages and tasks. For day-to-day basket recovery, use <Link to="/admin/crm/open-orders">Open orders</Link>.
      </p>
      <div className="admin-crm-pipeline-wrap">
        <div className="card admin-card">
          <h2 style={{ marginTop: 0 }}>Activities due</h2>
          <div className="admin-inline-form--stack" style={{ marginBottom: '0.5rem' }}>
            <label className="admin-filter-check">
              <input type="checkbox" checked={showOverdueOnly} onChange={(e) => setShowOverdueOnly(e.target.checked)} />
              Overdue only
            </label>
            {overdueCount > 0 && <span className="admin-overdue-badge">{overdueCount} overdue</span>}
          </div>
          {activities.length === 0 ? (
            <p className="admin-muted">No open activities.</p>
          ) : (
            <ul className="admin-report-list">
              {visibleActivities.slice(0, 20).map((a) => {
                const isOverdue = a.due_at ? new Date(a.due_at).getTime() < now : false
                return (
                  <li key={a.id} className="admin-report-list-item">
                    <span className="admin-report-list-label">
                      <span className="admin-muted" style={{ marginRight: '0.5rem' }}>{a.activity_type}</span>
                      {a.subject ?? '—'}
                      <span className="admin-muted" style={{ marginLeft: '0.5rem' }}>
                        {customerLookup.get(a.customer_user_id)?.company_name ?? a.customer_user_id.slice(0, 8)}
                      </span>
                    </span>
                    <span className="admin-crm-activity-actions">
                      <span className={`admin-report-list-value ${isOverdue ? 'admin-text-overdue' : ''}`}>
                        {a.due_at ? new Date(a.due_at).toLocaleDateString() : '—'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-small btn-outline"
                        onClick={() => markActivityDone(a.id)}
                        disabled={updatingActId === a.id}
                      >
                        {updatingActId === a.id ? '…' : 'Done'}
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="admin-crm-pipeline">
          {STAGES.map((stage) => {
            const opps = opportunities.filter((o) => (o.stage || 'lead') === stage)
            const stageValue = opps.reduce((s, o) => s + Number(o.value_ex_vat || 0), 0)
            return (
              <div key={stage} className="admin-crm-stage">
                <div className="admin-crm-stage-head">
                  <span className="admin-crm-stage-title">{stage}</span>
                  <span className="admin-crm-stage-meta">{opps.length} · £{stageValue.toFixed(0)}</span>
                </div>
                <div className="admin-crm-stage-body">
                  {opps.length === 0 ? (
                    <div className="admin-crm-stage-empty">—</div>
                  ) : (
                    opps.map((o) => (
                      <div key={o.id} className="admin-crm-opp">
                        <div className="admin-crm-opp-top">
                          <span className="admin-crm-opp-name">{o.name}</span>
                          <span className="admin-crm-opp-value">£{Number(o.value_ex_vat || 0).toFixed(0)}</span>
                        </div>
                        <div className="admin-crm-opp-meta">
                          <Link to={`/admin/customers/${o.customer_user_id}`} className="admin-link">
                            {customerLookup.get(o.customer_user_id)?.company_name ?? o.customer_user_id.slice(0, 8)}
                          </Link>
                          {o.expected_close_date && (
                            <span className="admin-muted"> · {new Date(o.expected_close_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="admin-crm-opp-actions">
                          <select
                            value={o.stage || 'lead'}
                            onChange={(e) => updateOpportunityStage(o.id, e.target.value)}
                            disabled={updatingOppId === o.id}
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <Link to={`/admin/customers/${o.customer_user_id}`} className="btn btn-small btn-outline">
                            Open
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
