import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DocumentRow } from '@/types/database'

const UPLOAD_SLOTS = [
  { role: 'pricelist' as const, label: 'Pricelist', description: 'UK Pricelist PDF. Used by the import script to add 1700+ products.', storagePath: 'pricelist.pdf', category: 'pricelist' as const, title: 'UK Pricelist' },
  { role: 'main_brochure' as const, label: 'Brochure', description: 'Main brochure PDF. Shown in customer Downloads.', storagePath: 'main-brochure.pdf', category: 'brochure' as const, title: 'Main Brochure' },
  { role: 'door_finder' as const, label: 'Door finder', description: 'Door Finder poster PDF. Shown in customer Downloads.', storagePath: 'door-finder.pdf', category: 'brochure' as const, title: 'Door Finder' },
]

const DOC_CATEGORIES: { value: DocumentRow['category']; label: string }[] = [
  { value: 'brochure', label: 'Brochure' },
  { value: 'technical', label: 'Technical / Fitting guide' },
  { value: 'pricelist', label: 'Pricelist' },
  { value: 'other', label: 'Other' },
]

function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from('documents').getPublicUrl(filePath)
  return data.publicUrl
}

export default function AdminDocumentUploads() {
  const [slots, setSlots] = useState<Record<string, DocumentRow | null>>({})
  const [allDocuments, setAllDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addCategory, setAddCategory] = useState<DocumentRow['category']>('technical')
  const [addFile, setAddFile] = useState<File | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  async function loadDocuments() {
    const { data: slotData } = await supabase
      .from('documents')
      .select('*')
      .in('role', UPLOAD_SLOTS.map((s) => s.role))
    const byRole: Record<string, DocumentRow | null> = {}
    UPLOAD_SLOTS.forEach((s) => { byRole[s.role] = null })
    ;(slotData ?? []).forEach((row) => {
      const r = row as DocumentRow & { role: string }
      if (r.role) byRole[r.role] = r as DocumentRow
    })
    setSlots(byRole)

    const { data: list } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
    setAllDocuments((list ?? []) as DocumentRow[])
  }

  useEffect(() => {
    setLoading(true)
    loadDocuments().then(() => setLoading(false))
  }, [])

  async function handleUpload(role: string, file: File) {
    const slot = UPLOAD_SLOTS.find((s) => s.role === role)
    if (!slot || !file?.name) return
    setUploading(role)
    setMessage(null)
    try {
      const path = slot.storagePath
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const existing = slots[role]
      const row = {
        title: slot.title,
        description: slot.description,
        file_path: path,
        file_type: file.type || 'application/pdf',
        category: slot.category,
        role: slot.role,
      }
      if (existing?.id) {
        const { error: updateError } = await supabase.from('documents').update(row).eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('documents').insert(row)
        if (insertError) throw insertError
      }
      await loadDocuments()
      setMessage({ type: 'ok', text: `${slot.label} uploaded.` })
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      setUploading(null)
    }
  }

  async function handleRename(doc: DocumentRow) {
    if (!renameTitle.trim()) return
    const { error } = await supabase.from('documents').update({ title: renameTitle.trim() }).eq('id', doc.id)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Title updated.' })
    setRenamingId(null)
    setRenameTitle('')
    await loadDocuments()
  }

  async function handleArchive(doc: DocumentRow, archived: boolean) {
    const { error } = await supabase.from('documents').update({ is_archived: archived }).eq('id', doc.id)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: archived ? 'Document archived.' : 'Document restored.' })
    await loadDocuments()
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim() || !addFile) {
      setMessage({ type: 'err', text: 'Title and file are required.' })
      return
    }
    setAddSaving(true)
    setMessage(null)
    try {
      const safeName = addFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `uploads/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, addFile, { upsert: true })
      if (uploadError) throw uploadError
      const { error: insertError } = await supabase.from('documents').insert({
        title: addTitle.trim(),
        description: null,
        file_path: path,
        file_type: addFile.type || 'application/pdf',
        category: addCategory,
      })
      if (insertError) throw insertError
      setMessage({ type: 'ok', text: 'Document added.' })
      setAddOpen(false)
      setAddTitle('')
      setAddCategory('technical')
      setAddFile(null)
      await loadDocuments()
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Add failed' })
    } finally {
      setAddSaving(false)
    }
  }

  const activeDocs = allDocuments.filter((d) => !(d.is_archived === true))
  const archivedDocs = allDocuments.filter((d) => d.is_archived === true)

  if (loading) return <div className="admin-page"><p>Loading…</p></div>

  return (
    <div className="admin-page">
      <p className="page-intro">
        Upload the Pricelist, Brochure, and Door finder PDFs here. Add extra documents (e.g. fitting guides), rename files, and archive old brochures or pricelists below.
      </p>
      <p className="admin-upload-help" style={{ marginTop: '0.5rem' }}>
        The <strong>Pricelist</strong> is used by <code>npm run import-pricelist</code>. After uploading, run that script to refresh the catalogue. Ensure the <strong>documents</strong> storage bucket exists and is Public so View links work.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="admin-upload-slots">
        {UPLOAD_SLOTS.map((slot) => {
          const current = slots[slot.role]
          return (
            <div key={slot.role} className="card admin-upload-card">
              <h2>{slot.label}</h2>
              <p className="admin-upload-desc">{slot.description}</p>
              {current && (
                <p className="admin-upload-current">
                  Current file: <strong>{current.file_path}</strong>
                  {current.created_at && (
                    <span className="muted"> · Updated {new Date(current.created_at).toLocaleDateString()}</span>
                  )}
                  {' · '}
                  <a href={getPublicUrl(current.file_path)} target="_blank" rel="noopener noreferrer">View</a>
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')
                  if (input?.files?.[0]) handleUpload(slot.role, input.files[0])
                }}
                className="admin-upload-form"
              >
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="admin-upload-input"
                  onChange={() => setMessage(null)}
                />
                <button type="submit" className="btn btn-success" disabled={uploading === slot.role}>
                  {uploading === slot.role ? 'Uploading…' : 'Upload'}
                </button>
              </form>
            </div>
          )
        })}
      </div>

      <div className="card admin-card admin-docs-library">
        <div className="admin-card-header">
          <h2>Document library</h2>
          <button type="button" className="btn btn-small" onClick={() => setAddOpen(true)}>Add document</button>
        </div>
        <p className="admin-muted">All current documents. Use &quot;Technical / Fitting guide&quot; when adding fitting guides or other technical PDFs.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>File</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeDocs.length === 0 ? (
                <tr><td colSpan={5} className="admin-table-empty">No documents yet. Upload above or Add document.</td></tr>
              ) : (
                activeDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      {renamingId === doc.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleRename(doc); }}
                          className="admin-docs-rename-form"
                        >
                          <input
                            type="text"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            className="admin-input"
                            autoFocus
                          />
                          <button type="submit" className="btn btn-small">Save</button>
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => { setRenamingId(null); setRenameTitle(''); }}>Cancel</button>
                        </form>
                      ) : (
                        <strong>{doc.title}</strong>
                      )}
                    </td>
                    <td>{doc.category}</td>
                    <td><code>{doc.file_path}</code></td>
                    <td>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}</td>
                    <td className="admin-table-actions">
                      <a href={getPublicUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">View</a>
                      {renamingId !== doc.id && (
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => { setRenamingId(doc.id); setRenameTitle(doc.title); }}>Rename</button>
                      )}
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => handleArchive(doc, true)}>Archive</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card admin-card admin-docs-archive">
        <button
          type="button"
          className="admin-docs-archive-toggle"
          onClick={() => setShowArchived(!showArchived)}
          aria-expanded={showArchived}
        >
          <h2>Archived documents</h2>
          <span className="admin-muted">({archivedDocs.length})</span>
          <span className="admin-docs-archive-chevron">{showArchived ? '▲' : '▼'}</span>
        </button>
        {showArchived && (
          <div className="admin-docs-archive-body">
            {archivedDocs.length === 0 ? (
              <p className="admin-muted">No archived documents.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>File</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td><strong>{doc.title}</strong></td>
                        <td>{doc.category}</td>
                        <td><code>{doc.file_path}</code></td>
                        <td className="admin-table-actions">
                          <a href={getPublicUrl(doc.file_path)} target="_blank" rel="noopener noreferrer">View</a>
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => handleArchive(doc, false)}>Unarchive</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="admin-modal-backdrop" onClick={() => !addSaving && setAddOpen(false)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3>Add document</h3>
            <form onSubmit={handleAddDocument}>
              <label>Title (display name)</label>
              <input
                type="text"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. Fitting guide 2024"
                className="admin-input"
                required
              />
              <label>Category</label>
              <select value={addCategory} onChange={(e) => setAddCategory(e.target.value as DocumentRow['category'])} className="admin-select">
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <label>File (PDF)</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setAddFile(e.target.files?.[0] ?? null)}
                className="admin-upload-input"
              />
              <div className="admin-modal-actions">
                <button type="submit" className="btn" disabled={addSaving || !addFile}>{addSaving ? 'Adding…' : 'Add'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
