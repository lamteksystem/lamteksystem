import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getDocumentUrl } from '@/lib/documents'
import type { TicketRow, TicketMessageRow, CustomerProfileRow, StaffProfileRow, ReturnLineRow, OrderLineRow, ProductRow, TicketAttachmentRow } from '@/types/database'
import { usePermission } from '@/hooks/usePermission'

export default function AdminTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const { allowed: canView } = usePermission('tickets.view', 'view')
  const { allowed: canManage } = usePermission('tickets.manage', 'edit')

  const [loading, setLoading] = useState(true)
  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [messages, setMessages] = useState<TicketMessageRow[]>([])
  const [customer, setCustomer] = useState<CustomerProfileRow | null>(null)
  const [staff, setStaff] = useState<StaffProfileRow[]>([])
  const [returnLines, setReturnLines] = useState<ReturnLineRow[]>([])
  const [attachments, setAttachments] = useState<TicketAttachmentRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [orderLines, setOrderLines] = useState<Map<string, OrderLineRow>>(new Map())
  const [productsById, setProductsById] = useState<Map<string, ProductRow>>(new Map())
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAdvancedContext, setShowAdvancedContext] = useState(false)

  async function load() {
    if (!ticketId) return
    setLoading(true)
    const [tRes, mRes, sRes, rRes, aRes, pRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('staff_profiles').select('*'),
      supabase.from('return_lines').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('ticket_attachments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('products').select('*'),
    ])
    const t = (tRes.data ?? null) as TicketRow | null
    setTicket(t)
    setMessages((mRes.data ?? []) as TicketMessageRow[])
    setStaff((sRes.data ?? []) as StaffProfileRow[])
    setReturnLines((rRes.data ?? []) as ReturnLineRow[])
    setAttachments((aRes.data ?? []) as TicketAttachmentRow[])
    const prodMap = new Map<string, ProductRow>()
    ;(pRes.data ?? []).forEach((p) => prodMap.set((p as ProductRow).id, p as ProductRow))
    setProductsById(prodMap)
    if (t?.customer_user_id) {
      const { data } = await supabase.from('customer_profiles').select('*').eq('user_id', t.customer_user_id).maybeSingle()
      setCustomer((data ?? null) as CustomerProfileRow | null)
    }
    if (t?.order_id) {
      const { data } = await supabase.from('order_lines').select('*').eq('order_id', t.order_id)
      const map = new Map<string, OrderLineRow>()
      ;(data ?? []).forEach((l) => map.set((l as OrderLineRow).id, l as OrderLineRow))
      setOrderLines(map)
    } else {
      setOrderLines(new Map())
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!canView) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, canView])

  useEffect(() => {
    let cancelled = false
    async function loadUrls() {
      if (attachments.length === 0) {
        setAttachmentUrls({})
        return
      }
      const entries = await Promise.all(
        attachments.map(async (a) => ({
          id: a.id,
          url: await getDocumentUrl(a.file_path),
        }))
      )
      if (!cancelled) setAttachmentUrls(Object.fromEntries(entries.map((x) => [x.id, x.url])))
    }
    loadUrls()
    return () => { cancelled = true }
  }, [attachments])

  async function updateTicket(patch: Partial<TicketRow>) {
    if (!ticketId || !canManage) return
    const { error } = await supabase
      .from('tickets')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
    if (!error) await load()
  }

  async function send() {
    const hasBody = !!reply.trim()
    const hasFiles = selectedFiles.length > 0
    if (!ticketId || saving || (!hasBody && !hasFiles) || !canManage) return
    setSaving(true)
    setError(null)

    if (selectedFiles.length > 0) {
      try {
        const ticketIdSafe = ticketId
        await Promise.all(selectedFiles.map(async (file, idx) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const filePath = `ticket-attachments/${ticketIdSafe}/${Date.now()}-${idx}-${safeName}`
          const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
          if (uploadError) throw uploadError
          const { error: insErr } = await supabase.from('ticket_attachments').insert({
            ticket_id: ticketIdSafe,
            created_by_user_id: null,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            is_internal: internal,
          })
          if (insErr) throw insErr
        }))
        setSelectedFiles([])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload attachment(s).')
        setSaving(false)
        return
      }
    }

    const messageBody = reply.trim() || 'Attachment uploaded.'
    const { error: msgErr } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_user_id: null,
      body: messageBody,
      is_internal: internal,
    })
    if (msgErr) {
      setError(msgErr.message)
      setSaving(false)
      return
    }

    setReply('')
    setInternal(false)
    await updateTicket({ status: internal ? (ticket?.status ?? 'open') : 'waiting_customer' })
    await load()
    setSaving(false)
  }

  async function resolveReturnLine(id: string, resolution: string) {
    if (!canManage) return
    await supabase.from('return_lines').update({ resolution, updated_at: new Date().toISOString() }).eq('id', id)

    // Simple automation: once every return line has a resolution, mark the ticket resolved.
    // This keeps the returns workflow tidy without requiring the admin to manually set status.
    if (ticket?.type === 'returns') {
      const { data: rlData } = await supabase
        .from('return_lines')
        .select('resolution')
        .eq('ticket_id', ticketId)

      const rlList = (rlData ?? []) as Array<{ resolution: string | null }>
      const allResolved = rlList.length > 0 && rlList.every((r) => r.resolution != null)
      if (allResolved && ticket.status !== 'resolved') {
        await supabase.from('tickets').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', ticketId)
      }
    }
    await load()
  }

  if (!canView) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <h2>No access</h2>
          <p>You don&apos;t have permission to view tickets.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading ticket…</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="admin-page">
        <div className="card admin-card">
          <p>Ticket not found.</p>
          <Link to="/admin/tickets" className="btn btn-outline btn-small">← Tickets</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <span className="admin-breadcrumb">
          <Link to="/admin/tickets">Tickets</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{ticket.subject}</span>
        </span>
        <div className="admin-page-header-actions">
          {ticket.order_id && <Link to={`/admin/orders/${ticket.order_id}`} className="btn btn-outline btn-small">Order</Link>}
          {ticket.customer_user_id && <Link to={`/admin/customers/${ticket.customer_user_id}`} className="btn btn-outline btn-small">Customer</Link>}
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="card admin-card">
          <h2>Ticket</h2>
          <p className="admin-muted">{ticket.type} · priority {ticket.priority} · opened {new Date(ticket.created_at).toLocaleString()}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
          {customer && <p><strong>Customer:</strong> {customer.company_name} {customer.contact_name ? `· ${customer.contact_name}` : ''}</p>}
          <p>{ticket.body}</p>
          <button
            type="button"
            className={`btn btn-small ${showAdvancedContext ? 'active' : 'btn-outline'}`}
            onClick={() => setShowAdvancedContext((v) => !v)}
            style={{ marginBottom: '0.75rem' }}
          >
            {showAdvancedContext ? 'Hide advanced context' : 'Show advanced context'}
          </button>

          {showAdvancedContext && ticket.type === 'returns' && (
            <div style={{ marginTop: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Return items</h3>
              {returnLines.length === 0 ? (
                <p className="admin-muted">No return lines added yet.</p>
              ) : (
                <ul className="admin-report-list" style={{ marginTop: '0.5rem' }}>
                  {returnLines.map((r) => {
                    const ol = r.order_line_id ? orderLines.get(r.order_line_id) : null
                    const prod = r.product_id ? productsById.get(r.product_id) : null
                    return (
                      <li key={r.id} className="admin-report-list-item">
                        <span className="admin-report-list-label">
                          {prod?.name ?? (ol ? ((ol.product_snapshot as any)?.name ?? 'Item') : 'Item')}
                          <span className="admin-muted"> · qty {r.quantity}</span>
                          {r.reason ? <span className="admin-muted"> · {r.reason}</span> : null}
                        </span>
                        <span className="admin-report-list-value">
                          {r.resolution ?? '—'}
                        </span>
                        {canManage && (
                          <span style={{ marginLeft: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn btn-small btn-outline"
                              title="Posts a credit note to the customer account when the return is linked to an order line (or product on the ticket order)."
                              onClick={() => resolveReturnLine(r.id, 'approved')}
                            >
                              Approve
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-small btn-outline"
                              title="No credit note; if a credit was posted, it is removed when you reject."
                              onClick={() => resolveReturnLine(r.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {canManage && (
            <div className="admin-inline-form--stack" style={{ marginTop: '0.75rem' }}>
              <label>
                Status{' '}
                <select value={ticket.status} onChange={(e) => updateTicket({ status: e.target.value as TicketRow['status'] })}>
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="waiting_customer">waiting_customer</option>
                  <option value="resolved">resolved</option>
                </select>
              </label>
              <label>
                Assign{' '}
                <select value={ticket.assigned_staff_id ?? ''} onChange={(e) => updateTicket({ assigned_staff_id: e.target.value || null })}>
                  <option value="">—</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.display_name ?? s.role}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="card admin-card">
          <h2>Thread</h2>
          {showAdvancedContext && attachments.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Attachments</h3>
              <ul className="admin-report-list">
                {attachments.map((a) => {
                  const url = attachmentUrls[a.id]
                  return (
                    <li key={a.id} className="admin-report-list-item">
                      <span className="admin-report-list-label">
                        {a.file_name ?? 'Attachment'}{' '}
                        {a.is_internal ? <span className="admin-muted">· internal</span> : null}
                      </span>
                      <span className="admin-report-list-value">
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="link-inline">
                            View/Download
                          </a>
                        ) : (
                          <span className="admin-muted">Loading…</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {messages.length === 0 ? (
            <p className="admin-muted">No messages yet.</p>
          ) : (
            <ul className="admin-order-events">
              {messages.map((m) => (
                <li key={m.id} className="admin-order-event">
                  <span className="admin-order-event-time">{new Date(m.created_at).toLocaleString()}</span>
                  <span className={`admin-event-badge ${m.is_internal ? 'admin-event-badge--internal' : 'admin-event-badge--customer'}`}>
                    {m.is_internal ? 'internal' : 'message'}
                  </span>
                  <span>{m.body}</span>
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <div style={{ marginTop: '0.75rem' }}>
              {error && <div className="login-error" style={{ marginTop: 0 }}>{error}</div>}
              <label className="admin-checkbox-label" style={{ marginBottom: '0.5rem' }}>
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal note (not visible to customer)
              </label>
              <label style={{ display: 'block', marginTop: '0.75rem' }}>
                Attach files (optional){' '}
                <span className="admin-muted" style={{ fontSize: '0.85rem' }}>
                  · treated as {internal ? 'internal' : 'external'} with this setting
                </span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              {selectedFiles.length > 0 && (
                <p className="muted" style={{ fontSize: '0.9rem' }}>
                  Selected: {selectedFiles.map((f) => f.name).join(', ')}
                </p>
              )}
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a reply…" />
              <button type="button" className="btn btn-small" onClick={send} disabled={saving || (!reply.trim() && selectedFiles.length === 0)}>
                {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

