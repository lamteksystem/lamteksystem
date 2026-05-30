import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ColumnSettings } from '@/components/admin/ColumnSettings'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'
import {
  HorizontalScrollWithArrows,
  type HorizontalScrollHandle,
  type HorizontalScrollState,
} from '@/components/admin/HorizontalScrollWithArrows'
import {
  PRICELIST_WORKBENCH_COLUMNS,
  PRICELIST_WORKBENCH_DEFAULT_VISIBLE_IDS,
  workbenchColumnWidth,
  type WorkbenchColumnId,
} from '@/lib/pricelistWorkbenchColumns'
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
import { useColumnVisibility } from '@/hooks/useColumnVisibility'
import { useColumnWidths } from '@/hooks/useColumnWidths'
import PricelistWorkbenchRowModal from '@/components/admin/PricelistWorkbenchRowModal'
import type { AssemblyPartTypeRow, CategoryRow } from '@/types/database'

type EditableField =
  | 'door_range'
  | 'section'
  | 'trade_code'
  | 'sku'
  | 'name'
  | 'description'
  | 'cost_price'
  | 'unit_price'

type Props = {
  pageItems: PricelistWorkbenchRow[]
  categories: CategoryRow[]
  partTypes: AssemblyPartTypeRow[]
  allSelectedOnPage: boolean
  onToggleSelectAllOnPage: (checked: boolean) => void
  onPatchRow: (id: string, patch: Partial<PricelistWorkbenchRow>) => void
  onDeleteRow: (id: string) => void
  scrollRef?: RefObject<HorizontalScrollHandle>
  onScrollStateChange?: (state: HorizontalScrollState) => void
}

const COLUMN_DEFS = PRICELIST_WORKBENCH_COLUMNS.map(({ id, label }) => ({ id, label }))
// Columns whose own controls handle the click — single-click here must NOT open the row modal.
const INTERACTIVE_COLS = new Set<string>([
  'item_kind',
  'part_type',
  'section',
  'category',
  'standalone',
  'active',
  'is_stock',
  'actions',
])
const DBL_CLICK_FIELDS = new Set<EditableField>([
  'door_range',
  'trade_code',
  'sku',
  'name',
  'description',
  'cost_price',
  'unit_price',
])

const ITEM_KIND_OPTIONS: { value: WorkbenchItemKind; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'component', label: 'Component' },
  { value: 'door', label: 'Door' },
  { value: 'drawer_front', label: 'Drawer front' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other' },
]

const BASELINE_WIDTHS: Record<string, number> = {
  catalog_source: 96,
  item_kind: 177,
  part_type: 158,
  door_range: 168,
  section: 128,
  trade_code: 152,
  sku: 200,
  name: 240,
  description: 242,
  category: 180,
  standalone: 150,
  cost_price: 88,
  unit_price: 92,
  active: 56,
  is_stock: 56,
  actions: 92,
}

