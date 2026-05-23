import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type PopupPos = { top: number; left: number }

/**
 * Accessible help tooltip for admin UI. Renders the popup in a portal so it is not clipped by table scroll areas.
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
  const tipId = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<PopupPos | null>(null)

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxW = Math.min(320, window.innerWidth - 16)
    let left = rect.left + rect.width / 2 - maxW / 2
    left = Math.max(8, Math.min(left, window.innerWidth - maxW - 8))
    let top = rect.top - 8
    const estimatedHeight = 72
    if (top < estimatedHeight + 8) {
      top = rect.bottom + 8
    } else {
      top = rect.top - estimatedHeight - 8
    }
    setPos({ top, left })
  }, [])

  const show = useCallback(() => {
    updatePosition()
    setVisible(true)
  }, [updatePosition])

  const hide = useCallback(() => setVisible(false), [])

  useEffect(() => {
    if (!visible) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [visible, updatePosition])

  return (
    <>
      <span
        ref={anchorRef}
        className={`admin-help-tip ${className}`.trim()}
        tabIndex={0}
        aria-describedby={visible ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <span className="admin-help-tip-icon" aria-hidden>
          ?
        </span>
        <span className="visually-hidden">{label}: {text}</span>
      </span>
      {visible && pos
        ? createPortal(
            <span
              id={tipId}
              className="admin-help-tip-popup admin-help-tip-popup--portal"
              role="tooltip"
              style={{ top: pos.top, left: pos.left, maxWidth: Math.min(320, window.innerWidth - 16) }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
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
