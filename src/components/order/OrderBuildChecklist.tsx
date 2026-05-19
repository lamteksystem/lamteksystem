import { Link } from 'react-router-dom'
import {
  checklistFindUnitsLabel,
  type ChecklistGroup,
  type ChecklistGroupId,
} from '@/lib/orderChecklist'

interface OrderBuildChecklistProps {
  groups: ChecklistGroup[]
  componentHref: (group: ChecklistGroup) => string
  unitsHref: (group: ChecklistGroup) => string
  onToggleComplete: (groupId: ChecklistGroupId) => void
}

export default function OrderBuildChecklist({
  groups,
  componentHref,
  unitsHref,
  onToggleComplete,
}: OrderBuildChecklistProps) {
  if (groups.length === 0) return null

  const completedCount = groups.filter((g) => g.is_complete).length

  return (
    <details className="order-build-checklist card" aria-label="Checklist">
      <summary className="order-build-checklist-summary">
        <span className="order-build-checklist-summary-title">Checklist</span>
        <span className="order-build-checklist-summary-meta admin-muted">
          Optional · {completedCount}/{groups.length} ticked
        </span>
      </summary>

      <div className="order-build-checklist-body">
        <p className="admin-muted order-build-checklist-intro">
          Tick each section when you have added everything you need. Cart items do not tick sections
          automatically.
        </p>
        <ul className="order-build-checklist-list">
          {groups.map((g) => (
            <li
              key={g.id}
              className={`order-build-checklist-item${g.is_complete ? ' order-build-checklist-item--done' : ''}`}
            >
              <div className="order-build-checklist-item-main">
                <button
                  type="button"
                  className="order-build-checklist-toggle"
                  onClick={() => onToggleComplete(g.id)}
                  aria-pressed={g.is_complete}
                  aria-label={
                    g.is_complete
                      ? `Mark ${g.title} as not complete`
                      : `Mark ${g.title} as complete`
                  }
                  title={g.is_complete ? 'Mark as not complete' : 'Mark as complete'}
                >
                  <span className="order-build-checklist-status" aria-hidden>
                    {g.is_complete ? '✓' : '○'}
                  </span>
                </button>
                <div className="order-build-checklist-copy">
                  <strong>{g.title}</strong>
                  {!g.is_complete && g.hint ? (
                    <p className="order-build-checklist-hint">{g.hint}</p>
                  ) : null}
                  {!g.is_complete && g.matched_examples.length > 0 ? (
                    <p className="order-build-checklist-hint order-build-checklist-hint--cart">
                      Items in your cart may relate to this section (e.g.{' '}
                      {g.matched_examples.join(', ')}) — tick when you are finished.
                    </p>
                  ) : null}
                  {g.is_complete && g.matched_examples[0] ? (
                    <p className="order-build-checklist-hint">{g.matched_examples[0]}</p>
                  ) : null}
                </div>
              </div>
              {!g.is_complete && (
                <div className="order-build-checklist-actions">
                  <Link to={componentHref(g)} className="btn btn-outline btn-small">
                    Add parts
                  </Link>
                  <Link to={unitsHref(g)} className="btn btn-outline btn-small">
                    {checklistFindUnitsLabel(g)}
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
