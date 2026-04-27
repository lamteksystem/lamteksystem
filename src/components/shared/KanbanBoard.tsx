import type { ReactNode } from 'react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'

export type KanbanColumn = {
  id: string
  label: string
  color?: string
}

export interface KanbanBoardProps<T> {
  columns: KanbanColumn[]
  items: T[]
  getItemId: (item: T) => string
  getColumnId: (item: T) => string
  onMove: (itemId: string, toColumnId: string) => void | Promise<void>
  renderCard: (item: T, options: { isDragging: boolean }) => ReactNode
  /** Optional accent colour per item (e.g. from status). Falls back to column colour. */
  getCardColor?: (item: T) => string | undefined
  emptyMessage?: string
  /** Optional class on the board container */
  className?: string
}

export function KanbanBoard<T>({
  columns,
  items,
  getItemId,
  getColumnId,
  onMove,
  renderCard,
  getCardColor,
  emptyMessage = 'No items',
  className = '',
}: KanbanBoardProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const toColumnId = String(over.id)
    const itemId = String(active.id)
    const item = items.find((i) => getItemId(i) === itemId)
    if (!item || getColumnId(item) === toColumnId) return
    onMove(itemId, toColumnId)
  }

  const itemsByColumn = new Map<string, T[]>()
  for (const col of columns) itemsByColumn.set(col.id, [])
  for (const item of items) {
    const colId = getColumnId(item)
    if (itemsByColumn.has(colId)) itemsByColumn.get(colId)!.push(item)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={`kanban-board ${className}`.trim()} role="region" aria-label="Kanban board">
        <div className="kanban-columns">
          {columns.map((col) => (
            <KanbanColumnComponent
              key={col.id}
              column={col}
              columnItems={itemsByColumn.get(col.id) ?? []}
              getItemId={getItemId}
              getCardColor={getCardColor}
              renderCard={renderCard}
              emptyMessage={emptyMessage}
            />
          ))}
        </div>
      </div>
    </DndContext>
  )
}

interface KanbanColumnComponentProps<T> {
  column: KanbanColumn
  columnItems: T[]
  getItemId: (item: T) => string
  getCardColor?: (item: T) => string | undefined
  renderCard: (item: T, options: { isDragging: boolean }) => ReactNode
  emptyMessage: string
}

function KanbanColumnComponent<T>({
  column,
  columnItems,
  getItemId,
  getCardColor,
  renderCard,
  emptyMessage,
}: KanbanColumnComponentProps<T>) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-column--over' : ''}`}
      data-column-id={column.id}
    >
      <div
        className="kanban-column-header"
        style={column.color ? { borderTopColor: column.color } : undefined}
      >
        <span className="kanban-column-title">{column.label}</span>
        <span className="kanban-column-count" aria-hidden>{columnItems.length}</span>
      </div>
      <div className="kanban-column-cards">
        {columnItems.length === 0 ? (
          <p className="kanban-column-empty">{emptyMessage}</p>
        ) : (
          columnItems.map((item) => (
            <KanbanCardWrapper
              key={getItemId(item)}
              item={item}
              getItemId={getItemId}
              getCardColor={getCardColor}
              columnColor={column.color}
              renderCard={renderCard}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface KanbanCardWrapperProps<T> {
  item: T
  getItemId: (item: T) => string
  getCardColor?: (item: T) => string | undefined
  columnColor?: string
  renderCard: (item: T, options: { isDragging: boolean }) => ReactNode
}

function KanbanCardWrapper<T>({
  item,
  getItemId,
  getCardColor,
  columnColor,
  renderCard,
}: KanbanCardWrapperProps<T>) {
  const id = getItemId(item)
  const accentColor = getCardColor?.(item) ?? columnColor
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`kanban-card-wrap ${isDragging ? 'kanban-card-wrap--dragging' : ''}`}
      style={accentColor ? { ['--kanban-card-accent' as string]: accentColor } : undefined}
    >
      <div className="kanban-card" {...listeners} {...attributes}>
        {renderCard(item, { isDragging })}
      </div>
    </div>
  )
}
