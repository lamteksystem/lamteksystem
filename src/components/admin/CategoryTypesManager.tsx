import { useState, type FormEvent } from 'react'
import {
  createCategoryType,
  deleteCategoryType,
  ORDERING_BEHAVIOUR_LABELS,
  slugifyCategoryTypeCode,
  updateCategoryType,
} from '@/lib/categoryTypes'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import { usePermission } from '@/hooks/usePermission'
import type { CategoryTypeRow } from '@/types/database'

const BROWSE_MODE_LABELS: Record<CategoryTypeRow['browse_mode'], string> = {
  product: 'Product categories',
  door_range: 'Kitchen ranges',
  universal: 'Cross-range',
}

export type CategoryTypesEditScope = 'settings' | 'catalogue' | 'any'

export default function CategoryTypesManager({
  embedded = false,
  /** Who may add/edit types: settings admins, catalogue editors, or either. */
  editScope = 'settings',
  onTypesChanged,
}: {
  embedded?: boolean
  editScope?: CategoryTypesEditScope
  /** Called after types are added/updated so category Type dropdowns can refresh. */
  onTypesChanged?: () => void | Promise<void>
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
  const { types, loading, error, reload } = useCategoryTypes(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newBrowseMode, setNewBrowseMode] = useState<CategoryTypeRow['browse_mode']>('product')
  const [newOrderingBehaviour, setNewOrderingBehaviour] =
    useState<CategoryTypeRow['ordering_behaviour']>('standard')
  const [newDescription, setNewDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyCategoryTypeCode(newLabel) : '')

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setBusy(true)
    setMessage(null)
    const { categoryType, error: err } = await createCategoryType({
      label: newLabel,
      code: newCode.trim() || undefined,
      description: newDescription.trim() || undefined,
      browse_mode: newBrowseMode,
      ordering_behaviour: newOrderingBehaviour,
    })
    setBusy(false)
    if (err || !categoryType) {
      setMessage({ type: 'err', text: err ?? 'Could not add category type.' })
      return
    }
    setNewLabel('')
    setNewCode('')
    setNewDescription('')
    setNewBrowseMode('product')
    setNewOrderingBehaviour('standard')
    setMessage({ type: 'ok', text: `Added type “${categoryType.label}”.` })
    await reload()
    await onTypesChanged?.()
  }

  async function saveLabel(code: string, label: string) {
    if (!canEdit) return
    const trimmed = label.trim()
    if (!trimmed) return
    setBusy(true)
    const { error: err } = await updateCategoryType(code, { label: trimmed })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onTypesChanged?.()
    }
  }

  async function saveDescription(code: string, description: string) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateCategoryType(code, { description: description.trim() || null })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onTypesChanged?.()
    }
  }

  async function saveBrowseMode(code: string, browse_mode: CategoryTypeRow['browse_mode']) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateCategoryType(code, { browse_mode })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onTypesChanged?.()
    }
  }

  async function saveOrderingBehaviour(
    code: string,
    ordering_behaviour: CategoryTypeRow['ordering_behaviour'],
  ) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateCategoryType(code, { ordering_behaviour })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onTypesChanged?.()
    }
  }

  async function toggleActive(row: CategoryTypeRow) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateCategoryType(row.code, { active: !row.active })
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      await reload()
      await onTypesChanged?.()
    }
  }

  async function handleDelete(row: CategoryTypeRow) {
    if (!canEdit) return
    if (row.is_system) {
      setMessage({ type: 'err', text: 'Built-in types cannot be deleted — use Hide instead.' })
      return
    }
    if (!window.confirm(`Delete type “${row.label}”? Categories must not use this type.`)) return
    setBusy(true)
    const { error: err } = await deleteCategoryType(row.code)
    setBusy(false)
    if (err) setMessage({ type: 'err', text: err })
    else {
      setMessage({ type: 'ok', text: `Deleted “${row.label}”.` })
      await reload()
      await onTypesChanged?.()
    }
  }

  if (permLoading || loading) {
    return <p className="admin-muted">Loading category types…</p>
  }

  return (
    <section
      id="category-types"
      className={embedded ? 'admin-taxonomy-section card admin-card' : 'card admin-card admin-taxonomy-section'}
    >
      <h2 className="admin-modal-form-section-title">Category types</h2>
      <p className="admin-muted admin-taxonomy-section-intro">
        These are the options in the <strong>Type</strong> dropdown when you add or edit a category
        (Product category, Kitchen range, Tealbury Complete, etc.). <strong>Browse as</strong> controls
        filters; <strong>Quote/order behaviour</strong> controls guided setup and how lines are added.
        Built-in types can be hidden but not deleted.
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
              <th>Browse as</th>
              <th>Quote/order behaviour</th>
              <th>Description</th>
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
                  {canEdit ? (
                    <select
                      defaultValue={t.browse_mode}
                      disabled={busy}
                      onChange={(e) =>
                        void saveBrowseMode(t.code, e.target.value as CategoryTypeRow['browse_mode'])
                      }
                    >
                      <option value="product">{BROWSE_MODE_LABELS.product}</option>
                      <option value="door_range">{BROWSE_MODE_LABELS.door_range}</option>
                      <option value="universal">{BROWSE_MODE_LABELS.universal}</option>
                    </select>
                  ) : (
                    BROWSE_MODE_LABELS[t.browse_mode]
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <select
                      defaultValue={t.ordering_behaviour ?? 'standard'}
                      disabled={busy}
                      onChange={(e) =>
                        void saveOrderingBehaviour(
                          t.code,
                          e.target.value as CategoryTypeRow['ordering_behaviour'],
                        )
                      }
                    >
                      {(Object.keys(ORDERING_BEHAVIOUR_LABELS) as CategoryTypeRow['ordering_behaviour'][]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {ORDERING_BEHAVIOUR_LABELS[k]}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    ORDERING_BEHAVIOUR_LABELS[t.ordering_behaviour ?? 'standard']
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="admin-inline-edit-input admin-registry-desc-input"
                      defaultValue={t.description ?? ''}
                      placeholder="Optional"
                      disabled={busy}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (t.description ?? '')) void saveDescription(t.code, e.target.value)
                      }}
                    />
                  ) : (
                    t.description ?? '—'
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
                      onClick={() => void toggleActive(t)}
                      title={t.active ? 'Hide this type from new category assignments' : 'Show again'}
                    >
                      {t.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline admin-danger"
                      disabled={busy || t.is_system}
                      onClick={() => void handleDelete(t)}
                      title={t.is_system ? 'Built-in types cannot be deleted' : 'Delete custom type'}
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
          <h4 className="admin-modal-form-section-title">Add type</h4>
          <div className="admin-catalogue-categories-add-grid">
            <label>
              Display name
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Complete units"
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
              Browse as
              <select
                value={newBrowseMode}
                onChange={(e) => setNewBrowseMode(e.target.value as CategoryTypeRow['browse_mode'])}
                disabled={busy}
              >
                <option value="product">{BROWSE_MODE_LABELS.product}</option>
                <option value="door_range">{BROWSE_MODE_LABELS.door_range}</option>
                <option value="universal">{BROWSE_MODE_LABELS.universal}</option>
              </select>
            </label>
            <label>
              Quote/order behaviour
              <select
                value={newOrderingBehaviour}
                onChange={(e) =>
                  setNewOrderingBehaviour(e.target.value as CategoryTypeRow['ordering_behaviour'])
                }
                disabled={busy}
              >
                {(Object.keys(ORDERING_BEHAVIOUR_LABELS) as CategoryTypeRow['ordering_behaviour'][]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {ORDERING_BEHAVIOUR_LABELS[k]}
                    </option>
                  ),
                )}
              </select>
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
            {busy ? 'Adding…' : 'Add type'}
          </button>
        </form>
      ) : (
        <p className="admin-muted">
          You need catalogue or settings edit permission to add category types.
        </p>
      )}
    </section>
  )
}
