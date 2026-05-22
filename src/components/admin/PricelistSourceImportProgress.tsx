export type PricelistSourceImportProgressState = {
  percent: number
  label: string
  fileName?: string
}

export default function PricelistSourceImportProgress({
  progress,
}: {
  progress: PricelistSourceImportProgressState | null | undefined
}) {
  if (!progress) return null
  const pct = Math.min(100, Math.max(0, progress.percent))

  return (
    <div className="admin-pricelist-import-progress" aria-live="polite">
      <div
        className="admin-import-progress-bar"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progress.label}
      >
        <div className="admin-import-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="admin-import-progress-text">
        {progress.fileName ? (
          <span className="admin-pricelist-import-filename" title={progress.fileName}>
            {progress.fileName}
            {' · '}
          </span>
        ) : null}
        {progress.label}
        {pct < 100 ? ` (${Math.round(pct)}%)` : ''}
      </p>
    </div>
  )
}
