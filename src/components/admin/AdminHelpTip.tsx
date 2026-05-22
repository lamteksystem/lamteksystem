/**
 * Accessible help tooltip for admin UI. Prefer this over bare `title` for longer explanations.
 */
export function AdminHelpTip({
  text,
  label = 'More information',
  className = '',
}: {
  text: string
  label?: string
  className?: string
}) {
  return (
    <span className={`admin-help-tip ${className}`.trim()} tabIndex={0} aria-label={text}>
      <span className="admin-help-tip-icon" aria-hidden title="">
        ?
      </span>
      <span className="admin-help-tip-popup" role="tooltip">
        {text}
      </span>
      <span className="visually-hidden">{label}: {text}</span>
    </span>
  )
}

/** Label + optional help icon inline (for form fields, section titles). */
export function AdminLabelWithTip({
  label,
  tip,
  htmlFor,
}: {
  label: string
  tip?: string
  htmlFor?: string
}) {
  return (
    <span className="admin-label-with-tip">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      {tip ? <AdminHelpTip text={tip} /> : null}
    </span>
  )
}
