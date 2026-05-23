import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  title: string
  message: string
  variant?: 'success' | 'info'
  onClose: () => void
}

export default function AdminNoticeModal({
  open,
  title,
  message,
  variant = 'success',
  onClose,
}: Props) {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="admin-modal-backdrop admin-modal-backdrop--portal admin-modal-backdrop--notice"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`admin-modal card admin-modal--notice admin-modal--notice-${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-notice-modal-title"
        aria-describedby="admin-notice-modal-body"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="admin-notice-modal-title" className="admin-modal-title admin-notice-modal-title">
          {title}
        </h2>
        <p id="admin-notice-modal-body" className="admin-notice-modal-body">
          {message}
        </p>
        <div className="admin-modal-actions admin-notice-modal-actions">
          <button ref={okRef} type="button" className="btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
