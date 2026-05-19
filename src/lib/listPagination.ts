import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 250, 500, 1000] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export function normalizePageSize(n: number): PageSize {
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n as PageSize
  let best: PageSize = PAGE_SIZE_OPTIONS[0]
  let bestDist = Infinity
  for (const opt of PAGE_SIZE_OPTIONS) {
    const dist = Math.abs(opt - n)
    if (dist < bestDist) {
      bestDist = dist
      best = opt
    }
  }
  return best
}

export function paginationRange(totalItems: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, totalItems)
  return { totalPages, currentPage, rangeStart, rangeEnd }
}

export function paginateSlice<T>(items: readonly T[], currentPage: number, pageSize: number): T[] {
  const start = (currentPage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function useListPagination<T>(
  items: readonly T[],
  options?: { defaultPageSize?: PageSize; resetDeps?: readonly unknown[] },
) {
  const [pageSize, setPageSizeState] = useState<PageSize>(
    () => options?.defaultPageSize ?? PAGE_SIZE_OPTIONS[0],
  )
  const [page, setPage] = useState(1)
  const totalItems = items.length
  const { totalPages, currentPage, rangeStart, rangeEnd } = useMemo(
    () => paginationRange(totalItems, page, pageSize),
    [totalItems, page, pageSize],
  )
  const resetKey = JSON.stringify(options?.resetDeps ?? [])
  useEffect(() => {
    setPage(1)
  }, [pageSize, resetKey])
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [page, currentPage])
  const pageItems = useMemo(
    () => paginateSlice(items, currentPage, pageSize),
    [items, currentPage, pageSize],
  )
  function goToPage(n: number) {
    setPage(Math.max(1, Math.min(totalPages, Math.floor(n) || 1)))
  }
  function setPageSize(size: PageSize) {
    setPageSizeState(size)
    setPage(1)
  }
  return {
    pageItems,
    totalItems,
    totalPages,
    currentPage,
    pageSize,
    setPageSize,
    rangeStart,
    rangeEnd,
    goToPage,
  }
}
