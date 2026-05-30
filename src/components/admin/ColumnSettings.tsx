import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDef } from '@/hooks/useColumnVisibility'

interface ColumnSettingsProps {
  columnDefs: ColumnDef[]
  visibleIds: string[]
  setColumnVisible: (id: string, visible: boolean) => void
  tooltip?: string
  /** Ordered column ids for drag-and-drop reorder. If provided with setColumnOrder, reorder is enabled. */
  order?: string[]
  setColumnOrder?: (orderedIds: string[]) => void
  resetToDefault?: () => void
  /** Resets persisted column widths back to their defaults. */
  resetWidths?: () => void
  /** How each column's visibility is toggled. */
  visibilityControl?: 'checkbox' | 'radio'
  /** Optional note below locked columns (e.g. qty/action always shown). */
  lockedColumnsHint?: string
}

export function ColumnSettings({
  columnDefs,
  visibleIds,
  setColumnVisible,
  tooltip = 'Column settings – click here to edit columns',
  order,
  setColumnOrder,
  resetToDefault,
  resetWidths,
  visibilityControl = 'checkbox',
  lockedColumnsHint,
}: ColumnSettingsProps) {
  const [open, setOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: 'above' | 'below' } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cogRef = useRef<HTMLButtonElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)

  const orderedDefs = order
    ? order
        .map((id) => columnDefs.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c)
    : columnDefs
  const canReorder = Boolean(setColumnOrder && order && order.length > 0)

  useLayoutEffect(() => {
    if (!open || !cogRef.current) {
      setPanelPos(null)
      return
    }
    const rect = cogRef.current.getBoundingClientRect()
    const panelWidth = visibilityControl === 'radio' ? 300 : 260
    let left = rect.right - panelWidth
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
    setPanelPos({ top: rect.bottom + 6, left })
  }, [open, visibilityControl])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || cogRef.current?.contains(target)) return
      setOpen(false)
    }
    function onReposition() {
      if (!cogRef.current) return
      const rect = cogRef.current.getBoundingClientRect()
      const panelWidth = visibilityControl === 'radio' ? 300 : 260
      let left = rect.right - panelWidth
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
      setPanelPos({ top: rect.bottom + 6, left })
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open, visibilityControl])

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.setData('application/json', JSON.stringify({ columnId: id }))
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!draggedId || draggedId === id) {
      setDropIndicator(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const position = e.clientY < mid ? 'above' : 'below'
    setDropIndicator({ targetId: id, position })
  }

  function handleDragLeave() {
    setDropIndicator(null)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const position = dropIndicator?.targetId === targetId ? dropIndicator.position : 'below'
    setDropIndicator(null)
    setDraggedId(null)
    if (!order || !setColumnOrder || !draggedId || draggedId === targetId) return
    const fromIdx = order.indexOf(draggedId)
    let toIdx = order.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    if (position === 'below') toIdx += 1
    const next = [...order]
    next.splice(fromIdx, 1)
    const insertIdx = next.indexOf(targetId) + (position === 'below' ? 1 : 0)
    next.splice(insertIdx, 0, draggedId)
    setColumnOrder(next)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDropIndicator(null)
  }

  return (
    <div className="admin-column-settings" ref={panelRef}>
      <button
        ref={cogRef}
        type="button"
        className="admin-column-settings-cog"
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        aria-label={tooltip}
        aria-expanded={open}
      >
        <CogIcon />
      </button>
      {open && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-column-settings-panel card admin-column-settings-panel--portal"
              style={{ top: panelPos.top, left: panelPos.left }}
            >
              <h4 className="admin-column-settings-title">Columns</h4>
              <p className="admin-muted admin-column-settings-hint">
                {visibilityControl === 'radio'
                  ? 'Choose Show or Hide for each column.'
                  : 'Show or hide columns.'}{' '}
                {canReorder ? 'Drag to reorder.' : ''}
              </p>
              <ul
                className={`admin-column-settings-list admin-column-settings-list--draggable${visibilityControl === 'radio' ? ' admin-column-settings-list--radio' : ''}`}
              >
                {orderedDefs.map((col) => {
                  const isVisible = visibleIds.includes(col.id)
                  return (
                  <li key={col.id} className="admin-column-settings-li">
                    {dropIndicator?.targetId === col.id && dropIndicator?.position === 'above' && (
                      <div className="admin-column-settings-drop-line" aria-hidden title="Drop above" />
                    )}
                    <div
                      role="listitem"
                      className={`admin-column-settings-item ${draggedId === col.id ? 'admin-column-settings-item--dragging' : ''} ${dropIndicator?.targetId === col.id ? 'admin-column-settings-item--drop-target' : ''}`}
                      draggable={canReorder}
                      onDragStart={(e) => canReorder && handleDragStart(e, col.id)}
                      onDragOver={(e) => canReorder && handleDragOver(e, col.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => canReorder && handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {canReorder && (
                        <span
                          className="admin-column-settings-drag-handle"
                          aria-label="Drag to reorder"
                          title="Drag to reorder"
                        >
                          <DragHandleIcon />
                        </span>
                      )}
                      {visibilityControl === 'radio' ? (
                        <div className="admin-column-settings-row">
                          <span className="admin-column-settings-col-name">{col.label}</span>
                          <div
                            className="admin-column-settings-visibility"
                            role="radiogroup"
                            aria-label={`${col.label} visibility`}
                          >
                            <label className="admin-column-settings-radio">
                              <input
                                type="radio"
                                name={`column-vis-${col.id}`}
                                checked={isVisible}
                                onChange={() => setColumnVisible(col.id, true)}
                              />
                              <span>Show</span>
                            </label>
                            <label className="admin-column-settings-radio">
                              <input
                                type="radio"
                                name={`column-vis-${col.id}`}
                                checked={!isVisible}
                                onChange={() => setColumnVisible(col.id, false)}
                              />
                              <span>Hide</span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label className="admin-column-settings-label">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => setColumnVisible(col.id, e.target.checked)}
                          />
                          <span>{col.label}</span>
                        </label>
                      )}
                    </div>
                    {dropIndicator?.targetId === col.id && dropIndicator?.position === 'below' && (
                      <div className="admin-column-settings-drop-line" aria-hidden title="Drop below" />
                    )}
                  </li>
                  )
                })}
              </ul>
              {lockedColumnsHint && (
                <p className="admin-muted admin-column-settings-hint admin-column-settings-locked-hint">
                  {lockedColumnsHint}
                </p>
              )}
              {(resetToDefault || resetWidths) && (
                <div className="admin-column-settings-actions">
                  {resetToDefault && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => {
                        resetToDefault()
                      }}
                    >
                      Reset to default
                    </button>
                  )}
                  {resetWidths && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => {
                        resetWidths()
                      }}
                      title="Reset column widths back to the default sizes"
                    >
                      Reset column widths
                    </button>
                  )}
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function CogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}
