import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createAssemblyPartType,
  deleteAssemblyPartType,
  slugifyPartTypeCode,
  updateAssemblyPartType,
} from '@/lib/assemblyPartTypes'
import { useAssemblyPartTypes } from '@/hooks/useAssemblyPartTypes'
import { usePermission } from '@/hooks/usePermission'

export default function AdminAssemblyPartTypesSettings({ embedded = false }: { embedded?: boolean }) {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.settings', 'edit')
  const { types, loading, error, reload } = useAssemblyPartTypes(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyPartTypeCode(newLabel) : '')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setBusy(true)
    setMessage(null)
    const { partType, error: err } = await createAssemblyPartType({
      label: newLabel,
      code: newCode.trim() || undefined,
    })
    setBusy(false)
    if (err || !partType) {
      setMessage({ type: 'err', text: err ?? 'Could not add part type.' })
      return
    }
    setNewLabel('')
    setNewCode('')
    setMessage({ type: 'ok', text: `Added “${partType.label}”.` })
    await reload()
  }

  async function saveLabel(code: string, label: string) {
    if (!canEdit) return
    const trimmed = label.trim()
    if (!trimmed) return
    setBusy(true)
    const { error: err } = await updateAssemblyPartType(code, { label: trimmed })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else await reload()
  }

  async function toggleActive(code: string, active: boolean) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateAssemblyPartType(code, { active: !active })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else await reload()
  }

  async function handleDelete(code: string, label: string, isSystem: boolean) {
    if (!canEdit) return
    if (isSystem) {
      setMessage({ type: 'err', text: 'Built-in part types cannot be deleted — use Hide instead.' })
      return
    }
    if (!window.confirm(`Delete part type “${label}”?`)) return
    setBusy(true)
    const { error: err } = await deleteAssemblyPartType(code)
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      setMessage({ type: 'ok', text: `Deleted “${label}”.` })
      await reload()
    }
  }

  const wrapClass = embedded ? 'admin-settings-embedded-panel' : 'card admin-settings-card'

  if (permLoading || loading) {
    return (
      <section className={wrapClass}>
        {!embedded && <h2>Products &amp; inventory</h2>}
        <p className="admin-muted">Loading…</p>
      </section>
    )
  }

  return (
    <section className={wrapClass}>
      {!embedded && <h2>Products &amp; inventory</h2>}
      <p className={embedded ? 'admin-settings-panel-intro' : 'page-intro admin-settings-hint'}>
        <strong>BOM part types</strong> label each line when defining a complete-unit make-up in the
        catalogue product modal. Built-in types can be hidden but not deleted; custom types can be
        removed when unused.
      </p>
      {error && <p className="admin-error">{error}</p>}
      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}

      <div className="admin-registry-table-wrap">
        <table className="admin-registry-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Display name</th>
              <th>Status</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.code} className={!t.active ? 'admin-registry-row--inactive' : undefined}>
                <td>
                  <code>{t.code}</code>
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="admin-inline-edit-input"
                      defaultValue={t.label}
                      disabled={busy}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== t.label) void saveLabel(t.code, e.target.value)
                      }}
                    />
                  ) : (
                    t.label
                  )}
                </td>
                <td>
                  {t.is_system && <span className="admin-badge admin-badge--muted">Built-in</span>}
                  {!t.active && <span className="admin-badge">Hidden</span>}
                  {t.active && !t.is_system && <span className="admin-badge admin-badge--ok">Active</span>}
                </td>
                {canEdit && (
                  <td className="admin-registry-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={busy}
                      onClick={() => void toggleActive(t.code, t.active)}
                    >
                      {t.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline admin-danger"
                      disabled={busy || t.is_system}
                      onClick={() => void handleDelete(t.code, t.label, t.is_system)}
                      title={t.is_system ? 'Built-in — hide instead of delete' : 'Delete custom type'}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <form className="admin-registry-add-form" onSubmit={(e) => void handleAdd(e)}>
          <h3 className="admin-modal-form-section-title">Add part type</h3>
          <div className="admin-part-types-add-fields">
            <label>
              Display name
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Worktop bracket"
                required
                disabled={busy}
              />
            </label>
            <label>
              Code <span className="admin-muted">(optional)</span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={codePreview || 'auto from name'}
                disabled={busy}
              />
            </label>
          </div>
          {codePreview && (
            <p className="admin-muted admin-settings-hint">
              Stored as <code>{codePreview}</code>
            </p>
          )}
          <button type="submit" className="btn btn-outline" disabled={busy || !newLabel.trim()}>
            {busy ? 'Adding…' : 'Add part type'}
          </button>
        </form>
      ) : (
        <p className="admin-muted">You do not have permission to edit settings.</p>
      )}

      <p className="admin-settings-hint" style={{ marginTop: '1rem' }}>
        Manage BOM lines on <Link to="/admin/catalogue">Catalogue</Link> → open a product →{' '}
        <strong>Complete unit make-up</strong>.
      </p>
    </section>
  )
}
