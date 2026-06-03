import AdminNoticeModal from '@/components/admin/AdminNoticeModal'
import type { PrePublishReport, ValidationIssue } from '@/lib/workbenchReadiness'

type Props = {
  open: boolean
  report: PrePublishReport | null
  computingGaps?: boolean
  onClose: () => void
  onFilterSample?: (sample: string) => void
}

function ReadinessBar({ percent }: { percent: number }) {
  const tone = percent >= 80 ? 'ok' : percent >= 50 ? 'mid' : 'low'
  return (
    <div className={`workbench-readiness-bar workbench-readiness-bar--${tone}`}>
      <div className="workbench-readiness-bar__track" aria-hidden>
        <span className="workbench-readiness-bar__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="workbench-readiness-bar__label">
        <strong>{percent}%</strong> publish readiness
      </span>
    </div>
  )
}

function IssueBlock({
  issue,
  onFilterSample,
}: {
  issue: ValidationIssue
  onFilterSample?: (sample: string) => void
}) {
  return (
    <li className={`workbench-pre-publish-issue workbench-pre-publish-issue--${issue.severity}`}>
      <span className="workbench-pre-publish-issue__count">{issue.count}</span>
      <div>
        <strong>{issue.description}</strong>
        {issue.samples.length > 0 && (
          <ul className="workbench-pre-publish-issue__samples">
            {issue.samples.map((s) => (
              <li key={s}>
                {onFilterSample ? (
                  <button type="button" className="btn-link" onClick={() => onFilterSample(s)}>
                    {s}
                  </button>
                ) : (
                  s
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function WorkbenchPrePublishModal({
  open,
  report,
  computingGaps = false,
  onClose,
  onFilterSample,
}: Props) {
  if (!open || !report) return null

  const { readiness, issues, bomGaps } = report
  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warn')

  return (
    <AdminNoticeModal
      open
      title="Pre-publish readiness"
      onClose={onClose}
      variant={errors.length ? 'warning' : 'success'}
      message={
        <div className="workbench-pre-publish-modal">
          <ReadinessBar percent={readiness.overallPercent} />
          <dl className="workbench-readiness-stats">
            <div>
              <dt>Named</dt>
              <dd>
                {readiness.named.ok}/{readiness.named.total} ({readiness.named.percent}%)
              </dd>
            </div>
            <div>
              <dt>Categorised</dt>
              <dd>
                {readiness.categorised.ok}/{readiness.categorised.total} ({readiness.categorised.percent}%)
              </dd>
            </div>
            <div>
              <dt>Tealbury completes with BOM</dt>
              <dd>
                {readiness.tealburyCompletesWithBom.ok}/{readiness.tealburyCompletesWithBom.total} (
                {readiness.tealburyCompletesWithBom.percent}%)
              </dd>
            </div>
            <div>
              <dt>Panel-like → accessory</dt>
              <dd>
                {readiness.panelLikeAccessoryKind.ok}/{readiness.panelLikeAccessoryKind.total} (
                {readiness.panelLikeAccessoryKind.percent}%)
              </dd>
            </div>
          </dl>

          {errors.length > 0 && (
            <>
              <h3 className="workbench-pre-publish-heading">Must fix ({errors.length})</h3>
              <ul className="workbench-pre-publish-issues">
                {errors.map((issue) => (
                  <IssueBlock key={issue.kind} issue={issue} onFilterSample={onFilterSample} />
                ))}
              </ul>
            </>
          )}

          {warns.length > 0 && (
            <>
              <h3 className="workbench-pre-publish-heading">Recommended ({warns.length})</h3>
              <ul className="workbench-pre-publish-issues">
                {warns.map((issue) => (
                  <IssueBlock key={issue.kind} issue={issue} onFilterSample={onFilterSample} />
                ))}
              </ul>
            </>
          )}

          {issues.length === 0 && (
            <p className="admin-muted">No validation issues detected on this draft.</p>
          )}

          <h3 className="workbench-pre-publish-heading">BOM &amp; component gaps</h3>
          {computingGaps ? (
            <p className="admin-muted">Computing gaps across Tealbury completes…</p>
          ) : bomGaps ? (
            <>
              <p className="admin-muted">
                {bomGaps.okCount} of {bomGaps.completeCount} complete unit(s) resolve a full draft BOM ·{' '}
                {bomGaps.failedCount} failed
              </p>
              {bomGaps.groups.length > 0 ? (
                <ul className="workbench-bom-gap-groups">
                  {bomGaps.groups.slice(0, 12).map((g) => (
                    <li key={g.reason}>
                      <strong>
                        {g.count}× {g.reason}
                      </strong>
                      {g.samples.length > 0 && (
                        <span className="admin-muted"> — e.g. {g.samples.slice(0, 3).join('; ')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-muted">All completes resolved a BOM.</p>
              )}
              {bomGaps.groups.length > 12 && (
                <p className="admin-muted">…and {bomGaps.groups.length - 12} more gap type(s).</p>
              )}
            </>
          ) : null}
        </div>
      }
    />
  )
}
