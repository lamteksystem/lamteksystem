import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createCategoryType,
  deleteCategoryType,
  slugifyCategoryTypeCode,
  updateCategoryType,
} from '@/lib/categoryTypes'
import { ORDERING_BEHAVIOUR_SETTINGS_HREF } from '@/lib/catalogueSettingsPaths'
import { createOrderingBehaviour } from '@/lib/orderingBehaviours'
import { useCategoryTypes } from '@/hooks/useCategoryTypes'
import { useOrderingBehaviours } from '@/hooks/useOrderingBehaviours'
import { usePermission } from '@/hooks/usePermission'
import type { CategoryTypeRow, OrderingBehaviourDefinitionRow } from '@/types/database'

const BROWSE_MODE_LABELS: Record<CategoryTypeRow['browse_mode'], string> = {
  product: 'Product categories',
  door_range: 'Kitchen ranges',
  universal: 'Cross-range',
}

const ADD_BEHAVIOUR_OPTION = '__add_behaviour__'

export type CategoryTypesEditScope = 'settings' | 'catalogue' | 'any'

function OrderingBehaviourSelect({
  value,
  behaviours,
  disabled,
  canEdit,
  onSelect,
  onRequestAdd,
}: {
  value: string
  behaviours: OrderingBehaviourDefinitionRow[]
  disabled: boolean
  canEdit: boolean
  onSelect: (code: string) => void
  onRequestAdd: () => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value
        if (next === ADD_BEHAVIOUR_OPTION) {
          onRequestAdd()
          return
        }
        onSelect(next)
      }}
    >
      {behaviours.map((b) => (
        <option key={b.code} value={b.code}>
          {b.label}
        </option>
      ))}
      {canEdit && <option value={ADD_BEHAVIOUR_OPTION}>+ Add new behaviour…</option>}
    </select>
  )
}

export default function CategoryTypesManager({
  embedded = false,
  editScope = 'settings',
  onTypesChanged,
}: {
  embedded?: boolean
  editScope?: CategoryTypesEditScope
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
  const {
    behaviours,
    labelFor,
    loading: behavioursLoading,
    reload: reloadBehaviours,
  } = useOrderingBehaviours()
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newBrowseMode, setNewBrowseMode] = useState<CategoryTypeRow['browse_mode']>('product')
  const [newOrderingBehaviour, setNewOrderingBehaviour] = useState('standard')
  const [newDescription, setNewDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [quickBehaviourOpen, setQuickBehaviourOpen] = useState(false)
  const [quickBehaviourLabel, setQuickBehaviourLabel] = useState('')
  const [quickBehaviourApply, setQuickBehaviourApply] = useState<
    { kind: 'add-form' } | { kind: 'type-row'; typeCode: string }
  >({ kind: 'add-form' })

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyCategoryTypeCode(newLabel) : '')

  function openQuickAddBehaviour(
    apply: { kind: 'add-form' } | { kind: 'type-row'; typeCode: string },
  ) {
    setQuickBehaviourApply(apply)
    setQuickBehaviourLabel('')
    setQuickBehaviourOpen(true)
  }

  async function submitQuickBehaviour(e: FormEvent) {
    e.preventDefault()
    if (!canEdit || !quickBehaviourLabel.trim()) return
    setBusy(true)
    setMessage(null)
    const { row, error: err } = await createOrderingBehaviour({ label: quickBehaviourLabel })
    setBusy(false)
    if (err || !row) {
      setMessage({ type: 'err', text: err ?? 'Could not add behaviour.' })
      return
    }
    await reloadBehaviours()
    if (quickBehaviourApply.kind === 'add-form') {
      setNewOrderingBehaviour(row.code)
    } else {
      await saveOrderingBehaviour(quickBehaviourApply.typeCode, row.code)
    }
    setQuickBehaviourOpen(false)
    setMessage({ type: 'ok', text: `Added behaviour “${row.label}”.` })
  }

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

  async function saveOrderingBehaviour(code: string, ordering_behaviour: string) {
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

  async function toggleBuiltIn(row: CategoryTypeRow) {
    if (!canEdit) return
    setBusy(true)
    const { error: err } = await updateCategoryType(row.code, { is_system: !row.is_system })
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

  if (permLoading || loading || behavioursLoading) {
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
        filters; <strong>Quote/order behaviour</strong> controls guided setup and how lines are added.{' '}
        <Link to={ORDERING_BEHAVIOUR_SETTINGS_HREF}>Manage behaviours in settings →</Link>
      </p>
      {error && <p className="admin-error">{error}</p>}
      {message && (
        <p className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} role="status">
          {message.text}
        </p>
      )}

      {quickBehaviourOpen && canEdit && (
        <form
          className="admin-registry-add-form admin-quick-behaviour-form"
          onSubmit={(e) => void submitQuickBehaviour(e)}
        >
          <h4 className="admin-modal-form-section-title">Add quote/order behaviour</h4>
          <label>
            Display name
            <input
              value={quickBehaviourLabel}
              onChange={(e) => setQuickBehaviourLabel(e.target.value)}
              placeholder="e.g. Panels workflow"
              required
              disabled={busy}
              autoFocus
            />
          </label>
          <div className="admin-settings-actions-row">
            <button type="submit" className="btn btn-small" disabled={busy || !quickBehaviourLabel.trim()}>
              {busy ? 'Adding…' : 'Add & select'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-small"
              disabled={busy}
              onClick={() => setQuickBehaviourOpen(false)}
            >
              Cancel
            </button>
            <Link to={ORDERING_BEHAVIOUR_SETTINGS_HREF} className="btn btn-outline btn-small">
              Full behaviour settings
            </Link>
          </div>
        </form>
      )}

      <div className="admin-registry-table-wrap">
        <table className="admin-registry-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Display name</th>
              <th>Browse as</th>
              <th>
                Quote/order behaviour{' '}
                <Link to={ORDERING_BEHAVIOUR_SETTINGS_HREF} className="admin-table-header-link">
                  Settings
                </Link>
              </th>
              <th>Description</th>
              <th>Built-in</th>
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
                    <OrderingBehaviourSelect
                      value={t.ordering_behaviour ?? 'standard'}
                      behaviours={behaviours}
                      disabled={busy}
                      canEdit={canEdit}
                      onSelect={(code) => void saveOrderingBehaviour(t.code, code)}
                      onRequestAdd={() => openQuickAddBehaviour({ kind: 'type-row', typeCode: t.code })}
                    />
                  ) : (
                    labelFor(t.ordering_behaviour)
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
                  {canEdit ? (
                    <label className="admin-settings-row admin-settings-row--compact" title="Built-in types cannot be deleted">
                      <input
                        type="checkbox"
                        checked={t.is_system}
                        disabled={busy}
                        onChange={() => void toggleBuiltIn(t)}
                      />
                      <span className="admin-muted">{t.is_system ? 'Yes' : 'No'}</span>
                    </label>
                  ) : t.is_system ? (
                    'Yes'
                  ) : (
                    'No'
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
              <OrderingBehaviourSelect
                value={newOrderingBehaviour}
                behaviours={behaviours}
                disabled={busy}
                canEdit={canEdit}
                onSelect={setNewOrderingBehaviour}
                onRequestAdd={() => openQuickAddBehaviour({ kind: 'add-form' })}
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
