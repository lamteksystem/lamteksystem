import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NotificationRuleSettingsRow } from '@/types/database'

export default function AdminNotifications() {
  const [rows, setRows] = useState<NotificationRuleSettingsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('notification_rule_settings').select('*').order('label')
      if (error) {
        setRows([])
        setLoading(false)
        return
      }
      setRows((data ?? []) as NotificationRuleSettingsRow[])
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      for (const r of rows) {
        const { error } = await supabase
          .from('notification_rule_settings')
          .update({
            email_customer: r.email_customer,
            portal_customer: r.portal_customer,
            sms_customer: r.sms_customer,
            staff_portal_alert: r.staff_portal_alert,
            updated_at: new Date().toISOString(),
          })
          .eq('event_key', r.event_key)
        if (error) throw error
      }
      setMessage('Saved notification rules.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.')
    }
    setSaving(false)
  }

  function patchRow(eventKey: string, patch: Partial<NotificationRuleSettingsRow>) {
    setRows((prev) => prev.map((r) => (r.event_key === eventKey ? { ...r, ...patch } : r)))
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading notification rules…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">Notifications</span>
        <div className="admin-page-header-actions">
          <button type="button" className="btn btn-small" onClick={save} disabled={saving || rows.length === 0}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
      <p className="page-intro">
        Choose where each event should notify customers and staff. This is the source-of-truth toggle map for notification behavior.
      </p>
      {message && <p className={message.startsWith('Saved') ? 'admin-message-ok' : 'admin-error'}>{message}</p>}
      <div className="card admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>Notification matrix</h2>
          <span className="admin-muted">Tip: turn on portal alerts for events your team must act on quickly.</span>
        </div>
        {rows.length === 0 ? (
          <p className="admin-muted" style={{ marginTop: '0.75rem' }}>
            No rules found. Run migration <code>051_crm_notifications_staff_consent.sql</code> and refresh.
          </p>
        ) : (
          <div className="admin-table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Description</th>
                  <th>Email → customer</th>
                  <th>Portal → customer</th>
                  <th>SMS → customer</th>
                  <th>Staff portal alert</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.event_key}>
                    <td>
                      <code>{r.event_key}</code>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                    </td>
                    <td className="admin-muted" style={{ maxWidth: 280 }}>
                      {r.description ?? '—'}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.email_customer}
                        onChange={(e) => patchRow(r.event_key, { email_customer: e.target.checked })}
                        aria-label={`Email for ${r.label}`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.portal_customer}
                        onChange={(e) => patchRow(r.event_key, { portal_customer: e.target.checked })}
                        aria-label={`Portal for ${r.label}`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.sms_customer}
                        onChange={(e) => patchRow(r.event_key, { sms_customer: e.target.checked })}
                        aria-label={`SMS for ${r.label}`}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.staff_portal_alert}
                        onChange={(e) => patchRow(r.event_key, { staff_portal_alert: e.target.checked })}
                        aria-label={`Staff alert for ${r.label}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
