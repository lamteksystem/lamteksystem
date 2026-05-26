import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import {
  CATALOG_WORKBENCH_COLUMNS,
  CATALOG_WORKBENCH_CONFIGURABLE_COLUMN_IDS,
  CATALOG_WORKBENCH_DEFAULT_ORDER_IDS,
  CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS,
  CATALOG_WORKBENCH_LOCKED_COLUMN_IDS,
  normalizeWorkbenchColumnOrder,
} from '@/lib/catalogWorkbenchColumns'
import {
  fetchCatalogWorkbenchColumnDefaults,
  saveCatalogWorkbenchColumnDefaults,
} from '@/lib/catalogWorkbenchSettings'

/** Organisation-wide default columns for product search on orders/quotes. */
export default function SettingsCatalogWorkbenchColumns() {
  const { allowed: canEdit, loading: permLoading } = usePermission('admin.settings', 'edit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<string[]>([...CATALOG_WORKBENCH_DEFAULT_ORDER_IDS])
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS),
  )
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const defaults = await fetchCatalogWorkbenchColumnDefaults()
      setOrder(defaults.order)
      setVisible(new Set(defaults.visible))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workbench column defaults.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const configurableDefs = useMemo(
    () =>
      order
        .filter((id) => CATALOG_WORKBENCH_CONFIGURABLE_COLUMN_IDS.includes(id))
        .map((id) => CATALOG_WORKBENCH_COLUMNS.find((c) => c.id === id))
        .filter((c): c is (typeof CATALOG_WORKBENCH_COLUMNS)[number] => !!c),
    [order],
  )

  function toggleVisible(id: string, checked: boolean) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      for (const locked of CATALOG_WORKBENCH_LOCKED_COLUMN_IDS) next.add(locked)
      return next
    })
    setStatus(null)
  }

  function moveColumn(id: string, direction: -1 | 1) {
    setOrder((prev) => {
      const configurable = prev.filter((colId) => CATALOG_WORKBENCH_CONFIGURABLE_COLUMN_IDS.includes(colId))
      const idx = configurable.indexOf(id)
      if (idx === -1) return prev
      const target = idx + direction
      if (target < 0 || target >= configurable.length) return prev
      const nextConfigurable = [...configurable]
      const [removed] = nextConfigurable.splice(idx, 1)
      nextConfigurable.splice(target, 0, removed)
      const locked = prev.filter((colId) => CATALOG_WORKBENCH_LOCKED_COLUMN_IDS.has(colId))
      return normalizeWorkbenchColumnOrder([...nextConfigurable, ...locked])
    })
    setStatus(null)
  }

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const saved = await saveCatalogWorkbenchColumnDefaults(order, [...visible])
      setOrder(saved.order)
      setVisible(new Set(saved.visible))
      setStatus('Saved. New staff sessions use these defaults; existing personal column choices are unchanged.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  function handleResetCodeDefaults() {
    setOrder([...CATALOG_WORKBENCH_DEFAULT_ORDER_IDS])
    setVisible(new Set(CATALOG_WORKBENCH_DEFAULT_VISIBLE_IDS))
    setStatus('Reset to built-in defaults — click Save to apply for everyone.')
  }

  if (loading || permLoading) {
    return <p className="admin-muted">Loading product table column defaults…</p>
  }

  return (
    <fieldset className="admin-settings-fieldset">
      <legend>Product search table columns</legend>
      <p className="admin-settings-panel-intro">
        Default columns for the product picker on orders and quotes (the table with the column cog).
        Staff can still customise their own view; &quot;Reset to default&quot; in the cog uses these
        organisation defaults.
      </p>

      {error && (
        <p className="admin-settings-error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="admin-settings-hint">{status}</p>}

      <ul className="admin-settings-column-defaults-list">
        {configurableDefs.map((col, index) => (
          <li key={col.id} className="admin-settings-column-defaults-row">
            <label className="admin-settings-column-defaults-label">
              <input
                type="checkbox"
                checked={visible.has(col.id)}
                disabled={!canEdit}
                onChange={(e) => toggleVisible(col.id, e.target.checked)}
              />
              <span>{col.label}</span>
            </label>
            <div className="admin-settings-column-defaults-order">
              <button
                type="button"
                className="btn btn-outline btn-small"
                disabled={!canEdit || index === 0}
                onClick={() => moveColumn(col.id, -1)}
                aria-label={`Move ${col.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-outline btn-small"
                disabled={!canEdit || index === configurableDefs.length - 1}
                onClick={() => moveColumn(col.id, 1)}
                aria-label={`Move ${col.label} down`}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="admin-settings-hint">
        <strong>Qty</strong> and <strong>Add</strong> are always shown at the end of the table.
      </p>

      <div className="admin-settings-actions-row">
        <button
          type="button"
          className="btn btn-small"
          disabled={!canEdit || saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save organisation defaults'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-small"
          disabled={!canEdit || saving}
          onClick={handleResetCodeDefaults}
        >
          Reset to built-in defaults
        </button>
      </div>

      {!canEdit && (
        <p className="admin-settings-hint">You need Settings edit permission to change organisation defaults.</p>
      )}
    </fieldset>
  )
}
