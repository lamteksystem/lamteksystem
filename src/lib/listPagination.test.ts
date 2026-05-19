import { describe, expect, it } from 'vitest'
import { normalizePageSize, paginationRange, paginateSlice, PAGE_SIZE_OPTIONS } from './listPagination'

describe('normalizePageSize', () => {
  it('returns exact matches from PAGE_SIZE_OPTIONS', () => {
    for (const n of PAGE_SIZE_OPTIONS) expect(normalizePageSize(n)).toBe(n)
  })
})

describe('paginationRange', () => {
  it('computes range for a middle page', () => {
    expect(paginationRange(100, 2, 20)).toEqual({ totalPages: 5, currentPage: 2, rangeStart: 21, rangeEnd: 40 })
  })
})

describe('paginateSlice', () => {
  it('returns the correct slice', () => {
    expect(paginateSlice(['a', 'b', 'c', 'd', 'e'], 2, 2)).toEqual(['c', 'd'])
  })
})
