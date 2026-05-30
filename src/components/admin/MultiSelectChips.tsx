import { useId, useMemo, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface Props {
  values: string[]
  options: MultiSelectOption[]
  onChange: (values: string[]) => void
  /** Allow typing values that are not in `options` (e.g. free-text sections). */
  allowCustom?: boolean
  /** Placeholder for the add control. */
  addLabel?: string
  ariaLabel?: string
  className?: string
}

/**
 * Compact chip-based multi-select. Selected values render as removable chips; an
 * inline native `<select>` (and optional free-text input) adds further values.
 * Used in both the pricelist workbench table cells and the row modal.
 */
export default function MultiSelectChips({
  values,
  options,
  onChange,
  allowCustom = false,
  addLabel = '+ Add',
  ariaLabel,
  className,
}: Props) {
  const [custom, setCustom] = useState('')
  const listId = useId()

  const labelFor = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]))
    return (v: string) => map.get(v) ?? v
  }, [options])

  const available = useMemo(() => {
    const chosen = new Set(values.map((v) => v.toLowerCase()))
    return options.filter((o) => !chosen.has(o.value.toLowerCase()))
  }, [options, values])

  const add = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) return
    onChange([...values, v])
  }

  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v))
  }

  return (
    <div className={`admin-multiselect${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      <div className="admin-multiselect-chips">
        {values.length === 0 ? <span className="admin-multiselect-empty">—</span> : null}
        {values.map((v) => (
          <span key={v} className="admin-multiselect-chip">
            <span className="admin-multiselect-chip-label">{labelFor(v)}</span>
            <button
              type="button"
              className="admin-multiselect-chip-remove"
              aria-label={`Remove ${labelFor(v)}`}
              onClick={() => remove(v)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="admin-multiselect-add">
        {available.length > 0 ? (
          <select
            className="admin-multiselect-select"
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value)
            }}
          >
            <option value="">{addLabel}</option>
            {available.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        {allowCustom ? (
          <>
            <input
              className="admin-multiselect-input"
              list={listId}
              value={custom}
              placeholder="Type + Enter"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add(custom)
                  setCustom('')
                }
              }}
            />
            <datalist id={listId}>
              {available.map((o) => (
                <option key={o.value} value={o.value} />
              ))}
            </datalist>
          </>
        ) : null}
      </div>
    </div>
  )
}
