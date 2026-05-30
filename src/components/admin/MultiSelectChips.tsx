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
  /** Short noun shown in the add control, e.g. "kind" → "+ Add kind". */
  noun?: string
  ariaLabel?: string
  className?: string
}

/**
 * Compact chip-based multi-select. Selected values render as removable pills; a
 * single "+ Add …" dropdown (plus optional free-text entry) appends more.
 * Shared by the pricelist workbench table cells and the row modal so both look
 * identical.
 */
export default function MultiSelectChips({
  values,
  options,
  onChange,
  allowCustom = false,
  noun,
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

  const remove = (v: string) => onChange(values.filter((x) => x !== v))

  const addLabel = noun ? `+ Add ${noun}` : '+ Add'

  return (
    <div className={`admin-mschips${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      {values.length > 0 ? (
        <div className="admin-mschips-tags">
          {values.map((v) => (
            <span key={v} className="admin-mschips-tag">
              <span className="admin-mschips-tag-label">{labelFor(v)}</span>
              <button
                type="button"
                className="admin-mschips-tag-x"
                aria-label={`Remove ${labelFor(v)}`}
                onClick={() => remove(v)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="admin-mschips-add">
        {available.length > 0 ? (
          <select
            className="admin-mschips-select"
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
              className="admin-mschips-input"
              list={listId}
              value={custom}
              placeholder={noun ? `New ${noun}…` : 'New…'}
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
