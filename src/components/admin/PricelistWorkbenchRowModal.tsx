import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  importSectionOptionsFromRows,
  rowSections,
  rowItemKinds,
  rowPartTypes,
  rowCategoryIds,
  setRowSectionsPatch,
  setRowItemKindsPatch,
  setRowPartTypesPatch,
  setRowCategoriesPatch,
  type PricelistWorkbenchRow,
} from '@/lib/pricelistWorkbench'
import type { WorkbenchItemKind } from '@/lib/tealburyCatalogueBuild'
import MultiSelectChips from '@/components/admin/MultiSelectChips'
import { catalogueSourceLabel } from '@/lib/catalogueSourceLabel'
import { getFinishPriceMap } from '@/lib/finishPricing'
import type { HingeBrand } from '@/lib/tealburyOrderSetup'
import { computeDraftBom, getWorkbenchBom, workbenchBomPatch } from '@/lib/workbenchBom'
import WorkbenchBomBreakdown, { HingeBrandPreviewSelect } from '@/components/admin/WorkbenchBomBreakdown'
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
  allRows: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  onPatchRow: (id: string, patch: Partial<PricelistWorkbenchRow>) => void
  onDeleteRow: (id: string) => void
  onClose: () => void
}

export default function PricelistWorkbenchRowModal({
  row,
  allRows,
  categories,
  partTypes,
  onPatchRow,
  onDeleteRow,
  onClose,
}: Props) {
  const [hingePreview, setHingePreview] = useState<HingeBrand | null>('titus')
  const [bomError, setBomError] = useState<string | null>(null)
  const finishMap = useMemo(() => getFinishPriceMap({ options: row.options }), [row.options])
  const finishEntries = useMemo(
    () => (finishMap ? Object.entries(finishMap).sort((a, b) => a[0].localeCompare(b[0])) : []),
    [finishMap],
  )
  const showBomSection = row.source === 'tealbury' && row.item_kind === 'complete'

  function computeBomForRow() {
    setBomError(null)
    const { bom, error } = computeDraftBom(row, { allRows, hingeBrand: 'titus' })
    if (!bom) {
      setBomError(error ?? 'Could not compute BOM')
      return
    }
    onPatchRow(row.id, workbenchBomPatch(bom))
  }
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

  const sectionOptions = useMemo(
    () => importSectionOptionsFromRows(allRows, categories),
    [allRows, categories],
  )
  const partTypeOptions = useMemo(
    () => partTypes.map((t) => ({ value: t.code, label: t.label })),
    [partTypes],
  )
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.parent_id ? `— ${c.name}` : c.name })),
    [categories],
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

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Sold as</span>
            <MultiSelectChips
              ariaLabel="Sold as"
              noun="kind"
              values={rowItemKinds(row)}
              options={itemKindOptions}
              onChange={(vals) => onPatchRow(row.id, setRowItemKindsPatch(vals as WorkbenchItemKind[]))}
            />
          </div>

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Component role</span>
            <MultiSelectChips
              ariaLabel="Component role"
              noun="part type"
              values={rowPartTypes(row)}
              options={partTypeOptions}
              onChange={(vals) => onPatchRow(row.id, setRowPartTypesPatch(vals))}
            />
          </div>

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Import section (legacy)</span>
            <MultiSelectChips
              ariaLabel="Import section"
              noun="section"
              values={rowSections(row)}
              options={sectionOptions}
              allowCustom
              onChange={(vals) => onPatchRow(row.id, setRowSectionsPatch(vals))}
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

          <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide">
            <span>Categories</span>
            <MultiSelectChips
              ariaLabel="Categories"
              noun="category"
              values={rowCategoryIds(row)}
              options={categoryOptions}
              onChange={(vals) => onPatchRow(row.id, setRowCategoriesPatch(vals, categories))}
            />
            <span className="admin-muted admin-pricelist-row-modal-hint">
              First category is the primary; add more to also sell this product in those categories.
            </span>
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

          {finishEntries.length > 0 ? (
            <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide admin-pricelist-finish-matrix">
              <span>Finish price matrix</span>
              <p className="admin-muted admin-pricelist-row-modal-hint">
                List £ at order time follows the customer&apos;s door finish. Base list price is the cheapest
                finish in this matrix.
              </p>
              <table className="admin-pricelist-finish-matrix-table">
                <thead>
                  <tr>
                    <th>Finish</th>
                    <th>List £</th>
                  </tr>
                </thead>
                <tbody>
                  {finishEntries.map(([label, price]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>£{price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {showBomSection ? (
            <div className="admin-pricelist-row-modal-field admin-pricelist-row-modal-field--wide admin-pricelist-row-modal-bom">
              <span>Component breakdown (draft BOM)</span>
              <div className="admin-pricelist-row-modal-bom-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={computeBomForRow}>
                  {getWorkbenchBom(row) ? 'Recompute BOM' : 'Compute BOM in draft'}
                </button>
                <HingeBrandPreviewSelect value={hingePreview} onChange={setHingePreview} />
              </div>
              {bomError ? <p className="admin-error">{bomError}</p> : null}
              <WorkbenchBomBreakdown
                row={row}
                allRows={allRows}
                hingeBrandPreview={hingePreview}
              />
            </div>
          ) : null}
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
