import { useState } from 'react'
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

  async function handleAdd(e: React.FormEvent) {
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

  async function handleDelete(code: string) {
    if (!canEdit) return
    if (!window.confirm('Delete this part type? Only unused custom types can be removed.')) return
    setBusy(true)
    const { error: err } = await deleteAssemblyPartType(code)
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else await reload()
  }

  const wrapClass = embedded ? 'admin-settings-embedded-panel' : 'card admin-settings-card'

  if (permLoading || loading) {
    return (
      <section className={wrapClass}>
        {!embedded && <h2>Complete-unit part types</h2>}
        <p className="admin-muted">Loading…</p>
      </section>
    )
  }

  return (
    <section className={wrapClass}>
      {!embedded && <h2>Complete-unit part types</h2>}
      <p className={embedded ? 'admin-settings-panel-intro' : 'page-intro admin-settings-hint'}>
        Labels used when defining a <strong>complete unit make-up</strong> (BOM) in the catalogue product modal and stock
        take. Staff can also add types on the fly when adding a component line.
      </p>
      {error && <p className="admin-error">{error}</p>}
      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}

      <ul className="admin-part-types-list">
        {types.map((t) => (
          <li key={t.code} className={`admin-part-types-item${t.active ? '' : ' admin-part-types-item--inactive'}`}>
            <code className="admin-part-types-code">{t.code}</code>
            {canEdit ? (
              <input
                className="admin-inline-edit-input admin-part-types-label-input"
                defaultValue={t.label}
                disabled={busy}
                onBlur={(e) => {
                  if (e.target.value.trim() !== t.label) void saveLabel(t.code, e.target.value)
                }}
              />
            ) : (
              <span>{t.label}</span>
            )}
            {t.is_system && <span className="admin-badge admin-badge--muted">Built-in</span>}
            {!t.active && <span className="admin-badge">Hidden</span>}
            {canEdit && (
              <div className="admin-part-types-item-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={busy}
                  onClick={() => void toggleActive(t.code, t.active)}
                >
                  {t.active ? 'Hide' : 'Show'}
                </button>
                {!t.is_system && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    disabled={busy}
                    onClick={() => void handleDelete(t.code)}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <form className="admin-part-types-add-form" onSubmit={(e) => void handleAdd(e)}>
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
        Manage BOM lines on <Link to="/admin/catalogue">Catalogue</Link> → open a product → scroll to{' '}
        <strong>Complete unit make-up</strong> → <strong>Define component breakdown</strong> (if needed) →{' '}
        <strong>Part type</strong> dropdown includes <em>＋ Add new part type…</em>.
      </p>
    </section>
  )
}
