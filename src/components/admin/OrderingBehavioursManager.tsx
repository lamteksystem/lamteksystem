import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createOrderingBehaviour,
  deleteOrderingBehaviour,
  slugifyOrderingBehaviourCode,
  updateOrderingBehaviour,
} from '@/lib/orderingBehaviours'
import { LIVE_CATALOGUE } from '@/lib/catalogueToolsPaths'
import { useOrderingBehaviours } from '@/hooks/useOrderingBehaviours'
import { usePermission } from '@/hooks/usePermission'
import type { OrderingBehaviourDefinitionRow } from '@/types/database'

export default function OrderingBehavioursManager({
  embedded = false,
  editScope = 'any',
  onChanged,
}: {
  embedded?: boolean
  editScope?: 'settings' | 'catalogue' | 'any'
  onChanged?: () => void | Promise<void>
}) {
  const { allowed: settingsEdit, loading: settingsPermLoading } = usePermission('admin.settings', 'edit')
  const { allowed: catalogueEdit, loading: cataloguePermLoading } = usePermission('admin.catalogue', 'edit')
  const canEdit =
    editScope === 'catalogue'
      ? catalogueEdit
      : editScope === 'settings'
        ? settingsEdit
        : settingsEdit || catalogueEdit
  const permLoading =
    editScope === 'catalogue'
      ? cataloguePermLoading
      : editScope === 'settings'
        ? settingsPermLoading
        : settingsPermLoading && cataloguePermLoading

  const { behaviours, loading, error, reload } = useOrderingBehaviours()
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyOrderingBehaviourCode(newLabel) : '')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setBusy(true)
    setMessage(null)
    const { row, error: err } = await createOrderingBehaviour({
      label: newLabel,
      code: newCode.trim() || undefined,
      description: newDescription.trim() || undefined,
    })
    setBusy(false)
    if (err || !row) {
      setMessage({ type: 'err', text: err ?? 'Could not add behaviour.' })
      return
    }
    setNewLabel('')
    setNewCode('')
    setNewDescription('')
    setMessage({ type: 'ok', text: `Added behaviour “${row.label}”.` })
    await reload()
    await onChanged?.()
  }

  async function saveLabel(code: string, label: string) {
    if (!canEdit) return
    const trimmed = label.trim()
    if (!trimmed) return
    setBusy(true)
    const { error: err } = await updateOrderingBehaviour(code, { label: trimmed })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onChanged?.()
    }
  }

  async function saveDescription(code: string, description: string) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateOrderingBehaviour(code, {
      description: description.trim() || null,
    })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onChanged?.()
    }
  }

  async function toggleBuiltIn(row: OrderingBehaviourDefinitionRow) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateOrderingBehaviour(row.code, { is_system: !row.is_system })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onChanged?.()
    }
  }

  async function handleDelete(row: OrderingBehaviourDefinitionRow) {
    if (!canEdit) return
    if (row.is_system) {
      setMessage({ type: 'err', text: 'Built-in behaviours cannot be deleted.' })
      return
    }
    if (!window.confirm(`Delete behaviour “${row.label}”?`)) return
    setBusy(true)
    const { error: err } = await deleteOrderingBehaviour(row.code)
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      setMessage({ type: 'ok', text: `Deleted “${row.label}”.` })
      await reload()
      await onChanged?.()
    }
  }

  if (permLoading || loading) {
    return <p className="admin-muted">Loading quote/order behaviours…</p>
  }

  return (
    <section
      id="ordering-behaviours"
      className={embedded ? 'admin-taxonomy-section card admin-card' : 'card admin-card admin-taxonomy-section'}
    >
      <h2 className="admin-modal-form-section-title">Quote / order behaviours</h2>
      <p className="admin-muted admin-taxonomy-section-intro">
        These behaviours appear on <Link to={LIVE_CATALOGUE.categories}>category types</Link> and describe how
        staff add products on quotes and orders (standard search, Tealbury Complete BOM, accessories, etc.).
        Built-in behaviours can be marked so they are not deleted accidentally.
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
              <th>Description</th>
              <th>Built-in</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {behaviours.map((b) => (
              <tr key={b.code}>
                <td>
                  <code>{b.code}</code>
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="admin-inline-edit-input"
                      defaultValue={b.label}
                      disabled={busy}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== b.label) void saveLabel(b.code, e.target.value)
                      }}
                    />
                  ) : (
                    b.label
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="admin-inline-edit-input admin-registry-desc-input"
                      defaultValue={b.description ?? ''}
                      placeholder="Optional"
                      disabled={busy}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (b.description ?? '')) void saveDescription(b.code, e.target.value)
                      }}
                    />
                  ) : (
                    b.description ?? '—'
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <label className="admin-settings-row admin-settings-row--compact">
                      <input
                        type="checkbox"
                        checked={b.is_system}
                        disabled={busy}
                        onChange={() => void toggleBuiltIn(b)}
                      />
                      <span className="admin-muted">{b.is_system ? 'Yes' : 'No'}</span>
                    </label>
                  ) : b.is_system ? (
                    'Yes'
                  ) : (
                    'No'
                  )}
                </td>
                {canEdit && (
                  <td className="admin-registry-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline admin-danger"
                      disabled={busy || b.is_system}
                      onClick={() => void handleDelete(b)}
                      title={b.is_system ? 'Built-in behaviours cannot be deleted' : 'Delete custom behaviour'}
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
          <h4 className="admin-modal-form-section-title">Add behaviour</h4>
          <div className="admin-catalogue-categories-add-grid">
            <label>
              Display name
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. MTO panels only"
                required
                disabled={busy}
              />
            </label>
            <label>
              Code <span className="admin-muted">(optional)</span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={codePreview || 'auto'}
                disabled={busy}
              />
            </label>
            <label>
              Description <span className="admin-muted">(optional)</span>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          {codePreview && (
            <p className="admin-muted admin-settings-hint">
              Stored as <code>{codePreview}</code>
            </p>
          )}
          <button type="submit" className="btn btn-outline btn-small" disabled={busy || !newLabel.trim()}>
            {busy ? 'Adding…' : 'Add behaviour'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
