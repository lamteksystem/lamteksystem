import AdminNoticeModal from '@/components/admin/AdminNoticeModal'

export type WorkbenchActionReport = {
  title: string
  summary: string
  lines: string[]
  variant?: 'ok' | 'warn'
}

type Props = {
  report: WorkbenchActionReport | null
  onClose: () => void
}

export default function WorkbenchActionReportModal({ report, onClose }: Props) {
  if (!report) return null
  return (
    <AdminNoticeModal
      open
      title={report.title}
      onClose={onClose}
      variant={report.variant === 'warn' ? 'warning' : 'success'}
      message={
        <>
          <p>{report.summary}</p>
          {report.lines.length > 0 && (
            <ul className="admin-pricelist-action-report-list">
              {report.lines.slice(0, 30).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {report.lines.length > 30 && (
            <p className="admin-muted">…and {report.lines.length - 30} more lines.</p>
          )}
        </>
      }
    />
  )
}
