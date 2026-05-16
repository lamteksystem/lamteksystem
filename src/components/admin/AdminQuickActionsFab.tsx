import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, FileText, Plus, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

const HIDE_PATHS = new Set(['/admin/create-order', '/admin/create-quote'])

function shouldHideFab(pathname: string): boolean {
  if (HIDE_PATHS.has(pathname)) return true
  if (/\/(invoice|quote|packing-slip)$/.test(pathname)) return true
  return false
}

export default function AdminQuickActionsFab() {
  const { allowed: canViewOrders } = usePermission('admin.orders', 'view')
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const hidden = !canViewOrders || shouldHideFab(location.pathname)

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden, location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (hidden) return null

  return (
    <>
      {open && (
        <button
          type="button"
          className="admin-fab-backdrop"
          aria-label="Close quick actions"
          onClick={() => setOpen(false)}
        />
      )}
      <div className={`admin-fab-root${open ? ' admin-fab-root--open' : ''}`}>
        <div id="admin-fab-menu" className="admin-fab-menu" role="menu" aria-hidden={!open}>
          <Link
            to="/admin/create-quote"
            role="menuitem"
            className="admin-fab-menu-item admin-fab-menu-item--quote"
            onClick={() => setOpen(false)}
          >
            <FileText size={18} strokeWidth={2} aria-hidden />
            <span>
              <strong>Create quote</strong>
              <small>Pricing proposal for customer</small>
            </span>
          </Link>
          <Link
            to="/admin/create-order"
            role="menuitem"
            className="admin-fab-menu-item admin-fab-menu-item--order"
            onClick={() => setOpen(false)}
          >
            <ClipboardList size={18} strokeWidth={2} aria-hidden />
            <span>
              <strong>Create order</strong>
              <small>Draft order to process now</small>
            </span>
          </Link>
        </div>
        <button
          type="button"
          className="admin-fab-trigger"
          aria-expanded={open}
          aria-controls="admin-fab-menu"
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} strokeWidth={2.5} aria-hidden /> : <Plus size={24} strokeWidth={2.5} aria-hidden />}
        </button>
      </div>
    </>
  )
}
