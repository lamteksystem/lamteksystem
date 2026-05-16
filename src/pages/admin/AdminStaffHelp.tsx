import { useMemo } from 'react'
import manualSource from '../../../docs/STAFF_HELP_MANUAL.md?raw'
import { renderStaffManualMarkdown } from '@/lib/staffManualMarkdown'

export default function AdminStaffHelp() {
  const content = useMemo(() => renderStaffManualMarkdown(manualSource), [])

  return (
    <div className="admin-page admin-staff-manual-page">
      <p className="page-intro">
        Staff and partner manual — ordering portal workflows, customer pricing, catalogue, stock, and troubleshooting.
        This page updates when <code>docs/STAFF_HELP_MANUAL.md</code> changes in the repository.
      </p>
      <article className="staff-manual card admin-card">{content}</article>
    </div>
  )
}
