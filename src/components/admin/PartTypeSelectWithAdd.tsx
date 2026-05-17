import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAssemblyPartType,
  DEFAULT_ASSEMBLY_PART_TYPES,
  slugifyPartTypeCode,
} from '@/lib/assemblyPartTypes'
import type { AssemblyPartTypeRow } from '@/types/database'

interface PartTypeSelectWithAddProps {
  partTypes: AssemblyPartTypeRow[]
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  onPartTypesChange?: (types: AssemblyPartTypeRow[]) => void
  className?: string
}

export default function PartTypeSelectWithAdd({
  partTypes: partTypesProp,
  value,
  onChange,
  disabled,
  onPartTypesChange,
  className,
}: PartTypeSelectWithAddProps) {
  const [partTypes, setPartTypes] = useState(partTypesProp)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setPartTypes(partTypesProp.length > 0 ? partTypesProp : fallbackTypes())
  }, [partTypesProp])

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyPartTypeCode(newLabel) : '')
  const options =
    partTypes.length > 0
      ? partTypes
      : fallbackTypes()

  async function handleSaveNew(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    const { partType, error } = await createAssemblyPartType({
      label: newLabel,
      code: newCode.trim() || undefined,
    })
    setAdding(false)
    if (error || !partType) {
      setAddError(error ?? 'Could not add part type.')
      return
    }
    const next = [...options, partType].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    )
    setPartTypes(next)
    onPartTypesChange?.(next)
    onChange(partType.code)
    setNewLabel('')
    setNewCode('')
    setShowAddForm(false)
  }

  return (
    <div className={`part-type-select-with-add${className ? ` ${className}` : ''}`}>
      <div className="part-type-select-with-add-row">
        <select
          className="admin-select part-type-select-with-add-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || showAddForm}
          aria-label="Part type"
        >
          {options.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm btn-outline part-type-select-with-add-btn"
          disabled={disabled}
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add part type'}
        </button>
      </div>

      {showAddForm && (
        <form className="part-type-select-with-add-form card" onSubmit={(e) => void handleSaveNew(e)}>
          <p className="admin-muted part-type-select-with-add-form-hint">
            Saved for all products. Also under{' '}
            <Link to="/admin/settings?tab=products">Settings → Products &amp; inventory</Link>.
          </p>
          <div className="part-type-select-with-add-form-fields">
            <label className="product-assembly-editor-field">
              <span className="product-assembly-editor-field-label">Display name</span>
              <input
                className="admin-input"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Cornice"
                required
                autoFocus
                disabled={adding}
              />
            </label>
            <label className="product-assembly-editor-field">
              <span className="product-assembly-editor-field-label">Code (optional)</span>
              <input
                className="admin-input"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={codePreview || 'auto'}
                disabled={adding}
              />
            </label>
          </div>
          {codePreview && (
            <p className="admin-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
              Code: <code>{codePreview}</code>
            </p>
          )}
          {addError && <p className="admin-error">{addError}</p>}
          <button type="submit" className="btn btn-sm" disabled={adding || !newLabel.trim()}>
            {adding ? 'Saving…' : 'Save part type'}
          </button>
        </form>
      )}
    </div>
  )
}

function fallbackTypes(): AssemblyPartTypeRow[] {
  return DEFAULT_ASSEMBLY_PART_TYPES.map((row) => ({
    ...row,
    active: true,
    created_at: '',
    updated_at: '',
  }))
}
