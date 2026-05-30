import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  rowSections,
  rowItemKinds,
  rowPartTypes,
  setRowSectionsPatch,
  setRowItemKindsPatch,
  setRowPartTypesPatch,
  type PricelistWorkbenchRow,
} from '@/lib/pricelistWorkbench'
import type { WorkbenchItemKind } from '@/lib/tealburyCatalogueBuild'
import MultiSelectChips from '@/components/admin/MultiSelectChips'
import { catalogueSourceLabel } from '@/lib/catalogueSourceLabel'
import type { AssemblyPartTypeRow, CategoryRow } from '@/types/database'

const ITEM_KIND_OPTIONS: { value: WorkbenchItemKind; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'component', label: 'Component' },
  { value: 'door', label: 'Door' },
  { value: 'drawer_front', label: 'Drawer front' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
]

interface Props {
  row: PricelistWorkbenchRow
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  onPatchRow: (id: string, patch: Partial<PricelistWorkbenchRow>) => void
  onDeleteRow: (id: string) => void
  onClose: () => void
}

export default function PricelistWorkbenchRowModal({
  row,
  categories,
  partTypes,
  onPatchRow,
  onDeleteRow,
  onClose,
}: Props) {
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

  const sellable = row.options.sellable_standalone === true
  const extraCategoryId =
    typeof row.options.extra_category_id === 'string' ? row.options.extra_category_id : ''

  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) map.set(c.name.toLowerCase(), c.name)
    for (const s of rowSections(row)) if (!map.has(s.toLowerCase())) map.set(s.toLowerCase(), s)
    return [...map.values()].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }))
  }, [categories, row])
  const partTypeOptions = useMemo(
    () => partTypes.map((t) => ({ value: t.code, label: t.label })),
    [partTypes],
  )
  const itemKindOptions = ITEM_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  const modalTree = (
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricelist-row-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="admin-modal card admin-modal--pricelist-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="pricelist-row-modal-title" className="admin-modal-title">
          Edit product
        </h2>
        <p className="admin-muted admin-pricelist-row-modal-sub">
          {catalogueSourceLabel(row.source)} · changes apply to the workbench draft (publish to save
          to the catalogue).
        </p>

        <div className="admin-modal-form admin-pricelist-row-modal-grid">
          <label className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Name</span>
            <input
              type="text"
              value={row.name}
              onChange={(e) => onPatchRow(row.id, { name: e.target.value })}
              autoFocus
            />
          </label>

          <label className="admin-pricelist-row-modal-field">
            <span>SKU</span>
            <input
              type="text"
              value={row.sku}
              onChange={(e) => onPatchRow(row.id, { sku: e.target.value })}
            />
          </label>

          <label className="admin-pricelist-row-modal-field">
            <span>Trade code</span>
            <input
              type="text"
              value={row.trade_code}
              onChange={(e) => onPatchRow(row.id, { trade_code: e.target.value })}
            />
          </label>

          <label className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Description</span>
            <textarea
              rows={4}
              value={row.description}
              onChange={(e) => onPatchRow(row.id, { description: e.target.value })}
            />
          </label>

          <label className="admin-pricelist-row-modal-field">
            <span>Door / range</span>
            <input
              type="text"
              value={row.door_range}
              onChange={(e) => onPatchRow(row.id, { door_range: e.target.value })}
            />
          </label>

          <div className="admin-pricelist-row-modal-field">
            <span>Sections</span>
            <MultiSelectChips
              ariaLabel="Sections"
              values={rowSections(row)}
              options={sectionOptions}
              allowCustom
              onChange={(vals) => onPatchRow(row.id, setRowSectionsPatch(vals))}
            />
          </div>

          <div className="admin-pricelist-row-modal-field">
            <span>Kinds</span>
            <MultiSelectChips
              ariaLabel="Item kinds"
              values={rowItemKinds(row)}
              options={itemKindOptions}
              onChange={(vals) => onPatchRow(row.id, setRowItemKindsPatch(vals as WorkbenchItemKind[]))}
            />
          </div>

          <div className="admin-pricelist-row-modal-field">
            <span>Part types</span>
            <MultiSelectChips
              ariaLabel="Part types"
              values={rowPartTypes(row)}
              options={partTypeOptions}
              onChange={(vals) => onPatchRow(row.id, setRowPartTypesPatch(vals))}
            />
          </div>

          <label className="admin-pricelist-row-modal-field">
            <span>Cost £ (ex VAT)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              defaultValue={row.cost_price ?? 0}
              onChange={(e) =>
                onPatchRow(row.id, { cost_price: Math.max(0, parseFloat(e.target.value) || 0) })
              }
            />
          </label>

          <label className="admin-pricelist-row-modal-field">
            <span>List / sell £ (ex VAT)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              defaultValue={row.unit_price}
              onChange={(e) =>
                onPatchRow(row.id, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })
              }
            />
          </label>

          <label className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Category</span>
            <select
              value={row.category_id ?? ''}
              onChange={(e) => {
                const cat = categories.find((c) => c.id === e.target.value)
                if (cat) {
                  onPatchRow(row.id, {
                    category_id: cat.id,
                    category_slug: cat.slug,
                    category_name: cat.name,
                  })
                } else {
                  onPatchRow(row.id, { category_id: null, category_slug: '', category_name: '' })
                }
              }}
            >
              <option value="">— Assign —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? `— ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <label className="admin-pricelist-row-modal-check">
              <input
                type="checkbox"
                checked={sellable}
                onChange={(e) => {
                  const on = e.target.checked
                  onPatchRow(row.id, {
                    options: {
                      ...row.options,
                      sellable_standalone: on,
                      ...(on ? {} : { extra_category_id: null, extra_category_name: '' }),
                    },
                  })
                }}
              />
              <span>Also sellable standalone</span>
            </label>
            {sellable && (
              <select
                value={extraCategoryId}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value)
                  onPatchRow(row.id, {
                    options: {
                      ...row.options,
                      sellable_standalone: true,
                      extra_category_id: cat?.id ?? null,
                      extra_category_name: cat?.name ?? '',
                    },
                  })
                }}
              >
                <option value="">— Browse category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-toggles">
            <label className="admin-pricelist-row-modal-check">
              <input
                type="checkbox"
                checked={row.active}
                onChange={(e) => onPatchRow(row.id, { active: e.target.checked })}
              />
              <span>Active</span>
            </label>
            <label className="admin-pricelist-row-modal-check">
              <input
                type="checkbox"
                checked={row.is_stock}
                onChange={(e) => onPatchRow(row.id, { is_stock: e.target.checked })}
              />
              <span>Stock item</span>
            </label>
          </div>
        </div>

        <div className="admin-modal-actions admin-pricelist-row-modal-actions">
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={() => {
              onDeleteRow(row.id)
              onClose()
            }}
          >
            Delete row
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalTree, document.body)
}
