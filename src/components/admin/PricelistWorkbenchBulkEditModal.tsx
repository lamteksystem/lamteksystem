import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import MultiSelectChips from '@/components/admin/MultiSelectChips'
import { catalogueSourceLabel } from '@/lib/catalogueSourceLabel'
import {
  rowSections,
  rowItemKinds,
  rowPartTypes,
  rowCategoryIds,
  type PricelistWorkbenchRow,
  type WorkbenchItemKindValue,
} from '@/lib/pricelistWorkbench'
import {
  bulkSpecHasChanges,
  emptyBulkEditSpec,
  type BulkEditSpec,
  type BulkTextField,
  type MultiMode,
  type PriceMode,
  type TriState,
} from '@/lib/pricelistWorkbenchBulkEdit'
import {
  TEXT_CASE_FIELDS,
  TEXT_CASE_MODES,
  textCaseFieldLabel,
  textCaseModeLabel,
  type TextCaseField,
  type TextCaseMode,
} from '@/lib/pricelistWorkbenchRules'
import type { AssemblyPartTypeRow, CategoryRow } from '@/types/database'

const ITEM_KIND_OPTIONS: { value: WorkbenchItemKindValue; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'component', label: 'Component' },
  { value: 'door', label: 'Door' },
  { value: 'drawer_front', label: 'Drawer front' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
]

const TEXT_FIELDS: { value: BulkTextField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'description', label: 'Description' },
  { value: 'sku', label: 'SKU' },
  { value: 'section', label: 'Section' },
  { value: 'door_range', label: 'Door / range' },
  { value: 'trade_code', label: 'Trade code' },
]

const MULTI_MODES: { value: MultiMode; label: string }[] = [
  { value: 'none', label: 'No change' },
  { value: 'replace', label: 'Replace with' },
  { value: 'add', label: 'Add' },
  { value: 'clear', label: 'Clear all' },
]

const PRICE_MODES: { value: PriceMode; label: string }[] = [
  { value: 'none', label: 'No change' },
  { value: 'set', label: 'Set to' },
  { value: 'increase_pct', label: 'Increase %' },
  { value: 'decrease_pct', label: 'Decrease %' },
  { value: 'round2', label: 'Round to 2dp' },
]

interface Props {
  rows: PricelistWorkbenchRow[]
  criteriaLabel?: string
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  onApply: (spec: BulkEditSpec, ids: string[]) => void
  onDelete: (ids: string[]) => void
  onClose: () => void
}

