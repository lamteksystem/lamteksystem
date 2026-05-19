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
  allowCreate?: boolean
  selectLabel?: string
}

export default function PartTypeSelectWithAdd({
  partTypes: partTypesProp,
  value,
  onChange,
  disabled,
  onPartTypesChange,
  className,
  allowCreate = true,
  selectLabel = 'Part type',
}: PartTypeSelectWithAddProps) {
  const [partTypes, setPartTypes] = useState(partTypesProp)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setPartTypes(partTypesProp.length > 0 ? partTypesProp : fallbackTypes())
  }, [partTypesProp])

  const codePreview = newCode.trim() || (newLabel.trim() ? slugifyPartTypeCode(newLabel) : '')
  const options = partTypes.length > 0 ? partTypes : fallbackTypes()

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
    setShowCreateForm(false)
  }

  return (
    <div className={`part-type-picker${className ? ` ${className}` : ''}`}>
      <label className="part-type-picker-select-wrap">
        <span className="product-assembly-editor-field-label">{selectLabel}</span>
        <select
          className="admin-select part-type-picker-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={selectLabel}
        >
          {options.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {allowCreate && (
        <div className="part-type-picker-create">
          <button
            type="button"
            className="part-type-picker-create-toggle"
            disabled={disabled}
            onClick={() => setShowCreateForm((v) => !v)}
            aria-expanded={showCreateForm}
          >
            {showCreateForm ? 'Hide new part type form' : 'Part type not listed? Create one…'}
          </button>
          {showCreateForm && (
            <form className="part-type-picker-create-form card" onSubmit={(e) => void handleSaveNew(e)}>
              <p className="admin-muted part-type-picker-create-hint">
                New part types are saved for all products. You can also manage them under{' '}
                <Link to="/admin/settings?tab=products">Settings → Products &amp; inventory</Link>.
              </p>
              <div className="part-type-picker-create-fields">
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
                <p className="admin-muted part-type-picker-code-preview">
                  Code: <code>{codePreview}</code>
                </p>
              )}
              {addError && <p className="admin-error">{addError}</p>}
              <button type="submit" className="btn btn-sm" disabled={adding || !newLabel.trim()}>
                {adding ? 'Saving…' : 'Save new part type'}
              </button>
            </form>
          )}
        </div>
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
