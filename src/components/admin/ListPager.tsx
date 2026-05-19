import { useEffect, useState } from 'react'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/lib/listPagination'

export interface ListPagerProps {
  totalItems: number
  totalPages: number
  currentPage: number
  pageSize: PageSize
  rangeStart: number
  rangeEnd: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  disabled?: boolean
  itemLabel?: string
  ariaLabel?: string
  className?: string
}

export default function ListPager({
  totalItems,
  totalPages,
  currentPage,
  pageSize,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  itemLabel = 'items',
  ariaLabel = 'List pages',
  className,
}: ListPagerProps) {
  const [pageInput, setPageInput] = useState(String(currentPage))
  useEffect(() => { setPageInput(String(currentPage)) }, [currentPage])
  if (totalItems === 0) return null
  function goToPage(n: number) {
    onPageChange(Math.max(1, Math.min(totalPages, Math.floor(n) || 1)))
  }
  return (
    <div className={`admin-list-pager${className ? ` ${className}` : ''}`} role="navigation" aria-label={ariaLabel}>
      <label className="admin-list-pager-pagesize">Per page
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)} disabled={disabled}>
          {PAGE_SIZE_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
      </label>
      <button type="button" className="btn btn-outline btn-small" onClick={() => goToPage(1)} disabled={disabled || currentPage === 1} aria-label="First page">«</button>
      <button type="button" className="btn btn-outline btn-small" onClick={() => goToPage(currentPage - 1)} disabled={disabled || currentPage === 1} aria-label="Previous page">‹ Prev</button>
      <span className="admin-list-pager-page-input">Page
        <input type="number" min={1} max={totalPages} value={pageInput} onChange={(e) => setPageInput(e.target.value)} onBlur={() => goToPage(Number(pageInput))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goToPage(Number(pageInput)) } }} disabled={disabled} aria-label="Go to page" />
        of <strong>{totalPages}</strong>
      </span>
      <button type="button" className="btn btn-outline btn-small" onClick={() => goToPage(currentPage + 1)} disabled={disabled || currentPage === totalPages} aria-label="Next page">Next ›</button>
      <button type="button" className="btn btn-outline btn-small" onClick={() => goToPage(totalPages)} disabled={disabled || currentPage === totalPages} aria-label="Last page">»</button>
      <span className="admin-muted admin-list-pager-range">Showing {rangeStart}–{rangeEnd} of {totalItems} {itemLabel}</span>
    </div>
  )
}
