import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { getDocumentUrl } from '@/lib/documents'
import { useEffectiveUserId } from '@/contexts/ImpersonationContext'
import type { TicketRow, TicketMessageRow, ReturnLineRow, ProductRow, TicketAttachmentRow } from '@/types/database'

export default function SupportTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const effectiveUserId = useEffectiveUserId()
  const [loading, setLoading] = useState(true)
  const [ticket, setTicket] = useState<TicketRow | null>(null)
  const [messages, setMessages] = useState<TicketMessageRow[]>([])
  const [returnLines, setReturnLines] = useState<ReturnLineRow[]>([])
  const [attachments, setAttachments] = useState<TicketAttachmentRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductRow>>(new Map())
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!ticketId || !effectiveUserId) return
    const [tRes, mRes, rRes, aRes, pRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).eq('customer_user_id', effectiveUserId).maybeSingle(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('return_lines').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('ticket_attachments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      supabase.from('products').select('id, name, sku, image_url, cost_price, unit_price, active, category_id, description, stock_quantity, options, image_alt, sort_order, created_at'),
    ])
    setTicket((tRes.data ?? null) as TicketRow | null)
    setMessages((mRes.data ?? []) as TicketMessageRow[])
    setReturnLines((rRes.data ?? []) as ReturnLineRow[])
    setAttachments((aRes.data ?? []) as TicketAttachmentRow[])
    const map = new Map<string, ProductRow>()
    ;(pRes.data ?? []).forEach((p) => map.set((p as ProductRow).id, p as ProductRow))
    setProductsById(map)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, effectiveUserId])

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
      if (!cancelled) {
        setAttachmentUrls(Object.fromEntries(entries.map((x) => [x.id, x.url])))
      }
    }
    loadUrls()
    return () => { cancelled = true }
  }, [attachments])

  async function send() {
    const hasBody = !!body.trim()
    const hasFiles = selectedFiles.length > 0
    if (!ticketId || !effectiveUserId || sending || (!hasBody && !hasFiles)) return
    setSending(true)
    setError(null)
    // Upload attachments (if any) before creating the message.
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
            created_by_user_id: effectiveUserId,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type || 'application/octet-stream',
            is_internal: false,
          })
          if (insErr) throw insErr
        }))
        setSelectedFiles([])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload attachment(s).')
        setSending(false)
        return
      }
    }

    const messageBody = body.trim() || 'Attachment uploaded.'
    const { error: err } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      author_user_id: effectiveUserId,
      body: messageBody,
      is_internal: false,
    })
    if (err) setError(err.message)
    else {
      setBody('')
      // Customer reply re-opens/continues work on the ticket.
      await supabase.from('tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', ticketId)
      await load()
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="account-page">
        <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { to: '/account/support', label: 'Support' }, { label: 'Ticket' }]} />
        <p>Loading…</p>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="account-page">
        <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { to: '/account/support', label: 'Support' }, { label: 'Ticket' }]} />
        <div className="card">
          <p>Ticket not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="account-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { to: '/account/support', label: 'Support' }, { label: ticket.subject }]} />
      <div className="card">
        <h1 style={{ marginTop: 0 }}>{ticket.subject}</h1>
        <p className="muted">{ticket.type} · {ticket.status} · opened {new Date(ticket.created_at).toLocaleString()}</p>
        <p>{ticket.body}</p>
      </div>

      {ticket.type === 'returns' && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Return items</h2>
          {returnLines.length === 0 ? (
            <p className="muted">No items attached to this return yet.</p>
          ) : (
            <ul className="admin-report-list">
              {returnLines.map((r) => (
                <li key={r.id} className="admin-report-list-item">
                  <span className="admin-report-list-label">
                    {r.product_id ? (productsById.get(r.product_id)?.name ?? r.product_id.slice(0, 8)) : 'Item'}
                    <span className="admin-muted"> · qty {r.quantity}</span>
                    {r.reason ? <span className="admin-muted"> · {r.reason}</span> : null}
                  </span>
                  <span className="admin-report-list-value">{r.resolution ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Messages</h2>
        {messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="admin-order-events">
            {messages.map((m) => (
              <li key={m.id} className="admin-order-event">
                <span className="admin-order-event-time">{new Date(m.created_at).toLocaleString()}</span>
                <span>{m.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Attachments</h2>
          <ul className="admin-report-list" style={{ marginTop: '0.5rem' }}>
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

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Reply</h2>
        {error && <div className="login-error">{error}</div>}
        {ticket.status === 'resolved' && (
          <p className="muted" style={{ marginTop: 0 }}>
            This ticket is currently marked resolved. Sending a reply will reopen it (status will move back to in progress).
          </p>
        )}
        <label style={{ display: 'block', marginTop: '0.75rem' }}>
          Attach files (optional)
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
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write a reply…" />
        <button type="button" className="btn" onClick={send} disabled={sending || (!body.trim() && selectedFiles.length === 0)}>
          {sending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
    </div>
  )
}

