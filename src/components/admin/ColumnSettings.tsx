import { useState, useRef, useEffect } from 'react'
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
}

export function ColumnSettings({
  columnDefs,
  visibleIds,
  setColumnVisible,
  tooltip = 'Column settings – click here to edit columns',
  order,
  setColumnOrder,
  resetToDefault,
}: ColumnSettingsProps) {
  const [open, setOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: 'above' | 'below' } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const orderedDefs = order
    ? order
        .map((id) => columnDefs.find((c) => c.id === id))
        .filter((c): c is ColumnDef => !!c)
    : columnDefs
  const canReorder = Boolean(setColumnOrder && order && order.length > 0)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

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
        type="button"
        className="admin-column-settings-cog"
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        aria-label={tooltip}
        aria-expanded={open}
      >
        <CogIcon />
      </button>
      {open && (
        <div className="admin-column-settings-panel card">
          <h4 className="admin-column-settings-title">Columns</h4>
          <p className="admin-muted admin-column-settings-hint">
            Show or hide columns. {canReorder ? 'Drag to reorder.' : ''}
          </p>
          <ul className="admin-column-settings-list admin-column-settings-list--draggable">
            {orderedDefs.map((col) => (
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
                    <span className="admin-column-settings-drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
                      <DragHandleIcon />
                    </span>
                  )}
                  <label className="admin-column-settings-label">
                    <input
                      type="checkbox"
                      checked={visibleIds.includes(col.id)}
                      onChange={(e) => setColumnVisible(col.id, e.target.checked)}
                    />
                    <span>{col.label}</span>
                  </label>
                </div>
                {dropIndicator?.targetId === col.id && dropIndicator?.position === 'below' && (
                  <div className="admin-column-settings-drop-line" aria-hidden title="Drop below" />
                )}
              </li>
            ))}
          </ul>
          {resetToDefault && (
            <div className="admin-column-settings-actions">
              <button
                type="button"
                className="btn btn-outline btn-small"
                onClick={() => {
                  resetToDefault()
                }}
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
      )}
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