export default function PricelistWorkbenchTable({
  pageItems,
  categories,
  partTypes,
  allSelectedOnPage,
  onToggleSelectAllOnPage,
  onPatchRow,
  onDeleteRow,
  scrollRef: scrollRefProp,
  onScrollStateChange: onScrollStateChangeProp,
}: Props) {
  const { columnDefs, visibleIds, setColumnVisible, setColumnOrder, resetToDefault, isVisible, order } =
    useColumnVisibility('pricelist-workbench', COLUMN_DEFS, PRICELIST_WORKBENCH_DEFAULT_VISIBLE_IDS)
  const { widths: columnWidths, setWidth, persistWidths, resetWidths, initialised: widthsInit } = useColumnWidths('pricelist-workbench-v4')
  const userResizedRef = useRef(false)
  const [resizingColId, setResizingColId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null)
  const [modalRowId, setModalRowId] = useState<string | null>(null)
  // Delay opening the row modal so a double-click (inline edit) on the same row can cancel it.
  const openModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeStartRef = useRef({ x: 0, width: 0 })
  const columnWidthsRef = useRef(columnWidths)
  columnWidthsRef.current = columnWidths
  const internalScrollRef = useRef<HorizontalScrollHandle>(null)
  const scrollRef = scrollRefProp ?? internalScrollRef
  const handleScrollStateChange = useCallback(
    (state: HorizontalScrollState) => {
      onScrollStateChangeProp?.(state)
    },
    [onScrollStateChangeProp],
  )

  const visibleCols = useMemo(
    () =>
      order
        .map((id) => (id === 'source' ? 'catalog_source' : id))
        .map((id) => PRICELIST_WORKBENCH_COLUMNS.find((c) => c.id === id))
        .filter((c): c is (typeof PRICELIST_WORKBENCH_COLUMNS)[number] => !!c && isVisible(c.id)),
    [order, isVisible]
  )

  const partTypeOptions = useMemo(
    () => partTypes.map((t) => ({ value: t.code, label: t.label })),
    [partTypes],
  )
  const itemKindOptions = useMemo(
    () => ITEM_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )
  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) map.set(c.name.toLowerCase(), c.name)
    for (const r of pageItems) {
      for (const s of rowSections(r)) if (!map.has(s.toLowerCase())) map.set(s.toLowerCase(), s)
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }))
  }, [categories, pageItems])

  useEffect(() => {
    if (!widthsInit) return
    const hasAny = Object.keys(columnWidths).length > 0
    if (hasAny) return
    Object.entries(BASELINE_WIDTHS).forEach(([id, w]) => setWidth(id, w))
    void persistWidths(BASELINE_WIDTHS)
  }, [widthsInit, columnWidths, setWidth, persistWidths])

  const tableWidthPx = useMemo(
    () => 40 + visibleCols.reduce((sum, c) => sum + workbenchColumnWidth(c.id, columnWidths), 0),
    [visibleCols, columnWidths]
  )

  useEffect(() => {
    if (!resizingColId) return
    const def = PRICELIST_WORKBENCH_COLUMNS.find((c) => c.id === resizingColId)
    const minW = def?.minWidth ?? 60
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current.x
      const newW = Math.max(minW, resizeStartRef.current.width + delta)
      setWidth(resizingColId, newW)
    }
    const onUp = () => {
      userResizedRef.current = true
      persistWidths(columnWidthsRef.current)
      setResizingColId(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColId, setWidth, persistWidths])

  const cancelPendingModal = useCallback(() => {
    if (openModalTimerRef.current) {
      clearTimeout(openModalTimerRef.current)
      openModalTimerRef.current = null
    }
  }, [])

  const scheduleOpenModal = useCallback(
    (rowId: string) => {
      if (editing || resizingColId) return
      cancelPendingModal()
      openModalTimerRef.current = setTimeout(() => {
        openModalTimerRef.current = null
        setModalRowId(rowId)
      }, 420)
    },
    [editing, resizingColId, cancelPendingModal],
  )

  useEffect(() => () => cancelPendingModal(), [cancelPendingModal])

  const startEdit = useCallback(
    (id: string, field: EditableField) => {
      cancelPendingModal()
      setEditing({ id, field })
    },
    [cancelPendingModal],
  )

  const modalRow = useMemo(
    () => (modalRowId ? pageItems.find((r) => r.id === modalRowId) ?? null : null),
    [modalRowId, pageItems],
  )

  const commitEdit = useCallback(
    (row: PricelistWorkbenchRow, field: EditableField, value: string) => {
      setEditing(null)
      if (field === 'cost_price' || field === 'unit_price') {
        const n = Math.max(0, parseFloat(value) || 0)
        if (n === row[field]) return
        onPatchRow(row.id, { [field]: n })
        return
      }
      const trimmed = value.trim()
      if (trimmed === (row[field] as string)) return
      onPatchRow(row.id, { [field]: trimmed })
    },
    [onPatchRow]
  )

  function renderHeader(col: (typeof PRICELIST_WORKBENCH_COLUMNS)[number]) {
    const w = workbenchColumnWidth(col.id, columnWidths)
    const isActions = col.id === 'actions'
    return (
      <th
        key={col.id}
        style={{ width: w, minWidth: w }}
        className={isActions ? 'admin-pricelist-th-actions' : undefined}
      >
        <span className="admin-th-label">
          {col.label}
          <AdminHelpTip text={col.tip} className="admin-th-help" />
        </span>
        {!isActions ? (
          <span
            className="admin-th-resizer"
            role="separator"
            aria-label={`Resize ${col.label} column`}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              resizeStartRef.current = { x: e.clientX, width: w }
              setResizingColId(col.id)
            }}
          />
        ) : null}
      </th>
    )
  }

  function renderEditableText(
    row: PricelistWorkbenchRow,
    field: EditableField,
    className?: string
  ) {
    const isEditing = editing?.id === row.id && editing.field === field
    const display = String(row[field] ?? '')
    if (isEditing) {
      return (
        <input
          className={`admin-pricelist-inline-input ${className ?? ''}`.trim()}
          autoFocus
          defaultValue={display}
          onBlur={(e) => commitEdit(row, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setEditing(null)
            }
          }}
        />
      )
    }
    return (
      <button
        type="button"
        className={`admin-pricelist-cell-edit ${className ?? ''}`.trim()}
        title="Double-click to edit"
        onDoubleClick={() => startEdit(row.id, field)}
      >
        {display || '—'}
      </button>
    )
  }

  function renderCell(row: PricelistWorkbenchRow, colId: WorkbenchColumnId) {
    switch (colId) {
      case 'catalog_source':
        return (
          <span
            className={`admin-pricelist-source admin-pricelist-source--${row.source}`}
            title={`Program: ${row.catalog_program}`}
          >
            {catalogueSourceLabel(row.source)}
          </span>
        )
      case 'item_kind':
        return (
          <MultiSelectChips
            ariaLabel="Item kinds"
            values={rowItemKinds(row)}
            options={itemKindOptions}
            onChange={(vals) =>
              onPatchRow(row.id, setRowItemKindsPatch(vals as WorkbenchItemKind[]))
            }
          />
        )
      case 'part_type':
        return (
          <MultiSelectChips
            ariaLabel="Part types"
            values={rowPartTypes(row)}
            options={partTypeOptions}
            onChange={(vals) => onPatchRow(row.id, setRowPartTypesPatch(vals))}
          />
        )
      case 'door_range':
        return renderEditableText(row, 'door_range', 'admin-pricelist-cell--range')
      case 'section':
        return (
          <MultiSelectChips
            ariaLabel="Sections"
            values={rowSections(row)}
            options={sectionOptions}
            allowCustom
            onChange={(vals) => onPatchRow(row.id, setRowSectionsPatch(vals))}
          />
        )
      case 'trade_code':
        return renderEditableText(row, 'trade_code', 'admin-pricelist-trade-code')
      case 'sku':
        return renderEditableText(row, 'sku')
      case 'name':
        return renderEditableText(row, 'name', 'admin-pricelist-inline-input--wide')
      case 'description':
        return renderEditableText(row, 'description', 'admin-pricelist-cell--desc')
      case 'category':
        return (
          <select
            className="admin-pricelist-category-select"
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
        )
      case 'standalone': {
        const sellable = row.options.sellable_standalone === true
        const extraId =
          typeof row.options.extra_category_id === 'string' ? row.options.extra_category_id : ''
        return (
          <div className="admin-pricelist-standalone-cell">
            <label className="admin-pricelist-standalone-check">
              <input
                type="checkbox"
                checked={sellable}
                onChange={(e) => {
                  const on = e.target.checked
                  onPatchRow(row.id, {
                    options: {
                      ...row.options,
                      sellable_standalone: on,
                      ...(on
                        ? {}
                        : { extra_category_id: null, extra_category_name: '' }),
                    },
                  })
                }}
                aria-label="Also sellable standalone"
              />
              <span className="admin-muted">Standalone</span>
            </label>
            {sellable ? (
              <select
                className="admin-pricelist-category-select"
                value={extraId}
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
                title="Browse category when sold on its own (e.g. Carcasses)"
              >
                <option value="">— Browse category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        )
      }
      case 'cost_price': {
        const isEditing = editing?.id === row.id && editing.field === 'cost_price'
        if (isEditing) {
          return (
            <input
              type="number"
              min={0}
              step={0.01}
              className="admin-pricelist-inline-input admin-pricelist-inline-input--price"
              autoFocus
              defaultValue={row.cost_price ?? 0}
              onBlur={(e) => commitEdit(row, 'cost_price', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(null)
              }}
            />
          )
        }
        return (
          <button
            type="button"
            className="admin-pricelist-cell-edit admin-pricelist-cell-edit--price"
            title="Lamtek cost price (ex VAT). Double-click to edit."
            onDoubleClick={() => startEdit(row.id, 'cost_price')}
          >
            {(row.cost_price ?? 0).toFixed(2)}
          </button>
        )
      }
      case 'unit_price': {
        const isEditing = editing?.id === row.id && editing.field === 'unit_price'
        if (isEditing) {
          return (
            <input
              type="number"
              min={0}
              step={0.01}
              className="admin-pricelist-inline-input admin-pricelist-inline-input--price"
              autoFocus
              defaultValue={row.unit_price}
              onBlur={(e) => commitEdit(row, 'unit_price', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(null)
              }}
            />
          )
        }
        return (
          <button
            type="button"
            className="admin-pricelist-cell-edit admin-pricelist-cell-edit--price"
            title="List / sell price (ex VAT). Double-click to edit."
            onDoubleClick={() => startEdit(row.id, 'unit_price')}
          >
            {row.unit_price.toFixed(2)}
          </button>
        )
      }
      case 'active':
        return (
          <input
            type="checkbox"
            checked={row.active}
            onChange={(e) => onPatchRow(row.id, { active: e.target.checked })}
            aria-label="Active"
          />
        )
      case 'is_stock':
        return (
          <input
            type="checkbox"
            checked={row.is_stock}
            onChange={(e) => onPatchRow(row.id, { is_stock: e.target.checked })}
            aria-label="Stock item"
          />
        )
      case 'actions':
        return (
          <button
            type="button"
            className="btn btn-small btn-danger-outline"
            onClick={() => onDeleteRow(row.id)}
          >
            Delete
          </button>
        )
      default:
        return null
    }
  }

  return (
    <>
    <div className="admin-pricelist-table-toolbar">
      <div className="admin-pricelist-table-toolbar-start">
        <ColumnSettings
          columnDefs={columnDefs}
          visibleIds={visibleIds}
          setColumnVisible={setColumnVisible}
          order={order}
          setColumnOrder={setColumnOrder}
          resetToDefault={resetToDefault}
          resetWidths={() => resetWidths(BASELINE_WIDTHS)}
          tooltip="Show, hide, and reorder workbench columns. Drag column edges in the header to resize."
        />
        <span className="admin-muted admin-pricelist-table-hint">
          Double-click cells to edit. Scroll horizontally with the bar below or the arrow buttons.
        </span>
      </div>
    </div>
    <HorizontalScrollWithArrows
      ref={scrollRef}
      overlayArrows
      className="admin-horizontal-scroll-wrap--pricelist-table"
      innerClassName="admin-pricelist-table-scroll"
      contentStyle={{ minWidth: tableWidthPx }}
      onScrollStateChange={handleScrollStateChange}
    >
      <div
        className="admin-table-wrap admin-pricelist-table-wrap"
        style={{ width: tableWidthPx, minWidth: tableWidthPx }}
      >
        <table
          className="admin-table admin-pricelist-table admin-table--resizable admin-table--sticky-header"
          style={{ width: tableWidthPx, minWidth: tableWidthPx }}
        >
        <colgroup>
          <col style={{ width: 40, minWidth: 40 }} />
          {visibleCols.map((col) => {
            const w = workbenchColumnWidth(col.id, columnWidths)
            return <col key={col.id} style={{ width: w, minWidth: w }} />
          })}
        </colgroup>
        <thead>
          <tr>
            <th className="admin-pricelist-th-check">
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={pageItems.length > 0 && allSelectedOnPage}
                onChange={(e) => onToggleSelectAllOnPage(e.target.checked)}
              />
            </th>
            {visibleCols.map(renderHeader)}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 ? (
            <tr>
              <td colSpan={visibleCols.length + 1} className="admin-table-empty">
                No rows on this page.
              </td>
            </tr>
          ) : (
            pageItems.map((r) => (
              <tr
                key={r.id}
                className={`admin-pricelist-row--clickable${!r.category_id ? ' admin-pricelist-row--unassigned' : ''}`}
                onClick={() => scheduleOpenModal(r.id)}
                title="Click to open product · double-click a cell to edit inline"
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => onPatchRow(r.id, { selected: e.target.checked })}
                  />
                </td>
                {visibleCols.map((col) => (
                  <td
                    key={col.id}
                    onClick={
                      INTERACTIVE_COLS.has(col.id) ? (e) => e.stopPropagation() : undefined
                    }
                    className={
                      col.id === 'actions'
                        ? 'admin-pricelist-td-actions'
                        : DBL_CLICK_FIELDS.has(col.id as EditableField)
                          ? 'admin-pricelist-td-editable'
                          : undefined
                    }
                  >
                    {renderCell(r, col.id as WorkbenchColumnId)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        </table>
      </div>
    </HorizontalScrollWithArrows>
    {modalRow ? (
      <PricelistWorkbenchRowModal
        row={modalRow}
        categories={categories}
        partTypes={partTypes}
        onPatchRow={onPatchRow}
        onDeleteRow={onDeleteRow}
        onClose={() => setModalRowId(null)}
      />
    ) : null}
    </>
  )
}
