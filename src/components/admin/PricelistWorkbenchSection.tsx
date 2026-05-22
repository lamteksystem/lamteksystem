import type { ReactNode } from 'react'
import { AdminHelpTip } from '@/components/admin/AdminHelpTip'

type Props = {
  id: string
  title: string
  summary?: string
  tip?: string
  defaultOpen?: boolean
  badge?: string | number
  children: ReactNode
}

export default function PricelistWorkbenchSection({
  id,
  title,
  summary,
  tip,
  defaultOpen = true,
  badge,
  children,
}: Props) {
  return (
    <details id={id} className="admin-workbench-section admin-modal-card" open={defaultOpen}>
      <summary className="admin-workbench-section-summary">
        <span className="admin-workbench-section-title">
          {title}
          {tip ? <AdminHelpTip text={tip} className="admin-workbench-section-tip" /> : null}
          {badge != null && badge !== '' ? (
            <span className="admin-workbench-section-badge">{badge}</span>
          ) : null}
        </span>
        {summary ? <span className="admin-muted admin-workbench-section-summary-text">{summary}</span> : null}
      </summary>
      <div className="admin-workbench-section-body">{children}</div>
    </details>
  )
}
