import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'

type Props = {
  id: string
  title: string
  summary?: string
  tip?: string
  defaultOpen?: boolean
  badge?: string | number
  /** Toolbar rendered in the header row (filters, scroll buttons, etc.) */
  headerExtra?: ReactNode
  children: ReactNode
}

export default function PricelistWorkbenchSection({
  id,
  title,
  summary,
  tip,
  defaultOpen = true,
  badge,
  headerExtra,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id} className="admin-workbench-section admin-modal-card">
      <header className="admin-workbench-section-header">
        <div className="admin-workbench-section-header-main">
          <h2 className="admin-workbench-section-title">
            {title}
            {tip ? <AdminHelpTip text={tip} className="admin-workbench-section-tip" /> : null}
            {badge != null && badge !== '' ? (
              <span className="admin-workbench-section-badge">{badge}</span>
            ) : null}
          </h2>
          {summary ? (
            <p className="admin-muted admin-workbench-section-summary-text">{summary}</p>
          ) : null}
        </div>
        {headerExtra ? <div className="admin-workbench-section-header-extra">{headerExtra}</div> : null}
        <button
          type="button"
          className="admin-workbench-section-chevron"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          title={open ? 'Collapse section' : 'Expand section'}
        >
          {open ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
        </button>
      </header>
      {open ? <div id={`${id}-body`} className="admin-workbench-section-body">{children}</div> : null}
    </section>
  )
}