export default function PricelistWorkbenchBulkEditModal({
  rows,
  criteriaLabel,
  categories,
  partTypes,
  onApply,
  onDelete,
  onClose,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)))
  const [spec, setSpec] = useState<BulkEditSpec>(() => emptyBulkEditSpec())

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.parent_id ? `— ${c.name}` : c.name })),
    [categories],
  )
  const partTypeOptions = useMemo(
    () => partTypes.map((t) => ({ value: t.code, label: t.label })),
    [partTypes],
  )
  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) map.set(c.name.toLowerCase(), c.name)
    for (const r of rows) for (const s of rowSections(r)) if (!map.has(s.toLowerCase())) map.set(s.toLowerCase(), s)
    return [...map.values()].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }))
  }, [categories, rows])
  const itemKindOptions = ITEM_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])
  const partTypeLabelByCode = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of partTypes) m.set(t.code, t.label)
    return m
  }, [partTypes])
  const itemKindLabel = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of ITEM_KIND_OPTIONS) m.set(o.value, o.label)
    return m
  }, [])

  const gbp = useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    [],
  )

  const rowMeta = (r: PricelistWorkbenchRow) => {
    const cats = rowCategoryIds(r).map((id) => categoryNameById.get(id) || id)
    const secs = rowSections(r)
    const kinds = rowItemKinds(r).map((k) => itemKindLabel.get(k) || k)
    const parts = rowPartTypes(r)
      .filter(Boolean)
      .map((p) => partTypeLabelByCode.get(p) || p)
    return { cats, secs, kinds, parts }
  }

  const allSelected = selectedIds.size === rows.length && rows.length > 0
  const hasChanges = bulkSpecHasChanges(spec)
  const canApply = hasChanges && selectedIds.size > 0

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const patchSpec = (p: Partial<BulkEditSpec>) => setSpec((prev) => ({ ...prev, ...p }))

  const renderMulti = (
    key: 'categories' | 'sections' | 'itemKinds' | 'partTypes',
    label: string,
    noun: string,
    options: { value: string; label: string }[],
    allowCustom = false,
  ) => {
    const field = spec[key]
    return (
      <div className="admin-bulk-field">
        <span className="admin-bulk-field-label">{label}</span>
        <div className="admin-bulk-field-control">
          <select
            className="admin-bulk-mode"
            value={field.mode}
            onChange={(e) => patchSpec({ [key]: { ...field, mode: e.target.value as MultiMode } } as Partial<BulkEditSpec>)}
          >
            {MULTI_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {(field.mode === 'replace' || field.mode === 'add') && (
            <MultiSelectChips
              ariaLabel={label}
              noun={noun}
              values={field.values as string[]}
              options={options}
              allowCustom={allowCustom}
              onChange={(vals) => patchSpec({ [key]: { ...field, values: vals } } as Partial<BulkEditSpec>)}
            />
          )}
        </div>
      </div>
    )
  }

  const renderTri = (key: 'active' | 'isStock', label: string) => (
    <div className="admin-bulk-field">
      <span className="admin-bulk-field-label">{label}</span>
      <select
        className="admin-bulk-mode"
        value={spec[key]}
        onChange={(e) => patchSpec({ [key]: e.target.value as TriState })}
      >
        <option value="none">No change</option>
        <option value="on">{key === 'active' ? 'Active' : 'Stock item'}</option>
        <option value="off">{key === 'active' ? 'Inactive' : 'Not stock'}</option>
      </select>
    </div>
  )

  const renderPrice = (key: 'cost' | 'price', label: string) => {
    const field = spec[key]
    return (
      <div className="admin-bulk-field">
        <span className="admin-bulk-field-label">{label}</span>
        <div className="admin-bulk-field-control admin-bulk-field-control--inline">
          <select
            className="admin-bulk-mode"
            value={field.mode}
            onChange={(e) => patchSpec({ [key]: { ...field, mode: e.target.value as PriceMode } })}
          >
            {PRICE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {(field.mode === 'set' || field.mode === 'increase_pct' || field.mode === 'decrease_pct') && (
            <input
              type="number"
              min={0}
              step={field.mode === 'set' ? 0.01 : 1}
              className="admin-bulk-num"
              value={field.value}
              onChange={(e) => patchSpec({ [key]: { ...field, value: parseFloat(e.target.value) || 0 } })}
            />
          )}
        </div>
      </div>
    )
  }

  const modalTree = (
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-edit-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="admin-modal card admin-modal--bulk-edit" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="bulk-edit-title" className="admin-modal-title">
          Bulk edit — {rows.length} product{rows.length === 1 ? '' : 's'}
        </h2>
        {criteriaLabel ? <p className="admin-muted admin-bulk-criteria">Matched: {criteriaLabel}</p> : null}

        <div className="admin-bulk-body">
          <div className="admin-bulk-list">
            <div className="admin-bulk-list-head">
              <label className="admin-bulk-list-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedIds.size > 0 && !allSelected
                  }}
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                  }
                />
                {selectedIds.size} of {rows.length} selected
              </label>
            </div>
            <ul className="admin-bulk-list-items">
              {rows.map((r) => {
                const meta = rowMeta(r)
                return (
                  <li key={r.id} className="admin-bulk-list-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                      />
                      <span className="admin-bulk-list-content">
                        <span className="admin-bulk-list-line1">
                          <span className="admin-bulk-list-sku">{r.sku || '(no SKU)'}</span>
                          <span className="admin-bulk-list-name">{r.name || '(no name)'}</span>
                          {!r.active && <span className="admin-bulk-list-flag admin-bulk-list-flag--off">Inactive</span>}
                          {r.is_stock && <span className="admin-bulk-list-flag">Stock</span>}
                        </span>
                        <span className="admin-bulk-list-meta">
                          <span className="admin-bulk-list-source">{catalogueSourceLabel(r.source)}</span>
                          <span className="admin-bulk-list-price">
                            {gbp.format(r.unit_price || 0)}
                            {typeof r.cost_price === 'number' && r.cost_price > 0
                              ? ` · cost ${gbp.format(r.cost_price)}`
                              : ''}
                          </span>
                          {meta.cats.map((c) => (
                            <span key={`c-${c}`} className="admin-bulk-list-tag admin-bulk-list-tag--cat">
                              {c}
                            </span>
                          ))}
                          {meta.secs.map((s) => (
                            <span key={`s-${s}`} className="admin-bulk-list-tag admin-bulk-list-tag--sec">
                              {s}
                            </span>
                          ))}
                          {meta.kinds.map((k) => (
                            <span key={`k-${k}`} className="admin-bulk-list-tag admin-bulk-list-tag--kind">
                              {k}
                            </span>
                          ))}
                          {meta.parts.map((p) => (
                            <span key={`p-${p}`} className="admin-bulk-list-tag admin-bulk-list-tag--part">
                              {p}
                            </span>
                          ))}
                          {r.door_range ? (
                            <span className="admin-bulk-list-tag admin-bulk-list-tag--range">{r.door_range}</span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="admin-bulk-form">
            <fieldset className="admin-bulk-group">
              <legend>Classification</legend>
              {renderMulti('categories', 'Categories', 'category', categoryOptions)}
              {renderMulti('sections', 'Sections', 'section', sectionOptions, true)}
              {renderMulti('itemKinds', 'Kinds', 'kind', itemKindOptions)}
              {renderMulti('partTypes', 'Part types', 'part type', partTypeOptions)}
            </fieldset>

            <fieldset className="admin-bulk-group">
              <legend>Status</legend>
              {renderTri('active', 'Active')}
              {renderTri('isStock', 'Stock')}
            </fieldset>

            <fieldset className="admin-bulk-group">
              <legend>Pricing</legend>
              {renderPrice('cost', 'Cost £')}
              {renderPrice('price', 'List / sell £')}
            </fieldset>

            <fieldset className="admin-bulk-group">
              <legend>Text tools</legend>
              <div className="admin-bulk-field">
                <span className="admin-bulk-field-label">Find &amp; replace</span>
                <div className="admin-bulk-field-control admin-bulk-field-control--inline">
                  <select
                    className="admin-bulk-mode"
                    value={spec.findReplace.field}
                    onChange={(e) =>
                      patchSpec({ findReplace: { ...spec.findReplace, field: e.target.value as BulkTextField | '' } })
                    }
                  >
                    <option value="">No change</option>
                    {TEXT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {spec.findReplace.field && (
                    <>
                      <input
                        className="admin-bulk-text"
                        placeholder="Find…"
                        value={spec.findReplace.find}
                        onChange={(e) => patchSpec({ findReplace: { ...spec.findReplace, find: e.target.value } })}
                      />
                      <input
                        className="admin-bulk-text"
                        placeholder="Replace with…"
                        value={spec.findReplace.replace}
                        onChange={(e) => patchSpec({ findReplace: { ...spec.findReplace, replace: e.target.value } })}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="admin-bulk-field">
                <span className="admin-bulk-field-label">Change case</span>
                <div className="admin-bulk-field-control admin-bulk-field-control--inline">
                  <select
                    className="admin-bulk-mode"
                    value={spec.textCase.field}
                    onChange={(e) =>
                      patchSpec({ textCase: { ...spec.textCase, field: e.target.value as TextCaseField | '' } })
                    }
                  >
                    <option value="">No change</option>
                    {TEXT_CASE_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {textCaseFieldLabel(f)}
                      </option>
                    ))}
                  </select>
                  {spec.textCase.field && (
                    <select
                      className="admin-bulk-mode"
                      value={spec.textCase.mode}
                      onChange={(e) => patchSpec({ textCase: { ...spec.textCase, mode: e.target.value as TextCaseMode } })}
                    >
                      {TEXT_CASE_MODES.map((m) => (
                        <option key={m} value={m}>
                          {textCaseModeLabel(m)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="admin-bulk-field">
                <span className="admin-bulk-field-label">Prefix / suffix</span>
                <div className="admin-bulk-field-control admin-bulk-field-control--inline">
                  <select
                    className="admin-bulk-mode"
                    value={spec.affix.field}
                    onChange={(e) => patchSpec({ affix: { ...spec.affix, field: e.target.value as BulkTextField } })}
                  >
                    {TEXT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="admin-bulk-text"
                    placeholder="Prefix"
                    value={spec.affix.prefix}
                    onChange={(e) => patchSpec({ affix: { ...spec.affix, prefix: e.target.value } })}
                  />
                  <input
                    className="admin-bulk-text"
                    placeholder="Suffix"
                    value={spec.affix.suffix}
                    onChange={(e) => patchSpec({ affix: { ...spec.affix, suffix: e.target.value } })}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="admin-modal-actions admin-bulk-actions">
          <button
            type="button"
            className="btn btn-danger-outline"
            disabled={selectedIds.size === 0}
            onClick={() => {
              if (
                window.confirm(`Delete ${selectedIds.size} row(s) from the workbench draft? (Live catalogue is untouched until publish.)`)
              ) {
                onDelete([...selectedIds])
                onClose()
              }
            }}
          >
            Delete {selectedIds.size} from draft
          </button>
          <div className="admin-bulk-actions-end">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canApply}
              onClick={() => {
                onApply(spec, [...selectedIds])
                onClose()
              }}
            >
              Apply to {selectedIds.size} product{selectedIds.size === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
